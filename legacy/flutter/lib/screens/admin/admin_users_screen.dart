// lib/screens/admin/admin_users_screen.dart
// UC-008: Manage Users

import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';

class AdminUsersScreen extends StatefulWidget {
  const AdminUsersScreen({super.key});

  @override
  State<AdminUsersScreen> createState() => _AdminUsersScreenState();
}

class _AdminUsersScreenState extends State<AdminUsersScreen> {
  List<Map<String, dynamic>> _rawUsers = [];
  bool _isLoading = true;
  String? _errorMessage;
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load({String? keyword}) async {
    setState(() { _isLoading = true; _errorMessage = null; });
    try {
      final res = await ApiService.getAllUsers(keyword: keyword);
      setState(() {
        _rawUsers = List<Map<String, dynamic>>.from(res['data']);
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() { _errorMessage = e.message; _isLoading = false; });
    } catch (e) {
      setState(() { _errorMessage = 'Gagal memuat data: ${e.toString()}'; _isLoading = false; });
    }
  }

  Future<void> _toggleUser(Map<String, dynamic> raw) async {
    final isActive = raw['isActive'] as bool? ?? true;
    final name = raw['name'] as String? ?? '-';

    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(isActive ? 'Nonaktifkan User?' : 'Aktifkan User?',
            style: const TextStyle(fontFamily: 'Poppins', fontWeight: FontWeight.w600)),
        content: Text(
          isActive ? '$name tidak akan bisa login setelah dinonaktifkan.' : '$name akan dapat login kembali.',
          style: const TextStyle(fontFamily: 'Poppins'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Batal')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: isActive ? AppColors.error : AppColors.success),
            child: Text(isActive ? 'Nonaktifkan' : 'Aktifkan'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    try {
      await ApiService.toggleUserStatus(raw['id']);
      _load(keyword: _searchCtrl.text.trim().isNotEmpty ? _searchCtrl.text : null);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(isActive ? '$name berhasil dinonaktifkan' : '$name berhasil diaktifkan'),
          backgroundColor: isActive ? AppColors.error : AppColors.success,
        ));
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: AppColors.error));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Kelola Users')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              onSubmitted: (v) => _load(keyword: v.trim().isNotEmpty ? v : null),
              onChanged: (v) { if (v.isEmpty) _load(); },
              decoration: InputDecoration(
                hintText: 'Cari nama, email, atau NIM...',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _searchCtrl.text.isNotEmpty
                    ? IconButton(icon: const Icon(Icons.close_rounded),
                        onPressed: () { _searchCtrl.clear(); _load(); })
                    : null,
              ),
            ),
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : _errorMessage != null
                    ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.error_outline_rounded, size: 56, color: AppColors.error),
                          const SizedBox(height: 12),
                          Text(_errorMessage!, textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.error)),
                          const SizedBox(height: 16),
                          ElevatedButton.icon(onPressed: _load, icon: const Icon(Icons.refresh_rounded), label: const Text('Coba Lagi')),
                        ],
                      )))
                    : RefreshIndicator(
                        color: AppColors.primary,
                        onRefresh: _load,
                        child: ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemCount: _rawUsers.length,
                          itemBuilder: (_, i) {
                            final raw = _rawUsers[i];
                            final isActive = raw['isActive'] as bool? ?? true;
                            final isVerified = raw['isVerified'] as bool? ?? false;
                            final name = raw['name'] as String? ?? '-';
                            final email = raw['email'] as String? ?? '-';
                            final studentId = raw['studentId'] as String?;
                            final isAdmin = (raw['role'] as String?) == 'ADMIN';

                            return Container(
                              decoration: AppDecorations.card,
                              padding: const EdgeInsets.all(14),
                              child: Row(
                                children: [
                                  CircleAvatar(
                                    radius: 22,
                                    backgroundColor: isActive ? AppColors.primaryLighter : AppColors.errorLight,
                                    child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
                                        style: TextStyle(fontFamily: 'Poppins', fontWeight: FontWeight.w700,
                                            color: isActive ? AppColors.primary : AppColors.error)),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                      Row(children: [
                                        Flexible(child: Text(name, style: Theme.of(context).textTheme.titleMedium,
                                            maxLines: 1, overflow: TextOverflow.ellipsis)),
                                        if (isVerified) ...[const SizedBox(width: 4), const Icon(Icons.verified_rounded, size: 13, color: AppColors.primary)],
                                      ]),
                                      Text(email, style: Theme.of(context).textTheme.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                                      if (studentId != null) Text('NIM: $studentId', style: Theme.of(context).textTheme.bodySmall),
                                    ]),
                                  ),
                                  const SizedBox(width: 8),
                                  // Status badge yang lebih jelas
                                  isAdmin
                                      ? _Badge(label: 'Admin', color: AppColors.primary)
                                      : GestureDetector(
                                          onTap: () => _toggleUser(raw),
                                          child: _Badge(
                                            label: isActive ? 'Aktif' : 'Nonaktif',
                                            color: isActive ? AppColors.success : AppColors.error,
                                            icon: isActive ? Icons.check_circle_outline_rounded : Icons.block_rounded,
                                          ),
                                        ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  final String label;
  final Color color;
  final IconData? icon;
  const _Badge({required this.label, required this.color, this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: 12, color: color), const SizedBox(width: 4)],
        Text(label, style: TextStyle(fontFamily: 'Poppins', fontSize: 11, fontWeight: FontWeight.w600, color: color)),
      ]),
    );
  }
}
