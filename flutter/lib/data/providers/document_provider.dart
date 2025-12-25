import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/document.dart';
import '../repositories/document_repository.dart';

// Repository Provider
final documentRepositoryProvider = Provider<DocumentRepository>((ref) {
  return DocumentRepository();
});

// Documents State
class DocumentsState {
  final List<Document> documents;
  final bool isLoading;
  final String? error;
  final DocumentCategory? selectedCategory;

  const DocumentsState({
    this.documents = const [],
    this.isLoading = false,
    this.error,
    this.selectedCategory,
  });

  DocumentsState copyWith({
    List<Document>? documents,
    bool? isLoading,
    String? error,
    DocumentCategory? selectedCategory,
    bool clearCategory = false,
  }) {
    return DocumentsState(
      documents: documents ?? this.documents,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      selectedCategory: clearCategory ? null : (selectedCategory ?? this.selectedCategory),
    );
  }
}

// Documents Notifier
class DocumentsNotifier extends StateNotifier<DocumentsState> {
  final DocumentRepository _repository;

  DocumentsNotifier(this._repository) : super(const DocumentsState());

  Future<void> loadDocuments({DocumentCategory? category}) async {
    state = state.copyWith(isLoading: true, error: null, selectedCategory: category);
    try {
      final documents = await _repository.getDocuments(category: category);
      state = state.copyWith(
        isLoading: false,
        documents: documents,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }

  Future<Document?> createDocument({
    required String title,
    required DocumentCategory category,
    required String content,
    String? clientId,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final document = await _repository.createDocument(
        title: title,
        category: category,
        content: content,
        clientId: clientId,
      );
      state = state.copyWith(
        isLoading: false,
        documents: [document, ...state.documents],
      );
      return document;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
      return null;
    }
  }

  Future<void> deleteDocument(String id) async {
    try {
      await _repository.deleteDocument(id);
      state = state.copyWith(
        documents: state.documents.where((d) => d.id != id).toList(),
      );
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  void setCategory(DocumentCategory? category) {
    if (category == null) {
      state = state.copyWith(clearCategory: true);
    } else {
      state = state.copyWith(selectedCategory: category);
    }
    loadDocuments(category: category);
  }

  void clearError() {
    state = state.copyWith(error: null);
  }
}

// Documents Provider
final documentsProvider = StateNotifierProvider<DocumentsNotifier, DocumentsState>((ref) {
  final repository = ref.watch(documentRepositoryProvider);
  return DocumentsNotifier(repository);
});

// Single Document Provider
final documentProvider = FutureProvider.family<Document, String>((ref, id) async {
  final repository = ref.watch(documentRepositoryProvider);
  return repository.getDocumentById(id);
});

// Templates Provider
final templatesProvider = FutureProvider.family<List<DocumentTemplate>, DocumentCategory?>((ref, category) async {
  final repository = ref.watch(documentRepositoryProvider);
  return repository.getTemplates(category: category);
});

// Recent Documents Provider
final recentDocumentsProvider = Provider<List<Document>>((ref) {
  final state = ref.watch(documentsProvider);
  final docs = [...state.documents];
  docs.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
  return docs.take(5).toList();
});
