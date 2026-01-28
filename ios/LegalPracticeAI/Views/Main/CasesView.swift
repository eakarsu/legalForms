//
//  CasesView.swift
//  LegalPracticeAI
//
//  Cases list and management screen
//

import SwiftUI

struct CasesView: View {
    @StateObject private var viewModel = CasesViewModel()
    @State private var showAddCase = false

    // Main case types for grid display
    let mainCaseTypes: [CaseType] = [
        .litigation,
        .corporate,
        .realEstate,
        .familyLaw,
        .estatePlanning,
        .employment
    ]

    let columns = [
        GridItem(.flexible(), spacing: AppSpacing.md),
        GridItem(.flexible(), spacing: AppSpacing.md)
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.lg) {
                    // Case Types Grid (2x3)
                    LazyVGrid(columns: columns, spacing: AppSpacing.md) {
                        ForEach(mainCaseTypes, id: \.self) { caseType in
                            NavigationLink(destination: CaseTypeCasesView(caseType: caseType)) {
                                CaseTypeCard(caseType: caseType, count: countCases(for: caseType))
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
                    }
                    .padding(.horizontal)

                    // All Cases Link
                    NavigationLink(destination: AllCasesListView()) {
                        HStack {
                            Image(systemName: "folder.fill")
                                .foregroundColor(.accentColor)
                            Text("View All Cases")
                                .fontWeight(.medium)
                            Spacer()
                            Text("\(viewModel.cases.count)")
                                .foregroundColor(.secondary)
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding()
                        .background(Color.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                    }
                    .buttonStyle(PlainButtonStyle())
                    .padding(.horizontal)

                    // Recent Cases Section
                    if !viewModel.cases.isEmpty {
                        VStack(alignment: .leading, spacing: AppSpacing.md) {
                            Text("Recent Cases")
                                .font(.headline)
                                .foregroundColor(.primary)
                                .padding(.horizontal)

                            ForEach(viewModel.cases.prefix(5)) { caseItem in
                                NavigationLink(destination: CaseDetailView(caseItem: caseItem)) {
                                    CaseListRow(caseItem: caseItem)
                                        .padding(.horizontal)
                                }
                                .buttonStyle(PlainButtonStyle())
                            }
                        }
                    }
                }
                .padding(.top)
            }
            .navigationTitle("Cases")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showAddCase = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showAddCase) {
                AddCaseView(viewModel: viewModel)
            }
            .background(Color(UIColor.systemGroupedBackground))
        }
        .task {
            await viewModel.loadCases()
        }
    }

    func countCases(for caseType: CaseType) -> Int {
        viewModel.cases.filter { $0.caseType == caseType.rawValue }.count
    }
}

// MARK: - Case Type Card
struct CaseTypeCard: View {
    let caseType: CaseType
    let count: Int

    var icon: String {
        switch caseType {
        case .litigation: return "building.columns"
        case .corporate: return "building.2"
        case .realEstate: return "house"
        case .familyLaw: return "person.2"
        case .estatePlanning: return "scroll"
        case .employment: return "briefcase"
        case .bankruptcy: return "creditcard"
        case .criminal: return "shield"
        case .immigration: return "airplane"
        case .intellectualProperty: return "lightbulb"
        case .general: return "folder"
        }
    }

    var color: Color {
        switch caseType {
        case .litigation: return .blue
        case .corporate: return .purple
        case .realEstate: return .green
        case .familyLaw: return .orange
        case .estatePlanning: return .teal
        case .employment: return .pink
        case .bankruptcy: return .red
        case .criminal: return .gray
        case .immigration: return .cyan
        case .intellectualProperty: return .yellow
        case .general: return .secondary
        }
    }

    var body: some View {
        VStack(spacing: AppSpacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 32))
                .foregroundColor(color)

            Text(caseType.displayName)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(.primary)
                .multilineTextAlignment(.center)
                .lineLimit(2)

            Text("\(count) cases")
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

// MARK: - Case Type Cases View
struct CaseTypeCasesView: View {
    let caseType: CaseType
    @StateObject private var viewModel = CasesViewModel()
    @State private var showAddCase = false

