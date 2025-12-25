import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../core/constants/app_constants.dart';
import '../models/user.dart';
import 'api_client.dart';

class AuthRepository {
  final ApiClient _apiClient = ApiClient();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  Future<AuthResponse> login(String email, String password) async {
    try {
      final response = await _apiClient.dio.post(
        '/api/auth/login',
        data: {'email': email, 'password': password},
      );

      final authResponse = AuthResponse.fromJson(response.data);
      await _saveAuthData(authResponse);
      return authResponse;
    } catch (e) {
      throw _handleError(e);
    }
  }

  Future<AuthResponse> register(String name, String email, String password) async {
    try {
      final response = await _apiClient.dio.post(
        '/api/auth/register',
        data: {'name': name, 'email': email, 'password': password},
      );

      final authResponse = AuthResponse.fromJson(response.data);
      await _saveAuthData(authResponse);
      return authResponse;
    } catch (e) {
      throw _handleError(e);
    }
  }

  Future<void> forgotPassword(String email) async {
    try {
      await _apiClient.dio.post(
        '/api/auth/forgot-password',
        data: {'email': email},
      );
    } catch (e) {
      throw _handleError(e);
    }
  }

  Future<void> logout() async {
    try {
      await _apiClient.dio.post('/api/auth/logout');
    } catch (_) {
      // Ignore logout errors
    } finally {
      await _clearAuthData();
    }
  }

  Future<User?> getCurrentUser() async {
    try {
      final userJson = await _storage.read(key: AppConstants.userKey);
      if (userJson != null) {
        return User.fromJson(jsonDecode(userJson));
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<bool> isAuthenticated() async {
    final token = await _apiClient.getToken();
    return token != null;
  }

  Future<User> updateProfile(Map<String, dynamic> updates) async {
    try {
      final response = await _apiClient.dio.put(
        '/api/users/profile',
        data: updates,
      );

      final user = User.fromJson(response.data);
      await _storage.write(
        key: AppConstants.userKey,
        value: jsonEncode(user.toJson()),
      );
      return user;
    } catch (e) {
      throw _handleError(e);
    }
  }

  Future<void> _saveAuthData(AuthResponse response) async {
    await _apiClient.setToken(response.token);
    await _storage.write(
      key: AppConstants.userKey,
      value: jsonEncode(response.user.toJson()),
    );
  }

  Future<void> _clearAuthData() async {
    await _apiClient.clearToken();
    await _storage.delete(key: AppConstants.userKey);
  }

  Exception _handleError(dynamic error) {
    if (error is Exception) {
      return error;
    }
    return Exception('An unexpected error occurred');
  }
}
