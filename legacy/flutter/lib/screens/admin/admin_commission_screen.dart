// lib/screens/admin/admin_commission_screen.dart
// Manajemen Komisi (Monetisasi)

import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/format_utils.dart';

class AdminCommissionScreen extends StatefulWidget {
  const AdminCommissionScreen({super.key});

  @override
  State<AdminCommissionScreen> createState() => _AdminCommissionScreenState();
}

class _AdminCommissionScreenState extends State<AdminCommissionScreen> {
  double _currentRate = 5.0;
  List<Map<String, dynamic>> _history = [];
  bool _isLoading = true;
  bool _isSaving = false;
  final _rateCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _rateCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final resRate = await ApiService.getAdminCommission();
      final resHistory = await ApiService.getAdminCommissionHistory();
      setState(() {
        _currentRate = (resRate['data']['rate'] as num).toDouble();
        _rateCtrl.text = _currentRate.toStringAsFixed(1);
        _history = List<Map<String, dynamic>>.from(resHistory['data']);
        _isLoading = false;
      });
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _saveRate() async {
    final rate = double.tryParse(_rateCtrl.text);
    if (rate == null || rate < 0 || rate > 100) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Komisi harus antara 0% - 100%'), backgroundColor: AppColors.error),
      );
      return;
    }

    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Ubah Komisi?', style: TextStyle(fontFamily: 'Poppins', fontWeight: FontWeight.w600)),
        content: Text(
          'Komisi akan diubah dari ${_currentRate.toStringAsFixed(1)}% menjadi ${rate.toStringAsFixed(1)}%.\n\nKomisi baru hanya berlaku untuk transaksi yang dibuat setelah perubahan ini.',
          style: const TextStyle(fontFamily: 'Poppins'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Batal')),
          ElevatedButton(onPressed: () => Navigator.pop(context, true), child: const Text('Simpan')),
        ],
      ),
    );
    if (confirm != true) return;

    setState(() => _isSaving = true);
    try {
      await ApiService.setAdminCommission(rate);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Komisi berhasil diubah menjadi ${rate.toStringAsFixed(1)}%'), backgroundColor: AppColors.success),
        );
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message), backgroundColor: AppColors.error));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Manajemen Komisi')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : RefreshIndicator(
              color: AppColors.primary,
              onRefresh: _load,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Info card
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: AppDecorations.blueGradient.copyWith(borderRadius: BorderRadius.circular(16)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Model Monetisasi', style: TextStyle(fontFamily: 'Poppins', color: Colors.white70, fontSize: 13)),
                          const SizedBox(height: 4),
                          const Text('Komisi per Transaksi', style: TextStyle(fontFamily: 'Poppins', fontSize: 20, fontWeight: FontWeight.w700, color: Colors.white)),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              const Icon(Icons.info_outline_rounded, color: Colors.white70, size: 14),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  'Komisi dipotong otomatis dari harga jual saat transaksi dibuat.',
                                  style: TextStyle(fontFamily: 'Poppins', fontSize: 12, color: Colors.white.withOpacity(0.8)),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Current rate card
                    Container(
                      decoration: AppDecorations.card,
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Komisi Aktif Sekarang', style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Text(
                                '${_currentRate.toStringAsFixed(1)}%',
                                style: const TextStyle(fontFamily: 'Poppins', fontSize: 40, fontWeight: FontWeight.w700, color: AppColors.primary),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  'dari setiap transaksi yang selesai',
                                  style: Theme.of(context).textTheme.bodyMedium,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          // Contoh kalkulasi
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(color: AppColors.primaryLighter, borderRadius: BorderRadius.circular(10)),
                            child: Column(
                              children: [
                                _CalcRow(label: 'Harga barang', value: FormatUtils.currency(100000)),
                                _CalcRow(label: 'Komisi (${_currentRate.toStringAsFixed(1)}%)', value: '- ${FormatUtils.currency(100000 * _currentRate / 100)}'),
                                const Divider(height: 12),
                                _CalcRow(label: 'Seller terima', value: FormatUtils.currency(100000 * (1 - _currentRate / 100)), bold: true),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Ubah komisi
                    Container(
                      decoration: AppDecorations.card,
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Ubah Persentase Komisi', style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: _rateCtrl,
                                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                  decoration: const InputDecoration(
                                    labelText: 'Komisi (%)',
                                    hintText: '0.0 - 100.0',
                                    suffixText: '%',
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              ElevatedButton(
                                onPressed: _isSaving ? null : _saveRate,
                                child: _isSaving
                                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                    : const Text('Simpan'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Riwayat perubahan
                    if (_history.isNotEmpty) ...[
                      Text('Riwayat Perubahan', style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 10),
                      Container(
                        decoration: AppDecorations.card,
                        child: ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemCount: _history.length,
                          itemBuilder: (_, i) {
                            final h = _history[i];
                            final isLatest = i == 0;
                            return ListTile(
                              leading: Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: isLatest ? AppColors.primaryLighter : AppColors.grey100,
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(Icons.percent_rounded, size: 16, color: isLatest ? AppColors.primary : AppColors.grey500),
                              ),
                              title: Text(
                                '${(h['rate'] as num).toStringAsFixed(1)}%',
                                style: TextStyle(fontFamily: 'Poppins', fontWeight: FontWeight.w700, color: isLatest ? AppColors.primary : AppColors.textPrimary),
                              ),
                              subtitle: Text(
                                FormatUtils.dateTime(DateTime.parse(h['createdAt'])),
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                              trailing: isLatest
                                  ? Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(color: AppColors.primaryLighter, borderRadius: BorderRadius.circular(20)),
                                      child: const Text('Aktif', style: TextStyle(fontFamily: 'Poppins', fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary)),
                                    )
                                  : null,
                            );
                          },
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
    );
  }
}

class _CalcRow extends StatelessWidget {
  final String label, value;
  final bool bold;
  const _CalcRow({required this.label, required this.value, this.bold = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontFamily: 'Poppins', fontSize: 13, color: AppColors.textSecondary, fontWeight: bold ? FontWeight.w600 : FontWeight.normal)),
          Text(value, style: TextStyle(fontFamily: 'Poppins', fontSize: 13, color: bold ? AppColors.primary : AppColors.textPrimary, fontWeight: bold ? FontWeight.w700 : FontWeight.w500)),
        ],
      ),
    );
  }
}
