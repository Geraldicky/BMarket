// lib/screens/admin/admin_main_screen.dart
import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import 'admin_dashboard_screen.dart';
import 'admin_moderate_screen.dart';
import 'admin_users_screen.dart';
import 'admin_complaints_screen.dart';
import 'admin_commission_screen.dart';

class AdminMainScreen extends StatefulWidget {
  const AdminMainScreen({super.key});

  @override
  State<AdminMainScreen> createState() => _AdminMainScreenState();
}

class _AdminMainScreenState extends State<AdminMainScreen> {
  int _idx = 0;

  final _screens = const [
    AdminDashboardScreen(),
    AdminModerateScreen(),
    AdminUsersScreen(),
    AdminComplaintsScreen(),
    AdminCommissionScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _idx, children: _screens),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _idx,
        onTap: (i) => setState(() => _idx = i),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined), activeIcon: Icon(Icons.dashboard_rounded), label: 'Dashboard'),
          BottomNavigationBarItem(icon: Icon(Icons.rule_outlined), activeIcon: Icon(Icons.rule_rounded), label: 'Moderasi'),
          BottomNavigationBarItem(icon: Icon(Icons.people_outline_rounded), activeIcon: Icon(Icons.people_rounded), label: 'Users'),
          BottomNavigationBarItem(icon: Icon(Icons.report_outlined), activeIcon: Icon(Icons.report_rounded), label: 'Pengaduan'),
          BottomNavigationBarItem(icon: Icon(Icons.percent_outlined), activeIcon: Icon(Icons.percent_rounded), label: 'Komisi'),
        ],
      ),
    );
  }
}
