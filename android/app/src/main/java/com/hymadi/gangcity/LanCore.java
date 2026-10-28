package com.hymadi.gangcity;

import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * اللعب المحلي (القسم 16): اتصالات الشبكة المحلية بجافا وحدها بلا مكتبات، فتُختبر خارج أندرويد أيضاً.
 * المضيف: خادم TCP يقبل المنضمين، وإعلان UDP على الشبكة كل ثانية ليظهر عند من يبحث.
 * المنضم: يستمع للإعلانات، ثم يتصل بالمضيف. كل رسالة نص (JSON) في سطر واحد.
 * أرقام الاتصالات: المنضمون عند المضيف من 1، والمضيف عند المنضم 0.
 */
final class LanCore {

    interface Listener {
        void onPeer(int id, String address);
        void onMessage(int id, String data);
        void onClosed(int id);
        void onFound(String name, String ip, int port, String version);
    }

    static final String BEACON_TAG = "GANGCITY";

    private final Listener listener;
    private final Map<Integer, Conn> conns = new ConcurrentHashMap<>();
    private final AtomicInteger nextId = new AtomicInteger(1);
    private ServerSocket server;
    private DatagramSocket beaconSocket;
    private ScheduledExecutorService beaconTimer;
    private DatagramSocket discoverSocket;

    LanCore(Listener listener) {
        this.listener = listener;
    }

    // --- المضيف ---

    /** يبدأ الخادم على أول منفذ متاح من basePort فما بعده، ويعيد المنفذ */
    synchronized int startServer(int basePort) throws IOException {
        stopServer();
        IOException last = new IOException("لا منفذ متاح");
        for (int port = basePort; port < basePort + 10 && server == null; port++) {
            try {
                ServerSocket s = new ServerSocket();
                s.setReuseAddress(true);
                s.bind(new InetSocketAddress(port));
                server = s;
            } catch (IOException e) {
                last = e;
            }
        }
        if (server == null) throw last;
        final ServerSocket s = server;
        Thread accept = new Thread(() -> {
            while (!s.isClosed()) {
                try {
                    Socket socket = s.accept();
                    Conn c = new Conn(nextId.getAndIncrement(), socket);
                    conns.put(c.id, c);
                    listener.onPeer(c.id, socket.getInetAddress().getHostAddress());
                    c.start();
                } catch (IOException e) {
                    if (s.isClosed()) break;
                }
            }
        }, "lan-accept");
        accept.setDaemon(true);
        accept.start();
        return s.getLocalPort();
    }

    synchronized void stopServer() {
        if (server != null) {
            try { server.close(); } catch (IOException ignored) { }
            server = null;
        }
        for (Conn c : new ArrayList<>(conns.values())) if (c.id != 0) c.close(false);
    }

    /** إعلان "GANGCITY|النسخة|المنفذ|الاسم" على كل عناوين البث كل periodMs */
    synchronized void startBeacon(String name, String version, int tcpPort, int beaconPort, long periodMs) throws IOException {
        stopBeacon();
        final DatagramSocket socket = new DatagramSocket();
        socket.setBroadcast(true);
        beaconSocket = socket;
        final byte[] msg = (BEACON_TAG + "|" + version + "|" + tcpPort + "|" + name).getBytes(StandardCharsets.UTF_8);
        beaconTimer = Executors.newSingleThreadScheduledExecutor();
        beaconTimer.scheduleAtFixedRate(() -> {
            for (InetAddress addr : broadcastAddresses()) {
                try {
                    socket.send(new DatagramPacket(msg, msg.length, addr, beaconPort));
                } catch (IOException ignored) { }
            }
        }, 0, periodMs, TimeUnit.MILLISECONDS);
    }

    synchronized void stopBeacon() {
        if (beaconTimer != null) { beaconTimer.shutdownNow(); beaconTimer = null; }
        if (beaconSocket != null) { beaconSocket.close(); beaconSocket = null; }
    }

    // --- المنضم ---

