//
//  ContractAnalysisView.swift
//  LegalPracticeAI
//
//  AI-powered contract analysis and risk assessment screen
//

import SwiftUI

struct ContractAnalysisView: View {
    @State private var analyses: [ContractAnalysis] = []
    @State private var isLoading = false
    @State private var showNewAnalysis = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Quick Analyze Button
                Button {
                    showNewAnalysis = true
                } label: {
                    HStack {
                        Image(systemName: "doc.badge.gearshape")
                            .font(.title3)
                        Text("Analyze Contract")
                            .font(.headline)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
                    .background(Color.accentColor)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                }
                .padding()

                // Analyses List
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if analyses.isEmpty {
                    VStack(spacing: AppSpacing.lg) {
                        Image(systemName: "doc.badge.gearshape.fill")
                            .font(.system(size: 60))
                            .foregroundColor(.secondary)

                        Text("No Analyses Yet")
                            .font(.title3)
                            .fontWeight(.semibold)

                        Text("Upload contracts to identify risks,\nkey terms, and missing provisions")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(analyses) { analysis in
                            NavigationLink(destination: ContractAnalysisDetailView(analysis: analysis)) {
                                ContractAnalysisRow(analysis: analysis)
                            }
                            .listRowBackground(Color.cardBackground)
                        }
                        .onDelete(perform: deleteAnalyses)
                    }
                    .listStyle(.plain)
                    .refreshable {
                        await loadAnalyses()
                    }
                }
            }
            .navigationTitle("Contract Analysis")
            .sheet(isPresented: $showNewAnalysis) {
                NewContractAnalysisView { newAnalysis in
                    if let a = newAnalysis {
                        analyses.insert(a, at: 0)
                    }
                }
            }
            .background(Color(UIColor.systemGroupedBackground))
        }
        .task {
            await loadAnalyses()
        }
    }

    func loadAnalyses() async {
        isLoading = true
        do {
            let response = try await APIService.shared.getContractAnalyses()
            analyses = response.analyses
        } catch {
            print("Failed to load analyses: \(error)")
        }
        isLoading = false
    }

    func deleteAnalyses(at offsets: IndexSet) {
        analyses.remove(atOffsets: offsets)
    }
}

// MARK: - Contract Analysis Row
struct ContractAnalysisRow: View {
    let analysis: ContractAnalysis

