//
//  CasesViewModel.swift
//  LegalPracticeAI
//
//  Cases state management
//

import Foundation
import SwiftUI

@MainActor
final class CasesViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published var cases: [Case] = []
    @Published var searchText = ""
    @Published var selectedStatus: String = "all"
    @Published var isLoading = false
    @Published var error: String?

    // MARK: - Private
    private let api = APIService.shared

    // MARK: - Computed Properties
    var filteredCases: [Case] {
        var result = cases

        // Filter by status
        if selectedStatus != "all" {
            result = result.filter { $0.status?.lowercased() == selectedStatus.lowercased() }
        }

        // Filter by search text
        if !searchText.isEmpty {
            result = result.filter {
                ($0.title?.localizedCaseInsensitiveContains(searchText) ?? false) ||
                ($0.caseNumber?.localizedCaseInsensitiveContains(searchText) ?? false) ||
                $0.clientDisplayName.localizedCaseInsensitiveContains(searchText)
            }
        }

        return result
    }

    var openCasesCount: Int {
        cases.filter { $0.status?.lowercased() == "open" }.count
    }

    var pendingCasesCount: Int {
        cases.filter { $0.status?.lowercased() == "pending" }.count
    }

    var closedCasesCount: Int {
        cases.filter { $0.status?.lowercased() == "closed" }.count
    }

    // MARK: - Load Cases
    func loadCases() async {
        isLoading = true
        error = nil

        do {
            let response = try await api.getCases()
            cases = response.cases
        } catch let apiError as APIServiceError {
            error = apiError.localizedDescription
        } catch {
            self.error = "Failed to load cases"
        }

        isLoading = false
    }

    // MARK: - Refresh
    func refresh() async {
        await loadCases()
    }

    // MARK: - Create Case
    func createCase(
        clientId: String?,
        title: String,
        description: String?,
        caseType: String?,
        priority: String?,
        billingType: String?,
        billingRate: Double?
    ) async -> Bool {
        guard !title.isEmpty else {
            error = "Title is required"
            return false
        }

        isLoading = true
        error = nil

        do {
            let request = CreateCaseRequest(
                clientId: clientId,
                title: title,
                description: description,
                caseType: caseType,
                status: "open",
                priority: priority,
                billingType: billingType,
                billingRate: billingRate
            )

            let newCase = try await api.createCase(request: request)
            cases.insert(newCase, at: 0)
            isLoading = false
            return true
        } catch let apiError as APIServiceError {
            error = apiError.localizedDescription
            isLoading = false
            return false
        } catch {
            self.error = "Failed to create case"
            isLoading = false
            return false
        }
    }

    // MARK: - Delete Case
    func deleteCase(_ caseItem: Case) async -> Bool {
        do {
            try await api.deleteCase(id: String(caseItem.id))
            cases.removeAll { $0.id == caseItem.id }
            return true
        } catch {
            self.error = "Failed to delete case"
            return false
        }
    }

    // MARK: - Add Note
    func addNote(caseId: String, content: String, noteType: String?, isBillable: Bool) async -> Bool {
        do {
            _ = try await api.addCaseNote(caseId: caseId, content: content, noteType: noteType, isBillable: isBillable)
            return true
        } catch {
            self.error = "Failed to add note"
            return false
        }
    }
}
