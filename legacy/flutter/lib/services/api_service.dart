// lib/services/api_service.dart
// Semua panggilan HTTP ke backend

import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiService {
  // ⚠️ Ganti dengan IP/URL backend kamu
  // Untuk Android emulator: 10.0.2.2
  // Untuk iOS simulator: localhost
  // Untuk device fisik: IP komputer kamu (cth: 192.168.1.5)
  static const String baseUrl = 'http://10.0.2.2:3000/api';

  static final _storage = const FlutterSecureStorage();

  // ─────────────────────────────────────────────
  // Token Management
  // ─────────────────────────────────────────────
  static Future<String?> getToken() async {
    return await _storage.read(key: 'auth_token');
  }

  static Future<void> saveToken(String token) async {
    await _storage.write(key: 'auth_token', value: token);
  }

  static Future<void> deleteToken() async {
    await _storage.delete(key: 'auth_token');
  }

  // ─────────────────────────────────────────────
  // HTTP Helpers
  // ─────────────────────────────────────────────
  static Future<Map<String, String>> _headers({bool auth = true}) async {
    final headers = {'Content-Type': 'application/json'};
    if (auth) {
      final token = await getToken();
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  static Map<String, dynamic> _parseResponse(http.Response response) {
    final body = jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }
    throw ApiException(
      message: body['message'] ?? 'Terjadi kesalahan',
      statusCode: response.statusCode,
    );
  }

  // ─────────────────────────────────────────────
  // AUTH
  // ─────────────────────────────────────────────
  static Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: await _headers(auth: false),
      body: jsonEncode({'email': email, 'password': password}),
    );
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    required String name,
    String? studentId,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/auth/register'),
      headers: await _headers(auth: false),
      body: jsonEncode({'email': email, 'password': password, 'name': name, 'studentId': studentId}),
    );
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> getMe() async {
    final res = await http.get(
      Uri.parse('$baseUrl/auth/me'),
      headers: await _headers(),
    );
    return _parseResponse(res);
  }

  // ─────────────────────────────────────────────
  // LISTINGS
  // ─────────────────────────────────────────────
  static Future<Map<String, dynamic>> getListings({
    String? category,
    String? type,
    String? keyword,
    double? minPrice,
    double? maxPrice,
    int page = 1,
    int limit = 20,
  }) async {
    final params = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (category != null) params['category'] = category;
    if (type != null) params['type'] = type;
    if (keyword != null && keyword.isNotEmpty) params['keyword'] = keyword;
    if (minPrice != null) params['minPrice'] = minPrice.toString();
    if (maxPrice != null) params['maxPrice'] = maxPrice.toString();

    final uri = Uri.parse('$baseUrl/listings').replace(queryParameters: params);
    final res = await http.get(uri, headers: await _headers());
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> getListingById(String id) async {
    final res = await http.get(Uri.parse('$baseUrl/listings/$id'), headers: await _headers());
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> getMyListings() async {
    final res = await http.get(Uri.parse('$baseUrl/listings/my/listings'), headers: await _headers());
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> createListing(Map<String, dynamic> data) async {
    final res = await http.post(
      Uri.parse('$baseUrl/listings'),
      headers: await _headers(),
      body: jsonEncode(data),
    );
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> updateListing(String id, Map<String, dynamic> data) async {
    final res = await http.put(
      Uri.parse('$baseUrl/listings/$id'),
      headers: await _headers(),
      body: jsonEncode(data),
    );
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> deleteListing(String id) async {
    final res = await http.delete(Uri.parse('$baseUrl/listings/$id'), headers: await _headers());
    return _parseResponse(res);
  }

  // ─────────────────────────────────────────────
  // TRANSACTIONS
  // ─────────────────────────────────────────────
  static Future<Map<String, dynamic>> getMyTransactions({String? role}) async {
    final params = role != null ? {'role': role} : <String, String>{};
    final uri = Uri.parse('$baseUrl/transactions').replace(queryParameters: params);
    final res = await http.get(uri, headers: await _headers());
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> getTransactionById(String id) async {
    final res = await http.get(Uri.parse('$baseUrl/transactions/$id'), headers: await _headers());
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> getBalance() async {
    final res = await http.get(Uri.parse('$baseUrl/transactions/balance'), headers: await _headers());
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> topupBalance(double amount) async {
    final res = await http.post(
      Uri.parse('$baseUrl/transactions/topup'),
      headers: await _headers(),
      body: jsonEncode({'amount': amount}),
    );
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> payTransaction(String transactionId) async {
    final res = await http.post(
      Uri.parse('$baseUrl/transactions/$transactionId/pay'),
      headers: await _headers(),
    );
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> createTransaction(
    String listingId, {
    String? note,
    int quantity = 1,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/transactions'),
      headers: await _headers(),
      body: jsonEncode({'listingId': listingId, 'note': note, 'quantity': quantity}),
    );
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> updateTransactionStatus(String id, String status) async {
    final res = await http.patch(
      Uri.parse('$baseUrl/transactions/$id/status'),
      headers: await _headers(),
      body: jsonEncode({'status': status}),
    );
    return _parseResponse(res);
  }

  // ─────────────────────────────────────────────
  // REVIEWS
  // ─────────────────────────────────────────────
  static Future<Map<String, dynamic>> createReview({
    required String transactionId,
    required int rating,
    String? comment,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/reviews'),
      headers: await _headers(),
      body: jsonEncode({'transactionId': transactionId, 'rating': rating, 'comment': comment}),
    );
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> getUserReviews(String userId) async {
    final res = await http.get(Uri.parse('$baseUrl/reviews/user/$userId'), headers: await _headers());
    return _parseResponse(res);
  }

  // ─────────────────────────────────────────────
  // CHAT
  // ─────────────────────────────────────────────
  static Future<Map<String, dynamic>> getChatRooms() async {
    final res = await http.get(Uri.parse('$baseUrl/chat/rooms'), headers: await _headers());
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> getOrCreateChatRoom(String otherUserId) async {
    final res = await http.post(
      Uri.parse('$baseUrl/chat/rooms'),
      headers: await _headers(),
      body: jsonEncode({'otherUserId': otherUserId}),
    );
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> getRoomMessages(String roomId, {int page = 1}) async {
    final uri = Uri.parse('$baseUrl/chat/rooms/$roomId/messages')
        .replace(queryParameters: {'page': page.toString()});
    final res = await http.get(uri, headers: await _headers());
    return _parseResponse(res);
  }

  // ─────────────────────────────────────────────
  // USER PROFILE
  // ─────────────────────────────────────────────
  static Future<Map<String, dynamic>> getUserProfile(String userId) async {
    final res = await http.get(Uri.parse('$baseUrl/users/$userId'), headers: await _headers());
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> updateProfile(Map<String, dynamic> data) async {
    final res = await http.put(
      Uri.parse('$baseUrl/users/me'),
      headers: await _headers(),
      body: jsonEncode(data),
    );
    return _parseResponse(res);
  }

  // ─────────────────────────────────────────────
  // COMPLAINTS
  // ─────────────────────────────────────────────
  static Future<Map<String, dynamic>> createComplaint({
    required String targetType,
    required String targetId,
    required String reason,
    String? description,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/complaints'),
      headers: await _headers(),
      body: jsonEncode({'targetType': targetType, 'targetId': targetId, 'reason': reason, 'description': description}),
    );
    return _parseResponse(res);
  }

  // ─────────────────────────────────────────────
  // ADMIN
  // ─────────────────────────────────────────────
  static Future<Map<String, dynamic>> getAdminDashboard() async {
    final res = await http.get(Uri.parse('$baseUrl/admin/dashboard'), headers: await _headers());
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> getPendingListings() async {
    final res = await http.get(Uri.parse('$baseUrl/admin/listings/pending'), headers: await _headers());
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> moderateListing(String id, String action) async {
    final res = await http.patch(
      Uri.parse('$baseUrl/admin/listings/$id/moderate'),
      headers: await _headers(),
      body: jsonEncode({'action': action}),
    );
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> getAllUsers({String? keyword}) async {
    final params = keyword != null ? {'keyword': keyword} : <String, String>{};
    final uri = Uri.parse('$baseUrl/admin/users').replace(queryParameters: params);
    final res = await http.get(uri, headers: await _headers());
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> toggleUserStatus(String userId) async {
    final res = await http.patch(
      Uri.parse('$baseUrl/admin/users/$userId/toggle'),
      headers: await _headers(),
    );
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> getComplaints({String? status}) async {
    // Admin endpoint — bukan /complaints biasa (itu hanya untuk POST)
    final params = status != null ? {'status': status} : <String, String>{};
    final uri = Uri.parse('$baseUrl/admin/complaints').replace(queryParameters: params);
    final res = await http.get(uri, headers: await _headers());
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> updateComplaintStatusAdmin(String id, String status, {String? adminNote}) async {
    final res = await http.patch(
      Uri.parse('$baseUrl/admin/complaints/$id'),
      headers: await _headers(),
      body: jsonEncode({'status': status, if (adminNote != null) 'adminNote': adminNote}),
    );
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> getAdminCommission() async {
    final res = await http.get(Uri.parse('$baseUrl/admin/commission'), headers: await _headers());
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> setAdminCommission(double rate) async {
    final res = await http.patch(
      Uri.parse('$baseUrl/admin/commission'),
      headers: await _headers(),
      body: jsonEncode({'rate': rate}),
    );
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> getAdminCommissionHistory() async {
    final res = await http.get(Uri.parse('$baseUrl/admin/commission/history'), headers: await _headers());
    return _parseResponse(res);
  }

  static Future<Map<String, dynamic>> updateComplaintStatus(String id, String status, {String? adminNote}) async {
    final res = await http.patch(
      Uri.parse('$baseUrl/complaints/$id'),
      headers: await _headers(),
      body: jsonEncode({'status': status, if (adminNote != null) 'adminNote': adminNote}),
    );
    return _parseResponse(res);
  }
}

// ─────────────────────────────────────────────
// Custom Exception
// ─────────────────────────────────────────────
class ApiException implements Exception {
  final String message;
  final int statusCode;

  ApiException({required this.message, required this.statusCode});

  @override
  String toString() => 'ApiException($statusCode): $message';
}