    var riskColor: Color {
        switch analysis.overallRisk?.lowercased() {
        case "low": return .green
        case "medium": return .orange
        case "high": return .red
        case "critical": return .purple
        default: return .gray
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                Text(analysis.title ?? "Untitled Contract")
                    .font(.body)
                    .fontWeight(.medium)

                Spacer()

                if let risk = analysis.overallRisk {
                    HStack(spacing: 4) {
                        Image(systemName: "shield.fill")
                            .font(.caption2)
                        Text(risk.uppercased())
                            .font(.caption2)
                            .fontWeight(.bold)
                    }
                    .foregroundColor(riskColor)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(riskColor.opacity(0.1))
                    .clipShape(Capsule())
                }
            }

            if let contractType = analysis.contractType {
                Text(contractType)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            HStack {
                if let date = analysis.createdAt {
                    Text(date.formatted(date: .abbreviated, time: .omitted))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                Spacer()

                if let clauses = analysis.clauses {
                    Label("\(clauses.count) clauses", systemImage: "list.bullet.rectangle")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

// MARK: - Contract Analysis Detail View
struct ContractAnalysisDetailView: View {
    let analysis: ContractAnalysis
    @State private var selectedTab = 0

    var riskColor: Color {
        switch analysis.overallRisk?.lowercased() {
        case "low": return .green
        case "medium": return .orange
        case "high": return .red
        case "critical": return .purple
        default: return .gray
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.lg) {
                // Header with Risk Score
                VStack(spacing: AppSpacing.md) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(analysis.title ?? "Contract Analysis")
                                .font(.title2)
                                .fontWeight(.bold)

                            if let type = analysis.contractType {
                                Text(type)
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                        }

                        Spacer()

                        // Risk Gauge
                        ZStack {
                            Circle()
                                .stroke(Color.gray.opacity(0.2), lineWidth: 8)
                                .frame(width: 70, height: 70)

                            Circle()
                                .trim(from: 0, to: CGFloat(analysis.riskScore ?? 0) / 100)
                                .stroke(riskColor, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                                .frame(width: 70, height: 70)
                                .rotationEffect(.degrees(-90))

                            VStack(spacing: 0) {
                                Text("\(analysis.riskScore ?? 0)")
                                    .font(.headline)
                                    .fontWeight(.bold)
                                Text("Risk")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }

                    if let summary = analysis.summary {
                        Text(summary)
                            .font(.body)
                            .foregroundColor(.secondary)
                    }
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Tab Picker
                Picker("View", selection: $selectedTab) {
                    Text("Clauses").tag(0)
                    Text("Key Terms").tag(1)
                    Text("Issues").tag(2)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                // Content
                if selectedTab == 0 {
                    clausesContent
                } else if selectedTab == 1 {
                    keyTermsContent
                } else {
                    issuesContent
                }
            }
            .padding(.top)
            .padding(.bottom, AppSpacing.xxl)
        }
        .background(Color(UIColor.systemGroupedBackground))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button {
                        // Export report
                    } label: {
                        Label("Export Report", systemImage: "square.and.arrow.up")
                    }

                    Button {
                        // Share
                    } label: {
                        Label("Share", systemImage: "paperplane")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
    }

    var clausesContent: some View {
        VStack(spacing: AppSpacing.md) {
            if let clauses = analysis.clauses, !clauses.isEmpty {
                ForEach(clauses) { clause in
                    ClauseCard(clause: clause)
                }
            } else {
                emptyStateView(title: "No Clauses", message: "No clauses were identified")
            }
        }
        .padding(.horizontal)
    }

    var keyTermsContent: some View {
        VStack(spacing: AppSpacing.md) {
            if let terms = analysis.keyTerms, !terms.isEmpty {
                ForEach(terms) { term in
                    KeyTermRow(term: term)
                }
            } else {
                emptyStateView(title: "No Key Terms", message: "No key terms were extracted")
            }
        }
        .padding(.horizontal)
    }

    var issuesContent: some View {
        VStack(alignment: .leading, spacing: AppSpacing.lg) {
            // Missing Provisions
            if let missing = analysis.missingProvisions, !missing.isEmpty {
                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                    Text("MISSING PROVISIONS")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.secondary)

                    VStack(alignment: .leading, spacing: AppSpacing.sm) {
                        ForEach(missing, id: \.self) { provision in
                            HStack(alignment: .top) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(.orange)
                                    .font(.caption)
                                Text(provision)
                                    .font(.body)
                            }
                        }
                    }
                    .padding()
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                }
            }

            // Recommendations
            if let recommendations = analysis.recommendations, !recommendations.isEmpty {
                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                    Text("RECOMMENDATIONS")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.secondary)

                    VStack(alignment: .leading, spacing: AppSpacing.sm) {
                        ForEach(recommendations, id: \.self) { rec in
                            HStack(alignment: .top) {
                                Image(systemName: "lightbulb.fill")
                                    .foregroundColor(.yellow)
                                    .font(.caption)
                                Text(rec)
                                    .font(.body)
                            }
                        }
                    }
                    .padding()
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                }
            }

            if (analysis.missingProvisions?.isEmpty ?? true) && (analysis.recommendations?.isEmpty ?? true) {
                emptyStateView(title: "No Issues Found", message: "No issues or recommendations")
            }
        }
        .padding(.horizontal)
    }

    func emptyStateView(title: String, message: String) -> some View {
        VStack {
            Text(title)
                .font(.body)
                .fontWeight(.medium)
            Text(message)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
    }
}

// MARK: - Clause Card
struct ClauseCard: View {
    let clause: ContractClause
    @State private var isExpanded = false

    var riskColor: Color {
        switch clause.riskLevel?.lowercased() {
        case "low": return .green
        case "medium": return .orange
        case "high": return .red
        case "critical": return .purple
        default: return .gray
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            Button {
                withAnimation { isExpanded.toggle() }
            } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(clause.title ?? clause.clauseType ?? "Clause")
                            .font(.body)
                            .fontWeight(.medium)
                            .foregroundColor(.primary)

                        if let type = clause.clauseType, clause.title != nil {
                            Text(type)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }

                    Spacer()

                    if let risk = clause.riskLevel {
                        Text(risk.uppercased())
                            .font(.caption2)
                            .fontWeight(.bold)
                            .foregroundColor(riskColor)
                    }

                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                }
            }

            if isExpanded {
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    if let content = clause.content {
                        Text(content)
                            .font(.body)
                    }

                    if let explanation = clause.riskExplanation {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Risk Analysis")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundColor(.secondary)
                            Text(explanation)
                                .font(.caption)
                                .foregroundColor(riskColor)
                        }
                    }

                    if let recommendation = clause.recommendation {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Recommendation")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundColor(.secondary)
                            Text(recommendation)
                                .font(.caption)
                                .foregroundColor(.accentColor)
                        }
                    }
                }
                .padding(.top, AppSpacing.sm)
            }
        }
        .padding()
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.md)
                .stroke(riskColor.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Key Term Row
struct KeyTermRow: View {
    let term: ContractKeyTerm

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(term.term)
                    .font(.body)
                    .fontWeight(.medium)

                if let type = term.termType {
                    Text(type.capitalized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            if let value = term.value {
                Text(value)
                    .font(.body)
                    .foregroundColor(.accentColor)
                    .fontWeight(.medium)
            }
        }
        .padding()
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
    }
}

// MARK: - New Contract Analysis View
struct NewContractAnalysisView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var casesViewModel = CasesViewModel()

    @State private var content = ""
    @State private var title = ""
    @State private var contractType = ""
    @State private var selectedCaseId: String?
    @State private var isProcessing = false

    var onComplete: (ContractAnalysis?) -> Void

    let contractTypes = [
        "Employment Agreement",
        "Service Agreement",
        "NDA / Confidentiality",
        "Lease Agreement",
        "Purchase Agreement",
        "Partnership Agreement",
        "License Agreement",
        "Consulting Agreement",
        "Other"
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("Contract Content") {
                    TextEditor(text: $content)
                        .frame(minHeight: 200)

                    Button {
                        if let clipboardText = UIPasteboard.general.string {
                            content = clipboardText
                        }
                    } label: {
                        Label("Paste from Clipboard", systemImage: "doc.on.clipboard")
                    }
                }

                Section("Contract Details") {
                    TextField("Title (optional)", text: $title)

                    Picker("Contract Type", selection: $contractType) {
                        Text("Auto-detect").tag("")
                        ForEach(contractTypes, id: \.self) { type in
                            Text(type).tag(type)
                        }
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
            .navigationTitle("Analyze Contract")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await analyzeContract() }
                    } label: {
                        if isProcessing {
                            ProgressView()
                        } else {
                            Text("Analyze")
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

    func analyzeContract() async {
        isProcessing = true
        do {
            let request = AnalyzeContractRequest(
                content: content,
                title: title.isEmpty ? nil : title,
                contractType: contractType.isEmpty ? nil : contractType,
                caseId: selectedCaseId,
                clientId: nil
            )
            let response = try await APIService.shared.analyzeContract(request: request)
            onComplete(response.analysis)
        } catch {
            print("Failed to analyze contract: \(error)")
            onComplete(nil)
        }
        isProcessing = false
        dismiss()
    }
}

// MARK: - Preview
#Preview {
    ContractAnalysisView()
}
