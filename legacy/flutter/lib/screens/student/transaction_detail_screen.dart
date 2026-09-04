// lib/screens/student/transaction_detail_screen.dart
// UC-004: Detail Transaksi + UC-005: Review

import 'package:flutter/material.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/format_utils.dart';

class TransactionDetailScreen extends StatefulWidget {
  final TransactionModel transaction;
  final bool isBuyer;
  final VoidCallback onUpdate;

  const TransactionDetailScreen({super.key, required this.transaction, required this.isBuyer, required this.onUpdate});

  @override
  State<TransactionDetailScreen> createState() => _TransactionDetailScreenState();
}

class _TransactionDetailScreenState extends State<TransactionDetailScreen> {
  late TransactionModel _transaction;
  bool _isUpdating = false;

  @override
  void initState() {
    super.initState();
    _transaction = widget.transaction;
  }

  Future<void> _updateStatus(String status) async {
    final labels = {'CONFIRMED': 'Konfirmasi', 'COMPLETED': 'Selesaikan', 'CANCELLED': 'Batalkan'};
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('${labels[status]} Transaksi?', style: const TextStyle(fontWeight: FontWeight.w600)),
        content: Text(_confirmMessage(status), style: const TextStyle()),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Batal')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: status == 'CANCELLED' ? ElevatedButton.styleFrom(backgroundColor: AppColors.error) : null,
            child: Text(labels[status]!),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _isUpdating = true);
    try {
      final res = await ApiService.updateTransactionStatus(_transaction.id, status);
      // Reload transaction detail
      final detailRes = await ApiService.getTransactionById(_transaction.id);
      setState(() {
        _transaction = TransactionModel.fromJson(detailRes['data']);
        _isUpdating = false;
      });
      widget.onUpdate();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'] ?? 'Status diperbarui'), backgroundColor: AppColors.success),
        );
      }
    } on ApiException catch (e) {
      setState(() => _isUpdating = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message), backgroundColor: AppColors.error));
    }
  }

  String _confirmMessage(String status) {
    switch (status) {
      case 'CONFIRMED':
        return 'Kamu mengkonfirmasi bahwa kamu siap memproses pesanan ini. Dana buyer sudah tersimpan aman di escrow.';
      case 'COMPLETED':
        return 'Tandai transaksi selesai. Dana (${FormatUtils.currency(_transaction.sellerReceives ?? _transaction.price)}) akan langsung ditransfer ke saldo kamu.';
      case 'CANCELLED':
        return _transaction.isEscrowHeld
            ? 'Transaksi dibatalkan. Dana buyer akan dikembalikan (refund) secara otomatis.'
            : 'Transaksi akan dibatalkan dan tidak dapat diubah kembali.';
      default:
        return '';
    }
  }

  Future<void> _payTransaction() async {
    Map<String, dynamic>? balanceData;
    try {
      final res = await ApiService.getBalance();
      balanceData = res['data'];
    } catch (_) {}

    final balance = (balanceData?['balance'] as num?)?.toDouble() ?? 0;
    final totalPrice = _transaction.totalPrice; // gunakan totalPrice bukan price

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Konfirmasi Pembayaran',
            style: TextStyle(fontFamily: 'Poppins', fontWeight: FontWeight.w600)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_transaction.quantity > 1)
              _DialogRow(label: 'Jumlah', value: '${_transaction.quantity} unit'),
            _DialogRow(label: 'Total bayar', value: FormatUtils.currency(totalPrice)),
            _DialogRow(label: 'Saldo kamu', value: FormatUtils.currency(balance)),
            _DialogRow(
              label: 'Sisa saldo',
              value: FormatUtils.currency(balance - totalPrice),
              isRed: balance < totalPrice,
            ),
            if (balance < totalPrice) ...[
              const SizedBox(height: 8),
              const Text('⚠️ Saldo tidak cukup. Topup terlebih dahulu.',
                  style: TextStyle(fontFamily: 'Poppins', fontSize: 12, color: AppColors.error)),
            ],
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                  color: AppColors.primaryLighter, borderRadius: BorderRadius.circular(8)),
              child: const Text(
                '🔒 Dana akan disimpan di escrow dan hanya diteruskan ke seller setelah transaksi selesai.',
                style: TextStyle(fontFamily: 'Poppins', fontSize: 12, color: AppColors.primary),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false), child: const Text('Batal')),
          if (balance >= totalPrice)
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Bayar Sekarang'),
            )
          else
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context, false);
                _showTopup();
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.warning),
              child: const Text('Topup Saldo'),
            ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isUpdating = true);
    try {
      await ApiService.payTransaction(_transaction.id);
      final detailRes = await ApiService.getTransactionById(_transaction.id);
      setState(() {
        _transaction = TransactionModel.fromJson(detailRes['data']);
        _isUpdating = false;
      });
      widget.onUpdate();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Pembayaran berhasil! Dana masuk escrow.'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } on ApiException catch (e) {
      setState(() => _isUpdating = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<void> _showTopup() async {
    final amountCtrl = TextEditingController();
    await showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Topup Saldo', style: TextStyle(fontFamily: 'Poppins', fontWeight: FontWeight.w600)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Masukkan nominal topup (simulasi):', style: TextStyle(fontFamily: 'Poppins', fontSize: 13)),
            const SizedBox(height: 12),
            TextField(
              controller: amountCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Nominal (Rp)', prefixText: 'Rp '),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [50000, 100000, 500000, 1000000].map((amt) =>
                ActionChip(
                  label: Text(FormatUtils.currency(amt.toDouble()), style: const TextStyle(fontFamily: 'Poppins', fontSize: 11)),
                  onPressed: () => amountCtrl.text = amt.toString(),
                ),
              ).toList(),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Batal')),
          ElevatedButton(
            onPressed: () async {
              final amount = double.tryParse(amountCtrl.text);
              if (amount == null || amount <= 0) return;
              try {
                await ApiService.topupBalance(amount);
                if (context.mounted) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Topup ${FormatUtils.currency(amount)} berhasil!'),
                      backgroundColor: AppColors.success,
                    ),
                  );
                }
              } on ApiException catch (e) {
                if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
                );
              }
            },
            child: const Text('Topup'),
          ),
        ],
      ),
    );
  }

  List<Color> _statusGradient(String status) {
    switch (status) {
      case 'PAID': return [AppColors.info, const Color(0xFF29B6F6)];
      case 'CONFIRMED': return [AppColors.primary, AppColors.primaryLight];
      case 'COMPLETED': return [AppColors.success, const Color(0xFF66BB6A)];
      case 'CANCELLED': return [AppColors.grey600, AppColors.grey500];
      default: return [AppColors.warning, const Color(0xFFFFCA28)]; // PENDING
    }
  }

  Future<void> _openReview() async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ReviewSheet(
        transaction: _transaction,
        onSubmitted: () async {
          final detailRes = await ApiService.getTransactionById(_transaction.id);
          setState(() => _transaction = TransactionModel.fromJson(detailRes['data']));
          widget.onUpdate();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = _transaction;
    final title = t.listing?['title'] ?? 'Produk';
    final otherUser = widget.isBuyer ? t.seller : t.buyer;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Detail Transaksi')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: _statusGradient(t.status),
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white)),
                  const SizedBox(height: 4),
                  Text(FormatUtils.currency(t.price), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: Colors.white)),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(color: Colors.white.withOpacity(0.25), borderRadius: BorderRadius.circular(20)),
                    child: Text(t.statusLabel, style: const TextStyle(fontWeight: FontWeight.w700, color: Colors.white, fontSize: 13)),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Lawan transaksi
            _InfoCard(
              title: widget.isBuyer ? 'Penjual' : 'Pembeli',
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: AppColors.primaryLighter,
                    child: Text(
                      otherUser?.name[0].toUpperCase() ?? '?',
                      style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(otherUser?.name ?? '-', style: Theme.of(context).textTheme.titleMedium),
                      if (otherUser?.isVerified == true)
                        const Row(children: [
                          Icon(Icons.verified_rounded, size: 12, color: AppColors.primary),
                          SizedBox(width: 4),
                          Text('Terverifikasi BINUS', style: TextStyle(fontSize: 11, color: AppColors.primary)),
                        ]),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 12),

            // Catatan buyer
            if (t.note != null && t.note!.isNotEmpty)
              _InfoCard(
                title: 'Catatan',
                child: Text(t.note!, style: Theme.of(context).textTheme.bodyMedium),
              ),

            if (t.note != null && t.note!.isNotEmpty) const SizedBox(height: 12),

            // Info komisi & rincian harga
            _InfoCard(
              title: 'Rincian Harga',
              child: Column(
                children: [
                  if (t.quantity > 1) ...[
                    _PriceRow(label: 'Harga satuan', value: FormatUtils.currency(t.price)),
                    _PriceRow(label: 'Jumlah', value: '${t.quantity} unit'),
                    const Divider(height: 12),
                  ],
                  _PriceRow(label: t.quantity > 1 ? 'Subtotal' : 'Harga', value: FormatUtils.currency(t.totalPrice)),
                  _PriceRow(
                    label: 'Komisi (${t.commissionRate?.toStringAsFixed(1) ?? '5.0'}%)',
                    value: '- ${FormatUtils.currency(t.commissionAmt ?? 0)}',
                    color: AppColors.error,
                  ),
                  const Divider(height: 16),
                  _PriceRow(
                    label: widget.isBuyer ? 'Total Bayar' : 'Kamu Terima',
                    value: FormatUtils.currency(widget.isBuyer ? t.totalPrice : (t.sellerReceives ?? t.totalPrice)),
                    bold: true,
                  ),
                ],
              ),
            ),

            // Tanggal
            _InfoCard(
              title: 'Tanggal Transaksi',
              child: Text(FormatUtils.dateTime(t.createdAt), style: Theme.of(context).textTheme.bodyMedium),
            ),

            const SizedBox(height: 12),

            // Review (jika sudah ada)
            if (t.review != null)
              _InfoCard(
                title: 'Review',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: List.generate(5, (i) => Icon(
                        i < t.review!.rating ? Icons.star_rounded : Icons.star_outline_rounded,
                        color: Colors.amber,
                        size: 20,
                      )),
                    ),
                    if (t.review!.comment != null) ...[
                      const SizedBox(height: 6),
                      Text(t.review!.comment!, style: Theme.of(context).textTheme.bodyMedium),
                    ],
                  ],
                ),
              ),

            const SizedBox(height: 32),

            // Action buttons
            if (_isUpdating)
              const Center(child: CircularProgressIndicator(color: AppColors.primary))
            else ...[
              // ── Seller actions ──────────────────
              if (!widget.isBuyer) ...[
                // Seller konfirmasi hanya setelah buyer bayar (PAID)
                if (t.sellerCanConfirm)
                  _ActionButton(
                    label: 'Konfirmasi Pesanan',
                    icon: Icons.check_circle_outline_rounded,
                    color: AppColors.success,
                    onTap: () => _updateStatus('CONFIRMED'),
                  ),
                // Seller selesaikan setelah dikonfirmasi
                if (t.sellerCanComplete)
                  _ActionButton(
                    label: 'Tandai Selesai & Terima Dana',
                    icon: Icons.done_all_rounded,
                    color: AppColors.primary,
                    onTap: () => _updateStatus('COMPLETED'),
                  ),
                // Seller batalkan
                if (t.sellerCanCancel)
                  _ActionButton(
                    label: 'Batalkan Transaksi',
                    icon: Icons.cancel_outlined,
                    color: AppColors.error,
                    onTap: () => _updateStatus('CANCELLED'),
                    isOutline: true,
                  ),
                // Jika masih PENDING (buyer belum bayar), beri tahu seller
                if (t.status == 'PENDING')
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.warningLight,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.warning.withOpacity(0.4)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.hourglass_empty_rounded, color: AppColors.warning, size: 18),
                            const SizedBox(width: 8),
                            const Text('Menunggu Pembayaran Buyer',
                                style: TextStyle(fontFamily: 'Poppins', fontSize: 14,
                                    fontWeight: FontWeight.w600, color: AppColors.warning)),
                          ],
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Buyer belum melakukan pembayaran. Kamu bisa mengkonfirmasi pesanan setelah buyer menyelesaikan pembayaran.\n\n'
                          'Alur: Buyer Bayar → Kamu Konfirmasi → Kamu Tandai Selesai → Dana cair ke saldo kamu.',
                          style: TextStyle(fontFamily: 'Poppins', fontSize: 12, color: AppColors.warning),
                        ),
                      ],
                    ),
                  ),
              ],

              // ── Buyer actions ───────────────────
              if (widget.isBuyer) ...[
                // TOMBOL BAYAR — muncul saat PENDING
                if (t.canPay)
                  _ActionButton(
                    label: 'Bayar Sekarang (${FormatUtils.currency(t.totalPrice)})',
                    icon: Icons.payment_rounded,
                    color: AppColors.primary,
                    onTap: _payTransaction,
                  ),
                // Status sudah bayar, menunggu seller
                if (t.status == 'PAID')
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: AppColors.infoLight, borderRadius: BorderRadius.circular(12)),
                    child: Row(
                      children: [
                        const Icon(Icons.lock_outline_rounded, color: AppColors.info, size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Dana ${FormatUtils.currency(t.price)} tersimpan di escrow. Menunggu konfirmasi seller.',
                            style: const TextStyle(fontFamily: 'Poppins', fontSize: 13, color: AppColors.info),
                          ),
                        ),
                      ],
                    ),
                  ),
                // Buyer bisa batalkan jika belum dikonfirmasi seller
                if (t.buyerCanCancel)
                  _ActionButton(
                    label: t.isEscrowHeld ? 'Batalkan & Refund Dana' : 'Batalkan Permintaan',
                    icon: Icons.cancel_outlined,
                    color: AppColors.error,
                    onTap: () => _updateStatus('CANCELLED'),
                    isOutline: true,
                  ),
                // Review setelah selesai
                if (t.canReview)
                  _ActionButton(
                    label: 'Beri Review',
                    icon: Icons.star_outline_rounded,
                    color: AppColors.warning,
                    onTap: _openReview,
                  ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _DialogRow extends StatelessWidget {
  final String label, value;
  final bool isRed;
  const _DialogRow({required this.label, required this.value, this.isRed = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontFamily: 'Poppins', fontSize: 13, color: AppColors.textSecondary)),
          Text(value, style: TextStyle(fontFamily: 'Poppins', fontSize: 13, fontWeight: FontWeight.w600, color: isRed ? AppColors.error : AppColors.textPrimary)),
        ],
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  final String label, value;
  final bool bold;
  final Color? color;
  const _PriceRow({required this.label, required this.value, this.bold = false, this.color});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontFamily: 'Poppins', fontSize: 13, color: AppColors.textSecondary, fontWeight: bold ? FontWeight.w600 : FontWeight.normal)),
          Text(value, style: TextStyle(fontFamily: 'Poppins', fontSize: 13, color: color ?? (bold ? AppColors.primary : AppColors.textPrimary), fontWeight: bold ? FontWeight.w700 : FontWeight.w500)),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final String title;
  final Widget child;
  const _InfoCard({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: AppDecorations.card,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.labelMedium?.copyWith(color: AppColors.textSecondary)),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  final bool isOutline;

  const _ActionButton({required this.label, required this.icon, required this.color, required this.onTap, this.isOutline = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: SizedBox(
        width: double.infinity,
        child: isOutline
            ? OutlinedButton.icon(
                onPressed: onTap,
                icon: Icon(icon, size: 18, color: color),
                label: Text(label),
                style: OutlinedButton.styleFrom(foregroundColor: color, side: BorderSide(color: color, width: 1.5)),
              )
            : ElevatedButton.icon(
                onPressed: onTap,
                icon: Icon(icon, size: 18),
                label: Text(label),
                style: ElevatedButton.styleFrom(backgroundColor: color),
              ),
      ),
    );
  }
}

