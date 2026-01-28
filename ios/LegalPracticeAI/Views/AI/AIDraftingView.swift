//
//  AIDraftingView.swift
//  LegalPracticeAI
//
//  AI Document Drafting interface
//

import SwiftUI

struct AIDraftingView: View {
    @State private var sessions: [AIDraftSession] = []
    @State private var templates: [AIDraftTemplate] = []
    @State private var isLoading = false
    @State private var showNewDraft = false
    @State private var selectedTab = 0

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Tab Selector
                Picker("View", selection: $selectedTab) {
                    Text("My Drafts").tag(0)
                    Text("Templates").tag(1)
                }
                .pickerStyle(.segmented)
                .padding()

                if selectedTab == 0 {
                    draftsContent
                } else {
                    templatesContent
                }
            }
            .navigationTitle("AI Drafting")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showNewDraft = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showNewDraft) {
                NewAIDraftView()
            }
            .background(Color(UIColor.systemGroupedBackground))
        }
        .task {
            await loadData()
        }
    }

    var draftsContent: some View {
        Group {
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if sessions.isEmpty {
                VStack(spacing: AppSpacing.lg) {
                    Image(systemName: "doc.badge.gearshape")
                        .font(.system(size: 60))
                        .foregroundColor(.secondary)

                    Text("No AI Drafts Yet")
                        .font(.title3)
                        .fontWeight(.semibold)

                    Text("Create your first AI-generated document")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    Button {
                        showNewDraft = true
                    } label: {
                        Label("New Draft", systemImage: "plus")
                            .fontWeight(.semibold)
                    }
                    .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(sessions) { session in
                        NavigationLink(destination: AIDraftDetailView(session: session)) {
                            DraftSessionRow(session: session)
                        }
                        .listRowBackground(Color.cardBackground)
                    }
                }
                .listStyle(.plain)
                .refreshable {
                    await loadData()
                }
            }
        }
    }

    var templatesContent: some View {
        Group {
            if templates.isEmpty {
                VStack(spacing: AppSpacing.lg) {
                    Image(systemName: "doc.on.doc")
                        .font(.system(size: 60))
                        .foregroundColor(.secondary)

                    Text("No Templates")
                        .font(.title3)
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(templates) { template in
                        TemplateRow(template: template) {
                            showNewDraft = true
                        }
                        .listRowBackground(Color.cardBackground)
                    }
                }
                .listStyle(.plain)
            }
        }
    }

    func loadData() async {
        isLoading = true
        do {
            async let sessionsResponse = APIService.shared.getAIDraftSessions()
            async let templatesResponse = APIService.shared.getAIDraftTemplates()

            sessions = try await sessionsResponse.sessions
            templates = try await templatesResponse.templates
        } catch {
            print("Failed to load AI drafting data: \(error)")
        }
        isLoading = false
    }
}

// MARK: - Draft Session Row
struct DraftSessionRow: View {
    let session: AIDraftSession

