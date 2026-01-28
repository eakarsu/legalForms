//
//  DocumentsView.swift
//  LegalPracticeAI
//
//  Documents list screen
//

import SwiftUI

struct DocumentsView: View {
    @StateObject private var viewModel = DocumentsViewModel()

    // Define 6 main categories for the grid
    let mainCategories: [DocumentCategory] = [
        .businessFormation,
        .realEstate,
        .familyLaw,
        .estatePlanning,
        .employmentLaw,
        .contracts
    ]

    let columns = [
        GridItem(.flexible(), spacing: AppSpacing.md),
        GridItem(.flexible(), spacing: AppSpacing.md)
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.lg) {
                    // Category Grid (2x3)
                    LazyVGrid(columns: columns, spacing: AppSpacing.md) {
                        ForEach(mainCategories, id: \.self) { category in
                            NavigationLink(destination: CategoryDocumentsView(category: category)) {
                                DocumentCategoryCard(category: category)
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
                    }
                    .padding(.horizontal)

                    // Recent Documents Section
                    if !viewModel.documents.isEmpty {
                        VStack(alignment: .leading, spacing: AppSpacing.md) {
                            Text("Recent Documents")
                                .font(.headline)
                                .foregroundColor(.primary)
                                .padding(.horizontal)

                            ForEach(viewModel.documents.prefix(5)) { document in
                                NavigationLink(destination: DocumentDetailView(document: document)) {
                                    DocumentListRow(document: document)
                                }
                                .buttonStyle(PlainButtonStyle())
                                .padding(.horizontal)
                            }
                        }
                    }
                }
                .padding(.top)
            }
            .navigationTitle("Documents")
            .background(Color(UIColor.systemGroupedBackground))
        }
        .task {
            await viewModel.loadDocuments()
        }
    }
}

// MARK: - Document Category Card
struct DocumentCategoryCard: View {
    let category: DocumentCategory

    var body: some View {
        VStack(spacing: AppSpacing.sm) {
            Image(systemName: category.icon)
                .font(.system(size: 32))
                .foregroundColor(.accentColor)

            Text(category.displayName)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(.primary)
                .multilineTextAlignment(.center)
                .lineLimit(2)

            Text("\(category.templates.count) templates")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 120)
        .padding()
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
        .shadow(color: Color.black.opacity(0.05), radius: 5, x: 0, y: 2)
    }
}

// MARK: - Category Documents View
struct CategoryDocumentsView: View {
    let category: DocumentCategory
    @StateObject private var viewModel = DocumentsViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.isLoading && viewModel.documents.isEmpty {
                Spacer()
                ProgressView()
                Spacer()
            } else if viewModel.filteredDocuments.isEmpty {
                Spacer()
                VStack(spacing: AppSpacing.lg) {
                    Image(systemName: category.icon)
                        .font(.system(size: 60))
                        .foregroundColor(.accentColor.opacity(0.5))

                    Text("No \(category.displayName) Documents")
                        .font(.headline)
                        .foregroundColor(.secondary)

                    Text("Create a new document using one of the templates below")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)

                    // Show available templates
                    VStack(alignment: .leading, spacing: AppSpacing.sm) {
                        Text("Available Templates")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)

                        ForEach(category.templates, id: \.self) { template in
                            HStack {
                                Image(systemName: "doc.text")
                                    .foregroundColor(.accentColor)
                                Text(template)
                                    .font(.subheadline)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .padding()
                            .background(Color.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                        }
                    }
                    .padding()
                }
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
        .navigationTitle(category.displayName)
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $viewModel.searchText, prompt: "Search \(category.displayName.lowercased())")
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            viewModel.filterByCategory(category)
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
        switch document.status?.lowercased() {
        case "draft": return .orange
        case "final", "completed": return .green
        case "signed": return .blue
        case "pending": return .yellow
        default: return .gray
        }
    }

    var categoryIcon: String {
        document.displayCategory?.icon ?? "doc.text"
    }

    var categoryName: String {
        document.displayCategory?.displayName ?? document.category ?? "Document"
    }

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: categoryIcon)
                .font(.title3)
                .foregroundColor(.accentColor)
                .frame(width: 44, height: 44)
                .background(Color.accentColor.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 4) {
                Text(document.title ?? "Untitled Document")
                    .font(.body)
                    .fontWeight(.medium)
                    .lineLimit(1)

                Text(categoryName)
                    .font(.caption)
                    .foregroundColor(.secondary)

                HStack(spacing: 4) {
                    Text((document.status ?? "draft").uppercased())
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundColor(statusColor)

                    if let createdAt = document.createdAt {
                        Text("•")
                            .foregroundColor(.secondary)

                        Text(createdAt.formatted(date: .abbreviated, time: .omitted))
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
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