    var filteredCases: [Case] {
        viewModel.cases.filter { $0.caseType == caseType.rawValue }
    }

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.isLoading && viewModel.cases.isEmpty {
                Spacer()
                ProgressView()
                Spacer()
            } else if filteredCases.isEmpty {
                Spacer()
                VStack(spacing: AppSpacing.lg) {
                    Image(systemName: CaseTypeCard(caseType: caseType, count: 0).icon)
                        .font(.system(size: 60))
                        .foregroundColor(.accentColor.opacity(0.5))

                    Text("No \(caseType.displayName) Cases")
                        .font(.headline)
                        .foregroundColor(.secondary)

                    Text("Create a new case to get started")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)

                    Button {
                        showAddCase = true
                    } label: {
                        Label("New Case", systemImage: "plus")
                            .fontWeight(.semibold)
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding()
                Spacer()
            } else {
                List {
                    ForEach(filteredCases) { caseItem in
                        NavigationLink(destination: CaseDetailView(caseItem: caseItem)) {
                            CaseListRow(caseItem: caseItem)
                        }
                        .listRowBackground(Color.cardBackground)
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                Task {
                                    await viewModel.deleteCase(caseItem)
                                }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    }
                }
                .listStyle(.plain)
                .refreshable {
                    await viewModel.loadCases()
                }
            }
        }
        .navigationTitle(caseType.displayName)
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $viewModel.searchText, prompt: "Search \(caseType.displayName.lowercased())")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAddCase = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddCase) {
            AddCaseView(viewModel: viewModel)
        }
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadCases()
        }
    }
}

// MARK: - All Cases List View
struct AllCasesListView: View {
    @StateObject private var viewModel = CasesViewModel()
    @State private var showAddCase = false

    var body: some View {
        VStack(spacing: 0) {
            // Status Filter
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: AppSpacing.sm) {
                    StatusFilterChip(title: "All", count: viewModel.cases.count, isSelected: viewModel.selectedStatus == "all") {
                        viewModel.selectedStatus = "all"
                    }
                    StatusFilterChip(title: "Open", count: viewModel.openCasesCount, isSelected: viewModel.selectedStatus == "open", color: .green) {
                        viewModel.selectedStatus = "open"
                    }
                    StatusFilterChip(title: "Pending", count: viewModel.pendingCasesCount, isSelected: viewModel.selectedStatus == "pending", color: .orange) {
                        viewModel.selectedStatus = "pending"
                    }
                    StatusFilterChip(title: "Closed", count: viewModel.closedCasesCount, isSelected: viewModel.selectedStatus == "closed", color: .gray) {
                        viewModel.selectedStatus = "closed"
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, AppSpacing.sm)
            }
            .background(Color(UIColor.systemBackground))

            // Content
            if viewModel.isLoading && viewModel.cases.isEmpty {
                Spacer()
                ProgressView()
                Spacer()
            } else if viewModel.filteredCases.isEmpty {
                Spacer()
                VStack(spacing: AppSpacing.lg) {
                    Image(systemName: "folder.badge.plus")
                        .font(.system(size: 60))
                        .foregroundColor(.secondary)

                    Text("No Cases Yet")
                        .font(.title3)
                        .fontWeight(.semibold)

                    Button {
                        showAddCase = true
                    } label: {
                        Label("New Case", systemImage: "plus")
                            .fontWeight(.semibold)
                    }
                    .buttonStyle(.borderedProminent)
                }
                Spacer()
            } else {
                List {
                    ForEach(viewModel.filteredCases) { caseItem in
                        NavigationLink(destination: CaseDetailView(caseItem: caseItem)) {
                            CaseListRow(caseItem: caseItem)
                        }
                        .listRowBackground(Color.cardBackground)
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                Task {
                                    await viewModel.deleteCase(caseItem)
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
        .navigationTitle("All Cases")
        .searchable(text: $viewModel.searchText, prompt: "Search cases")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAddCase = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddCase) {
            AddCaseView(viewModel: viewModel)
        }
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadCases()
        }
    }
}

// MARK: - Status Filter Chip
struct StatusFilterChip: View {
    let title: String
    let count: Int
    let isSelected: Bool
    var color: Color = .accentColor
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(isSelected ? .semibold : .regular)

                Text("\(count)")
                    .font(.caption)
                    .fontWeight(.medium)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(isSelected ? color : Color.secondary.opacity(0.2))
                    .foregroundColor(isSelected ? .white : .secondary)
                    .clipShape(Capsule())
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(isSelected ? color.opacity(0.15) : Color.clear)
            .foregroundColor(isSelected ? color : .primary)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(isSelected ? color : Color.secondary.opacity(0.3), lineWidth: 1)
            )
        }
    }
}

