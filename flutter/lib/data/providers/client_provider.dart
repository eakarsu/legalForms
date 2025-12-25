import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/client.dart';
import '../repositories/client_repository.dart';

// Repository Provider
final clientRepositoryProvider = Provider<ClientRepository>((ref) {
  return ClientRepository();
});

// Clients State
class ClientsState {
  final List<Client> clients;
  final bool isLoading;
  final String? error;
  final String searchQuery;

  const ClientsState({
    this.clients = const [],
    this.isLoading = false,
    this.error,
    this.searchQuery = '',
  });

  ClientsState copyWith({
    List<Client>? clients,
    bool? isLoading,
    String? error,
    String? searchQuery,
  }) {
    return ClientsState(
      clients: clients ?? this.clients,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      searchQuery: searchQuery ?? this.searchQuery,
    );
  }

  List<Client> get filteredClients {
    if (searchQuery.isEmpty) return clients;
    final query = searchQuery.toLowerCase();
    return clients.where((client) {
      return client.name.toLowerCase().contains(query) ||
          client.email.toLowerCase().contains(query) ||
          (client.company?.toLowerCase().contains(query) ?? false);
    }).toList();
  }
}

// Clients Notifier
class ClientsNotifier extends StateNotifier<ClientsState> {
  final ClientRepository _repository;

  ClientsNotifier(this._repository) : super(const ClientsState());

  Future<void> loadClients() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final clients = await _repository.getClients();
      state = state.copyWith(
        isLoading: false,
        clients: clients,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }

  Future<Client?> createClient(CreateClientRequest request) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final client = await _repository.createClient(request);
      state = state.copyWith(
        isLoading: false,
        clients: [client, ...state.clients],
      );
      return client;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
      return null;
    }
  }

  Future<void> updateClient(String id, Map<String, dynamic> updates) async {
    try {
      final updatedClient = await _repository.updateClient(id, updates);
      state = state.copyWith(
        clients: state.clients.map((c) {
          return c.id == id ? updatedClient : c;
        }).toList(),
      );
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  Future<void> deleteClient(String id) async {
    try {
      await _repository.deleteClient(id);
      state = state.copyWith(
        clients: state.clients.where((c) => c.id != id).toList(),
      );
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  void setSearchQuery(String query) {
    state = state.copyWith(searchQuery: query);
  }

  void clearError() {
    state = state.copyWith(error: null);
  }
}

// Clients Provider
final clientsProvider = StateNotifierProvider<ClientsNotifier, ClientsState>((ref) {
  final repository = ref.watch(clientRepositoryProvider);
  return ClientsNotifier(repository);
});

// Single Client Provider
final clientProvider = FutureProvider.family<Client, String>((ref, id) async {
  final repository = ref.watch(clientRepositoryProvider);
  return repository.getClientById(id);
});

// Client Count Provider
final clientCountProvider = Provider<int>((ref) {
  return ref.watch(clientsProvider).clients.length;
});
