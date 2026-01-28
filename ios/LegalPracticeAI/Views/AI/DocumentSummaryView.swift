//
//  DocumentSummaryView.swift
//  LegalPracticeAI
//
//  AI-powered document summarization screen
//

import SwiftUI

struct DocumentSummaryView: View {
    @State private var summaries: [DocumentSummary] = []
    @State private var isLoading = false
    @State private var showNewSummary = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Quick Summarize Button
                Button {
                    showNewSummary = true
                } label: {
                    HStack {
                        Image(systemName: "doc.text.magnifyingglass")
                            .font(.title3)
                        Text("Summarize Document")
                            .font(.headline)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
                    .background(Color.accentColor)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                }
                .padding()

                // Summaries List
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if summaries.isEmpty {
                    VStack(spacing: AppSpacing.lg) {
                        Image(systemName: "doc.text")
                            .font(.system(size: 60))
                            .foregroundColor(.secondary)

                        Text("No Summaries Yet")
                            .font(.title3)
                            .fontWeight(.semibold)

                        Text("Upload or paste documents to generate\nAI-powered summaries")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(summaries) { summary in
                            NavigationLink(destination: SummaryDetailView(summary: summary)) {
                                SummaryRow(summary: summary)
                            }
                            .listRowBackground(Color.cardBackground)
                        }
                        .onDelete(perform: deleteSummaries)
                    }
                    .listStyle(.plain)
                    .refreshable {
                        await loadSummaries()
                    }
                }
            }
            .navigationTitle("Document Summaries")
            .sheet(isPresented: $showNewSummary) {
                NewSummaryView { newSummary in
                    if let s = newSummary {
                        summaries.insert(s, at: 0)
                    }
                }
            }
            .background(Color(UIColor.systemGroupedBackground))
        }
        .task {
            await loadSummaries()
        }
    }

    func loadSummaries() async {
        isLoading = true
        do {
            let response = try await APIService.shared.getDocumentSummaries()
            summaries = response.summaries
        } catch {
            print("Failed to load summaries: \(error)")
        }
        isLoading = false
    }

    func deleteSummaries(at offsets: IndexSet) {
        summaries.remove(atOffsets: offsets)
    }
}

// MARK: - Summary Row
struct SummaryRow: View {
    let summary: DocumentSummary

