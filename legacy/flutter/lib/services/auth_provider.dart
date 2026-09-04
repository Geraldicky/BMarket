// lib/services/auth_provider.dart
// State management untuk autentikasi

import 'package:flutter/foundation.dart';
import '../models/models.dart';
import 'api_service.dart';

class AuthProvider extends ChangeNotifier {
  UserModel? _user;
  bool _isLoading = false;
  String? _error;

  UserModel? get user => _user;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isLoggedIn => _user != null;
  bool get isAdmin => _user?.isAdmin ?? false;

  void _setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }

  void _setError(String? value) {
    _error = value;
    notifyListeners();
  }

  /// Cek apakah sudah login saat app dibuka (dari token tersimpan)
  Future<bool> tryAutoLogin() async {
    final token = await ApiService.getToken();
    if (token == null) return false;

    try {
      final res = await ApiService.getMe();
      _user = UserModel.fromJson(res['data']);
      notifyListeners();
      return true;
    } catch (_) {
      await ApiService.deleteToken();
      return false;
    }
  }

  /// Login
  Future<bool> login(String email, String password) async {
    _setLoading(true);
    _setError(null);

    try {
      final res = await ApiService.login(email, password);
      final data = res['data'];
      _user = UserModel.fromJson(data['user']);
      await ApiService.saveToken(data['token']);
      _setLoading(false);
      return true;
    } on ApiException catch (e) {
      _setError(e.message);
      _setLoading(false);
      return false;
    } catch (_) {
      _setError('Tidak dapat terhubung ke server. Periksa koneksi internet kamu.');
      _setLoading(false);
      return false;
    }
  }

  /// Register
  Future<bool> register({
    required String email,
    required String password,
    required String name,
    String? studentId,
  }) async {
    _setLoading(true);
    _setError(null);

    try {
      final res = await ApiService.register(
        email: email, password: password, name: name, studentId: studentId,
      );
      final data = res['data'];
      _user = UserModel.fromJson(data['user']);
      await ApiService.saveToken(data['token']);
      _setLoading(false);
      return true;
    } on ApiException catch (e) {
      _setError(e.message);
      _setLoading(false);
      return false;
    } catch (_) {
      _setError('Tidak dapat terhubung ke server. Periksa koneksi internet kamu.');
      _setLoading(false);
      return false;
    }
  }

  /// Refresh data user
  Future<void> refreshUser() async {
    try {
      final res = await ApiService.getMe();
      _user = UserModel.fromJson(res['data']);
      notifyListeners();
    } catch (_) {}
  }

  /// Logout
  Future<void> logout() async {
    _user = null;
    await ApiService.deleteToken();
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