    var statusColor: Color {
        switch session.status?.lowercased() {
        case "completed": return .green
        case "in_progress": return .blue
        case "draft": return .orange
        default: return .gray
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                Text(session.title ?? "Untitled Draft")
                    .font(.body)
                    .fontWeight(.medium)
                    .lineLimit(1)

                Spacer()

                if let status = session.status {
                    Text(status.uppercased())
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundColor(statusColor)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(statusColor.opacity(0.1))
                        .clipShape(Capsule())
                }
            }

            HStack(spacing: AppSpacing.md) {
                if let docType = session.documentType {
                    Label(docType.replacingOccurrences(of: "_", with: " ").capitalized, systemImage: "doc.text")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                if let versions = session.versionCount, versions > 0 {
                    Label("\(versions) versions", systemImage: "clock.arrow.circlepath")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            if let date = session.createdAt {
                Text(date.formatted(date: .abbreviated, time: .shortened))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

// MARK: - Template Row
struct TemplateRow: View {
    let template: AIDraftTemplate
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: AppSpacing.md) {
                Image(systemName: "doc.text.fill")
                    .font(.title2)
                    .foregroundColor(.accentColor)
                    .frame(width: 44, height: 44)
                    .background(Color.accentColor.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.sm))

                VStack(alignment: .leading, spacing: 4) {
                    Text(template.name)
                        .font(.body)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)

                    if let desc = template.description {
                        Text(desc)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }

                    if let category = template.category {
                        Text(category.replacingOccurrences(of: "_", with: " ").capitalized)
                            .font(.caption)
                            .foregroundColor(.accentColor)
                    }
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

// MARK: - New AI Draft View
struct NewAIDraftView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var casesViewModel = CasesViewModel()
    @StateObject private var clientsViewModel = ClientsViewModel()

    @State private var documentType = "contract"
    @State private var title = ""
    @State private var context = ""
    @State private var style = "formal"
    @State private var length = "standard"
    @State private var jurisdiction = ""
    @State private var selectedClientId: String?
    @State private var selectedCaseId: String?
    @State private var additionalInstructions = ""
    @State private var isGenerating = false
    @State private var generatedContent: String?
    @State private var error: String?

    let documentTypes = [
        ("contract", "Contract"),
        ("letter", "Legal Letter"),
        ("motion", "Motion"),
        ("brief", "Brief"),
        ("agreement", "Agreement"),
        ("memorandum", "Memorandum"),
        ("pleading", "Pleading"),
        ("discovery", "Discovery Request"),
        ("notice", "Notice"),
        ("other", "Other")
    ]

    let styles = [
        ("formal", "Formal"),
        ("persuasive", "Persuasive"),
        ("neutral", "Neutral"),
        ("firm", "Firm")
    ]

    let lengths = [
        ("concise", "Concise"),
        ("standard", "Standard"),
        ("detailed", "Detailed")
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("Document Type") {
                    Picker("Type", selection: $documentType) {
                        ForEach(documentTypes, id: \.0) { type in
                            Text(type.1).tag(type.0)
                        }
                    }

                    TextField("Title (optional)", text: $title)
                }

                Section("Context & Instructions") {
                    TextEditor(text: $context)
                        .frame(minHeight: 100)
                        .overlay(
                            Group {
                                if context.isEmpty {
                                    Text("Describe what you need... (e.g., 'A non-disclosure agreement between two software companies')")
                                        .foregroundColor(.secondary)
                                        .padding(.top, 8)
                                        .padding(.leading, 4)
                                        .allowsHitTesting(false)
                                }
                            },
                            alignment: .topLeading
                        )
                }

                Section("Style Options") {
                    Picker("Writing Style", selection: $style) {
                        ForEach(styles, id: \.0) { s in
                            Text(s.1).tag(s.0)
                        }
                    }

                    Picker("Length", selection: $length) {
                        ForEach(lengths, id: \.0) { l in
                            Text(l.1).tag(l.0)
                        }
                    }

                    TextField("Jurisdiction (optional)", text: $jurisdiction)
                }

                Section("Link to") {
                    Picker("Client", selection: $selectedClientId) {
                        Text("None").tag(nil as String?)
                        ForEach(clientsViewModel.clients, id: \.id) { client in
                            Text(client.displayName).tag(client.id as String?)
                        }
                    }

                    Picker("Case", selection: $selectedCaseId) {
                        Text("None").tag(nil as String?)
                        ForEach(casesViewModel.cases, id: \.id) { caseItem in
                            Text(caseItem.title ?? "Untitled").tag(caseItem.id as String?)
                        }
                    }
                }

                Section("Additional Instructions") {
                    TextEditor(text: $additionalInstructions)
                        .frame(minHeight: 60)
                }

                if let error = error {
                    Section {
                        Text(error)
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("New AI Draft")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await generateDraft() }
                    } label: {
                        if isGenerating {
                            ProgressView()
                        } else {
                            Text("Generate")
                        }
                    }
                    .disabled(context.isEmpty || isGenerating)
                }
            }
        }
        .task {
            await clientsViewModel.loadClients()
            await casesViewModel.loadCases()
        }
    }

    func generateDraft() async {
        isGenerating = true
        error = nil

        do {
            let request = GenerateDraftRequest(
                documentType: documentType,
                title: title.isEmpty ? nil : title,
                context: context,
                style: style,
                length: length,
                clientId: selectedClientId,
                caseId: selectedCaseId,
                jurisdiction: jurisdiction.isEmpty ? nil : jurisdiction,
                additionalInstructions: additionalInstructions.isEmpty ? nil : additionalInstructions
            )

            let response = try await APIService.shared.generateAIDraft(request: request)
            generatedContent = response.content
            dismiss()
        } catch {
            self.error = "Failed to generate: \(error.localizedDescription)"
        }

        isGenerating = false
    }
}

// MARK: - AI Draft Detail View
struct AIDraftDetailView: View {
    let session: AIDraftSession
    @State private var showReviseSheet = false
    @State private var isLoading = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.lg) {
                // Header
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text(session.title ?? "Untitled Draft")
                        .font(.title2)
                        .fontWeight(.bold)

                    HStack(spacing: AppSpacing.md) {
                        if let docType = session.documentType {
                            Label(docType.replacingOccurrences(of: "_", with: " ").capitalized, systemImage: "doc.text")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }

                        if let style = session.style {
                            Label(style.capitalized, systemImage: "textformat")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }

                    if let tokens = session.totalTokens {
                        HStack {
                            Label("\(tokens) tokens", systemImage: "number")
                                .font(.caption)
                                .foregroundColor(.secondary)

                            if let cost = session.estimatedCost {
                                Text("~$\(String(format: "%.4f", cost))")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Content Preview
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("DOCUMENT CONTENT")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.secondary)
                        .padding(.horizontal)

                    ScrollView {
                        Text(session.latestContent ?? "No content available")
                            .font(.system(.body, design: .monospaced))
                            .padding()
                    }
                    .frame(maxHeight: 400)
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                    .padding(.horizontal)
                }

                // Actions
                VStack(spacing: AppSpacing.sm) {
                    Button {
                        showReviseSheet = true
                    } label: {
                        Label("Revise with AI", systemImage: "wand.and.stars")
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(Color.accentColor)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                    }

                    Button {
                        // Copy to clipboard
                        if let content = session.latestContent {
                            UIPasteboard.general.string = content
                        }
                    } label: {
                        Label("Copy to Clipboard", systemImage: "doc.on.doc")
                            .font(.headline)
                            .foregroundColor(.accentColor)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(Color.accentColor.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                    }

                    Button {
                        // Export
                    } label: {
                        Label("Export as PDF", systemImage: "arrow.down.doc")
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
        .sheet(isPresented: $showReviseSheet) {
            ReviseAIDraftView(sessionId: session.id)
        }
    }
}

// MARK: - Revise AI Draft View
struct ReviseAIDraftView: View {
    @Environment(\.dismiss) private var dismiss
    let sessionId: String

    @State private var instructions = ""
    @State private var style = "formal"
    @State private var isRevising = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Revision Instructions") {
                    TextEditor(text: $instructions)
                        .frame(minHeight: 120)
                        .overlay(
                            Group {
                                if instructions.isEmpty {
                                    Text("Describe what changes you want... (e.g., 'Make it more formal', 'Add a confidentiality clause')")
                                        .foregroundColor(.secondary)
                                        .padding(.top, 8)
                                        .padding(.leading, 4)
                                        .allowsHitTesting(false)
                                }
                            },
                            alignment: .topLeading
                        )
                }

                Section("Style") {
                    Picker("Writing Style", selection: $style) {
                        Text("Formal").tag("formal")
                        Text("Persuasive").tag("persuasive")
                        Text("Neutral").tag("neutral")
                        Text("Firm").tag("firm")
                    }
                }
            }
            .navigationTitle("Revise Draft")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await reviseDraft() }
                    } label: {
                        if isRevising {
                            ProgressView()
                        } else {
                            Text("Revise")
                        }
                    }
                    .disabled(instructions.isEmpty || isRevising)
                }
            }
        }
    }

    func reviseDraft() async {
        isRevising = true
        do {
            let request = ReviseDraftRequest(instructions: instructions, style: style)
            _ = try await APIService.shared.reviseAIDraft(sessionId: sessionId, request: request)
            dismiss()
        } catch {
            print("Failed to revise: \(error)")
        }
        isRevising = false
    }
}

// MARK: - Preview
#Preview {
    AIDraftingView()
}
