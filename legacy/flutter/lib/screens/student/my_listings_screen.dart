// lib/screens/student/my_listings_screen.dart
// UC-003: Manage Product Listings

import 'package:flutter/material.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/format_utils.dart';
import 'add_edit_listing_screen.dart';

class MyListingsScreen extends StatefulWidget {
  const MyListingsScreen({super.key});

  @override
  State<MyListingsScreen> createState() => _MyListingsScreenState();
}

class _MyListingsScreenState extends State<MyListingsScreen> {
  List<ListingModel> _listings = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiService.getMyListings();
      final data = res['data'] as List;
      setState(() {
        _listings = data.map((e) => ListingModel.fromJson(e)).toList();
        _isLoading = false;
      });
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _delete(ListingModel listing) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Hapus Listing?', style: TextStyle(fontWeight: FontWeight.w600)),
        content: Text('Listing "${listing.title}" akan dihapus.', style: const TextStyle()),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Batal')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Hapus'),
          ),
        ],
      ),
    );

    if (confirm != true) return;
    try {
      await ApiService.deleteListing(listing.id);
      _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Listing dihapus'), backgroundColor: AppColors.success),
        );
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'ACTIVE': return AppColors.success;
      case 'PENDING': return AppColors.warning;
      case 'REJECTED': return AppColors.error;
      case 'SOLD': return AppColors.info;
      default: return AppColors.grey500;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Jualanku'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _load,
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _load,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
            : _listings.isEmpty
                ? _EmptyState(onAdd: () async {
                    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AddEditListingScreen()));
                    _load();
                  })
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemCount: _listings.length,
                    itemBuilder: (_, i) {
                      final listing = _listings[i];
                      return Container(
                        decoration: AppDecorations.card,
                        child: Column(
                          children: [
                            ListTile(
                              contentPadding: const EdgeInsets.fromLTRB(16, 12, 8, 4),
                              leading: Container(
                                width: 56,
                                height: 56,
                                decoration: BoxDecoration(
                                  color: AppColors.primaryLighter,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: listing.images.isNotEmpty
                                    ? ClipRRect(
                                        borderRadius: BorderRadius.circular(12),
                                        child: Image.network(listing.images.first, fit: BoxFit.cover),
                                      )
                                    : const Icon(Icons.image_outlined, color: AppColors.primary),
                              ),
                              title: Text(
                                listing.title,
                                style: Theme.of(context).textTheme.titleMedium,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const SizedBox(height: 4),
                                  Text(
                                    FormatUtils.currency(listing.price),
                                    style: const TextStyle(
                                      
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.primary,
                                      fontSize: 14,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: _statusColor(listing.status).withOpacity(0.12),
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: Text(
                                      listing.statusLabel,
                                      style: TextStyle(
                                        
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: _statusColor(listing.status),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              trailing: PopupMenuButton<String>(
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                onSelected: (val) async {
                                  if (val == 'edit') {
                                    await Navigator.of(context).push(
                                      MaterialPageRoute(builder: (_) => AddEditListingScreen(listing: listing)),
                                    );
                                    _load();
                                  } else if (val == 'delete') {
                                    _delete(listing);
                                  }
                                },
                                itemBuilder: (_) => [
                                  if (!['SOLD', 'REJECTED'].contains(listing.status))
                                    const PopupMenuItem(value: 'edit', child: Row(children: [Icon(Icons.edit_outlined, size: 18), SizedBox(width: 8), Text('Edit')])),
                                  const PopupMenuItem(value: 'delete', child: Row(children: [Icon(Icons.delete_outline, size: 18, color: Colors.red), SizedBox(width: 8), Text('Hapus', style: TextStyle(color: Colors.red))])),
                                ],
                              ),
                            ),
                            if (listing.status == 'PENDING')
                              Padding(
                                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                                child: Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: AppColors.warningLight,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.hourglass_empty_rounded, size: 14, color: AppColors.warning),
                                      const SizedBox(width: 6),
                                      Text(
                                        'Sedang menunggu review admin',
                                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.warning, fontWeight: FontWeight.w500),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            if (listing.status == 'REJECTED')
                              Padding(
                                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                                child: Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: AppColors.errorLight,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.cancel_outlined, size: 14, color: AppColors.error),
                                      const SizedBox(width: 6),
                                      Text(
                                        'Ditolak admin. Edit listing untuk mengajukan ulang.',
                                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.error),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                          ],
                        ),
                      );
                    },
                  ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AddEditListingScreen()));
          _load();
        },
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('Tambah Listing', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.white)),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final VoidCallback onAdd;
  const _EmptyState({required this.onAdd});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.storefront_outlined, size: 80, color: AppColors.grey300),
          const SizedBox(height: 16),
          Text('Belum ada listing', style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: AppColors.grey500)),
          const SizedBox(height: 8),
          Text('Mulai jual barang atau jasa kamu!', style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: onAdd,
            icon: const Icon(Icons.add_rounded),
            label: const Text('Tambah Listing'),
          ),
        ],
      ),
    );
  }
}
