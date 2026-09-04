// lib/main.dart
// Entry point aplikasi BINUS Marketplace

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';

import 'theme/app_theme.dart';
import 'services/auth_provider.dart';
import 'screens/auth/splash_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/register_screen.dart';
import 'screens/student/main_nav_screen.dart';
import 'screens/admin/admin_main_screen.dart';

void main() async {
  // Wajib dipanggil sebelum menggunakan plugin/async di main
  WidgetsFlutterBinding.ensureInitialized();

  // Inisialisasi locale Indonesia agar DateFormat('id_ID') bekerja dengan benar
  await initializeDateFormatting('id_ID', null);

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
      ],
      child: const BinusMarketplaceApp(),
    ),
  );
}

class BinusMarketplaceApp extends StatelessWidget {
  const BinusMarketplaceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BINUS Marketplace',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,

      // Localization: paksa app pakai bahasa Indonesia
      locale: const Locale('id', 'ID'),
      supportedLocales: const [
        Locale('id', 'ID'), // Indonesia
        Locale('en', 'US'), // English fallback
      ],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],

      initialRoute: '/splash',
      routes: {
        '/splash': (ctx) => const SplashScreen(),
        '/login': (ctx) => const LoginScreen(),
        '/register': (ctx) => const RegisterScreen(),
        '/home': (ctx) => const MainNavScreen(),
        '/admin': (ctx) => const AdminMainScreen(),
      },
    );
  }
}
