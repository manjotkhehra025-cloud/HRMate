# ProGuard rules for HRMate Native Android Application
-keepattributes *Annotation*
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.gdfoods.hrmate.** { *; }
-keep class androidx.biometric.** { *; }
