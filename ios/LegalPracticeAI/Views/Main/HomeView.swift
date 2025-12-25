//
//  HomeView.swift
//  LegalPracticeAI
//
//  Dashboard home screen
//

import SwiftUI

struct HomeView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var documentsVM = DocumentsViewModel()

    var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 12 { return "Good Morning" }
        if hour < 18 { return "Good Afternoon" }
        return "Good Evening"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: AppSpacing.lg) {
                    // Header
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(greeting)
                                .font(.subheadline)
                                .foregroundColor(.secondary)

                            Text(authViewModel.user?.name ?? "User")
                                .font(.title2)
                                .fontWeight(.bold)
                        }

                        Spacer()

                        NavigationLink(destination: SettingsView()) {
                            Image(systemName: "gearshape.fill")
                                .font(.title3)
                                .foregroundColor(.primary)
                                .frame(width: 44, height: 44)
                                .background(Color.cardBackground)
                                .clipShape(Circle())
                        }
                    }
                    .padding(.horizontal)

                    // Stats Cards
                    HStack(spacing: AppSpacing.md) {
                        StatCard(
                            title: "Documents",
                            value: "\(documentsVM.totalCount)",
                            icon: "doc.text.fill",
                            gradient: LinearGradient.primaryGradient
                        )

                        StatCard(
                            title: "Clients",
                            value: "0",
                            icon: "person.2.fill",
                            gradient: LinearGradient(
                                colors: [.purple, .pink],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                    }
                    .padding(.horizontal)

                    // Quick Create
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("Quick Create")
                            .font(.headline)
                            .padding(.horizontal)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: AppSpacing.md) {
                                ForEach(DocumentCategory.allCases.prefix(4), id: \.self) { category in
                                    NavigationLink(destination: DocumentFormView(category: category)) {
                                        QuickCreateCard(category: category)
                                    }
                                }
                            }
                            .padding(.horizontal)
                        }
                    }

                    // Recent Documents
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        HStack {
                            Text("Recent Documents")
                                .font(.headline)

                            Spacer()

                            NavigationLink("See All") {
                                DocumentsView()
                            }
                            .font(.subheadline)
                        }
                        .padding(.horizontal)

                        if documentsVM.documents.isEmpty {
                            EmptyStateCard(
                                icon: "doc.text",
                                title: "No Documents Yet",
                                message: "Create your first legal document to get started"
                            )
                            .padding(.horizontal)
                        } else {
                            ForEach(documentsVM.documents.prefix(3)) { document in
                                NavigationLink(destination: DocumentDetailView(document: document)) {
                                    DocumentRowCard(document: document)
                                }
                                .padding(.horizontal)
                            }
                        }
                    }

                    // Pro Tip
                    TipCard()
                        .padding(.horizontal)
                        .padding(.bottom, 100)
                }
                .padding(.top)
            }
            .background(Color(UIColor.systemGroupedBackground))
            .refreshable {
                await documentsVM.refresh()
            }
        }
        .task {
            await documentsVM.loadDocuments()
        }
    }
}

// MARK: - Stat Card
struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let gradient: LinearGradient

    var body: some View {
        VStack(alignment: .center, spacing: AppSpacing.sm) {
            Image(systemName: icon)
                .font(.title2)

            Text(value)
                .font(.title)
                .fontWeight(.bold)

            Text(title)
                .font(.caption)
                .opacity(0.9)
        }
        .foregroundColor(.white)
        .frame(maxWidth: .infinity)
        .padding(.vertical, AppSpacing.lg)
        .background(gradient)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
    }
}

// MARK: - Quick Create Card
struct QuickCreateCard: View {
    let category: DocumentCategory

    var body: some View {
        VStack(spacing: AppSpacing.sm) {
            Image(systemName: category.icon)
                .font(.title2)
                .foregroundColor(.accentColor)
                .frame(width: 48, height: 48)
                .background(Color.accentColor.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 12))

            Text(category.displayName)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(.primary)
                .lineLimit(1)
        }
        .frame(width: 80)
    }
}

// MARK: - Document Row Card
struct DocumentRowCard: View {
    let document: Document

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: "doc.text.fill")
                .font(.title3)
                .foregroundColor(.accentColor)
                .frame(width: 44, height: 44)
                .background(Color.accentColor.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 2) {
                Text(document.title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.primary)
                    .lineLimit(1)

                Text("\(document.category.displayName) • \(document.createdAt.formatted(date: .abbreviated, time: .omitted))")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

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

// MARK: - Empty State Card
struct EmptyStateCard: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: AppSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 40))
                .foregroundColor(.secondary)

            Text(title)
                .font(.headline)

            Text(message)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, AppSpacing.xl)
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
    }
}

// MARK: - Tip Card
struct TipCard: View {
    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: "lightbulb.fill")
                .font(.title3)
                .foregroundColor(.orange)

            VStack(alignment: .leading, spacing: 2) {
                Text("Pro Tip")
                    .font(.subheadline)
                    .fontWeight(.semibold)

                Text("Use AI-powered document analysis to review contracts and identify potential issues.")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color.orange.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.md)
                .stroke(Color.orange.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Preview
#Preview {
    HomeView()
        .environmentObject(AuthViewModel())
}