// ── Review Bottom Sheet ───────────────────────
class _ReviewSheet extends StatefulWidget {
  final TransactionModel transaction;
  final VoidCallback onSubmitted;
  const _ReviewSheet({required this.transaction, required this.onSubmitted});

  @override
  State<_ReviewSheet> createState() => _ReviewSheetState();
}

class _ReviewSheetState extends State<_ReviewSheet> {
  int _rating = 5;
  final _commentCtrl = TextEditingController();
  bool _isSubmitting = false;

  Future<void> _submit() async {
    setState(() => _isSubmitting = true);
    try {
      await ApiService.createReview(
        transactionId: widget.transaction.id,
        rating: _rating,
        comment: _commentCtrl.text.trim().isNotEmpty ? _commentCtrl.text.trim() : null,
      );
      widget.onSubmitted();
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message), backgroundColor: AppColors.error));
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.grey300, borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 20),
          Text('Beri Review', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text('Bagaimana pengalaman transaksimu?', style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(5, (i) => GestureDetector(
              onTap: () => setState(() => _rating = i + 1),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Icon(i < _rating ? Icons.star_rounded : Icons.star_outline_rounded, color: Colors.amber, size: 40),
              ),
            )),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _commentCtrl,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'Komentar (opsional)', hintText: 'Tulis pengalamanmu...'),
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isSubmitting ? null : _submit,
              child: _isSubmitting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Kirim Review'),
            ),
          ),
        ],
      ),
    );
  }
}
