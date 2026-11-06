package com.hymadi.gangcity;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;

import com.getcapacitor.BridgeActivity;

/**
 * اللعبة بملء الشاشة بلا شريط حالة ولا أزرار نظام (القسم 2.1).
 * الاتجاه الأفقي مضبوط في AndroidManifest.xml، ومنع نوم الشاشة في js/platform.js.
 */
public class MainActivity extends BridgeActivity {

    private AudioManager audio;
    private AudioDeviceCallback audioRoute;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LanPlugin.class);   // اللعب المحلي (القسم 16): قبل إنشاء الجسر
        super.onCreate(savedInstanceState);
        hideSystemBars();
        setupAudio();
    }

    // مخرج الصوت (بطلب المستخدم: صوت اللعبة كان يخرج من سماعة الجوال وسماعات البلوتوث متصلة):
    // أزرار الصوت تتحكم في صوت الوسائط، وكل جهاز صوت يُوصل أو يُفصل يُخبر اللعبة فتفتح مخرجها من جديد
    // على الجهاز الحالي (js/audio/sound.js: reroute)
    private void setupAudio() {
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
        audio = (AudioManager) getSystemService(AUDIO_SERVICE);
        if (audio == null) return;
        audioRoute = new AudioDeviceCallback() {
            @Override
            public void onAudioDevicesAdded(AudioDeviceInfo[] added) { audioRouteChanged(); }

            @Override
            public void onAudioDevicesRemoved(AudioDeviceInfo[] removed) { audioRouteChanged(); }
        };
        audio.registerAudioDeviceCallback(audioRoute, null);
    }

    private void audioRouteChanged() {
        if (bridge == null || bridge.getWebView() == null) return;
        bridge.getWebView().post(() ->
            bridge.getWebView().evaluateJavascript("window.dispatchEvent(new Event('gangcity:audioroute'))", null));
    }

    @Override
    public void onResume() {
        super.onResume();
        // وضع المكالمات يحوّل الصوت إلى سماعة الجوال: اللعبة لا تستعمله أبداً، فإن بقي من غيرها نعيده عادياً
        if (audio != null && audio.getMode() == AudioManager.MODE_IN_COMMUNICATION) audio.setMode(AudioManager.MODE_NORMAL);
        audioRouteChanged();
    }

    @Override
    public void onDestroy() {
        if (audio != null && audioRoute != null) audio.unregisterAudioDeviceCallback(audioRoute);
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();   // الأشرطة تعود بعد السحب أو بعد العودة للتطبيق
    }

    // زرا شاشة تعذر WebView (res/layout/no_webview.xml): إعادة المحاولة تعيد إنشاء النشاط فيحاول Capacitor من جديد،
    // وفتح المتجر على صفحة Android System WebView (أو موقع المتجر إن لم يوجد تطبيقه)
    public void retryWebView(View view) {
        recreate();
    }

    public void openWebViewStore(View view) {
        final String id = "com.google.android.webview";
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + id)));
        } catch (ActivityNotFoundException e) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=" + id)));
            } catch (ActivityNotFoundException ignored) { }
        }
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.systemBars());
                controller.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }
}
