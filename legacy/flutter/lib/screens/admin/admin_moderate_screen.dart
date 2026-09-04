// lib/screens/admin/admin_moderate_screen.dart
// UC-006: Moderate Products

import 'package:flutter/material.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/format_utils.dart';

class AdminModerateScreen extends StatefulWidget {
  const AdminModerateScreen({super.key});

  @override
  State<AdminModerateScreen> createState() => _AdminModerateScreenState();
}

class _AdminModerateScreenState extends State<AdminModerateScreen> {
  List<ListingModel> _listings = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final res = await ApiService.getPendingListings();
      final data = res['data'] as List;
      setState(() {
        _listings = data.map((e) => ListingModel.fromJson(e as Map<String, dynamic>)).toList();
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _errorMessage = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Gagal memuat data: ${e.toString()}';
        _isLoading = false;
      });
    }
  }

  Future<void> _moderate(ListingModel listing, String action) async {
    final isApprove = action == 'approve';
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          isApprove ? 'Setujui Listing?' : 'Tolak Listing?',
          style: const TextStyle(fontFamily: 'Poppins', fontWeight: FontWeight.w600),
        ),
        content: Text(
          isApprove
              ? '"${listing.title}" akan ditampilkan di marketplace.'
              : '"${listing.title}" akan ditolak dan tidak ditampilkan.',
          style: const TextStyle(fontFamily: 'Poppins'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Batal')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: isApprove ? AppColors.success : AppColors.error),
            child: Text(isApprove ? 'Setujui' : 'Tolak'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    try {
      await ApiService.moderateListing(listing.id, action);
      _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(isApprove ? 'Listing berhasil disetujui' : 'Listing berhasil ditolak'),
            backgroundColor: isApprove ? AppColors.success : AppColors.error,
          ),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal: ${e.toString()}'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text('Moderasi Listing${_listings.isNotEmpty ? " (${_listings.length})" : ""}'),
        actions: [IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _load)],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _errorMessage != null
              // Tampilkan error dengan tombol retry
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline_rounded, size: 56, color: AppColors.error),
                        const SizedBox(height: 12),
                        Text(
                          _errorMessage!,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.error),
                        ),
                        const SizedBox(height: 20),
                        ElevatedButton.icon(
                          onPressed: _load,
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Coba Lagi'),
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: _load,
                  child: _listings.isEmpty
                      ? const Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.check_circle_outline_rounded, size: 72, color: AppColors.success),
                              SizedBox(height: 12),
                              Text(
                                'Semua listing sudah direview!',
                                style: TextStyle(fontFamily: 'Poppins', fontSize: 16, color: AppColors.grey500),
                              ),
                            ],
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemCount: _listings.length,
                          itemBuilder: (_, i) => _ModerateCard(
                            listing: _listings[i],
                            onApprove: () => _moderate(_listings[i], 'approve'),
                            onReject: () => _moderate(_listings[i], 'reject'),
                          ),
                        ),
                ),
    );
  }
}

class _ModerateCard extends StatelessWidget {
  final ListingModel listing;
  final VoidCallback onApprove, onReject;
  const _ModerateCard({required this.listing, required this.onApprove, required this.onReject});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: AppDecorations.card,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Badges tipe & kategori
          Row(
            children: [
              _Badge(
                label: listing.type == 'SERVICE' ? 'Jasa' : 'Produk',
                color: listing.type == 'SERVICE' ? AppColors.info : AppColors.primary,
              ),
              const SizedBox(width: 8),
              _Badge(label: listing.categoryLabel, color: AppColors.grey600),
            ],
          ),
          const SizedBox(height: 10),

          // Judul
          Text(listing.title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),

          // Harga
          Text(
            FormatUtils.currency(listing.price),
            style: const TextStyle(fontFamily: 'Poppins', fontWeight: FontWeight.w700, color: AppColors.primary, fontSize: 15),
          ),
          const SizedBox(height: 8),

          // Deskripsi
          Text(listing.description, style: Theme.of(context).textTheme.bodyMedium, maxLines: 3, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 8),

          // Info seller
          if (listing.seller != null)
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: AppColors.grey50, borderRadius: BorderRadius.circular(8)),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 16,
                    backgroundColor: AppColors.primaryLighter,
                    child: Text(
                      listing.seller!.name[0].toUpperCase(),
                      style: const TextStyle(fontFamily: 'Poppins', fontWeight: FontWeight.w700, color: AppColors.primary, fontSize: 12),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(listing.seller!.name, style: Theme.of(context).textTheme.labelMedium),
                            if (listing.seller!.isVerified) ...[
                              const SizedBox(width: 4),
                              const Icon(Icons.verified_rounded, size: 12, color: AppColors.primary),
                            ],
                          ],
                        ),
                        Text(FormatUtils.timeAgo(listing.createdAt), style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ),
                  ),
                ],
              ),
            ),

          const SizedBox(height: 14),
          const Divider(height: 1),
          const SizedBox(height: 12),

          // Tombol Tolak & Setujui
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onReject,
                  icon: const Icon(Icons.close_rounded, size: 16, color: AppColors.error),
                  label: const Text('Tolak'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.error,
                    side: const BorderSide(color: AppColors.error),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: onApprove,
                  icon: const Icon(Icons.check_rounded, size: 16),
                  label: const Text('Setujui'),
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  final String label;
  final Color color;
  const _Badge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: TextStyle(fontFamily: 'Poppins', fontSize: 11, fontWeight: FontWeight.w600, color: color)),
    );
  }
}
