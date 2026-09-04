// lib/screens/student/profile_screen.dart
// UC: Manage Profile + Virtual Balance

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/api_service.dart';
import '../../services/auth_provider.dart';
import '../../theme/app_theme.dart';
import '../../utils/format_utils.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _isEditing = false;
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _bioCtrl = TextEditingController();
  bool _isSaving = false;
  double _balance = 0;
  double _escrow = 0;
  bool _loadingBalance = true;

  @override
  void initState() {
    super.initState();
    _loadBalance();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _bioCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadBalance() async {
    try {
      final res = await ApiService.getBalance();
      if (mounted) {
        setState(() {
          _balance = (res['data']['balance'] as num).toDouble();
          _escrow = (res['data']['escrow'] as num).toDouble();
          _loadingBalance = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingBalance = false);
    }
  }

  void _startEditing(user) {
    _nameCtrl.text = user.name;
    _phoneCtrl.text = user.phone ?? '';
    _bioCtrl.text = user.bio ?? '';
    setState(() => _isEditing = true);
  }

  Future<void> _saveProfile() async {
    setState(() => _isSaving = true);
    try {
      await ApiService.updateProfile({
        'name': _nameCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim().isNotEmpty ? _phoneCtrl.text.trim() : null,
        'bio': _bioCtrl.text.trim().isNotEmpty ? _bioCtrl.text.trim() : null,
      });
      await context.read<AuthProvider>().refreshUser();
      setState(() { _isEditing = false; _isSaving = false; });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profil berhasil diperbarui'), backgroundColor: AppColors.success),
        );
      }
    } on ApiException catch (e) {
      setState(() => _isSaving = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
      );
    }
  }

  Future<void> _logout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Keluar?', style: TextStyle(fontFamily: 'Poppins', fontWeight: FontWeight.w600)),
        content: const Text('Kamu akan keluar dari akun ini.', style: TextStyle(fontFamily: 'Poppins')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Batal')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Keluar'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    await context.read<AuthProvider>().logout();
    if (mounted) Navigator.of(context).pushReplacementNamed('/login');
  }

  Future<void> _showTopup() async {
    final amountCtrl = TextEditingController();
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(width: 40, height: 4,
                    decoration: BoxDecoration(color: AppColors.grey300, borderRadius: BorderRadius.circular(2))),
              ),
              const SizedBox(height: 20),
              const Text('Topup Saldo', style: TextStyle(fontFamily: 'Poppins', fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              const Text('Saldo digunakan untuk membayar produk/jasa di marketplace.',
                  style: TextStyle(fontFamily: 'Poppins', fontSize: 13, color: AppColors.textSecondary)),
              const SizedBox(height: 16),
              TextField(
                controller: amountCtrl,
                keyboardType: TextInputType.number,
                autofocus: true,
                decoration: const InputDecoration(
                  labelText: 'Nominal Topup',
                  prefixIcon: Icon(Icons.account_balance_wallet_outlined),
                  hintText: '100000',
                ),
              ),
              const SizedBox(height: 12),
              // Chip quick amount
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [50000, 100000, 250000, 500000, 1000000, 5000000].map((amt) =>
                  ActionChip(
                    label: Text(
                      amt >= 1000000 ? 'Rp ${(amt / 1000000).toStringAsFixed(0)}jt' : 'Rp ${(amt / 1000).toStringAsFixed(0)}rb',
                      style: const TextStyle(fontFamily: 'Poppins', fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary),
                    ),
                    backgroundColor: AppColors.primaryLighter,
                    onPressed: () => amountCtrl.text = amt.toString(),
                  ),
                ).toList(),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    final amount = double.tryParse(amountCtrl.text);
                    if (amount == null || amount <= 0) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Masukkan nominal yang valid'), backgroundColor: AppColors.error),
                      );
                      return;
                    }
                    try {
                      await ApiService.topupBalance(amount);
                      if (mounted) {
                        Navigator.pop(context);
                        await _loadBalance();
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Topup ${FormatUtils.currency(amount)} berhasil!'),
                            backgroundColor: AppColors.success,
                          ),
                        );
                      }
                    } on ApiException catch (e) {
                      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
                      );
                    }
                  },
                  child: const Text('Topup Sekarang'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    if (user == null) return const SizedBox();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Profil Saya'),
        actions: [
          if (!_isEditing)
            IconButton(icon: const Icon(Icons.edit_outlined), onPressed: () => _startEditing(user))
          else
            TextButton(
              onPressed: () => setState(() => _isEditing = false),
              child: const Text('Batal', style: TextStyle(color: Colors.white)),
            ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _loadBalance,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            children: [
              // ── Header ───────────────────────────
              Container(
                width: double.infinity,
                decoration: AppDecorations.blueGradient,
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
                child: Column(
                  children: [
                    CircleAvatar(
                      radius: 44,
                      backgroundColor: Colors.white.withOpacity(0.3),
                      child: user.avatarUrl != null
                          ? ClipOval(child: Image.network(user.avatarUrl!, width: 88, height: 88, fit: BoxFit.cover))
                          : Text(user.name[0].toUpperCase(),
                              style: const TextStyle(fontFamily: 'Poppins', fontSize: 36, fontWeight: FontWeight.w700, color: Colors.white)),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(user.name, style: const TextStyle(fontFamily: 'Poppins', fontSize: 20, fontWeight: FontWeight.w700, color: Colors.white)),
                        if (user.isVerified) ...[const SizedBox(width: 6), const Icon(Icons.verified_rounded, color: Colors.white, size: 18)],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(user.email, style: const TextStyle(fontFamily: 'Poppins', fontSize: 13, color: Colors.white70)),
                    if (user.studentId != null)
                      Text('NIM: ${user.studentId}', style: const TextStyle(fontFamily: 'Poppins', fontSize: 12, color: Colors.white60)),
                  ],
                ),
              ),

              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    // ── Saldo Virtual (hanya student) ─
                    if (!user.isAdmin) ...[
                      _BalanceCard(
                        balance: _balance,
                        escrow: _escrow,
                        isLoading: _loadingBalance,
                        onTopup: _showTopup,
                        onRefresh: _loadBalance,
                      ),
                      const SizedBox(height: 16),
                    ],

                    // ── Edit form atau info ───────────
                    if (_isEditing)
                      _EditForm(
                        nameCtrl: _nameCtrl,
                        phoneCtrl: _phoneCtrl,
                        bioCtrl: _bioCtrl,
                        isSaving: _isSaving,
                        onSave: _saveProfile,
                      )
                    else
                      _ProfileInfo(user: user),

                    const SizedBox(height: 20),

                    // ── Logout ────────────────────────
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: _logout,
                        icon: const Icon(Icons.logout_rounded, color: AppColors.error),
                        label: const Text('Keluar'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.error,
                          side: const BorderSide(color: AppColors.error),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Balance Card ──────────────────────────────
class _BalanceCard extends StatelessWidget {
  final double balance, escrow;
  final bool isLoading;
  final VoidCallback onTopup, onRefresh;

  const _BalanceCard({
    required this.balance,
    required this.escrow,
    required this.isLoading,
    required this.onTopup,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary, AppColors.primaryLight],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: AppColors.primary.withOpacity(0.3), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.account_balance_wallet_rounded, color: Colors.white70, size: 16),
              const SizedBox(width: 6),
              const Text('Saldo Tersedia', style: TextStyle(fontFamily: 'Poppins', fontSize: 13, color: Colors.white70)),
              const Spacer(),
              GestureDetector(
                onTap: onRefresh,
                child: const Icon(Icons.refresh_rounded, color: Colors.white70, size: 18),
              ),
            ],
          ),
          const SizedBox(height: 8),
          isLoading
              ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : Text(
                  FormatUtils.currency(balance),
                  style: const TextStyle(fontFamily: 'Poppins', fontSize: 26, fontWeight: FontWeight.w700, color: Colors.white),
                ),
          if (escrow > 0) ...[
            const SizedBox(height: 4),
            Text(
              '🔒 ${FormatUtils.currency(escrow)} dalam escrow',
              style: const TextStyle(fontFamily: 'Poppins', fontSize: 12, color: Colors.white70),
            ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: onTopup,
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('Topup Saldo'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: AppColors.primary,
                elevation: 0,
                textStyle: const TextStyle(fontFamily: 'Poppins', fontWeight: FontWeight.w600, fontSize: 14),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Profile Info ──────────────────────────────
class _ProfileInfo extends StatelessWidget {
  final dynamic user;
  const _ProfileInfo({required this.user});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: AppDecorations.card,
      child: Column(
        children: [
          _InfoTile(icon: Icons.phone_outlined, label: 'No. Telepon', value: user.phone ?? '-'),
          const Divider(height: 1),
          _InfoTile(icon: Icons.info_outline_rounded, label: 'Bio', value: user.bio ?? '-'),
          const Divider(height: 1),
          _InfoTile(
            icon: Icons.verified_user_outlined,
            label: 'Status',
            value: user.isVerified ? 'Terverifikasi BINUS' : 'Belum Terverifikasi',
          ),
        ],
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String label, value;
  const _InfoTile({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: AppColors.primary, size: 20),
      title: Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary)),
      subtitle: Text(value, style: Theme.of(context).textTheme.bodyLarge),
    );
  }
}

// ── Edit Form ─────────────────────────────────
class _EditForm extends StatelessWidget {
  final TextEditingController nameCtrl, phoneCtrl, bioCtrl;
  final bool isSaving;
  final VoidCallback onSave;

  const _EditForm({
    required this.nameCtrl,
    required this.phoneCtrl,
    required this.bioCtrl,
    required this.isSaving,
    required this.onSave,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TextFormField(
          controller: nameCtrl,
          decoration: const InputDecoration(
            labelText: 'Nama Lengkap',
            prefixIcon: Icon(Icons.person_outline_rounded),
          ),
        ),
        const SizedBox(height: 16),
        TextFormField(
          controller: phoneCtrl,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(
            labelText: 'No. Telepon (opsional)',
            prefixIcon: Icon(Icons.phone_outlined),
          ),
        ),
        const SizedBox(height: 16),
        TextFormField(
          controller: bioCtrl,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Bio (opsional)',
            hintText: 'Ceritakan sedikit tentang dirimu...',
            alignLabelWithHint: true,
          ),
        ),
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: isSaving ? null : onSave,
            child: isSaving
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Simpan Profil'),
          ),
        ),
      ],
    );
  }
}