    synchronized void startDiscovery(int beaconPort) throws IOException {
        stopDiscovery();
        final DatagramSocket s = new DatagramSocket(null);
        s.setReuseAddress(true);
        s.setBroadcast(true);
        s.bind(new InetSocketAddress(beaconPort));
        discoverSocket = s;
        Thread t = new Thread(() -> {
            byte[] buf = new byte[512];
            while (!s.isClosed()) {
                try {
                    DatagramPacket p = new DatagramPacket(buf, buf.length);
                    s.receive(p);
                    String text = new String(p.getData(), 0, p.getLength(), StandardCharsets.UTF_8);
                    String[] parts = text.split("\\|", 4);
                    if (parts.length == 4 && BEACON_TAG.equals(parts[0])) {
                        listener.onFound(parts[3], p.getAddress().getHostAddress(), Integer.parseInt(parts[2]), parts[1]);
                    }
                } catch (IOException | NumberFormatException e) {
                    if (s.isClosed()) break;
                }
            }
        }, "lan-discover");
        t.setDaemon(true);
        t.start();
    }

    synchronized void stopDiscovery() {
        if (discoverSocket != null) { discoverSocket.close(); discoverSocket = null; }
    }

    /** يتصل بالمضيف (يحجز الخيط حتى ينجح أو تنتهي المهلة) */
    void connect(String ip, int port, int timeoutMs) throws IOException {
        Conn old = conns.get(0);
        if (old != null) old.close(false);
        Socket socket = new Socket();
        socket.connect(new InetSocketAddress(ip, port), timeoutMs);
        Conn c = new Conn(0, socket);
        conns.put(0, c);
        listener.onPeer(0, ip);
        c.start();
    }

    // --- الطرفان ---

    /** to: رقم اتصال، أو سالب للجميع */
    void send(int to, String data) {
        if (to < 0) {
            for (Conn c : conns.values()) c.send(data);
        } else {
            Conn c = conns.get(to);
            if (c != null) c.send(data);
        }
    }

    void closePeer(int id) {
        Conn c = conns.get(id);
        if (c != null) c.close(true);
    }

    synchronized void stopAll() {
        stopBeacon();
        stopDiscovery();
        stopServer();
        Conn c = conns.get(0);
        if (c != null) c.close(false);
    }

    /** عناوين IPv4 لهذا الجهاز على الشبكات المتصلة (يعرضها المضيف لمن يكتب العنوان بيده) */
    static List<String> localIps() {
        List<String> list = new ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (a instanceof Inet4Address) list.add(a.getHostAddress());
                }
            }
        } catch (Exception ignored) { }
        return list;
    }

    static List<InetAddress> broadcastAddresses() {
        List<InetAddress> list = new ArrayList<>();
        try {
            list.add(InetAddress.getByName("255.255.255.255"));
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InterfaceAddress ia : ni.getInterfaceAddresses()) {
                    InetAddress b = ia.getBroadcast();
                    if (b != null && !list.contains(b)) list.add(b);
                }
            }
        } catch (Exception ignored) { }
        return list;
    }

    /** اتصال واحد: قارئ أسطر في خيطه، وكاتب واحد بالترتيب في خيطه */
    private final class Conn {
        final int id;
        final Socket socket;
        final OutputStream out;
        final ExecutorService writer = Executors.newSingleThreadExecutor();
        private boolean open = true;

        Conn(int id, Socket socket) throws IOException {
            this.id = id;
            this.socket = socket;
            socket.setTcpNoDelay(true);
            socket.setKeepAlive(true);
            out = new BufferedOutputStream(socket.getOutputStream(), 1 << 16);
        }

        void start() {
            Thread t = new Thread(this::read, "lan-read-" + id);
            t.setDaemon(true);
            t.start();
        }

        private void read() {
            try (BufferedReader in = new BufferedReader(
                    new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8), 1 << 16)) {
                String line;
                while ((line = in.readLine()) != null) {
                    if (!line.isEmpty()) listener.onMessage(id, line);
                }
            } catch (IOException ignored) { }
            close(true);
        }

        void send(String data) {
            final byte[] bytes = (data + "\n").getBytes(StandardCharsets.UTF_8);
            try {
                writer.execute(() -> {
                    try {
                        out.write(bytes);
                        out.flush();
                    } catch (IOException e) {
                        close(true);
                    }
                });
            } catch (RejectedExecutionException ignored) { }
        }

        void close(boolean notify) {
            synchronized (this) {
                if (!open) return;
                open = false;
            }
            writer.shutdown();
            try { socket.close(); } catch (IOException ignored) { }
            conns.remove(id, this);
            if (notify) listener.onClosed(id);
        }
    }
}