    var lengthColor: Color {
        switch summary.summaryLength?.lowercased() {
        case "brief": return .green
        case "medium": return .blue
        case "detailed": return .purple
        default: return .gray
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                Text(summary.title ?? "Untitled Document")
                    .font(.body)
                    .fontWeight(.medium)

                Spacer()

                if let length = summary.summaryLength {
                    Text(length.capitalized)
                        .font(.caption2)
                        .fontWeight(.medium)
                        .foregroundColor(lengthColor)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(lengthColor.opacity(0.1))
                        .clipShape(Capsule())
                }
            }

            if let summaryText = summary.summary, !summaryText.isEmpty {
                Text(summaryText)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }

            HStack {
                if let date = summary.createdAt {
                    Text(date.formatted(date: .abbreviated, time: .omitted))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                if let audience = summary.targetAudience {
                    Text("For \(audience)")
                        .font(.caption2)
                        .foregroundColor(.accentColor)
                }

                Spacer()

                if let keyPoints = summary.keyPoints, !keyPoints.isEmpty {
                    Label("\(keyPoints.count) key points", systemImage: "list.bullet")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

// MARK: - Summary Detail View
struct SummaryDetailView: View {
    let summary: DocumentSummary
    @State private var selectedTab = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.lg) {
                // Header
                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                    Text(summary.title ?? "Document Summary")
                        .font(.title2)
                        .fontWeight(.bold)

                    HStack {
                        if let audience = summary.targetAudience {
                            Label("For \(audience)", systemImage: "person")
                        }
                        if let length = summary.summaryLength {
                            Label(length.capitalized, systemImage: "text.alignleft")
                        }
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Tab Picker
                Picker("View", selection: $selectedTab) {
                    Text("Summary").tag(0)
                    Text("Key Points").tag(1)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                // Content
                if selectedTab == 0 {
                    // Summary
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        if let summaryText = summary.summary, !summaryText.isEmpty {
                            Text(summaryText)
                                .font(.body)
                        } else {
                            Text("No summary available")
                                .font(.body)
                                .foregroundColor(.secondary)
                                .italic()
                        }
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                    .padding(.horizontal)
                } else {
                    // Key Points
                    if let keyPoints = summary.keyPoints, !keyPoints.isEmpty {
                        VStack(spacing: AppSpacing.md) {
                            ForEach(keyPoints) { point in
                                KeyPointCard(keyPoint: point)
                            }
                        }
                        .padding(.horizontal)
                    } else {
                        VStack(alignment: .leading) {
                            Text("No key points extracted")
                                .font(.body)
                                .foregroundColor(.secondary)
                                .italic()
                        }
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                        .padding(.horizontal)
                    }
                }

                // Actions
                VStack(spacing: AppSpacing.sm) {
                    Button {
                        // Copy summary
                    } label: {
                        Label("Copy Summary", systemImage: "doc.on.doc")
                            .font(.headline)
                            .foregroundColor(.accentColor)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(Color.accentColor.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                    }

                    Button {
                        // Share
                    } label: {
                        Label("Share", systemImage: "square.and.arrow.up")
                            .font(.headline)
                            .foregroundColor(.accentColor)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(Color.accentColor.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                    }
                }
                .padding(.horizontal)
            }
            .padding(.top)
            .padding(.bottom, AppSpacing.xxl)
        }
        .background(Color(UIColor.systemGroupedBackground))
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Key Point Card
struct KeyPointCard: View {
    let keyPoint: SummaryKeyPoint

    var categoryColor: Color {
        switch keyPoint.category?.lowercased() {
        case "fact": return .blue
        case "issue": return .orange
        case "holding": return .purple
        case "date": return .green
        case "obligation": return .red
        case "party": return .cyan
        default: return .gray
        }
    }

    var importanceIcon: String {
        switch keyPoint.importance?.lowercased() {
        case "critical": return "exclamationmark.triangle.fill"
        case "high": return "exclamationmark.circle.fill"
        default: return "info.circle"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                if let category = keyPoint.category {
                    Text(category.uppercased())
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundColor(categoryColor)
                }

                Spacer()

                if let importance = keyPoint.importance, importance != "normal" {
                    Image(systemName: importanceIcon)
                        .foregroundColor(importance == "critical" ? .red : .orange)
                }
            }

            Text(keyPoint.content)
                .font(.body)

            if let excerpt = keyPoint.sourceExcerpt, !excerpt.isEmpty {
                Text("\"\(excerpt)\"")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .italic()
                    .lineLimit(2)
            }
        }
        .padding()
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.md)
                .stroke(categoryColor.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - New Summary View
struct NewSummaryView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var casesViewModel = CasesViewModel()

    @State private var content = ""
    @State private var title = ""
    @State private var summaryLength = "medium"
    @State private var targetAudience = "attorney"
    @State private var selectedCaseId: String?
    @State private var isProcessing = false

    var onComplete: (DocumentSummary?) -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section("Document Content") {
                    TextEditor(text: $content)
                        .frame(minHeight: 200)

                    Button {
                        // Paste from clipboard
                        if let clipboardText = UIPasteboard.general.string {
                            content = clipboardText
                        }
                    } label: {
                        Label("Paste from Clipboard", systemImage: "doc.on.clipboard")
                    }
                }

                Section("Options") {
                    TextField("Title (optional)", text: $title)

                    Picker("Summary Length", selection: $summaryLength) {
                        Text("Brief").tag("brief")
                        Text("Medium").tag("medium")
                        Text("Detailed").tag("detailed")
                    }

                    Picker("Target Audience", selection: $targetAudience) {
                        Text("Attorney").tag("attorney")
                        Text("Client").tag("client")
                        Text("Court").tag("court")
                    }
                }

                Section("Link to Case") {
                    Picker("Case", selection: $selectedCaseId) {
                        Text("None").tag(nil as String?)
                        ForEach(casesViewModel.cases, id: \.id) { caseItem in
                            Text(caseItem.title ?? "Untitled").tag(caseItem.id as String?)
                        }
                    }
                }
            }
            .navigationTitle("Summarize Document")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await generateSummary() }
                    } label: {
                        if isProcessing {
                            ProgressView()
                        } else {
                            Text("Summarize")
                        }
                    }
                    .disabled(content.isEmpty || isProcessing)
                }
            }
        }
        .task {
            await casesViewModel.loadCases()
        }
    }

    func generateSummary() async {
        isProcessing = true
        do {
            let request = SummarizeRequest(
                content: content,
                title: title.isEmpty ? nil : title,
                summaryLength: summaryLength,
                targetAudience: targetAudience,
                caseId: selectedCaseId,
                clientId: nil
            )
            let response = try await APIService.shared.summarizeDocument(request: request)
            onComplete(response.summary)
        } catch {
            print("Failed to generate summary: \(error)")
            onComplete(nil)
        }
        isProcessing = false
        dismiss()
    }
}

// MARK: - Preview
#Preview {
    DocumentSummaryView()
}
