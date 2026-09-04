<<<<<<< HEAD
# Add project specific ProGuard rules here.
=======
# ProGuard rules for HRMate Native Android Application
>>>>>>> 8c110ce (feat(native): pure native app experience with zero web-overscroll and hardware biometric bridge)
-keepattributes *Annotation*
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
<<<<<<< HEAD
-dontwarn com.google.androidbrowserhelper.**
=======
-keep class com.gdfoods.hrmate.** { *; }
-keep class androidx.biometric.** { *; }
>>>>>>> 8c110ce (feat(native): pure native app experience with zero web-overscroll and hardware biometric bridge)