// MARK: - Case List Row
struct CaseListRow: View {
    let caseItem: Case

    var statusColor: Color {
        switch caseItem.status?.lowercased() {
        case "open": return .green
        case "pending": return .orange
        case "closed": return .gray
        default: return .blue
        }
    }

    var priorityColor: Color {
        switch caseItem.priority?.lowercased() {
        case "high": return .red
        case "medium": return .orange
        case "low": return .green
        default: return .blue
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                Text(caseItem.title ?? "Untitled Case")
                    .font(.body)
                    .fontWeight(.medium)
                    .lineLimit(1)

                Spacer()

                Text(caseItem.status?.uppercased() ?? "OPEN")
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundColor(statusColor)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(statusColor.opacity(0.1))
                    .clipShape(Capsule())
            }

            HStack(spacing: AppSpacing.md) {
                if let caseNumber = caseItem.caseNumber {
                    Label(caseNumber, systemImage: "number")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Label(caseItem.clientDisplayName, systemImage: "person")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }

            HStack {
                if let caseType = caseItem.caseType {
                    Text(caseType.replacingOccurrences(of: "_", with: " ").capitalized)
                        .font(.caption)
                        .foregroundColor(.accentColor)
                }

                Spacer()

                if let priority = caseItem.priority {
                    HStack(spacing: 2) {
                        Circle()
                            .fill(priorityColor)
                            .frame(width: 6, height: 6)
                        Text(priority.capitalized)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

// MARK: - Add Case View
struct AddCaseView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: CasesViewModel
    @StateObject private var clientsViewModel = ClientsViewModel()

    @State private var title = ""
    @State private var description = ""
    @State private var selectedClientId: String?
    @State private var caseType = "general"
    @State private var priority = "medium"
    @State private var billingType = "hourly"
    @State private var billingRate = ""

    var isValid: Bool {
        !title.isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Case Information") {
                    TextField("Case Title", text: $title)

                    Picker("Client", selection: $selectedClientId) {
                        Text("No Client").tag(nil as String?)
                        ForEach(clientsViewModel.clients, id: \.id) { client in
                            Text(client.displayName).tag(client.id as String?)
                        }
                    }

                    Picker("Case Type", selection: $caseType) {
                        ForEach(CaseType.allCases, id: \.rawValue) { type in
                            Text(type.displayName).tag(type.rawValue)
                        }
                    }

                    Picker("Priority", selection: $priority) {
                        ForEach(CasePriority.allCases, id: \.rawValue) { p in
                            Text(p.displayName).tag(p.rawValue)
                        }
                    }
                }

                Section("Description") {
                    TextEditor(text: $description)
                        .frame(minHeight: 100)
                }

                Section("Billing") {
                    Picker("Billing Type", selection: $billingType) {
                        Text("Hourly").tag("hourly")
                        Text("Fixed Fee").tag("fixed")
                        Text("Contingency").tag("contingency")
                        Text("Pro Bono").tag("pro_bono")
                    }

                    if billingType == "hourly" {
                        TextField("Hourly Rate ($)", text: $billingRate)
                            .keyboardType(.decimalPad)
                    }
                }
            }
            .navigationTitle("New Case")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task {
                            let rate = Double(billingRate)
                            let success = await viewModel.createCase(
                                clientId: selectedClientId,
                                title: title,
                                description: description.isEmpty ? nil : description,
                                caseType: caseType,
                                priority: priority,
                                billingType: billingType,
                                billingRate: rate
                            )
                            if success {
                                dismiss()
                            }
                        }
                    }
                    .disabled(!isValid || viewModel.isLoading)
                }
            }
        }
        .task {
            await clientsViewModel.loadClients()
        }
    }
}

// MARK: - Case Detail View
struct CaseDetailView: View {
    let caseItem: Case
    @State private var showAddNote = false

