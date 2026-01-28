//
//  AIBillingView.swift
//  LegalPracticeAI
//
//  AI-powered billing suggestions screen
//

import SwiftUI

struct AIBillingView: View {
    @State private var suggestions: [AIBillingSuggestion] = []
    @State private var isLoading = false
    @State private var isScanning = false
    @State private var selectedCase: String?
    @State private var lookbackDays = 7
    @StateObject private var casesViewModel = CasesViewModel()

    var pendingSuggestions: [AIBillingSuggestion] {
        suggestions.filter { $0.status == "pending" }
    }

    var totalSuggestedAmount: Double {
        pendingSuggestions.reduce(0) { $0 + ($1.suggestedAmount ?? 0) }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Summary Card
                VStack(spacing: AppSpacing.md) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Unbilled Work Detected")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            Text("$\(String(format: "%.2f", totalSuggestedAmount))")
                                .font(.system(size: 36, weight: .bold, design: .rounded))
                                .foregroundColor(.accentColor)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 4) {
                            Text("\(pendingSuggestions.count)")
                                .font(.title)
                                .fontWeight(.bold)
                            Text("suggestions")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }

                    Button {
                        Task { await scanNotes() }
                    } label: {
                        HStack {
                            if isScanning {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Image(systemName: "wand.and.stars")
                            }
                            Text(isScanning ? "Scanning..." : "Scan Notes for Billable Work")
                        }
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Color.accentColor)
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                    }
                    .disabled(isScanning)
                }
                .padding()
                .background(Color.cardBackground)

                // Filter Section
                HStack {
                    Picker("Case", selection: $selectedCase) {
                        Text("All Cases").tag(nil as String?)
                        ForEach(casesViewModel.cases, id: \.id) { caseItem in
                            Text(caseItem.title ?? "Untitled").tag(caseItem.id as String?)
                        }
                    }
                    .pickerStyle(.menu)

                    Spacer()

                    Picker("Days", selection: $lookbackDays) {
                        Text("7 days").tag(7)
                        Text("14 days").tag(14)
                        Text("30 days").tag(30)
                    }
                    .pickerStyle(.menu)
                }
                .padding(.horizontal)
                .padding(.vertical, AppSpacing.sm)

                // Suggestions List
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if suggestions.isEmpty {
                    VStack(spacing: AppSpacing.lg) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 60))
                            .foregroundColor(.secondary)

                        Text("No Suggestions Yet")
                            .font(.title3)
                            .fontWeight(.semibold)

                        Text("Scan your case notes to find\nunbilled work")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(suggestions) { suggestion in
                            BillingSuggestionRow(suggestion: suggestion) {
                                acceptSuggestion(suggestion)
                            } onReject: {
                                rejectSuggestion(suggestion)
                            }
                            .listRowBackground(Color.cardBackground)
                        }
                    }
                    .listStyle(.plain)
                    .refreshable {
                        await loadSuggestions()
                    }
                }
            }
            .navigationTitle("AI Billing")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    if !pendingSuggestions.isEmpty {
                        Button("Accept All") {
                            acceptAllSuggestions()
                        }
                    }
                }
            }
            .background(Color(UIColor.systemGroupedBackground))
        }
        .task {
            await casesViewModel.loadCases()
            await loadSuggestions()
        }
    }

    func loadSuggestions() async {
        isLoading = true
        do {
            let response = try await APIService.shared.getBillingSuggestions(caseId: selectedCase)
            suggestions = response.suggestions
        } catch {
            print("Failed to load suggestions: \(error)")
        }
        isLoading = false
    }

    func scanNotes() async {
        isScanning = true
        do {
            let request = ScanNotesRequest(caseId: selectedCase, days: lookbackDays)
            let response = try await APIService.shared.scanNotesForBilling(request: request)
            suggestions = response.suggestions
        } catch {
            print("Failed to scan notes: \(error)")
        }
        isScanning = false
    }

    func acceptSuggestion(_ suggestion: AIBillingSuggestion) {
        // Update suggestion status
        if let index = suggestions.firstIndex(where: { $0.id == suggestion.id }) {
            suggestions[index].status = "accepted"
        }
    }

    func rejectSuggestion(_ suggestion: AIBillingSuggestion) {
        if let index = suggestions.firstIndex(where: { $0.id == suggestion.id }) {
            suggestions[index].status = "rejected"
        }
    }

    func acceptAllSuggestions() {
        for i in suggestions.indices {
            if suggestions[i].status == "pending" {
                suggestions[i].status = "accepted"
            }
        }
    }
}

// MARK: - Billing Suggestion Row
struct BillingSuggestionRow: View {
    let suggestion: AIBillingSuggestion
    var onAccept: () -> Void
    var onReject: () -> Void

    var confidenceColor: Color {
        let confidence = suggestion.confidence ?? 0
        if confidence >= 0.8 { return .green }
        if confidence >= 0.6 { return .orange }
        return .red
    }

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(suggestion.description ?? "Billable work detected")
                        .font(.body)
                        .fontWeight(.medium)

                    if let caseTitle = suggestion.caseTitle {
                        Text(caseTitle)
                            .font(.caption)
                            .foregroundColor(.accentColor)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    Text("$\(String(format: "%.2f", suggestion.suggestedAmount ?? 0))")
                        .font(.headline)
                        .foregroundColor(.accentColor)

                    Text(suggestion.formattedDuration)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            HStack {
                // Activity Type Badge
                if let activityType = suggestion.activityType {
                    Text(activityType.capitalized)
                        .font(.caption2)
                        .fontWeight(.medium)
                        .foregroundColor(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.blue)
                        .clipShape(Capsule())
                }

                // Confidence Badge
                HStack(spacing: 4) {
                    Image(systemName: "sparkle")
                        .font(.caption2)
                    Text("\(suggestion.confidencePercentage)%")
                        .font(.caption2)
                }
                .foregroundColor(confidenceColor)

                Spacer()

                // Status or Action Buttons
                if suggestion.status == "pending" {
                    HStack(spacing: AppSpacing.sm) {
                        Button {
                            onReject()
                        } label: {
                            Image(systemName: "xmark")
                                .font(.caption)
                                .foregroundColor(.red)
                                .frame(width: 32, height: 32)
                                .background(Color.red.opacity(0.1))
                                .clipShape(Circle())
                        }

                        Button {
                            onAccept()
                        } label: {
                            Image(systemName: "checkmark")
                                .font(.caption)
                                .foregroundColor(.green)
                                .frame(width: 32, height: 32)
                                .background(Color.green.opacity(0.1))
                                .clipShape(Circle())
                        }
                    }
                } else {
                    Text(suggestion.status?.uppercased() ?? "")
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundColor(suggestion.status == "accepted" ? .green : .red)
                }
            }

            // Source Excerpt
            if let excerpt = suggestion.sourceExcerpt, !excerpt.isEmpty {
                Text("\"\(excerpt)\"")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .italic()
                    .lineLimit(2)
            }
        }
        .padding(.vertical, AppSpacing.sm)
    }
}

// MARK: - Preview
#Preview {
    AIBillingView()
}
