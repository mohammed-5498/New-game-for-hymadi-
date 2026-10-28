package com.hymadi.gangcity;

import android.content.Context;
import android.net.wifi.WifiManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * اللعب المحلي (القسم 16): جسر بين اللعبة (js/net/transport.js) والشبكة المحلية (LanCore).
 * الأحداث إلى اللعبة: peer (اتصال جديد)، message (رسالة)، closed (انقطاع)، found (مضيف على الشبكة).
 * قفل البث المتعدد (MulticastLock) يُمسك أثناء الاستضافة والبحث: بعض الأجهزة لا تستقبل إعلانات البث بدونه.
 */
@CapacitorPlugin(name = "LanNet")
public class LanPlugin extends Plugin implements LanCore.Listener {

    private final LanCore core = new LanCore(this);
    private WifiManager.MulticastLock lock;

    private void holdLock(boolean on) {
        try {
            if (on) {
                if (lock == null) {
                    WifiManager wifi = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                    if (wifi == null) return;
                    lock = wifi.createMulticastLock("gangcity-lan");
                    lock.setReferenceCounted(false);
                }
                if (!lock.isHeld()) lock.acquire();
            } else if (lock != null && lock.isHeld()) {
                lock.release();
            }
        } catch (Exception ignored) { }
    }

    @PluginMethod
    public void host(PluginCall call) {
        try {
            int port = core.startServer(call.getInt("port", 47821));
            core.startBeacon(call.getString("name", ""), call.getString("version", "1"), port,
                call.getInt("beaconPort", 47820), call.getInt("beaconMs", 1000));
            holdLock(true);
            JSObject result = new JSObject();
            result.put("port", port);
            result.put("ips", new JSArray(LanCore.localIps()));
            call.resolve(result);
        } catch (Exception e) {
            call.reject("تعذر بدء الاستضافة: " + e.getMessage());
        }
    }

    @PluginMethod
    public void discover(PluginCall call) {
        try {
            core.startDiscovery(call.getInt("beaconPort", 47820));
            holdLock(true);
            call.resolve();
        } catch (Exception e) {
            call.reject("تعذر البحث عن المباريات: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopDiscover(PluginCall call) {
        core.stopDiscovery();
        call.resolve();
    }

    // الاتصال يحجز خيطه حتى ينجح أو تنتهي مهلته: في خيط مستقل حتى لا يعطل بقية الأوامر
    @PluginMethod
    public void connect(PluginCall call) {
        final String ip = call.getString("ip", "");
        final int port = call.getInt("port", 47821);
        final int timeout = call.getInt("timeoutMs", 4000);
        new Thread(() -> {
            try {
                core.connect(ip, port, timeout);
                call.resolve();
            } catch (Exception e) {
                call.reject("تعذر الاتصال بـ " + ip + ": " + e.getMessage());
            }
        }, "lan-connect").start();
    }

    @PluginMethod
    public void send(PluginCall call) {
        core.send(call.getInt("to", -1), call.getString("data", ""));
        call.resolve();
    }

    @PluginMethod
    public void closePeer(PluginCall call) {
        core.closePeer(call.getInt("id", -1));
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        core.stopAll();
        holdLock(false);
        call.resolve();
    }

    @PluginMethod
    public void localIps(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ips", new JSArray(LanCore.localIps()));
        call.resolve(result);
    }

    @Override
    protected void handleOnDestroy() {
        core.stopAll();
        holdLock(false);
    }

    // --- من الشبكة إلى اللعبة ---

    @Override
    public void onPeer(int id, String address) {
        JSObject o = new JSObject();
        o.put("id", id);
        o.put("address", address);
        notifyListeners("peer", o);
    }

    @Override
    public void onMessage(int id, String data) {
        JSObject o = new JSObject();
        o.put("id", id);
        o.put("data", data);
        notifyListeners("message", o);
    }

    @Override
    public void onClosed(int id) {
        JSObject o = new JSObject();
        o.put("id", id);
        notifyListeners("closed", o);
    }

    @Override
    public void onFound(String name, String ip, int port, String version) {
        JSObject o = new JSObject();
        o.put("name", name);
        o.put("ip", ip);
        o.put("port", port);
        o.put("version", version);
        notifyListeners("found", o);
    }
}
