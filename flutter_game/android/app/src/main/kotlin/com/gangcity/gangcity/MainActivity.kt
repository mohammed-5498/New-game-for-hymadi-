package com.gangcity.gangcity

import android.content.Context
import android.net.wifi.WifiManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import android.webkit.WebView
import android.webkit.WebViewClient
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private var lock: WifiManager.MulticastLock? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 60 إطاراً بدل 90 أو 120 في الشاشات السريعة: نصف عمل المعالج وكرت الشاشة والبطارية (القسم 18.1)
        window.attributes = window.attributes.apply { preferredRefreshRate = 60f }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)   // الشاشة لا تنطفئ أثناء اللعب (كـ platform.js)
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        val messenger = flutterEngine.dartExecutor.binaryMessenger
        // اللعب المحلي (net/session.dart): قفل البث المتعدد أثناء الاستضافة والبحث، فبعض الأجهزة لا تستقبل الإعلانات بدونه
        MethodChannel(messenger, "gangcity/lan").setMethodCallHandler { call, result ->
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
        // نقل الحفظ من اللعبة القديمة (ui/migrate.dart): WebView مخفية بأصلها (https://localhost) تقرأ مفاتيحها من مجلدها
        // الباقي في بيانات التطبيق، وتعيدها نصاً. لا WebView أو لا رد في 4 ث: null
        MethodChannel(messenger, "gangcity/migrate").setMethodCallHandler { call, result ->
            if (call.method != "read") { result.notImplemented(); return@setMethodCallHandler }
            var web: WebView? = null
            var answered = false
            fun finish(value: String?) {
                if (answered) return
                answered = true
                result.success(value)
                web?.let { w -> w.post { w.destroy() } }
            }
            try {
                val w = WebView(this)
                web = w
                w.settings.javaScriptEnabled = true
                w.settings.domStorageEnabled = true
                w.webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView, url: String?) {
                        view.evaluateJavascript("(function(){var o={};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);" +
                            "if(k.indexOf('gangcity.')===0)o[k]=localStorage.getItem(k);}return JSON.stringify(o);})()") { v -> finish(v) }
                    }
                }
                w.loadDataWithBaseURL("https://localhost/", "<html><body></body></html>", "text/html", "utf-8", null)
                Handler(Looper.getMainLooper()).postDelayed({ finish(null) }, 4000)
            } catch (_: Throwable) {
                finish(null)
            }
        }
    }
}
