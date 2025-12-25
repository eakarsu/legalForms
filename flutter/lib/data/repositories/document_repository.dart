import '../models/document.dart';
import 'api_client.dart';

class DocumentRepository {
  final ApiClient _apiClient = ApiClient();

  Future<List<Document>> getDocuments({
    DocumentCategory? category,
    DocumentStatus? status,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'limit': limit,
      };

      if (category != null) {
        queryParams['category'] = category.name;
      }
      if (status != null) {
        queryParams['status'] = status.name;
      }

      final response = await _apiClient.dio.get(
        '/api/documents',
        queryParameters: queryParams,
      );

      final List<dynamic> data = response.data['documents'] ?? response.data;
      return data.map((json) => Document.fromJson(json)).toList();
    } catch (e) {
      throw _handleError(e);
    }
  }

  Future<Document> getDocumentById(String id) async {
    try {
      final response = await _apiClient.dio.get('/api/documents/$id');
      return Document.fromJson(response.data);
    } catch (e) {
      throw _handleError(e);
    }
  }

  Future<Document> createDocument({
    required String title,
    required DocumentCategory category,
    required String content,
    String? clientId,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        '/api/documents',
        data: {
          'title': title,
          'category': category.name,
          'content': content,
          'clientId': clientId,
        },
      );
      return Document.fromJson(response.data);
    } catch (e) {
      throw _handleError(e);
    }
  }

  Future<Document> updateDocument(String id, Map<String, dynamic> updates) async {
    try {
      final response = await _apiClient.dio.put(
        '/api/documents/$id',
        data: updates,
      );
      return Document.fromJson(response.data);
    } catch (e) {
      throw _handleError(e);
    }
  }

  Future<void> deleteDocument(String id) async {
    try {
      await _apiClient.dio.delete('/api/documents/$id');
    } catch (e) {
      throw _handleError(e);
    }
  }

  Future<List<DocumentTemplate>> getTemplates({DocumentCategory? category}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (category != null) {
        queryParams['category'] = category.name;
      }

      final response = await _apiClient.dio.get(
        '/api/templates',
        queryParameters: queryParams,
      );

      final List<dynamic> data = response.data;
      return data.map((json) => DocumentTemplate.fromJson(json)).toList();
    } catch (e) {
      throw _handleError(e);
    }
  }

  Future<Document> generateDocument({
    required String templateId,
    required Map<String, dynamic> formData,
    String? clientId,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        '/api/documents/generate',
        data: {
          'templateId': templateId,
          'formData': formData,
          'clientId': clientId,
        },
      );
      return Document.fromJson(response.data);
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
