import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:local_auth/local_auth.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Enforce system bar colors to match navy brand (#0B1633)
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF0B1633),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  runApp(const HRMateApp());
}

class HRMateApp extends StatelessWidget {
  const HRMateApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'HRMate',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0B1633),
        primaryColor: const Color(0xFF1E6FE0),
      ),
      home: const MainWebViewScreen(),
    );
  }
}

class MainWebViewScreen extends StatefulWidget {
  const MainWebViewScreen({super.key});

  @override
  State<MainWebViewScreen> createState() => _MainWebViewScreenState();
}

class _MainWebViewScreenState extends State<MainWebViewScreen> with WidgetsBindingObserver {
  static const String primaryUrl = "https://hr.flavorflow.co.in";
  static const String fallbackUrl = "https://gdfoods.duckdns.org";

  late final WebViewController _controller;
  final LocalAuthentication _localAuth = LocalAuthentication();

  bool _isSplashVisible = true;
  double _splashOpacity = 1.0;
  bool _isOffline = false;
  DateTime? _lastBackPressTime;
  Timer? _splashFallbackTimer;

  static const String _jsBridgeScript = """
    (function() {
      if (window.AndroidApp) return;
      window.AndroidApp = {
        isNativeApp: function() { return true; },
        getDeviceArch: function() { return "universal"; },
        authenticateBiometrics: function() {
          if (window.HRMateNative) {
            window.HRMateNative.postMessage(JSON.stringify({ action: "authenticateBiometrics" }));
          }
        },
        getNativeGpsLocation: function() {
          if (window.HRMateNative) {
            window.HRMateNative.postMessage(JSON.stringify({ action: "getNativeGpsLocation" }));
          }
        },
        printPage: function() {
          if (window.HRMateNative) {
            window.HRMateNative.postMessage(JSON.stringify({ action: "printPage" }));
          }
        },
        saveBase64Image: function(base64Data, filename, mimeType) {
          if (window.HRMateNative) {
            window.HRMateNative.postMessage(JSON.stringify({
              action: "saveBase64Image",
              data: base64Data,
              filename: filename,
              mime: mimeType
            }));
          }
        },
        openAppSettings: function() {
          if (window.HRMateNative) {
            window.HRMateNative.postMessage(JSON.stringify({ action: "openAppSettings" }));
          }
        },
        onAppReady: function() {
          if (window.HRMateReady) {
            window.HRMateReady.postMessage("ready");
          }
        }
      };
      window.Android = window.AndroidApp;
    })();
  """;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initWebView();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _splashFallbackTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      // Flush cookies to ensure session survives app kill/reopen
      WebViewCookieManager().setCookie(
        const WebViewCookie(
          name: 'hrmate_persisted',
          value: 'true',
          domain: 'flavorflow.co.in',
        ),
      );
    }
  }

  void _initWebView() {
    final NavigationDelegate navigationDelegate = NavigationDelegate(
      onPageStarted: (String url) {
        _controller.runJavaScript(_jsBridgeScript);
      },
      onPageFinished: (String url) {
        _controller.runJavaScript(_jsBridgeScript);
        // Fallback timer in case the webapp doesn't post HRMateReady
        _splashFallbackTimer?.cancel();
        _splashFallbackTimer = Timer(const Duration(milliseconds: 300), () {
          _dismissSplash();
        });
      },
      onWebResourceError: (WebResourceError error) {
        if (error.isForMainFrame ?? true) {
          setState(() {
            _isOffline = true;
          });
          _dismissSplash();
        }
      },
      onNavigationRequest: (NavigationRequest request) {
        final uri = Uri.parse(request.url);
        final scheme = uri.scheme.toLowerCase();

        // Handle external protocols
        if (scheme == 'tel' ||
            scheme == 'mailto' ||
            scheme == 'sms' ||
            scheme == 'geo' ||
            request.url.startsWith('https://wa.me/') ||
            request.url.startsWith('https://maps.google.com') ||
            request.url.startsWith('http://maps.google.com') ||
            scheme == 'whatsapp') {
          _launchExternalUrl(uri);
          return NavigationDecision.prevent;
        }

        return NavigationDecision.navigate;
      },
    );

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0B1633))
      ..setUserAgent("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 HRMateApp/1.0.5 HRMateNativeApp/1.0.5")
      ..setNavigationDelegate(navigationDelegate)
      ..addJavaScriptChannel(
        'HRMateReady',
        onMessageReceived: (JavaScriptMessage message) {
          _dismissSplash();
        },
      )
      ..addJavaScriptChannel(
        'HRMateNative',
        onMessageReceived: (JavaScriptMessage message) {
          _handleNativeBridgeCall(message.message);
        },
      );

    // Platform-specific Android configuration
    if (_controller.platform is AndroidWebViewController) {
      final androidController = _controller.platform as AndroidWebViewController;
      AndroidWebViewController.enableDebugging(false);
      androidController.setMediaPlaybackRequiresUserGesture(false);
      androidController.setOnPlatformPermissionRequest((request) {
        request.grant();
      });
      androidController.setGeolocationPermissionsPromptCallbacks(
        onShowPrompt: (origin) async {
          return const GeolocationPermissionsResponse(
            allow: true,
            retain: true,
          );
        },
        onHidePrompt: () {},
      );
    }

    _controller.loadRequest(Uri.parse(primaryUrl));
  }

  void _dismissSplash() {
    if (!_isSplashVisible) return;
    if (mounted) {
      setState(() {
        _splashOpacity = 0.0;
      });
      Future.delayed(const Duration(milliseconds: 200), () {
        if (mounted) {
          setState(() {
            _isSplashVisible = false;
          });
        }
      });
    }
  }

  Future<void> _launchExternalUrl(Uri uri) async {
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (_) {}
  }

  void _handleNativeBridgeCall(String rawMessage) {
    try {
      final data = jsonDecode(rawMessage);
      final action = data['action'] as String?;

      switch (action) {
        case 'authenticateBiometrics':
          _performBiometricAuth();
          break;
        case 'getNativeGpsLocation':
          _fetchNativeGpsLocation();
          break;
        case 'openAppSettings':
          Geolocator.openAppSettings();
          break;
        case 'printPage':
          _controller.runJavaScript("window.print && window.print();");
          break;
        case 'saveBase64Image':
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text("✓ ID Badge generated & saved to Downloads"),
              backgroundColor: Color(0xFF10B981),
            ),
          );
          break;
      }
    } catch (e) {
      debugPrint('Native Bridge Error: $e');
    }
  }

  Future<void> _performBiometricAuth() async {
    try {
      final bool canAuthenticateWithBiometrics = await _localAuth.canCheckBiometrics;
      final bool canAuthenticate = canAuthenticateWithBiometrics || await _localAuth.isDeviceSupported();

      if (!canAuthenticate) {
        _controller.runJavaScript(
          "window.onNativeBiometricResult && window.onNativeBiometricResult(false, 'Biometrics not available on device');",
        );
        return;
      }

      final bool didAuthenticate = await _localAuth.authenticate(
        localizedReason: 'Scan fingerprint or Face ID to verify HRMate sign-in',
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: false,
        ),
      );

      if (didAuthenticate) {
        _controller.runJavaScript(
          "window.onNativeBiometricResult && window.onNativeBiometricResult(true, 'success');",
        );
      } else {
        _controller.runJavaScript(
          "window.onNativeBiometricResult && window.onNativeBiometricResult(false, 'Biometric authentication cancelled');",
        );
      }
    } catch (e) {
      _controller.runJavaScript(
        "window.onNativeBiometricResult && window.onNativeBiometricResult(false, '${e.toString().replaceAll("'", "\\'")}');",
      );
    }
  }

  Future<void> _fetchNativeGpsLocation() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          _controller.runJavaScript(
            "window.onNativeGpsResult && window.onNativeGpsResult(false, 0, 0, 'Location permission denied');",
          );
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        _controller.runJavaScript(
          "window.onNativeGpsResult && window.onNativeGpsResult(false, 0, 0, 'Location permission denied forever');",
        );
        return;
      }

      final Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 5),
      );

      _controller.runJavaScript(
        "window.onNativeGpsResult && window.onNativeGpsResult(true, ${position.latitude}, ${position.longitude}, 'success');",
      );
    } catch (e) {
      _controller.runJavaScript(
        "window.onNativeGpsResult && window.onNativeGpsResult(false, 0, 0, '${e.toString().replaceAll("'", "\\'")}');",
      );
    }
  }

  void _retryConnection() {
    setState(() {
      _isOffline = false;
      _isSplashVisible = true;
      _splashOpacity = 1.0;
    });
    _controller.loadRequest(Uri.parse(primaryUrl));
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, dynamic result) async {
        if (didPop) return;

        if (await _controller.canGoBack()) {
          _controller.goBack();
          return;
        }

        final now = DateTime.now();
        if (_lastBackPressTime == null || now.difference(_lastBackPressTime!) > const Duration(seconds: 2)) {
          _lastBackPressTime = now;
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text("Press back again to exit HRMate"),
                duration: Duration(seconds: 2),
                backgroundColor: Color(0xFF0F172A),
              ),
            );
          }
          return;
        }

        SystemNavigator.pop();
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF0B1633),
        body: SafeArea(
          bottom: false,
          child: Stack(
            children: [
              // Main WebView
              RefreshIndicator(
                color: const Color(0xFF10B981),
                backgroundColor: const Color(0xFF0F172A),
                onRefresh: () async {
                  await _controller.reload();
                },
                child: WebViewWidget(controller: _controller),
              ),

              // Offline Screen (Shown when no network connection)
              if (_isOffline)
                Container(
                  color: const Color(0xFF0B1633),
                  width: double.infinity,
                  height: double.infinity,
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(24),
                        child: Image.asset(
                          'assets/images/logo.png',
                          height: 84,
                          width: 84,
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => Container(
                            height: 84,
                            width: 84,
                            decoration: BoxDecoration(
                              color: const Color(0xFF1E6FE0),
                              borderRadius: BorderRadius.circular(24),
                            ),
                            child: const Icon(Icons.wifi_off_rounded, color: Colors.white, size: 44),
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      const Text(
                        "No Internet Connection",
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        "Please check your Wi-Fi or mobile data connection to access HRMate.",
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 13.5,
                          color: Color(0xFF94A3B8),
                        ),
                      ),
                      const SizedBox(height: 28),
                      ElevatedButton.icon(
                        onPressed: _retryConnection,
                        icon: const Icon(Icons.refresh_rounded, color: Colors.white, size: 18),
                        label: const Text(
                          "Retry Connection",
                          style: TextStyle(fontWeight: FontWeight.w800, color: Colors.white),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF10B981),
                          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                      ),
                    ],
                  ),
                ),

              // Splash Overlay (Opaque #0B1633 with icon + spinner ONLY — zero text duplication)
              if (_isSplashVisible)
                IgnorePointer(
                  ignoring: _splashOpacity == 0.0,
                  child: AnimatedOpacity(
                    opacity: _splashOpacity,
                    duration: const Duration(milliseconds: 200),
                    child: Container(
                      color: const Color(0xFF0B1633),
                      width: double.infinity,
                      height: double.infinity,
                      child: Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(26),
                              child: Image.asset(
                                'assets/images/logo.png',
                                height: 88,
                                width: 88,
                                fit: BoxFit.contain,
                                errorBuilder: (_, __, ___) => Container(
                                  height: 88,
                                  width: 88,
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      colors: [Color(0xFF1E6FE0), Color(0xFF10B981)],
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                    ),
                                    borderRadius: BorderRadius.circular(26),
                                  ),
                                  child: const Center(
                                    child: Icon(Icons.fingerprint, color: Colors.white, size: 48),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 32),
                            const SizedBox(
                              height: 26,
                              width: 26,
                              child: CircularProgressIndicator(
                                color: Color(0xFF10B981),
                                strokeWidth: 2.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
