package com.gangcity.gangcity

import android.content.Context
import android.net.wifi.WifiManager
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private var lock: WifiManager.MulticastLock? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 60 إطاراً بدل 90 أو 120 في الشاشات السريعة: نصف عمل المعالج وكرت الشاشة والبطارية (القسم 18.1)
        window.attributes = window.attributes.apply { preferredRefreshRate = 60f }
    }

    // اللعب المحلي (net/session.dart): قفل البث المتعدد أثناء الاستضافة والبحث، فبعض الأجهزة لا تستقبل الإعلانات بدونه
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "gangcity/lan").setMethodCallHandler { call, result ->
            try {
                if (call.method == "lock" && lock == null) {
                    val wifi = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                    lock = wifi.createMulticastLock("gangcity-lan").apply { setReferenceCounted(false); acquire() }
                } else if (call.method == "unlock") {
                    lock?.release()
                    lock = null
                }
            } catch (_: Exception) { }
            result.success(null)
        }
    }
}
