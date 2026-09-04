// lib/screens/admin/admin_complaints_screen.dart
// UC-007: Handle Complaints

import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/format_utils.dart';

class AdminComplaintsScreen extends StatefulWidget {
  const AdminComplaintsScreen({super.key});

  @override
  State<AdminComplaintsScreen> createState() => _AdminComplaintsScreenState();
}

class _AdminComplaintsScreenState extends State<AdminComplaintsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  Map<String, List<Map<String, dynamic>>> _complaints = {
    'OPEN': [],
    'IN_REVIEW': [],
    'RESOLVED': [],
    'DISMISSED': [],
  };
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiService.getComplaints(); // sekarang panggil /admin/complaints
      final data = List<Map<String, dynamic>>.from(res['data']);

      final grouped = <String, List<Map<String, dynamic>>>{
        'OPEN': [],
        'IN_REVIEW': [],
        'RESOLVED': [],
        'DISMISSED': [],
      };

      for (final c in data) {
        final status = c['status'] as String? ?? 'OPEN';
        grouped[status]?.add(c);
      }

      setState(() {
        _complaints = grouped;
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() => _isLoading = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: ${e.message}'), backgroundColor: AppColors.error),
      );
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Gagal memuat: ${e.toString()}'), backgroundColor: AppColors.error),
      );
    }
  }

  Future<void> _updateStatus(String id, String status) async {
    try {
      await ApiService.updateComplaintStatusAdmin(id, status); // gunakan admin endpoint
      _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Status pengaduan diperbarui'), backgroundColor: AppColors.success),
        );
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
      );
    }
  }

  Future<void> _showDetail(Map<String, dynamic> complaint) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ComplaintDetailSheet(
        complaint: complaint,
        onUpdateStatus: _updateStatus,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final open = (_complaints['OPEN']?.length ?? 0) + (_complaints['IN_REVIEW']?.length ?? 0);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text('Pengaduan${open > 0 ? " ($open)" : ""}'),
        actions: [IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _load)],
        bottom: TabBar(
          controller: _tabController,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
          tabs: [
            Tab(text: 'Baru (${_complaints['OPEN']?.length ?? 0})'),
            Tab(text: 'Proses (${_complaints['IN_REVIEW']?.length ?? 0})'),
            Tab(text: 'Selesai'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : TabBarView(
              controller: _tabController,
              children: [
                _ComplaintList(complaints: _complaints['OPEN'] ?? [], onTap: _showDetail),
                _ComplaintList(complaints: _complaints['IN_REVIEW'] ?? [], onTap: _showDetail),
                _ComplaintList(
                  complaints: [
                    ...(_complaints['RESOLVED'] ?? []),
                    ...(_complaints['DISMISSED'] ?? []),
                  ],
                  onTap: _showDetail,
                ),
              ],
            ),
    );
  }
}

class _ComplaintList extends StatelessWidget {
  final List<Map<String, dynamic>> complaints;
  final Function(Map<String, dynamic>) onTap;

  const _ComplaintList({required this.complaints, required this.onTap});

