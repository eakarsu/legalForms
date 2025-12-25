//
//  DocumentsView.swift
//  LegalPracticeAI
//
//  Documents list screen
//

import SwiftUI

struct DocumentsView: View {
    @StateObject private var viewModel = DocumentsViewModel()
    @State private var searchText = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Category Filter
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: AppSpacing.sm) {
                        CategoryChip(
                            title: "All",
                            isSelected: viewModel.selectedCategory == nil
                        ) {
                            viewModel.filterByCategory(nil)
                        }

                        ForEach(DocumentCategory.allCases, id: \.self) { category in
                            CategoryChip(
                                title: category.displayName,
                                isSelected: viewModel.selectedCategory == category
                            ) {
                                viewModel.filterByCategory(category)
                            }
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, AppSpacing.sm)
                }
                .background(Color(UIColor.systemBackground))

                // Documents List
                if viewModel.isLoading && viewModel.documents.isEmpty {
                    Spacer()
                    ProgressView()
                    Spacer()
                } else if viewModel.filteredDocuments.isEmpty {
                    Spacer()
                    EmptyStateCard(
                        icon: "folder.badge.questionmark",
                        title: "No Documents Found",
                        message: searchText.isEmpty
                            ? "Create your first document to get started"
                            : "Try a different search term"
                    )
                    .padding()
                    Spacer()
                } else {
                    List {
                        ForEach(viewModel.filteredDocuments) { document in
                            NavigationLink(destination: DocumentDetailView(document: document)) {
                                DocumentListRow(document: document)
                            }
                            .listRowBackground(Color.cardBackground)
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                Button(role: .destructive) {
                                    Task {
                                        await viewModel.deleteDocument(document)
                                    }
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                    .refreshable {
                        await viewModel.refresh()
                    }
                }
            }
            .navigationTitle("Documents")
            .searchable(text: $viewModel.searchText, prompt: "Search documents")
            .background(Color(UIColor.systemGroupedBackground))
        }
        .task {
            await viewModel.loadDocuments()
        }
    }
}

// MARK: - Category Chip
struct CategoryChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(isSelected ? .white : .primary)
                .padding(.horizontal, AppSpacing.md)
                .padding(.vertical, AppSpacing.sm)
                .background(isSelected ? Color.accentColor : Color.cardBackground)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(isSelected ? Color.clear : Color.secondary.opacity(0.3), lineWidth: 1)
                )
        }
    }
}

// MARK: - Document List Row
struct DocumentListRow: View {
    let document: Document

    var statusColor: Color {
        switch document.status {
        case .draft: return .orange
        case .final: return .green
        case .signed: return .blue
        }
    }

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: document.category.icon)
                .font(.title3)
                .foregroundColor(.accentColor)
                .frame(width: 44, height: 44)
                .background(Color.accentColor.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 4) {
                Text(document.title)
                    .font(.body)
                    .fontWeight(.medium)
                    .lineLimit(1)

                Text(document.category.displayName)
                    .font(.caption)
                    .foregroundColor(.secondary)

                HStack(spacing: 4) {
                    Text(document.status.rawValue.uppercased())
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundColor(statusColor)

                    Text("•")
                        .foregroundColor(.secondary)

                    Text(document.createdAt.formatted(date: .abbreviated, time: .omitted))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

// MARK: - Preview
#Preview {
    DocumentsView()
}
