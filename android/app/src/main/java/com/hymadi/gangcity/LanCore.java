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
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

/**
 * اللعب المحلي (القسم 16): اتصالات الشبكة المحلية بجافا وحدها بلا مكتبات، فتُختبر خارج أندرويد أيضاً.
 * المضيف: خادم TCP يقبل المنضمين، وإعلان UDP على الشبكة كل ثانية ليظهر عند من يبحث.
 * المنضم: يستمع للإعلانات، ويسأل أيضاً كل عنوان في شبكته (/24) على منفذ المضيف كل بضع ثوانٍ، فتظهر المباراة
 * ولو منعت الشبكة البث. المضيف يجيب السؤال بسطر الإعلان نفسه ويغلق، ولا تعرف اللعبة به.
 * ثم يتصل المنضم بالمضيف. كل رسالة نص (JSON) في سطر واحد.
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
    static final String PROBE = "GANGCITY?";           // سؤال البحث: أول سطر من اتصال لا يريد اللعب
    static final int FIRST_LINE_MS = 5000;             // اتصال صامت لا يُنتظر أكثر من هذا
    static final int SCAN_THREADS = 32;

    private final Listener listener;
    private final Map<Integer, Conn> conns = new ConcurrentHashMap<>();
    private final AtomicInteger nextId = new AtomicInteger(1);
    private ServerSocket server;
    private DatagramSocket beaconSocket;
    private ScheduledExecutorService beaconTimer;
    private DatagramSocket discoverSocket;
    private volatile String probeReply;                // المضيف: سطر الإعلان جواباً للسؤال
    private ScheduledExecutorService scanTimer;
    private ExecutorService scanPool;

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
                    // يُسجَّل الاتصال ويُعلن عنه بعد أول سطر منه (سؤال البحث يُجاب ويُغلق بلا إعلان)
                    Socket socket = s.accept();
                    new Conn(nextId.getAndIncrement(), socket, true).start();
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
        probeReply = null;
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
        probeReply = BEACON_TAG + "|" + version + "|" + tcpPort + "|" + name;
        final byte[] msg = probeReply.getBytes(StandardCharsets.UTF_8);
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
        stopScan();
        if (discoverSocket != null) { discoverSocket.close(); discoverSocket = null; }
    }

    /** يسأل كل عناوين شبكات هذا الجهاز على منفذ المضيف، كل periodMs (حتى stopDiscovery) */
    void startScan(int port, long periodMs, int timeoutMs) {
        startScan(port, periodMs, timeoutMs, LanCore::scanTargets);
    }

    /** targets: العناوين المسؤولة في كل جولة (الاختبار يعطيها بنفسه) */
    synchronized void startScan(int port, long periodMs, int timeoutMs, Supplier<List<String>> targets) {
        stopScan();
        final ExecutorService pool = Executors.newFixedThreadPool(SCAN_THREADS);
        scanPool = pool;
        scanTimer = Executors.newSingleThreadScheduledExecutor();
        scanTimer.scheduleWithFixedDelay(() -> {
            List<Future<?>> jobs = new ArrayList<>();
            for (String ip : targets.get()) {
                try {
                    jobs.add(pool.submit(() -> probe(ip, port, timeoutMs)));
                } catch (RejectedExecutionException e) {
                    return;
                }
            }
            for (Future<?> job : jobs) {          // الجولة التالية بعد انتهاء هذه
                try { job.get(); } catch (Exception e) { return; }
            }
        }, 0, periodMs, TimeUnit.MILLISECONDS);
    }

    synchronized void stopScan() {
        if (scanTimer != null) { scanTimer.shutdownNow(); scanTimer = null; }
        if (scanPool != null) { scanPool.shutdownNow(); scanPool = null; }
    }

    /** هل في هذا العنوان مضيف؟ يجيب بسطر الإعلان فيُعلن عنه كما لو وصل إعلانه */
    boolean probe(String ip, int port, int timeoutMs) {
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress(ip, port), timeoutMs);
            s.setSoTimeout(timeoutMs * 3);
            OutputStream o = s.getOutputStream();
            o.write((PROBE + "\n").getBytes(StandardCharsets.UTF_8));
            o.flush();
            String line = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8)).readLine();
            if (line == null) return false;
            String[] parts = line.split("\\|", 4);
            if (parts.length != 4 || !BEACON_TAG.equals(parts[0])) return false;
            listener.onFound(parts[3], ip, Integer.parseInt(parts[2]), parts[1]);
            return true;
        } catch (IOException | NumberFormatException e) {
            return false;
        }
    }

    /** عناوين /24 حول عناوين هذا الجهاز على الشبكات التي لها عنوان بث (واي فاي ونقطة اتصال، لا بيانات الجوال) */
    static List<String> scanTargets() {
        List<String> list = new ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InterfaceAddress ia : ni.getInterfaceAddresses()) {
                    InetAddress a = ia.getAddress();
                    if (!(a instanceof Inet4Address) || ia.getBroadcast() == null || !a.isSiteLocalAddress()) continue;
                    byte[] b = a.getAddress();
                    String prefix = (b[0] & 255) + "." + (b[1] & 255) + "." + (b[2] & 255) + ".";
                    for (int h = 1; h < 255; h++) {
                        String ip = prefix + h;
                        if (h != (b[3] & 255) && !list.contains(ip)) list.add(ip);
                    }
                }
            }
        } catch (Exception ignored) { }
        return list;
    }

    /** يتصل بالمضيف (يحجز الخيط حتى ينجح أو تنتهي المهلة) */
    void connect(String ip, int port, int timeoutMs) throws IOException {
        Conn old = conns.get(0);
        if (old != null) old.close(false);
        Socket socket = new Socket();
        socket.connect(new InetSocketAddress(ip, port), timeoutMs);
        Conn c = new Conn(0, socket, false);
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
        stopDiscovery();           // والسؤال معه
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

    /** اتصال واحد: قارئ أسطر في خيطه، وكاتب واحد بالترتيب في خيطه.
     *  incoming: اتصال وصل للمضيف، يُسجَّل ويُعلن عنه بعد أول سطر (إلا سؤال البحث) */
    private final class Conn {
        final int id;
        final Socket socket;
        final OutputStream out;
        final boolean incoming;
        final ExecutorService writer = Executors.newSingleThreadExecutor();
        private boolean open = true;
        private volatile boolean known;          // أعلنّا عنه للعبة (فيُعلن انقطاعه)

        Conn(int id, Socket socket, boolean incoming) throws IOException {
            this.id = id;
            this.socket = socket;
            this.incoming = incoming;
            this.known = !incoming;
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
                if (incoming) {
                    socket.setSoTimeout(FIRST_LINE_MS);
                    line = in.readLine();
                    socket.setSoTimeout(0);
                    if (line == null) { close(false); return; }
                    if (PROBE.equals(line)) { answerProbe(); return; }
                    conns.put(id, this);
                    known = true;
                    listener.onPeer(id, socket.getInetAddress().getHostAddress());
                    if (!line.isEmpty()) listener.onMessage(id, line);
                }
                while ((line = in.readLine()) != null) {
                    if (!line.isEmpty()) listener.onMessage(id, line);
                }
            } catch (SocketTimeoutException e) {
                close(false);                       // اتصال صامت: ليس من اللعبة
                return;
            } catch (IOException ignored) { }
            close(true);
        }

        private void answerProbe() {
            String reply = probeReply;
            if (reply != null) {
                try {
                    out.write((reply + "\n").getBytes(StandardCharsets.UTF_8));
                    out.flush();
                } catch (IOException ignored) { }
            }
            close(false);
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
            if (notify && known) listener.onClosed(id);
        }
    }
}
