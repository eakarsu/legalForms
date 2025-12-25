//
//  DocumentsViewModel.swift
//  LegalPracticeAI
//
//  Documents state management
//

import Foundation
import SwiftUI

@MainActor
final class DocumentsViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published var documents: [Document] = []
    @Published var selectedCategory: DocumentCategory?
    @Published var searchText = ""
    @Published var isLoading = false
    @Published var error: String?
    @Published var totalCount = 0

    // MARK: - Private
    private let api = APIService.shared
    private var currentPage = 1
    private let pageSize = 20

    // MARK: - Computed Properties
    var filteredDocuments: [Document] {
        guard !searchText.isEmpty else { return documents }
        return documents.filter { $0.title.localizedCaseInsensitiveContains(searchText) }
    }

    // MARK: - Load Documents
    func loadDocuments(refresh: Bool = false) async {
        if refresh {
            currentPage = 1
        }

        isLoading = true
        error = nil

        do {
            let response = try await api.getDocuments(
                page: currentPage,
                limit: pageSize,
                category: selectedCategory
            )

            if refresh {
                documents = response.documents
            } else {
                documents.append(contentsOf: response.documents)
            }

            totalCount = response.total
            currentPage += 1
        } catch let apiError as APIServiceError {
            error = apiError.localizedDescription
        } catch {
            self.error = "Failed to load documents"
        }

        isLoading = false
    }

    // MARK: - Refresh
    func refresh() async {
        await loadDocuments(refresh: true)
    }

    // MARK: - Load More (Pagination)
    func loadMoreIfNeeded(currentItem: Document) async {
        guard let lastItem = documents.last,
              lastItem.id == currentItem.id,
              documents.count < totalCount else {
            return
        }

        await loadDocuments()
    }

    // MARK: - Delete Document
    func deleteDocument(_ document: Document) async -> Bool {
        do {
            try await api.deleteDocument(id: document.id)
            documents.removeAll { $0.id == document.id }
            totalCount -= 1
            return true
        } catch {
            self.error = "Failed to delete document"
            return false
        }
    }

    // MARK: - Filter by Category
    func filterByCategory(_ category: DocumentCategory?) {
        selectedCategory = category
        Task {
            await refresh()
        }
    }
}

// MARK: - Document Creation ViewModel
@MainActor
final class CreateDocumentViewModel: ObservableObject {
    @Published var selectedCategory: DocumentCategory?
    @Published var selectedTemplate: DocumentTemplate?
    @Published var formData: [String: String] = [:]
    @Published var selectedState = "California"
    @Published var isLoading = false
    @Published var isGenerating = false
    @Published var error: String?
    @Published var generatedDocument: Document?
    @Published var templates: [DocumentTemplate] = []

    private let api = APIService.shared

    // US States
    let usStates = [
        "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
        "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
        "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
        "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
        "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
        "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma",
        "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
        "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
        "West Virginia", "Wisconsin", "Wyoming"
    ]

    // MARK: - Load Templates
    func loadTemplates(for category: DocumentCategory) async {
        isLoading = true
        selectedCategory = category

        do {
            templates = try await api.getTemplates(category: category)
            if let first = templates.first {
                selectedTemplate = first
            }
        } catch {
            // Use fallback templates from category
            templates = category.templates.enumerated().map { index, name in
                DocumentTemplate(
                    id: "\(index)",
                    name: name,
                    category: category,
                    description: "Generate a \(name)",
                    fields: []
                )
            }
            if let first = templates.first {
                selectedTemplate = first
            }
        }

        isLoading = false
    }

    // MARK: - Generate Document
    func generateDocument() async -> Bool {
        guard let template = selectedTemplate else {
            error = "Please select a template"
            return false
        }

        isGenerating = true
        error = nil

        do {
            let request = GenerateDocumentRequest(
                templateId: template.id,
                formData: formData,
                state: selectedState
            )

            generatedDocument = try await api.generateDocument(request: request)
            isGenerating = false
            return true
        } catch let apiError as APIServiceError {
            error = apiError.localizedDescription
            isGenerating = false
            return false
        } catch {
            self.error = "Failed to generate document"
            isGenerating = false
            return false
        }
    }

    // MARK: - Reset
    func reset() {
        selectedCategory = nil
        selectedTemplate = nil
        formData = [:]
        selectedState = "California"
        generatedDocument = nil
        templates = []
    }
}
