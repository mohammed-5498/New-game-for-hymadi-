package com.gangcity.gangcity

import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 60 إطاراً بدل 90 أو 120 في الشاشات السريعة: نصف عمل المعالج وكرت الشاشة والبطارية (القسم 18.1)
        window.attributes = window.attributes.apply { preferredRefreshRate = 60f }
    }
}
