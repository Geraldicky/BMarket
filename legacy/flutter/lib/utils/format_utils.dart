// lib/utils/format_utils.dart

import 'package:intl/intl.dart';

class FormatUtils {
  static final _currencyFormat = NumberFormat.currency(
    locale: 'id_ID',
    symbol: 'Rp ',
    decimalDigits: 0,
  );

  /// Format angka ke Rupiah: Rp 1.500.000
  static String currency(double amount) => _currencyFormat.format(amount);

  /// Format tanggal: 28 Jan 2025
  static String date(DateTime dt) => DateFormat('d MMM yyyy', 'id_ID').format(dt);

  /// Format tanggal + jam: 28 Jan 2025, 14:30
  static String dateTime(DateTime dt) => DateFormat('d MMM yyyy, HH:mm', 'id_ID').format(dt);

  /// Format jam saja: 14:30
  static String time(DateTime dt) => DateFormat('HH:mm').format(dt);

  /// Relative time: "2 jam yang lalu", "baru saja", dll.
  static String timeAgo(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);

    if (diff.inSeconds < 60) return 'Baru saja';
    if (diff.inMinutes < 60) return '${diff.inMinutes} menit yang lalu';
    if (diff.inHours < 24) return '${diff.inHours} jam yang lalu';
    if (diff.inDays < 7) return '${diff.inDays} hari yang lalu';
    if (diff.inDays < 30) return '${(diff.inDays / 7).floor()} minggu yang lalu';
    return date(dt);
  }

  /// Format untuk waktu chat: hari ini tampil jam, kemarin tampil "Kemarin", sisanya tanggal
  static String chatTime(DateTime dt) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final msgDay = DateTime(dt.year, dt.month, dt.day);

    if (msgDay == today) return time(dt);
    if (today.difference(msgDay).inDays == 1) return 'Kemarin';
    return date(dt);
  }
}
