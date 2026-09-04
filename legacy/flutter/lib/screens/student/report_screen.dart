// lib/screens/student/report_screen.dart
// Halaman laporan/pengaduan untuk student

import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';

class ReportScreen extends StatefulWidget {
  final String targetType;  // 'USER' atau 'LISTING'
  final String targetId;
  final String targetName;  // Nama listing atau user yang dilaporkan

  const ReportScreen({
    super.key,
    required this.targetType,
    required this.targetId,
    required this.targetName,
  });

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  final _formKey = GlobalKey<FormState>();
  final _descCtrl = TextEditingController();
  String? _selectedReason;
  bool _isSubmitting = false;

  final _reasons = [
    'Produk/jasa tidak sesuai deskripsi',
    'Penjual tidak responsif',
    'Harga tidak wajar atau penipuan',
    'Konten tidak pantas',
    'Spam atau iklan berlebihan',
    'Melanggar aturan komunitas BINUS',
    'Lainnya',
  ];

  @override
  void dispose() {
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);
    try {
      await ApiService.createComplaint(
        targetType: widget.targetType,
        targetId: widget.targetId,
        reason: _selectedReason!,
        description: _descCtrl.text.trim().isNotEmpty ? _descCtrl.text.trim() : null,
      );

      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Laporan berhasil dikirim. Admin akan meninjau dalam 1x24 jam.'),
          backgroundColor: AppColors.success,
          duration: Duration(seconds: 4),
        ),
      );
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Buat Laporan')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Info yang dilaporkan
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.errorLight,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.error.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.flag_rounded, color: AppColors.error, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Melaporkan ${widget.targetType == 'LISTING' ? 'Listing' : 'User'}',
                            style: const TextStyle(fontFamily: 'Poppins', fontSize: 12, color: AppColors.error),
                          ),
                          Text(
                            widget.targetName,
                            style: const TextStyle(fontFamily: 'Poppins', fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.error),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Pilih alasan
              Text('Alasan Laporan *', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              ...(_reasons.map((reason) => RadioListTile<String>(
                value: reason,
                groupValue: _selectedReason,
                onChanged: (v) => setState(() => _selectedReason = v),
                title: Text(reason, style: const TextStyle(fontFamily: 'Poppins', fontSize: 14)),
                contentPadding: EdgeInsets.zero,
                activeColor: AppColors.primary,
                dense: true,
              ))),

              // Validasi alasan
              if (_formKey.currentState != null && _selectedReason == null)
                const Padding(
                  padding: EdgeInsets.only(left: 4),
                  child: Text('Pilih alasan laporan', style: TextStyle(fontFamily: 'Poppins', fontSize: 12, color: AppColors.error)),
                ),

              const SizedBox(height: 16),

              // Deskripsi tambahan
              Text('Detail Tambahan (Opsional)', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              TextFormField(
                controller: _descCtrl,
                maxLines: 4,
                maxLength: 500,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  hintText: 'Jelaskan lebih detail masalah yang kamu temukan...',
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 8),

              // Info kebijakan
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.primaryLighter,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.info_outline_rounded, size: 16, color: AppColors.primary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Laporan palsu atau penyalahgunaan fitur ini dapat mengakibatkan akunmu dinonaktifkan.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.primary),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Tombol submit
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _isSubmitting
                      ? null
                      : () {
                          if (_selectedReason == null) {
                            setState(() {}); // trigger rebuild untuk tampilkan error
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Pilih alasan laporan terlebih dahulu'),
                                backgroundColor: AppColors.error,
                              ),
                            );
                            return;
                          }
                          _submit();
                        },
                  icon: _isSubmitting
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.send_rounded, size: 18),
                  label: Text(_isSubmitting ? 'Mengirim...' : 'Kirim Laporan'),
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
