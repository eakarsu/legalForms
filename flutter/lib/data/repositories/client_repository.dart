import '../models/client.dart';
import 'api_client.dart';

class ClientRepository {
  final ApiClient _apiClient = ApiClient();

  Future<List<Client>> getClients({
    String? search,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'limit': limit,
      };

      if (search != null && search.isNotEmpty) {
        queryParams['search'] = search;
      }

      final response = await _apiClient.dio.get(
        '/api/clients',
        queryParameters: queryParams,
      );

      final List<dynamic> data = response.data['clients'] ?? response.data;
      return data.map((json) => Client.fromJson(json)).toList();
    } catch (e) {
      throw _handleError(e);
    }
  }

  Future<Client> getClientById(String id) async {
    try {
      final response = await _apiClient.dio.get('/api/clients/$id');
      return Client.fromJson(response.data);
    } catch (e) {
      throw _handleError(e);
    }
  }

  Future<Client> createClient(CreateClientRequest request) async {
    try {
      final response = await _apiClient.dio.post(
        '/api/clients',
        data: request.toJson(),
      );
      return Client.fromJson(response.data);
    } catch (e) {
      throw _handleError(e);
    }
  }

  Future<Client> updateClient(String id, Map<String, dynamic> updates) async {
    try {
      final response = await _apiClient.dio.put(
        '/api/clients/$id',
        data: updates,
      );
      return Client.fromJson(response.data);
    } catch (e) {
      throw _handleError(e);
    }
  }

  Future<void> deleteClient(String id) async {
    try {
      await _apiClient.dio.delete('/api/clients/$id');
    } catch (e) {
      throw _handleError(e);
    }
  }

  Exception _handleError(dynamic error) {
    if (error is Exception) {
      return error;
    }
    return Exception('An unexpected error occurred');
  }
}