    var statusColor: Color {
        switch caseItem.status?.lowercased() {
        case "open": return .green
        case "pending": return .orange
        case "closed": return .gray
        default: return .blue
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.lg) {
                // Header Card
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    HStack {
                        Text(caseItem.caseNumber ?? "No Case #")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Spacer()

                        Text(caseItem.status?.uppercased() ?? "OPEN")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(statusColor)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(statusColor.opacity(0.1))
                            .clipShape(Capsule())
                    }

                    Text(caseItem.title ?? "Untitled Case")
                        .font(.title2)
                        .fontWeight(.bold)

                    if let description = caseItem.description, !description.isEmpty {
                        Text(description)
                            .font(.body)
                            .foregroundColor(.secondary)
                    }

                    Divider()

                    // Client Info
                    HStack {
                        Image(systemName: "person.circle.fill")
                            .foregroundColor(.accentColor)
                        Text(caseItem.clientDisplayName)
                            .font(.subheadline)
                    }

                    // Case Type & Priority
                    HStack(spacing: AppSpacing.lg) {
                        if let caseType = caseItem.caseType {
                            Label(caseType.replacingOccurrences(of: "_", with: " ").capitalized, systemImage: "folder")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }

                        if let priority = caseItem.priority {
                            Label(priority.capitalized, systemImage: "flag")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Court Information
                if caseItem.courtName != nil || caseItem.judgeName != nil {
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("COURT INFORMATION")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)

                        VStack(spacing: 0) {
                            if let court = caseItem.courtName {
                                InfoRow(icon: "building.columns", label: "Court", value: court)
                                Divider().padding(.leading, 44)
                            }
                            if let judge = caseItem.judgeName {
                                InfoRow(icon: "person.text.rectangle", label: "Judge", value: judge)
                                Divider().padding(.leading, 44)
                            }
                            if let courtNum = caseItem.courtCaseNumber {
                                InfoRow(icon: "number", label: "Court Case #", value: courtNum)
                            }
                        }
                        .background(Color.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                    }
                    .padding(.horizontal)
                }

                // Opposing Party
                if caseItem.opposingParty != nil || caseItem.opposingCounsel != nil {
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("OPPOSING PARTY")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)

                        VStack(spacing: 0) {
                            if let party = caseItem.opposingParty {
                                InfoRow(icon: "person.fill.xmark", label: "Party", value: party)
                                Divider().padding(.leading, 44)
                            }
                            if let counsel = caseItem.opposingCounsel {
                                InfoRow(icon: "person.badge.shield.checkmark", label: "Counsel", value: counsel)
                            }
                        }
                        .background(Color.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                    }
                    .padding(.horizontal)
                }

                // Billing Information
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("BILLING")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.secondary)

                    VStack(spacing: 0) {
                        InfoRow(icon: "dollarsign.circle", label: "Type", value: caseItem.billingType?.capitalized ?? "Hourly")
                        if let rate = caseItem.billingRate {
                            Divider().padding(.leading, 44)
                            InfoRow(icon: "clock", label: "Rate", value: "$\(String(format: "%.2f", rate))/hr")
                        }
                        if let retainer = caseItem.retainerAmount {
                            Divider().padding(.leading, 44)
                            InfoRow(icon: "banknote", label: "Retainer", value: "$\(String(format: "%.2f", retainer))")
                        }
                    }
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                }
                .padding(.horizontal)

                // Quick Actions
                VStack(spacing: AppSpacing.sm) {
                    Button {
                        showAddNote = true
                    } label: {
                        Label("Add Note", systemImage: "note.text.badge.plus")
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(Color.accentColor)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                    }

                    Button {
                        // Log time
                    } label: {
                        Label("Log Time", systemImage: "clock.badge.checkmark")
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
        .sheet(isPresented: $showAddNote) {
            AddNoteView(caseId: caseItem.id)
        }
    }
}

// MARK: - Info Row
struct InfoRow: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: icon)
                .foregroundColor(.accentColor)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text(value)
                    .font(.body)
            }

            Spacer()
        }
        .padding()
    }
}

// MARK: - Add Note View
struct AddNoteView: View {
    @Environment(\.dismiss) private var dismiss
    let caseId: String

    @State private var content = ""
    @State private var noteType = "general"
    @State private var isBillable = false
    @State private var isLoading = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Note") {
                    TextEditor(text: $content)
                        .frame(minHeight: 150)
                }

                Section("Options") {
                    Picker("Type", selection: $noteType) {
                        Text("General").tag("general")
                        Text("Phone Call").tag("phone_call")
                        Text("Meeting").tag("meeting")
                        Text("Research").tag("research")
                        Text("Court").tag("court")
                    }

                    Toggle("Billable", isOn: $isBillable)
                }
            }
            .navigationTitle("Add Note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        // Save note
                        dismiss()
                    }
                    .disabled(content.isEmpty || isLoading)
                }
            }
        }
    }
}

// MARK: - Preview
#Preview {
    CasesView()
}
