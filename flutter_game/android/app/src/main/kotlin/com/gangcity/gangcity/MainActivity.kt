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
    private var pool: SoundPool? = null   // لا يمسه إلا خيط الصوت (إن تعذر الخلاط على الجهاز)
    @Volatile private var mixer: SfxMixer? = null   // خلاط المؤثرات (2.9.0، SfxMixer.kt): قناة واحدة لكل الأصوات
    // خيط خاص بالصوت (2.1.4، وأعيد في 2.3.1): منذ Flutter 3.29 يعمل كود Dart على خيط أندرويد الرئيسي نفسه، فكان كل صوت في
    // القتال (SoundPool.play) يوقف تجهيز الإطار حتى يرد نظام الصوت. أُلغي في 2.1.6 ظناً أنه سبب الانهيار، والسبب كان الضباب (2.2.2)
    private val sfxThread = HandlerThread("gangcity-sfx").apply { start() }
    private val sfx = Handler(sfxThread.looper)
    private val main = Handler(Looper.getMainLooper())
    // ما يُرسل لخيط الصوت لا يُغلق اللعبة أبداً إن فشل (2.1.5): يُسجَّل ويُترك
    private fun onSfx(job: () -> Unit) { sfx.post { try { job() } catch (e: Throwable) { note("sfx", e) } } }
    private fun note(where: String, e: Throwable) {
        try { File(filesDir, "last_error.txt").writeText("$where: ${e.stackTraceToString().take(6000)}") } catch (_: Throwable) { }
    }

    // أثر آخر انهيار أصلي (2.1.6): سطوره في سجل أندرويد، والتطبيق يقرأ سطوره وحده بلا إذن. من سطر "Fatal signal" (الإشارة
    // والخيط) إلى أثره ورسالة الإيقاف، وقبله سطور أخطاء المحرك (flutter) إن وُجدت
    private fun crashLog(): String = try {
        val p = ProcessBuilder("logcat", "-d", "-v", "time", "-b", "crash", "-b", "main", "flutter:E", "*:F").redirectErrorStream(true).start()
        val lines = p.inputStream.bufferedReader().use { it.readLines() }
        p.waitFor()
        val at = lines.indexOfLast { "Fatal signal" in it }
        if (at < 0) "" else lines.drop(maxOf(0, at - 6)).take(100).joinToString("\n").take(9000)
    } catch (_: Throwable) { "" }

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
        mixer?.release()
        mixer = null
        onSfx { pool?.release(); pool = null }
        sfxThread.quitSafely()
        super.onDestroy()
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        val messenger = flutterEngine.dartExecutor.binaryMessenger
        // مؤثرات الصوت (audio/sound.dart): كل ملف يُفك مرة واحدة عند التشغيل، وخلاط واحد يخلطها في قناة واحدة (2.9.0: كانت
        // SoundPool تفتح قناة لكل ضربة، 38% من نواة في معارك جوال المستخدم)، وSoundPool إن تعذر الخلاط على الجهاز.
        // load: مسارات الأصول ← أرقامها، plays: [رقم، ارتفاع، سرعة، أولوية] لكل صوت متتالية، hold: إيقاف مؤقت أو متابعة
        MethodChannel(messenger, "gangcity/sfx").setMethodCallHandler { call, result ->
            try {
                when (call.method) {
                    "load" -> {
                        val voices = call.argument<Int>("voices") ?: 24
                        val paths = call.argument<List<String>>("paths")!!
                        onSfx {
                            var ids = paths.map { 0 }   // يرد دائماً (ولو فشل) فلا تنتظر اللعبة عند فتحها
                            try {
                                val loader = FlutterInjector.instance().flutterLoader()
                                fun open(path: String) = try { assets.openFd(loader.getLookupKeyForAsset(path)) } catch (_: Exception) { null }
                                val m = try { SfxMixer(voices) { e -> note("mix", e) } } catch (e: Throwable) { note("mix", e); null }
                                val mixed = try { m?.load(paths.map { open(it) }) } catch (e: Throwable) { note("mix", e); null }
                                if (m != null && mixed != null && mixed.any { it > 0 }) {
                                    mixer = m
                                    ids = mixed
                                } else {
                                    m?.release()
                                    val p = pool ?: SoundPool.Builder().setMaxStreams(voices).setAudioAttributes(AudioAttributes.Builder()
                                        .setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                                        .build().also { pool = it }
                                    ids = paths.map { path -> try { open(path)?.use { p.load(it, 1) } ?: 0 } catch (_: Exception) { 0 } }
                                }
                            } finally {
                                main.post { result.success(ids) }
                            }
                        }
                    }
                    "plays" -> {
                        // أصوات التحديث كلها في رسالة واحدة (2.9.0): البدء في الخلاط إضافة إلى قائمة، فيُطلب هنا مباشرة
                        val a = call.arguments as List<*>
                        val m = mixer
                        var k = 0
                        while (k + 3 < a.size) {
                            val id = (a[k] as Number).toInt(); val v = (a[k + 1] as Number).toFloat()
                            val rate = (a[k + 2] as Number).toFloat().coerceIn(0.5f, 2f); val pri = (a[k + 3] as Number).toInt()
                            if (m != null) m.play(id, v, rate, pri) else onSfx { pool?.play(id, v, v, pri, 0, rate) }
                            k += 4
                        }
                        result.success(null)
                    }
                    "hold" -> {
                        val on = call.arguments == true
                        val m = mixer
                        if (m != null) m.hold(on) else onSfx { if (on) pool?.autoPause() else pool?.autoResume() }
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            } catch (e: Exception) {
                result.success(null)
            }
        }
        // سبب آخر إغلاق للعبة (2.1.5، ui/crash_report.dart): سجل أندرويد لخروج العملية (من أندرويد 11) بنوعه ووصفه وإشارته
        // وذاكرتها، وأثر الانهيار الأصلي من سجل أندرويد نفسه (2.1.6: أندرويد 11 لا يعطيه في سجل الخروج)، وآخر خطوة
        // في المباراة، وآخر خطأ أندرويد مكتوب. clear: تُحذف بعد عرضها. step: آخر خطوة (تُكتب فوراً، فتبقى بعد الانهيار)
        MethodChannel(messenger, "gangcity/diag").setMethodCallHandler { call, result ->
            val file = File(filesDir, "last_error.txt")
            val step = File(filesDir, "last_step.txt")
            when (call.method) {
                "lastExit" -> Thread {
                    val out = try {
                        val exits = mutableListOf<Map<String, Any?>>()
                        if (Build.VERSION.SDK_INT >= 30) {
                            val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
                            for (info in am.getHistoricalProcessExitReasons(packageName, 0, 5)) {
                                // أثر الانهيار الأصلي (5) في أندرويد 12 فأعلى ملف ثنائي لا يُقرأ نصاً: يكفي سطر سجل أندرويد
                                val trace = if (info.reason == 5) null else try { info.traceInputStream?.bufferedReader()?.use { it.readText().take(8000) } } catch (_: Throwable) { null }
                                exits.add(mapOf("time" to info.timestamp, "reason" to info.reason, "status" to info.status,
                                    "desc" to (info.description ?: ""), "pss" to info.pss, "rss" to info.rss, "trace" to (trace ?: "")))
                            }
                        }
                        mapOf("exits" to exits, "error" to (if (file.exists()) file.readText() else ""), "sdk" to Build.VERSION.SDK_INT,
                            "device" to Build.MODEL, "log" to crashLog(), "step" to (if (step.exists()) step.readText() else ""))
                    } catch (_: Throwable) { null }
                    main.post { result.success(out) }
                }.start()
                "clear" -> { try { file.delete() } catch (_: Throwable) { }; result.success(null) }
                "step" -> { try { step.writeText(call.arguments as String) } catch (_: Throwable) { }; result.success(null) }
                else -> result.notImplemented()
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
