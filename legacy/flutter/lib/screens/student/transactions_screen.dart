// lib/screens/student/transactions_screen.dart
// UC-004: Manage Transactions

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../services/auth_provider.dart';
import '../../theme/app_theme.dart';
import '../../utils/format_utils.dart';
import 'transaction_detail_screen.dart';

class TransactionsScreen extends StatefulWidget {
  const TransactionsScreen({super.key});

  @override
  State<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsScreenState extends State<TransactionsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<TransactionModel> _buying = [];
  List<TransactionModel> _selling = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
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
      final resBuying = await ApiService.getMyTransactions(role: 'buyer');
      final resSelling = await ApiService.getMyTransactions(role: 'seller');
      setState(() {
        _buying = (resBuying['data'] as List).map((e) => TransactionModel.fromJson(e)).toList();
        _selling = (resSelling['data'] as List).map((e) => TransactionModel.fromJson(e)).toList();
        _isLoading = false;
      });
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Transaksi'),
        bottom: TabBar(
          controller: _tabController,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
          tabs: const [Tab(text: 'Pembelian'), Tab(text: 'Penjualan')],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : RefreshIndicator(
              color: AppColors.primary,
              onRefresh: _load,
              child: TabBarView(
                controller: _tabController,
                children: [
                  _TransactionList(transactions: _buying, isBuyer: true, onRefresh: _load),
                  _TransactionList(transactions: _selling, isBuyer: false, onRefresh: _load),
                ],
              ),
            ),
    );
  }
}

class _TransactionList extends StatelessWidget {
  final List<TransactionModel> transactions;
  final bool isBuyer;
  final VoidCallback onRefresh;

  const _TransactionList({required this.transactions, required this.isBuyer, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    if (transactions.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.receipt_long_outlined, size: 72, color: AppColors.grey300),
            const SizedBox(height: 12),
            Text('Belum ada transaksi', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: AppColors.grey500)),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemCount: transactions.length,
      itemBuilder: (_, i) => _TransactionCard(
        transaction: transactions[i],
        isBuyer: isBuyer,
        onRefresh: onRefresh,
      ),
    );
  }
}

class _TransactionCard extends StatelessWidget {
  final TransactionModel transaction;
  final bool isBuyer;
  final VoidCallback onRefresh;

  const _TransactionCard({required this.transaction, required this.isBuyer, required this.onRefresh});

  Color _statusColor(String status) {
    switch (status) {
      case 'PENDING': return AppColors.warning;
      case 'PAID': return AppColors.info;
      case 'CONFIRMED': return AppColors.primary;
      case 'COMPLETED': return AppColors.success;
      case 'CANCELLED': return AppColors.grey500;
      default: return AppColors.grey500;
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = transaction;
    final otherUser = isBuyer ? t.seller : t.buyer;
    final title = t.listing?['title'] ?? 'Produk';

    return GestureDetector(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => TransactionDetailScreen(transaction: t, isBuyer: isBuyer, onUpdate: onRefresh)),
      ),
      child: Container(
        decoration: AppDecorations.card,
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header: judul + status
            Row(
              children: [
                Expanded(
                  child: Text(title, style: Theme.of(context).textTheme.titleMedium, maxLines: 1, overflow: TextOverflow.ellipsis),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: _statusColor(t.status).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    t.statusLabel,
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _statusColor(t.status)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Harga
            Text(
              t.quantity > 1
                  ? '${FormatUtils.currency(t.totalPrice)} (${t.quantity}x)'
                  : FormatUtils.currency(t.totalPrice),
              style: const TextStyle(fontFamily: 'Poppins', fontWeight: FontWeight.w700, color: AppColors.primary, fontSize: 15),
            ),
            const SizedBox(height: 8),

            // User info + tanggal
            Row(
              children: [
                Icon(isBuyer ? Icons.store_outlined : Icons.person_outline_rounded, size: 14, color: AppColors.grey500),
                const SizedBox(width: 4),
                Text(
                  isBuyer ? (otherUser?.name ?? '-') : (otherUser?.name ?? '-'),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const Spacer(),
                Text(FormatUtils.timeAgo(t.createdAt), style: Theme.of(context).textTheme.bodySmall),
              ],
            ),

            // Hint bayar untuk buyer
            if (t.canPay && isBuyer) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: AppColors.warningLight, borderRadius: BorderRadius.circular(8)),
                child: Row(
                  children: [
                    const Icon(Icons.payment_rounded, size: 14, color: AppColors.warning),
                    const SizedBox(width: 6),
                    Text('Belum dibayar — tap untuk bayar', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.warning, fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
            ],

            // Review hint
            if (t.canReview && isBuyer) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: AppColors.successLight, borderRadius: BorderRadius.circular(8)),
                child: Row(
                  children: [
                    const Icon(Icons.star_outline_rounded, size: 14, color: AppColors.success),
                    const SizedBox(width: 6),
                    Text('Belum direview — tap untuk beri penilaian', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.success, fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
