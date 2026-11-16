package com.gangcity.gangcity

import android.app.ActivityManager
import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.view.WindowManager
import android.webkit.WebView
import android.webkit.WebViewClient
import io.flutter.FlutterInjector
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : FlutterActivity() {
    private var lock: WifiManager.MulticastLock? = null
    private var pool: SoundPool? = null   // لا يمسه إلا خيط الصوت
    // خيط خاص بالصوت (2.1.4): منذ Flutter 3.29 يعمل كود Dart على خيط أندرويد الرئيسي نفسه، فكان كل صوت في القتال
    // (SoundPool.play، وإيقاف أقدم صوت حين تمتلئ الأصوات) يوقف تجهيز الإطار حتى يرد نظام الصوت. الآن يُرسل الطلب ويعود فوراً
    private val sfxThread = HandlerThread("gangcity-sfx").apply { start() }
    private val sfx = Handler(sfxThread.looper)
    private val main = Handler(Looper.getMainLooper())
    // ما يُرسل لخيط الصوت لا يُغلق اللعبة أبداً إن فشل (2.1.5): يُسجَّل ويُترك
    private fun onSfx(job: () -> Unit) { sfx.post { try { job() } catch (e: Throwable) { note("sfx", e) } } }
    private fun note(where: String, e: Throwable) {
        try { File(filesDir, "last_error.txt").writeText("$where: ${e.stackTraceToString().take(6000)}") } catch (_: Throwable) { }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // خطأ أندرويد لم يُلتقط في أي خيط (2.1.5): يُكتب في ملف لتعرضه اللعبة عند فتحها التالي، ثم يُغلق التطبيق كما كان
        val system = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { t, e -> note("thread ${t.name}", e); system?.uncaughtException(t, e) }
        super.onCreate(savedInstanceState)
        // 60 إطاراً بدل 90 أو 120 في الشاشات السريعة: نصف عمل المعالج وكرت الشاشة والبطارية (القسم 18.1)
        window.attributes = window.attributes.apply { preferredRefreshRate = 60f }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)   // الشاشة لا تنطفئ أثناء اللعب (كـ platform.js)
    }

    override fun onDestroy() {
        onSfx { pool?.release(); pool = null }
        sfxThread.quitSafely()
        super.onDestroy()
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        val messenger = flutterEngine.dartExecutor.binaryMessenger
        // مؤثرات الصوت (audio/sound.dart): SoundPool واحد يفك كل ملف مرة واحدة عند التشغيل ويبقيه في الذاكرة، فلا يُفك
        // ملف مع كل ضربة. load: مسارات الأصول ← أرقامها، play: [رقم، ارتفاع، سرعة، أولوية]، hold: إيقاف مؤقت أو متابعة
        MethodChannel(messenger, "gangcity/sfx").setMethodCallHandler { call, result ->
            try {
                when (call.method) {
                    "load" -> {
                        val voices = call.argument<Int>("voices") ?: 24
                        val paths = call.argument<List<String>>("paths")!!
                        onSfx {
                            var ids = paths.map { 0 }   // يرد دائماً (ولو فشل) فلا تنتظر اللعبة عند فتحها
                            try {
                                val p = pool ?: SoundPool.Builder().setMaxStreams(voices).setAudioAttributes(AudioAttributes.Builder()
                                    .setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                                    .build().also { pool = it }
                                val loader = FlutterInjector.instance().flutterLoader()
                                ids = paths.map { path ->
                                    try { assets.openFd(loader.getLookupKeyForAsset(path)).use { p.load(it, 1) } } catch (_: Exception) { 0 }
                                }
                            } finally {
                                main.post { result.success(ids) }
                            }
                        }
                    }
                    "play" -> {
                        val a = call.arguments as List<*>
                        val id = (a[0] as Number).toInt(); val v = (a[1] as Number).toFloat()
                        val rate = (a[2] as Number).toFloat().coerceIn(0.5f, 2f); val pri = (a[3] as Number).toInt()
                        onSfx { pool?.play(id, v, v, pri, 0, rate) }
                        result.success(null)
                    }
                    "hold" -> {
                        val on = call.arguments == true
                        onSfx { if (on) pool?.autoPause() else pool?.autoResume() }
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            } catch (e: Exception) {
                result.success(null)
            }
        }
        // سبب آخر إغلاق للعبة (2.1.5، ui/crash_report.dart): سجل أندرويد لخروج العملية (من أندرويد 11) بنوعه ووصفه وذاكرتها
        // وأثره (للانهيار الأصلي وعدم الاستجابة)، وآخر خطأ أندرويد مكتوب. clear: تُحذف بعد عرضها
        MethodChannel(messenger, "gangcity/diag").setMethodCallHandler { call, result ->
            try {
                val file = File(filesDir, "last_error.txt")
                when (call.method) {
                    "lastExit" -> {
                        val exits = mutableListOf<Map<String, Any?>>()
                        if (Build.VERSION.SDK_INT >= 30) {
                            val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
                            for (info in am.getHistoricalProcessExitReasons(packageName, 0, 5)) {
                                val trace = try { info.traceInputStream?.bufferedReader()?.use { it.readText().take(8000) } } catch (_: Throwable) { null }
                                exits.add(mapOf("time" to info.timestamp, "reason" to info.reason, "status" to info.status,
                                    "desc" to (info.description ?: ""), "pss" to info.pss, "rss" to info.rss, "trace" to (trace ?: "")))
                            }
                        }
                        result.success(mapOf("exits" to exits, "error" to (if (file.exists()) file.readText() else ""), "sdk" to Build.VERSION.SDK_INT,
                            "device" to Build.MODEL))
                    }
                    "clear" -> { file.delete(); result.success(null) }
                    else -> result.notImplemented()
                }
            } catch (e: Throwable) {
                result.success(null)
            }
        }
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
