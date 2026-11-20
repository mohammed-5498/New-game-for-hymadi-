package com.gangcity.gangcity

import android.content.res.AssetFileDescriptor
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.os.Process
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

// خلاط المؤثرات (2.9.0، الخطوة الأولى بطلب المستخدم): كانت SoundPool تفتح قناة صوت (AudioTrack) جديدة لكل ضربة على الخيط
// الذي يطلبها (أندرويد 11: نحو 10 ملي ث لكل صوت)، فبلغ خيط الصوت 38% من نواة في معارك جوال المستخدم. الآن كل ملف يُفك مرة
// واحدة إلى عينات، وقناة واحدة يخلط فيها خيط واحد الأصوات الجارية بحجمها وسرعتها: بدء صوت إضافة إلى قائمة، والخلط كلفة صغيرة
// ثابتة. والقناة تتوقف بعد ثانية بلا صوت ويعود الخيط ينتظر بلا عمل حتى أول صوت
class SfxMixer(private val voices: Int, private val onError: (Throwable) -> Unit) {
    private class Pcm(val data: ShortArray, val rate: Int)
    private class Voice(val pcm: Pcm, val gain: Float, val step: Double, val pri: Int) { var pos = 0.0 }

    private val sounds = ArrayList<Pcm?>()                 // الرقم - 1 (يُملأ قبل أن يُعطى الخلاط لخيط اللعبة: mixer في MainActivity)
    private val pending = LinkedBlockingQueue<Voice>()   // ما طُلب ولم يدخل الخلط (الخيط ينتظر عليها وهو بلا عمل)
    @Volatile private var running = true
    @Volatile private var held = false
    private val rate = AudioTrack.getNativeOutputSampleRate(AudioManager.STREAM_MUSIC).takeIf { it in 8000..192000 } ?: 48000
    // عينات كل دفعة (10 ملي ث تقريباً) وقناة بأربع دفعات (نحو 43 ملي ث) بلا وضع التأخير القصير (2.11.0): كان الخيط يصحو نحو 190 مرة
    // في الثانية لقناة قصيرة (8% من نواة في عدّاد جوال المستخدم)، والآن مع دورة خلاط النظام (نحو 50)، والصوت أبطأ بنحو 40 ملي ث
    private val chunk = 512
    private val track: AudioTrack = AudioTrack.Builder()
        .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
        .setAudioFormat(AudioFormat.Builder().setSampleRate(rate).setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
        .setTransferMode(AudioTrack.MODE_STREAM)
        .setBufferSizeInBytes(maxOf(AudioTrack.getMinBufferSize(rate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT), chunk * 2 * 4))
        .build()
    // قناة لم تُفتح على هذا الجهاز: يفشل الخلاط هنا فتعود اللعبة إلى SoundPool وقت التحميل (MainActivity)، لا صمت بعده
    init { if (track.state != AudioTrack.STATE_INITIALIZED) { track.release(); throw IllegalStateException("AudioTrack ${track.state}") } }
    private val thread = Thread({ loop() }, "gangcity-mix").apply { start() }

    // الملفات بترتيبها: رقم كل منها (من 1)، أو 0 إن لم يُفك
    fun load(files: List<AssetFileDescriptor?>): List<Int> = files.map { fd ->
        val pcm = fd?.use { decode(it) }
        if (pcm == null || pcm.data.size < 2) 0 else { sounds.add(pcm); sounds.size }
    }

    // gain: ارتفاعه 0-1، وspeed: سرعته (والطبقة معها)، وpri: الأعلى يبقى إن امتلأت الأصوات
    fun play(id: Int, gain: Float, speed: Float, pri: Int) {
        if (held || !running) return                     // توقف بخطأ: لا تتراكم الطلبات
        val pcm = sounds.getOrNull(id - 1) ?: return
        pending.offer(Voice(pcm, gain, pcm.rate.toDouble() / rate * speed, pri))
    }

    // التطبيق في الخلفية: لا صوت، وما كان يُسمع يُترك
    fun hold(on: Boolean) { held = on }

    fun release() {
        running = false
        try { thread.join(800) } catch (_: InterruptedException) { }
        track.release()
    }

    private fun loop() {
        Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO)
        val active = ArrayList<Voice>(voices)
        val acc = FloatArray(chunk)
        val out = ShortArray(chunk)
        var playing = false
        val quietMax = rate / chunk                       // ثانية
        var quiet = quietMax                              // دفعات صامتة متتالية (يبدأ منتظراً)
        try {
            while (running) {
                if (held) { active.clear(); pending.clear() }
                while (true) {
                    val v = pending.poll() ?: break
                    if (active.size >= voices) {          // الأقل أولوية ثم الأقدم يُترك
                        var k = 0
                        for (n in 1 until active.size) if (active[n].pri < active[k].pri || (active[n].pri == active[k].pri && active[n].pos > active[k].pos)) k = n
                        if (active[k].pri > v.pri) continue
                        active.removeAt(k)
                    }
                    active.add(v)
                }
                if (active.isEmpty()) {
                    // ثانية بلا صوت: تتوقف القناة وينتظر الخيط بلا عمل حتى أول صوت (ويصحو كل نصف ثانية ليرى هل أُغلق)
                    if (held || quiet >= quietMax) {
                        if (playing) { track.pause(); track.flush(); playing = false }
                        val v = pending.poll(500, TimeUnit.MILLISECONDS) ?: continue
                        if (!held) active.add(v)
                        quiet = 0
                        continue
                    }
                    quiet++
                } else quiet = 0
                if (!playing) { track.play(); playing = true }
                java.util.Arrays.fill(acc, 0f)
                val it = active.iterator()
                while (it.hasNext()) {
                    val v = it.next()
                    val d = v.pcm.data
                    val last = d.size - 1
                    val g = v.gain / 32768f
                    var p = v.pos
                    var i = 0
                    while (i < chunk) {
                        val k = p.toInt()
                        if (k >= last) break
                        val f = (p - k).toFloat()
                        acc[i] += (d[k] + (d[k + 1] - d[k]) * f) * g
                        p += v.step
                        i++
                    }
                    v.pos = p
                    if (p.toInt() >= last) it.remove()
                }
                for (i in 0 until chunk) out[i] = (acc[i].coerceIn(-1f, 1f) * 32767f).toInt().toShort()
                var at = 0
                while (at < chunk && running) {           // يكتب حتى يتسع مكان في القناة: يضبط إيقاع الخيط بزمن الصوت نفسه
                    val n = track.write(out, at, chunk - at)
                    if (n < 0) throw IllegalStateException("AudioTrack.write $n")
                    at += n
                }
            }
        } catch (e: Throwable) {
            running = false                               // يسكت المزج ولا تُغلق اللعبة
            onError(e)
        }
    }

