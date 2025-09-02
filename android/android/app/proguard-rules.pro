# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# Preserve line numbers for debugging
-keepattributes SourceFile,LineNumberTable

# Keep Capacitor classes
-keep class com.getcapacitor.** { *; }
-keep class com.ionicframework.** { *; }

# Keep WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep custom app classes
-keep class com.romankuskowski.theatereditor.** { *; }

# Preserve annotations
-keepattributes *Annotation*

# For enumeration classes
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep R class members
-keepclassmembers class **.R$* {
    public static <fields>;
}

# Preserve WebView
-keep class android.webkit.** { *; }
-keep class androidx.webkit.** { *; }

# Keep JavaScript interfaces
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(android.webkit.WebView, java.lang.String);
}

# Gson specific (if used)
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn sun.misc.**

# OkHttp (often used by Capacitor plugins)
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# AndroidX
-keep class androidx.** { *; }
-keep interface androidx.** { *; }
-dontwarn androidx.**

# Capacitor plugins
-keep class * extends com.getcapacitor.Plugin { *; }

# Native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep View constructors
-keepclasseswithmembers class * {
    public <init>(android.content.Context, android.util.AttributeSet);
}

-keepclasseswithmembers class * {
    public <init>(android.content.Context, android.util.AttributeSet, int);
}

# Keep Activity methods
-keepclassmembers class * extends android.app.Activity {
   public void *(android.view.View);
}

# Serializable classes
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}