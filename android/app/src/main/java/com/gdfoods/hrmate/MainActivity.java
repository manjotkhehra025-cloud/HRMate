package com.gdfoods.hrmate;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import androidx.core.app.NotificationCompat;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.biometric.BiometricPrompt;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.Executor;

public class MainActivity extends AppCompatActivity {

    // HRMate web app home. hr.flavorflow.co.in is NOT HRMate any more (it is
    // reserved for a different, new app) — never point the WebView there.
    public static final String APP_URL = "https://gdfoods.duckdns.org";
    private static final int PERMISSION_REQUEST_CODE = 1001;
    private static final int FILE_CHOOSER_REQUEST_CODE = 2001;
    private static final int STORAGE_PERMISSION_CODE = 3001;

    private WebView webView;
    private LinearLayout loadingLayout;
    private LinearLayout offlineLayout;
    private Button btnRetry;

    private ValueCallback<Uri[]> filePathCallback;
    private String cameraPhotoPath;
    private long lastBackPressedTime = 0;
    private boolean isPageError = false;
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Native Edge-to-Edge Theme Integration
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(0xFF0F172A);
            getWindow().setNavigationBarColor(0xFF0F172A);
        }

        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        loadingLayout = findViewById(R.id.loadingLayout);
        offlineLayout = findViewById(R.id.offlineLayout);
        btnRetry = findViewById(R.id.btnRetry);

        checkAndRequestPermissions();
        createNotificationChannel();
        configureWebView();
        setupNetworkMonitoring();

        btnRetry.setOnClickListener(v -> retryLoading());

        if (isNetworkAvailable()) {
            isPageError = false;
            loadingLayout.setVisibility(View.VISIBLE);
            offlineLayout.setVisibility(View.GONE);
            webView.setVisibility(View.VISIBLE);
            if (savedInstanceState == null) {
                webView.loadUrl(APP_URL);
            } else {
                webView.restoreState(savedInstanceState);
            }
        } else {
            showOfflineScreen();
        }
    }

    private boolean isNetworkAvailable() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Network network = cm.getActiveNetwork();
                if (network == null) return false;
                NetworkCapabilities capabilities = cm.getNetworkCapabilities(network);
                return capabilities != null && (
                    capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                    capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
                    capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
                );
            } else {
                android.net.NetworkInfo activeNetworkInfo = cm.getActiveNetworkInfo();
                return activeNetworkInfo != null && activeNetworkInfo.isConnected();
            }
        } catch (Exception e) {
            return true;
        }
    }

    private void setupNetworkMonitoring() {
        try {
            connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (connectivityManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                networkCallback = new ConnectivityManager.NetworkCallback() {
                    @Override
                    public void onAvailable(@NonNull Network network) {
                        runOnUiThread(() -> {
                            if (isPageError || offlineLayout.getVisibility() == View.VISIBLE) {
                                retryLoading();
                            }
                        });
                    }

                    @Override
                    public void onLost(@NonNull Network network) {
                        // Keep current view
                    }
                };
                connectivityManager.registerDefaultNetworkCallback(networkCallback);
            }
        } catch (Exception ignored) {}
    }

    private void showOfflineScreen() {
        isPageError = true;
        runOnUiThread(() -> {
            try {
                webView.stopLoading();
                webView.loadUrl("about:blank");
            } catch (Exception ignored) {}
            loadingLayout.setVisibility(View.GONE);
            webView.setVisibility(View.GONE);
            offlineLayout.setVisibility(View.VISIBLE);
            offlineLayout.bringToFront();
        });
    }

    private void retryLoading() {
        isPageError = false;
        offlineLayout.setVisibility(View.GONE);
        loadingLayout.setVisibility(View.VISIBLE);
        webView.setVisibility(View.VISIBLE);
        webView.loadUrl(APP_URL);
    }

    private void checkAndRequestPermissions() {
        List<String> permissionsNeeded = new ArrayList<>();
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.ACCESS_FINE_LOCATION);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.CAMERA);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.RECORD_AUDIO);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }

        if (!permissionsNeeded.isEmpty()) {
            ActivityCompat.requestPermissions(this, permissionsNeeded.toArray(new String[0]), PERMISSION_REQUEST_CODE);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "HRMate Notifications";
            String description = "Attendance reminders, birthday wishes and approvals";
            int importance = NotificationManager.IMPORTANCE_HIGH;
            NotificationChannel channel = new NotificationChannel("hrmate_channel", name, importance);
            channel.setDescription(description);
            channel.enableVibration(true);
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setBackgroundColor(0xFF0B132B);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setGeolocationEnabled(true);
        settings.setGeolocationDatabasePath(getFilesDir().getPath());
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
        settings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.NORMAL);

        String defaultUserAgent = settings.getUserAgentString();
        settings.setUserAgentString(defaultUserAgent + " HRMateNativeApp/2.0 (" + Build.SUPPORTED_ABIS[0] + ")");

        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(webView, true);
        }

        // Native Download Listener for blobs / urls
        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                if (url.startsWith("data:")) {
                    saveBase64DataUrl(url, "hrmate-id-badge.png", mimeType);
                } else {
                    try {
                        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                        request.setMimeType(mimeType);
                        String filename = URLUtil.guessFileName(url, contentDisposition, mimeType);
                        request.setTitle(filename);
                        request.setDescription("Downloading file from HRMate");
                        request.allowScanningByMediaScanner();
                        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                        request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);

                        DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                        if (dm != null) {
                            dm.enqueue(request);
                            Toast.makeText(MainActivity.this, "Download started: " + filename, Toast.LENGTH_SHORT).show();
                        }
                    } catch (Exception e) {
                        try {
                            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                            startActivity(intent);
                        } catch (Exception ex) {
                            Toast.makeText(MainActivity.this, "Download failed", Toast.LENGTH_SHORT).show();
                        }
                    }
                }
            }
        });

        webView.addJavascriptInterface(new WebAppInterface(this), "AndroidApp");
        webView.addJavascriptInterface(new WebAppInterface(this), "Android");
        webView.setWebViewClient(new CustomWebViewClient());
        webView.setWebChromeClient(new CustomWebChromeClient());
    }

    @Override
    public void onConfigurationChanged(@NonNull Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
    }

    public class WebAppInterface {
        Context mContext;

        WebAppInterface(Context c) {
            mContext = c;
        }

        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public void onAppReady() {
            runOnUiThread(() -> {
                if (loadingLayout != null) {
                    loadingLayout.animate().alpha(0f).setDuration(200).withEndAction(() -> {
                        loadingLayout.setVisibility(View.GONE);
                    }).start();
                }
            });
        }

        @JavascriptInterface
        public String getDeviceArch() {
            return Build.SUPPORTED_ABIS != null && Build.SUPPORTED_ABIS.length > 0 ? Build.SUPPORTED_ABIS[0] : "unknown";
        }

        @JavascriptInterface
        public void authenticateBiometrics() {
            runOnUiThread(() -> showNativeBiometricPrompt());
        }

        @JavascriptInterface
        public void requestLocationPermission() {
            runOnUiThread(() -> checkAndRequestPermissions());
        }

        @JavascriptInterface
        public void getNativeGpsLocation() {
            runOnUiThread(() -> fetchNativeLocation());
        }

        // Native Android Print & Save as PDF Dialog
        @JavascriptInterface
        public void printPage() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    try {
                        PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                        if (printManager != null) {
                            String jobName = "HRMate_ID_Badge_" + System.currentTimeMillis();
                            PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter(jobName);
                            printManager.print(jobName, printAdapter, new PrintAttributes.Builder().build());
                        }
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "Printing not supported on this device", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        // Native High-Res Badge Image Downloader (Saves to Gallery / Downloads)
        @JavascriptInterface
        public void saveBase64Image(String base64Data, String filename, String mimeType) {
            runOnUiThread(() -> saveBase64DataUrl(base64Data, filename, mimeType));
        }

        // Native Notification Trigger (Attendance Reminders & Birthday Alerts)
        @JavascriptInterface
        public void showNativeNotification(String title, String body, String type) {
            runOnUiThread(() -> {
                try {
                    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                    if (nm != null) {
                        Intent intent = new Intent(MainActivity.this, MainActivity.class);
                        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                        PendingIntent pi = PendingIntent.getActivity(
                            MainActivity.this,
                            0,
                            intent,
                            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
                        );

                        NotificationCompat.Builder builder = new NotificationCompat.Builder(MainActivity.this, "hrmate_channel")
                            .setSmallIcon(R.mipmap.ic_launcher)
                            .setContentTitle(title)
                            .setContentText(body)
                            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                            .setPriority(NotificationCompat.PRIORITY_HIGH)
                            .setAutoCancel(true)
                            .setContentIntent(pi)
                            .setDefaults(NotificationCompat.DEFAULT_ALL);

                        nm.notify((int) System.currentTimeMillis(), builder.build());
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
        }

        @JavascriptInterface
        public void openAppSettings() {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    intent.setData(Uri.fromParts("package", getPackageName(), null));
                    startActivity(intent);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Unable to open settings", Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    private void saveBase64DataUrl(String base64Data, String filename, String mimeType) {
        try {
            if (base64Data == null || base64Data.isEmpty()) return;

            String cleanBase64 = base64Data;
            if (base64Data.contains(",")) {
                cleanBase64 = base64Data.substring(base64Data.indexOf(",") + 1);
            }

            byte[] imageBytes = Base64.decode(cleanBase64, Base64.DEFAULT);
            String saveName = (filename != null && !filename.isEmpty()) ? filename : ("hrmate_badge_" + System.currentTimeMillis() + ".png");
            String actualMime = (mimeType != null && !mimeType.isEmpty()) ? mimeType : "image/png";

            OutputStream fos = null;
            Uri imageUri = null;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContentResolver();
                ContentValues contentValues = new ContentValues();
                contentValues.put(MediaStore.MediaColumns.DISPLAY_NAME, saveName);
                contentValues.put(MediaStore.MediaColumns.MIME_TYPE, actualMime);
                contentValues.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/HRMate");

                imageUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues);
                if (imageUri != null) {
                    fos = resolver.openOutputStream(imageUri);
                }
            } else {
                File imagesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES);
                File hrmateDir = new File(imagesDir, "HRMate");
                if (!hrmateDir.exists()) hrmateDir.mkdirs();
                File imageFile = new File(hrmateDir, saveName);
                fos = new FileOutputStream(imageFile);
                imageUri = Uri.fromFile(imageFile);
            }

            if (fos != null) {
                fos.write(imageBytes);
                fos.flush();
                fos.close();
                Toast.makeText(MainActivity.this, "✓ ID Badge saved to Gallery & Pictures (" + saveName + ")", Toast.LENGTH_LONG).show();

                // Open share/view dialog
                if (imageUri != null) {
                    try {
                        Intent shareIntent = new Intent(Intent.ACTION_SEND);
                        shareIntent.setType(actualMime);
                        shareIntent.putExtra(Intent.EXTRA_STREAM, imageUri);
                        shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(shareIntent, "Share or View ID Badge"));
                    } catch (Exception ignored) {}
                }
            } else {
                Toast.makeText(MainActivity.this, "Unable to save image", Toast.LENGTH_SHORT).show();
            }
        } catch (Exception e) {
            Toast.makeText(MainActivity.this, "Error saving badge: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    @SuppressLint("MissingPermission")
    private void fetchNativeLocation() {
        boolean hasFine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean hasCoarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;

        if (!hasFine && !hasCoarse) {
            ActivityCompat.requestPermissions(this, new String[]{
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            }, PERMISSION_REQUEST_CODE);
            sendNativeGpsToWeb(false, 0, 0, "Location permission requested");
            return;
        }

        try {
            final LocationManager locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            if (locationManager == null) {
                sendNativeGpsToWeb(false, 0, 0, "LocationManager not available");
                return;
            }

            boolean isGpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER);
            boolean isNetworkEnabled = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);

            if (!isGpsEnabled && !isNetworkEnabled) {
                sendNativeGpsToWeb(false, 0, 0, "GPS is disabled on device");
                return;
            }

            Location bestLocation = null;
            if (isGpsEnabled) {
                bestLocation = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            }
            if (bestLocation == null && isNetworkEnabled) {
                bestLocation = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            }
            if (bestLocation == null) {
                bestLocation = locationManager.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER);
            }

            if (bestLocation != null && (System.currentTimeMillis() - bestLocation.getTime() < 180000)) {
                sendNativeGpsToWeb(true, bestLocation.getLatitude(), bestLocation.getLongitude(), "success");
                return;
            }

            final LocationListener locationListener = new LocationListener() {
                @Override
                public void onLocationChanged(@NonNull Location location) {
                    sendNativeGpsToWeb(true, location.getLatitude(), location.getLongitude(), "success");
                    try {
                        locationManager.removeUpdates(this);
                    } catch (Exception ignored) {}
                }

                @Override
                public void onStatusChanged(String provider, int status, Bundle extras) {}
                @Override
                public void onProviderEnabled(@NonNull String provider) {}
                @Override
                public void onProviderDisabled(@NonNull String provider) {}
            };

            String provider = isGpsEnabled ? LocationManager.GPS_PROVIDER : LocationManager.NETWORK_PROVIDER;
            locationManager.requestLocationUpdates(provider, 0, 0, locationListener, Looper.getMainLooper());

            final Location fallback = bestLocation;
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                try {
                    locationManager.removeUpdates(locationListener);
                } catch (Exception ignored) {}
                if (fallback != null) {
                    sendNativeGpsToWeb(true, fallback.getLatitude(), fallback.getLongitude(), "cached");
                }
            }, 3500);

        } catch (Exception e) {
            sendNativeGpsToWeb(false, 0, 0, e.getMessage());
        }
    }

    private void sendNativeGpsToWeb(final boolean success, final double lat, final double lng, final String message) {
        webView.post(() -> {
            String safeMsg = message != null ? message.replace("'", "\\'") : "";
            String js = "window.onNativeGpsResult && window.onNativeGpsResult(" + success + ", " + lat + ", " + lng + ", '" + safeMsg + "');";
            webView.evaluateJavascript(js, null);
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            boolean fineLocationGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            boolean coarseLocationGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            if (fineLocationGranted || coarseLocationGranted) {
                fetchNativeLocation();
            }
        }
    }

    private void showNativeBiometricPrompt() {
        Executor executor = ContextCompat.getMainExecutor(this);
        BiometricPrompt biometricPrompt = new BiometricPrompt(MainActivity.this, executor, new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                super.onAuthenticationError(errorCode, errString);
                webView.post(() -> webView.evaluateJavascript("window.onNativeBiometricResult && window.onNativeBiometricResult(false, '" + errString + "');", null));
            }

            @Override
            public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                super.onAuthenticationSucceeded(result);
                webView.post(() -> webView.evaluateJavascript("window.onNativeBiometricResult && window.onNativeBiometricResult(true, 'success');", null));
            }

            @Override
            public void onAuthenticationFailed() {
                super.onAuthenticationFailed();
                webView.post(() -> webView.evaluateJavascript("window.onNativeBiometricResult && window.onNativeBiometricResult(false, 'Fingerprint not recognized');", null));
            }
        });

        BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("HRMate Biometric Sign In")
                .setSubtitle("Confirm your fingerprint or Face ID")
                .setNegativeButtonText("Use Password")
                .build();

        biometricPrompt.authenticate(promptInfo);
    }

    private class CustomWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            String url = request.getUrl().toString();
            return handleUri(url);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleUri(url);
        }

        private boolean handleUri(String url) {
            if (url == null) return false;

            // Only HRMate's own domain stays inside the WebView; everything else
            // (including hr.flavorflow.co.in, which now belongs to another app)
            // opens in the system browser.
            if (url.startsWith("https://gdfoods.duckdns.org") || url.startsWith("http://gdfoods.duckdns.org") ||
                url.startsWith("about:")) {
                return false;
            }

            if (url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("sms:") ||
                url.startsWith("whatsapp:") || url.startsWith("geo:") || url.startsWith("market:")) {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                    return true;
                } catch (ActivityNotFoundException e) {
                    Toast.makeText(MainActivity.this, "No app available to handle this action", Toast.LENGTH_SHORT).show();
                    return true;
                }
            }

            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                startActivity(intent);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            if (!isPageError && !url.equals("about:blank")) {
                loadingLayout.setVisibility(View.VISIBLE);
            }
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            if (!isPageError && !url.equals("about:blank")) {
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    loadingLayout.setVisibility(View.GONE);
                }, 300);
            }
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) {
                showOfflineScreen();
            }
        }

        @Override
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            showOfflineScreen();
        }
    }

    private class CustomWebChromeClient extends WebChromeClient {
        @Override
        public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
            callback.invoke(origin, true, true);
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    request.grant(request.getResources());
                }
            });
        }

        @Override
        public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
            if (MainActivity.this.filePathCallback != null) {
                MainActivity.this.filePathCallback.onReceiveValue(null);
            }
            MainActivity.this.filePathCallback = filePathCallback;

            Intent takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            if (takePictureIntent.resolveActivity(getPackageManager()) != null) {
                File photoFile = null;
                try {
                    photoFile = createImageFile();
                    takePictureIntent.putExtra("PhotoPath", cameraPhotoPath);
                } catch (IOException ignored) {}

                if (photoFile != null) {
                    cameraPhotoPath = "file:" + photoFile.getAbsolutePath();
                    Uri photoURI = FileProvider.getUriForFile(MainActivity.this,
                            getApplicationContext().getPackageName() + ".fileprovider",
                            photoFile);
                    takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, photoURI);
                } else {
                    takePictureIntent = null;
                }
            }

            Intent contentSelectionIntent = new Intent(Intent.ACTION_GET_CONTENT);
            contentSelectionIntent.addCategory(Intent.CATEGORY_OPENABLE);
            contentSelectionIntent.setType("*/*");

            Intent[] intentArray;
            if (takePictureIntent != null) {
                intentArray = new Intent[]{takePictureIntent};
            } else {
                intentArray = new Intent[0];
            }

            Intent chooserIntent = new Intent(Intent.ACTION_CHOOSER);
            chooserIntent.putExtra(Intent.EXTRA_INTENT, contentSelectionIntent);
            chooserIntent.putExtra(Intent.EXTRA_TITLE, "Choose File or Camera");
            chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, intentArray);

            try {
                startActivityForResult(chooserIntent, FILE_CHOOSER_REQUEST_CODE);
            } catch (ActivityNotFoundException e) {
                MainActivity.this.filePathCallback = null;
                Toast.makeText(MainActivity.this, "Cannot open file chooser", Toast.LENGTH_SHORT).show();
                return false;
            }
            return true;
        }
    }

    private File createImageFile() throws IOException {
        String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
        String imageFileName = "HRMATE_IMG_" + timeStamp + "_";
        File storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
        return File.createTempFile(imageFileName, ".jpg", storageDir);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (filePathCallback == null) {
                super.onActivityResult(requestCode, resultCode, data);
                return;
            }

            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK) {
                if (data == null || data.getData() == null) {
                    if (cameraPhotoPath != null) {
                        results = new Uri[]{Uri.parse(cameraPhotoPath)};
                    }
                } else {
                    String dataString = data.getDataString();
                    if (dataString != null) {
                        results = new Uri[]{Uri.parse(dataString)};
                    }
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    @Override
    public void onBackPressed() {
        if (offlineLayout.getVisibility() == View.VISIBLE) {
            super.onBackPressed();
            return;
        }

        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            if (System.currentTimeMillis() - lastBackPressedTime < 2000) {
                super.onBackPressed();
            } else {
                lastBackPressedTime = System.currentTimeMillis();
                Toast.makeText(this, "Press back again to exit HRMate", Toast.LENGTH_SHORT).show();
            }
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        try {
            if (connectivityManager != null && networkCallback != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                connectivityManager.unregisterNetworkCallback(networkCallback);
            }
        } catch (Exception ignored) {}
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onRestoreInstanceState(@NonNull Bundle savedInstanceState) {
        super.onRestoreInstanceState(savedInstanceState);
        webView.restoreState(savedInstanceState);
    }
}