    // ملف (mp3 أو wav) إلى عينات 16 بت بقناة واحدة بمعدله الأصلي
    private fun decode(fd: AssetFileDescriptor): Pcm? {
        val ex = MediaExtractor()
        try {
            ex.setDataSource(fd.fileDescriptor, fd.startOffset, fd.length)
            val t = (0 until ex.trackCount).firstOrNull { ex.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true } ?: return null
            ex.selectTrack(t)
            val fmt = ex.getTrackFormat(t)
            val mime = fmt.getString(MediaFormat.KEY_MIME)!!
            var srcRate = fmt.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            var ch = fmt.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            var float = false
            val samples = ShortList()
            if (mime == MediaFormat.MIMETYPE_AUDIO_RAW) {
                if (fmt.containsKey(MediaFormat.KEY_PCM_ENCODING) && fmt.getInteger(MediaFormat.KEY_PCM_ENCODING) != AudioFormat.ENCODING_PCM_16BIT) return null
                val buf = ByteBuffer.allocateDirect(1 shl 16).order(ByteOrder.LITTLE_ENDIAN)
                while (true) {
                    buf.clear()
                    val n = ex.readSampleData(buf, 0)
                    if (n < 0) break
                    buf.position(0); buf.limit(n)
                    samples.add(buf, false)
                    ex.advance()
                }
            } else {
                val codec = MediaCodec.createDecoderByType(mime)
                try {
                    codec.configure(fmt, null, null, 0)
                    codec.start()
                    val info = MediaCodec.BufferInfo()
                    var inDone = false
                    var stuck = 0                         // ثانيتان بلا مخرج بعد آخر المدخل: يُترك الملف
                    while (stuck < 200) {
                        if (!inDone) {
                            val i = codec.dequeueInputBuffer(10_000)
                            if (i >= 0) {
                                val n = ex.readSampleData(codec.getInputBuffer(i)!!, 0)
                                if (n < 0) { codec.queueInputBuffer(i, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM); inDone = true }
                                else { codec.queueInputBuffer(i, 0, n, ex.sampleTime, 0); ex.advance() }
                            }
                        }
                        val o = codec.dequeueOutputBuffer(info, 10_000)
                        stuck = if (o < 0 && inDone) stuck + 1 else 0
                        if (o == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                            val f = codec.outputFormat
                            srcRate = f.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                            ch = f.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                            float = f.containsKey(MediaFormat.KEY_PCM_ENCODING) && f.getInteger(MediaFormat.KEY_PCM_ENCODING) == AudioFormat.ENCODING_PCM_FLOAT
                        } else if (o >= 0) {
                            val b = codec.getOutputBuffer(o)!!
                            b.position(info.offset); b.limit(info.offset + info.size)
                            samples.add(b.order(ByteOrder.LITTLE_ENDIAN), float)
                            codec.releaseOutputBuffer(o, false)
                            if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) break
                        }
                    }
                    codec.stop()
                } finally {
                    codec.release()
                }
            }
            val s = samples.toArray()
            if (ch <= 1) return Pcm(s, srcRate)
            return Pcm(ShortArray(s.size / ch) { i -> var sum = 0; for (c in 0 until ch) sum += s[i * ch + c]; (sum / ch).toShort() }, srcRate)
        } catch (_: Exception) {
            return null
        } finally {
            ex.release()
        }
    }

    // عينات 16 بت تنمو (أو float تُحوَّل)
    private class ShortList {
        private var a = ShortArray(1 shl 15)
        private var n = 0
        fun add(b: ByteBuffer, float: Boolean) {
            val count = if (float) b.remaining() / 4 else b.remaining() / 2
            if (n + count > a.size) a = a.copyOf(maxOf(a.size * 2, n + count))
            if (float) { val fb = b.asFloatBuffer(); for (k in 0 until count) a[n + k] = (fb.get().coerceIn(-1f, 1f) * 32767f).toInt().toShort() }
            else b.asShortBuffer().get(a, n, count)
            n += count
        }
        fun toArray(): ShortArray = a.copyOf(n)
    }
}
