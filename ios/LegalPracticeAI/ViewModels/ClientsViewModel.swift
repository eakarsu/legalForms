//
//  ClientsViewModel.swift
//  LegalPracticeAI
//
//  Clients state management
//

import Foundation
import SwiftUI

@MainActor
final class ClientsViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published var clients: [Client] = []
    @Published var searchText = ""
    @Published var isLoading = false
    @Published var error: String?
    @Published var totalCount = 0

    // MARK: - Private
    private let api = APIService.shared

    // MARK: - Computed Properties
    var filteredClients: [Client] {
        guard !searchText.isEmpty else { return clients }
        return clients.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            $0.email.localizedCaseInsensitiveContains(searchText) ||
            ($0.company?.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }

    // MARK: - Load Clients
    func loadClients() async {
        isLoading = true
        error = nil

        do {
            let response = try await api.getClients()
            clients = response.clients
            totalCount = response.total
        } catch let apiError as APIServiceError {
            error = apiError.localizedDescription
        } catch {
            self.error = "Failed to load clients"
        }

        isLoading = false
    }

    // MARK: - Refresh
    func refresh() async {
        await loadClients()
    }

    // MARK: - Create Client
    func createClient(name: String, email: String, phone: String?, company: String?, address: String?, notes: String?) async -> Bool {
        guard !name.isEmpty, !email.isEmpty else {
            error = "Name and email are required"
            return false
        }

        isLoading = true
        error = nil

        do {
            let request = CreateClientRequest(
                name: name,
                email: email,
                phone: phone,
                company: company,
                address: address,
                notes: notes
            )

            let newClient = try await api.createClient(request: request)
            clients.insert(newClient, at: 0)
            totalCount += 1
            isLoading = false
            return true
        } catch let apiError as APIServiceError {
            error = apiError.localizedDescription
            isLoading = false
            return false
        } catch {
            self.error = "Failed to create client"
            isLoading = false
            return false
        }
    }

    // MARK: - Delete Client
    func deleteClient(_ client: Client) async -> Bool {
        do {
            try await api.deleteClient(id: client.id)
            clients.removeAll { $0.id == client.id }
            totalCount -= 1
            return true
        } catch {
            self.error = "Failed to delete client"
            return false
        }
    }
}