  @override
  Widget build(BuildContext context) {
    if (complaints.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.check_circle_outline_rounded, size: 64, color: AppColors.grey300),
            const SizedBox(height: 12),
            Text('Tidak ada pengaduan', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.grey500)),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemCount: complaints.length,
      itemBuilder: (_, i) {
        final c = complaints[i];
        final reporter = c['reporter'] as Map<String, dynamic>?;
        final status = c['status'] as String;

        Color statusColor;
        switch (status) {
          case 'OPEN': statusColor = AppColors.error; break;
          case 'IN_REVIEW': statusColor = AppColors.warning; break;
          case 'RESOLVED': statusColor = AppColors.success; break;
          default: statusColor = AppColors.grey500;
        }

        String statusLabel;
        switch (status) {
          case 'OPEN': statusLabel = 'Baru'; break;
          case 'IN_REVIEW': statusLabel = 'Diproses'; break;
          case 'RESOLVED': statusLabel = 'Selesai'; break;
          default: statusLabel = 'Ditolak';
        }

        return GestureDetector(
          onTap: () => onTap(c),
          child: Container(
            decoration: AppDecorations.card,
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(statusLabel, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: statusColor)),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                      decoration: BoxDecoration(color: AppColors.grey100, borderRadius: BorderRadius.circular(20)),
                      child: Text(
                        c['targetType'] == 'USER' ? 'User' : 'Listing',
                        style: const TextStyle(fontSize: 11, color: AppColors.grey600),
                      ),
                    ),
                    const Spacer(),
                    Text(
                      FormatUtils.timeAgo(DateTime.parse(c['createdAt'])),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(c['reason'] as String, style: Theme.of(context).textTheme.titleMedium),
                if (c['description'] != null) ...[
                  const SizedBox(height: 4),
                  Text(c['description'] as String, style: Theme.of(context).textTheme.bodyMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
                ],
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.person_outline_rounded, size: 13, color: AppColors.grey500),
                    const SizedBox(width: 4),
                    Text(
                      'Dilaporkan oleh: ${reporter?['name'] ?? '-'}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ── Detail + Action Sheet ─────────────────────
class _ComplaintDetailSheet extends StatefulWidget {
  final Map<String, dynamic> complaint;
  final Future<void> Function(String id, String status) onUpdateStatus;

  const _ComplaintDetailSheet({required this.complaint, required this.onUpdateStatus});

  @override
  State<_ComplaintDetailSheet> createState() => _ComplaintDetailSheetState();
}

class _ComplaintDetailSheetState extends State<_ComplaintDetailSheet> {
  bool _isUpdating = false;

  Future<void> _update(String status) async {
    setState(() => _isUpdating = true);
    await widget.onUpdateStatus(widget.complaint['id'], status);
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.complaint;
    final reporter = c['reporter'] as Map<String, dynamic>?;
    final status = c['status'] as String;
    final isOpen = status == 'OPEN';
    final isInReview = status == 'IN_REVIEW';

    return Container(
      padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 24),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle bar
          Center(
            child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.grey300, borderRadius: BorderRadius.circular(2))),
          ),
          const SizedBox(height: 20),

          Text('Detail Pengaduan', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 16),

          _DetailRow(label: 'Pelapor', value: reporter?['name'] ?? '-'),
          _DetailRow(label: 'Email', value: reporter?['email'] ?? '-'),
          _DetailRow(label: 'Target', value: c['targetType'] == 'USER' ? 'User (ID: ${c['targetId']})' : 'Listing (ID: ${c['targetId']})'),
          _DetailRow(label: 'Alasan', value: c['reason']),
          if (c['description'] != null) _DetailRow(label: 'Deskripsi', value: c['description']),
          if (c['adminNote'] != null) _DetailRow(label: 'Catatan Admin', value: c['adminNote']),
          _DetailRow(label: 'Tanggal', value: FormatUtils.dateTime(DateTime.parse(c['createdAt']))),

          const SizedBox(height: 20),

          if (_isUpdating)
            const Center(child: CircularProgressIndicator(color: AppColors.primary))
          else ...[
            if (isOpen) ...[
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => _update('IN_REVIEW'),
                  icon: const Icon(Icons.visibility_outlined, size: 18),
                  label: const Text('Tandai Sedang Ditinjau'),
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.warning),
                ),
              ),
              const SizedBox(height: 10),
            ],
            if (isOpen || isInReview) ...[
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _update('DISMISSED'),
                      icon: const Icon(Icons.close_rounded, size: 16, color: AppColors.grey600),
                      label: const Text('Tolak'),
                      style: OutlinedButton.styleFrom(foregroundColor: AppColors.grey600, side: const BorderSide(color: AppColors.grey400)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => _update('RESOLVED'),
                      icon: const Icon(Icons.check_rounded, size: 16),
                      label: const Text('Selesaikan'),
                      style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label, value;
  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary)),
          ),
          const SizedBox(width: 8),
          Expanded(child: Text(value, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary))),
        ],
      ),
    );
  }
}
