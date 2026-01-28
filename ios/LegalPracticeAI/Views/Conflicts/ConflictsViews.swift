//
//  ConflictsViews.swift
//  LegalPracticeAI
//
//  Conflict check and management views
//

import SwiftUI

// MARK: - Conflicts ViewModel
@MainActor
final class ConflictsViewModel: ObservableObject {
    @Published var conflictChecks: [ConflictCheck] = []
    @Published var conflictParties: [ConflictParty] = []
    @Published var relatedParties: [RelatedParty] = []
    @Published var waivers: [ConflictWaiver] = []
    @Published var isLoading = false
    @Published var error: String?
    @Published var searchText = ""

    private let api = APIService.shared

    init() {
        // Data now loaded from API, not local storage
    }

    // MARK: - Load Parties from API
    func loadParties(search: String? = nil) async {
        isLoading = true
        error = nil

        do {
            let response = try await api.getConflictParties(search: search)
            conflictParties = response.parties
        } catch {
            self.error = "Failed to load parties: \(error.localizedDescription)"
            print("DEBUG: Failed to load conflict parties: \(error)")
        }

        isLoading = false
    }

    // MARK: - Add Party via API
    func addParty(name: String, partyType: String, role: String?, caseId: String?, clientId: String?, notes: String?) async -> Bool {
        isLoading = true
        error = nil

        do {
            let request = CreateConflictPartyRequest(
                name: name,
                partyType: partyType,
                role: role,
                caseId: caseId,
                clientId: clientId,
                notes: notes
            )
            let party = try await api.addConflictParty(request: request)
            conflictParties.insert(party, at: 0)
            isLoading = false
            return true
        } catch {
            self.error = "Failed to add party: \(error.localizedDescription)"
            isLoading = false
            return false
        }
    }

    // MARK: - Run Conflict Check via API
    func performConflictCheck(name: String, type: String) async -> ConflictCheck {
        isLoading = true
        error = nil

        do {
            let request = RunConflictCheckRequest(
                searchName: name,
                searchType: type,
                includeRelated: true
            )
            let response = try await api.runConflictCheck(request: request)

            // Convert API response to ConflictCheck
            let status: ConflictStatus = response.hasConflict ? .potential : .clear
            let check = ConflictCheck(
                id: response.checkId ?? UUID().uuidString,
                searchName: name,
                searchType: type,
                status: status,
                results: response.matches
            )
            conflictChecks.insert(check, at: 0)
            isLoading = false
            return check
        } catch {
            self.error = "Failed to run conflict check: \(error.localizedDescription)"
            print("DEBUG: Failed to run conflict check: \(error)")

            // Fall back to local check
            isLoading = false
            return performLocalConflictCheck(name: name, type: type)
        }
    }

    // MARK: - Load Waivers via API
    func loadWaivers(for conflictId: String) async {
        do {
            let response = try await api.getConflictWaivers(conflictId: conflictId)
            waivers = response.waivers
        } catch {
            print("DEBUG: Failed to load waivers: \(error)")
        }
    }

    // MARK: - Load All Waivers via API
    func loadAllWaivers() async {
        isLoading = true
        error = nil

        do {
            let response = try await api.getAllConflictWaivers()
            waivers = response.waivers
            print("DEBUG: Loaded \(waivers.count) waivers from API")
        } catch {
            self.error = "Failed to load waivers: \(error.localizedDescription)"
            print("DEBUG: Failed to load all waivers: \(error)")
        }

        isLoading = false
    }

    // MARK: - Load Conflict History via API
    func loadConflictHistory() async {
        isLoading = true
        error = nil

        do {
            let response = try await api.getConflictHistory()
            conflictChecks = response.checks
            print("DEBUG: Loaded \(conflictChecks.count) conflict checks from API")
        } catch {
            self.error = "Failed to load conflict history: \(error.localizedDescription)"
            print("DEBUG: Failed to load conflict history: \(error)")
        }

        isLoading = false
    }

    // MARK: - Add Waiver via API
    func addWaiver(conflictId: String, clientName: String, conflictDescription: String, waiverType: String?, signedBy: String?, signedAt: Date?, expiresAt: Date?, notes: String?) async -> Bool {
        do {
            let request = CreateConflictWaiverRequest(
                clientName: clientName,
                conflictDescription: conflictDescription,
                waiverType: waiverType,
                signedBy: signedBy,
                signedAt: signedAt,
                expiresAt: expiresAt,
                notes: notes
            )
            let waiver = try await api.addConflictWaiver(conflictId: conflictId, request: request)
            waivers.insert(waiver, at: 0)
            return true
        } catch {
            self.error = "Failed to add waiver: \(error.localizedDescription)"
            return false
        }
    }

    // MARK: - Local Operations
    func addConflictCheck(_ check: ConflictCheck) {
        conflictChecks.insert(check, at: 0)
    }

    func deleteConflictCheck(_ check: ConflictCheck) {
        conflictChecks.removeAll { $0.id == check.id }
    }

    func addRelatedParty(_ party: RelatedParty) {
        relatedParties.insert(party, at: 0)
    }

    func deleteRelatedParty(_ party: RelatedParty) {
        relatedParties.removeAll { $0.id == party.id }
    }

    func addWaiver(_ waiver: ConflictWaiver) {
        waivers.insert(waiver, at: 0)
    }

    func deleteWaiver(_ waiver: ConflictWaiver) {
        waivers.removeAll { $0.id == waiver.id }
    }

    // MARK: - Local Conflict Check (fallback)
    private func performLocalConflictCheck(name: String, type: String) -> ConflictCheck {
        var results: [ConflictResult] = []
        var status: ConflictStatus = .clear

        // Check against existing related parties
        for party in relatedParties {
            let similarity = calculateSimilarity(name, party.name)
            if similarity > 0.6 {
                results.append(ConflictResult(
                    matchedName: party.name,
                    matchType: similarity > 0.9 ? "exact" : "partial",
                    relatedCase: party.caseId,
                    relatedClient: party.clientId,
                    relationship: party.relationship,
                    matchScore: similarity
                ))
                status = similarity > 0.9 ? .confirmed : .potential
            }
        }

        // Check against conflict parties from API
        for party in conflictParties {
            let similarity = calculateSimilarity(name, party.name)
            if similarity > 0.6 {
                results.append(ConflictResult(
                    matchedName: party.name,
                    matchType: similarity > 0.9 ? "exact" : "partial",
                    relatedCase: party.caseId,
                    relatedClient: party.clientId,
                    relationship: party.role,
                    matchScore: similarity
                ))
                status = similarity > 0.9 ? .confirmed : .potential
            }
        }

        let check = ConflictCheck(
            searchName: name,
            searchType: type,
            status: status,
            results: results
        )
        addConflictCheck(check)
        return check
    }

    private func calculateSimilarity(_ s1: String, _ s2: String) -> Double {
        let str1 = s1.lowercased()
        let str2 = s2.lowercased()
        if str1 == str2 { return 1.0 }
        if str1.contains(str2) || str2.contains(str1) { return 0.8 }

        // Simple Jaccard similarity on words
        let words1 = Set(str1.split(separator: " ").map(String.init))
        let words2 = Set(str2.split(separator: " ").map(String.init))
        let intersection = words1.intersection(words2).count
        let union = words1.union(words2).count
        return union > 0 ? Double(intersection) / Double(union) : 0
    }
}

// MARK: - Conflict Check View
struct ConflictCheckView: View {
    @StateObject private var viewModel = ConflictsViewModel()
    @State private var searchName = ""
    @State private var companyName = ""
    @State private var searchType = "new_client"
    @State private var practiceArea = "any"
    @State private var searchClients = true
    @State private var searchCases = true
    @State private var searchParties = true
    @State private var fuzzyMatching = true
    @State private var lastResult: ConflictCheck?
    @State private var showResult = false

    let checkTypes = [
        ("new_client", "New Client Intake"),
        ("new_matter", "New Matter"),
        ("opposing_party", "Opposing Party"),
        ("witness", "Witness Check")
    ]

    let practiceAreas = [
        ("any", "Any"),
        ("business", "Business Law"),
        ("family", "Family Law"),
        ("real_estate", "Real Estate"),
        ("litigation", "Litigation"),
        ("criminal", "Criminal Defense")
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Quick Stats Banner
                HStack(spacing: AppSpacing.md) {
                    ConflictStatCard(title: "Total Checks", value: "\(viewModel.conflictChecks.count)", color: .blue)
                    ConflictStatCard(title: "Clear", value: "\(viewModel.conflictChecks.filter { $0.status == .clear }.count)", color: .green)
                    ConflictStatCard(title: "Conflicts", value: "\(viewModel.conflictChecks.filter { $0.status == .potential || $0.status == .confirmed }.count)", color: .orange)
                    ConflictStatCard(title: "Waived", value: "\(viewModel.conflictChecks.filter { $0.status == .waived }.count)", color: .purple)
                }
                .padding(.horizontal)

                // Quick Conflict Check Form
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Label("Quick Conflict Check", systemImage: "magnifyingglass")
                        .font(.headline)

                    VStack(alignment: .leading, spacing: AppSpacing.sm) {
                        Text("Names to Check")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        TextField("Enter names, comma separated", text: $searchName)
                            .textFieldStyle(.roundedBorder)
                    }

                    VStack(alignment: .leading, spacing: AppSpacing.sm) {
                        Text("Companies (Optional)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        TextField("Enter company names, comma separated", text: $companyName)
                            .textFieldStyle(.roundedBorder)
                    }

                    HStack {
                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            Text("Check Type")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Picker("Type", selection: $searchType) {
                                ForEach(checkTypes, id: \.0) { type in
                                    Text(type.1).tag(type.0)
                                }
                            }
                            .pickerStyle(.menu)
                        }

                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            Text("Practice Area")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Picker("Area", selection: $practiceArea) {
                                ForEach(practiceAreas, id: \.0) { area in
                                    Text(area.1).tag(area.0)
                                }
                            }
                            .pickerStyle(.menu)
                        }
                    }

                    // Search Options
                    VStack(alignment: .leading, spacing: AppSpacing.sm) {
                        Text("Search Options")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        HStack {
                            Toggle("Clients", isOn: $searchClients)
                                .toggleStyle(.button)
                                .buttonStyle(.bordered)
                            Toggle("Cases", isOn: $searchCases)
                                .toggleStyle(.button)
                                .buttonStyle(.bordered)
                            Toggle("Parties", isOn: $searchParties)
                                .toggleStyle(.button)
                                .buttonStyle(.bordered)
                        }
                        Toggle("Enable Fuzzy Matching", isOn: $fuzzyMatching)
                    }

                    Button {
                        Task {
                            let searchTerms = searchName + (companyName.isEmpty ? "" : ", \(companyName)")
                            lastResult = await viewModel.performConflictCheck(name: searchTerms, type: searchType)
                            showResult = true
                        }
                    } label: {
                        HStack {
                            if viewModel.isLoading {
                                ProgressView()
                                    .tint(.white)
                            }
                            Image(systemName: "magnifyingglass")
                            Text("Run Conflict Check")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(searchName.isEmpty || viewModel.isLoading)
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Result
                if let result = lastResult, showResult {
                    ConflictResultCard(check: result)
                        .padding(.horizontal)
                }

                // Recent Conflict Checks
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    HStack {
                        Text("Recent Conflict Checks")
                            .font(.headline)
                        Spacer()
                        NavigationLink("View All") {
                            ConflictHistoryView()
                        }
                        .font(.subheadline)
                    }
                    .padding(.horizontal)

                    if viewModel.conflictChecks.isEmpty {
                        Text("No recent checks")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity)
                            .padding()
                    } else {
                        ForEach(viewModel.conflictChecks.prefix(5)) { check in
                            ConflictHistoryRow(check: check)
                                .padding(.horizontal)
                                .padding(.vertical, AppSpacing.xs)
                                .background(Color.cardBackground)
                        }
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Conflict Checking")
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadConflictHistory()
        }
        .refreshable {
            await viewModel.loadConflictHistory()
        }
    }
}

struct ConflictResultCard: View {
    let check: ConflictCheck

    var statusColor: Color {
        switch check.status {
        case .clear: return .green
        case .potential: return .orange
        case .confirmed: return .red
        case .waived: return .blue
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            HStack {
                Image(systemName: check.status == .clear ? "checkmark.shield.fill" : "exclamationmark.triangle.fill")
                    .font(.title)
                    .foregroundColor(statusColor)

                VStack(alignment: .leading) {
                    Text(check.status.displayName)
                        .font(.headline)
                        .foregroundColor(statusColor)
                    Text("Search: \(check.searchName)")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                Spacer()
            }

            if !check.results.isEmpty {
                Divider()
                Text("Potential Matches:")
                    .font(.subheadline)
                    .fontWeight(.medium)

                ForEach(check.results) { result in
                    HStack {
                        Circle()
                            .fill(result.matchScore > 0.9 ? Color.red : Color.orange)
                            .frame(width: 8, height: 8)
                        Text(result.matchedName)
                            .font(.subheadline)
                        Spacer()
                        Text("\(Int(result.matchScore * 100))%")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }

            if let date = check.checkedAt {
                Text("Checked: \(date.formatted(date: .abbreviated, time: .shortened))")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(statusColor.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
    }
}

struct ConflictStatCard: View {
    let title: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: AppSpacing.sm) {
            Text(value)
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(color)
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
    }
}

// MARK: - Conflict History View
struct ConflictHistoryView: View {
    @StateObject private var viewModel = ConflictsViewModel()

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.isLoading {
                ProgressView("Loading history...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if viewModel.conflictChecks.isEmpty {
                EmptyStateView(
                    icon: "clock.arrow.circlepath",
                    title: "No History",
                    message: "Previous conflict checks will appear here"
                )
            } else {
                List {
                    ForEach(viewModel.conflictChecks) { check in
                        ConflictHistoryRow(check: check)
                            .listRowBackground(Color.cardBackground)
                    }
                    .onDelete { indexSet in
                        for index in indexSet {
                            viewModel.deleteConflictCheck(viewModel.conflictChecks[index])
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Conflict History")
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadConflictHistory()
        }
        .refreshable {
            await viewModel.loadConflictHistory()
        }
    }
}

struct ConflictHistoryRow: View {
    let check: ConflictCheck

    var statusColor: Color {
        switch check.status {
        case .clear: return .green
        case .potential: return .orange
        case .confirmed: return .red
        case .waived: return .blue
        }
    }

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: check.status == .clear ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                .foregroundColor(statusColor)
                .font(.title2)

            VStack(alignment: .leading, spacing: 2) {
                Text(check.searchName)
                    .font(.body)
                    .fontWeight(.medium)

                Text(check.status.displayName)
                    .font(.caption)
                    .foregroundColor(statusColor)

                if let date = check.checkedAt {
                    Text(date.formatted(date: .abbreviated, time: .shortened))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            if !check.results.isEmpty {
                Text("\(check.results.count)")
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(statusColor.opacity(0.2))
                    .clipShape(Capsule())
            }
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

// MARK: - Parties Database View (matches web "Parties Database")
struct PartiesDatabaseView: View {
    @StateObject private var viewModel = ConflictsViewModel()
    @State private var showAddParty = false
    @State private var searchText = ""
    @State private var selectedType = "all"
    @State private var selectedRole = "all"

    let partyTypes = [("all", "All Types"), ("individual", "Individual"), ("business", "Business"), ("company", "Company")]
    let partyRoles = [("all", "All Roles"), ("client", "Client"), ("opposing_party", "Opposing Party"), ("witness", "Witness"), ("other", "Other")]

    var filteredParties: [ConflictParty] {
        viewModel.conflictParties.filter { party in
            let matchesSearch = searchText.isEmpty || party.name.localizedCaseInsensitiveContains(searchText)
            let matchesType = selectedType == "all" || party.partyType == selectedType
            let matchesRole = selectedRole == "all" || party.role == selectedRole
            return matchesSearch && matchesType && matchesRole
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Search and Filter Bar
            VStack(spacing: AppSpacing.sm) {
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)
                    TextField("Search parties...", text: $searchText)
                }
                .padding(AppSpacing.sm)
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                .padding(.horizontal)

                HStack {
                    Picker("Type", selection: $selectedType) {
                        ForEach(partyTypes, id: \.0) { type in
                            Text(type.1).tag(type.0)
                        }
                    }
                    .pickerStyle(.menu)

                    Picker("Role", selection: $selectedRole) {
                        ForEach(partyRoles, id: \.0) { role in
                            Text(role.1).tag(role.0)
                        }
                    }
                    .pickerStyle(.menu)

                    Spacer()

                    Button {
                        Task { await viewModel.loadParties(search: searchText.isEmpty ? nil : searchText) }
                    } label: {
                        Label("Search", systemImage: "magnifyingglass")
                    }
                    .buttonStyle(.bordered)
                }
                .padding(.horizontal)
            }
            .padding(.vertical, AppSpacing.sm)
            .background(Color(UIColor.secondarySystemGroupedBackground))

            if viewModel.isLoading {
                ProgressView("Loading parties...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if filteredParties.isEmpty {
                EmptyStateView(
                    icon: "person.2.circle.fill",
                    title: "No Parties Found",
                    message: "Add parties to track for conflict checking",
                    actionTitle: "Add Party",
                    action: { showAddParty = true }
                )
            } else {
                List {
                    ForEach(filteredParties) { party in
                        PartiesDatabaseRow(party: party)
                            .listRowBackground(Color.cardBackground)
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Parties Database")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAddParty = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddParty) {
            AddPartyView(viewModel: viewModel)
        }
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadParties()
        }
        .refreshable {
            await viewModel.loadParties()
        }
    }
}

struct PartiesDatabaseRow: View {
    let party: ConflictParty

    var typeColor: Color {
        switch party.partyType {
        case "business", "company": return .blue
        default: return .green
        }
    }

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(party.name)
                        .font(.body)
                        .fontWeight(.medium)

                    Text(party.partyType.capitalized)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(typeColor.opacity(0.2))
                        .foregroundColor(typeColor)
                        .clipShape(Capsule())
                }

                if let role = party.role {
                    Text(role.replacingOccurrences(of: "_", with: " ").capitalized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                if let notes = party.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            if let date = party.createdAt {
                Text(date.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

struct AddPartyView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: ConflictsViewModel

    @State private var name = ""
    @State private var partyType = "individual"
    @State private var role = "client"
    @State private var notes = ""

    let partyTypes = [("individual", "Individual"), ("business", "Business"), ("company", "Company")]
    let roles = [("client", "Client"), ("opposing_party", "Opposing Party"), ("witness", "Witness"), ("expert", "Expert"), ("other", "Other")]

    var body: some View {
        NavigationStack {
            Form {
                Section("Party Information") {
                    TextField("Name", text: $name)

                    Picker("Type", selection: $partyType) {
                        ForEach(partyTypes, id: \.0) { type in
                            Text(type.1).tag(type.0)
                        }
                    }

                    Picker("Role", selection: $role) {
                        ForEach(roles, id: \.0) { r in
                            Text(r.1).tag(r.0)
                        }
                    }
                }

                Section("Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 80)
                }
            }
            .navigationTitle("Add Party")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            _ = await viewModel.addParty(
                                name: name,
                                partyType: partyType,
                                role: role,
                                caseId: nil,
                                clientId: nil,
                                notes: notes.isEmpty ? nil : notes
                            )
                            dismiss()
                        }
                    }
                    .disabled(name.isEmpty)
                }
            }
        }
    }
}

// Keep old name for backwards compatibility
typealias RelatedPartiesView = PartiesDatabaseView

struct ConflictPartyRow: View {
    let party: ConflictParty

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: party.partyType == "company" ? "building.2.fill" : "person.circle.fill")
                .foregroundColor(.accentColor)
                .font(.title2)

            VStack(alignment: .leading, spacing: 2) {
                Text(party.name)
                    .font(.body)
                    .fontWeight(.medium)

                if let relationship = party.relationship {
                    Text(relationship.replacingOccurrences(of: "_", with: " ").capitalized)
                        .font(.caption)
                        .foregroundColor(.accentColor)
                }

                if let notes = party.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            Text(party.partyType.capitalized)
                .font(.caption2)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.accentColor.opacity(0.2))
                .clipShape(Capsule())
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

struct RelatedPartyRow: View {
    let party: RelatedParty

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: "person.circle.fill")
                .foregroundColor(.accentColor)
                .font(.title2)

            VStack(alignment: .leading, spacing: 2) {
                Text(party.name)
                    .font(.body)
                    .fontWeight(.medium)

                Text(party.relationshipDisplay)
                    .font(.caption)
                    .foregroundColor(.accentColor)

                if let notes = party.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

struct AddRelatedPartyView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: ConflictsViewModel

    @State private var name = ""
    @State private var relationship = "opposing_party"
    @State private var notes = ""

    let relationships = [
        ("spouse", "Spouse"),
        ("business_partner", "Business Partner"),
        ("employer", "Employer"),
        ("employee", "Employee"),
        ("opposing_party", "Opposing Party"),
        ("witness", "Witness"),
        ("co_defendant", "Co-Defendant"),
        ("co_plaintiff", "Co-Plaintiff"),
        ("other", "Other")
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("Party Information") {
                    TextField("Name", text: $name)

                    Picker("Relationship", selection: $relationship) {
                        ForEach(relationships, id: \.0) { rel in
                            Text(rel.1).tag(rel.0)
                        }
                    }
                }

                Section("Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 80)
                }
            }
            .navigationTitle("Add Related Party")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let party = RelatedParty(
                            name: name,
                            relationship: relationship,
                            notes: notes.isEmpty ? nil : notes
                        )
                        viewModel.addRelatedParty(party)
                        dismiss()
                    }
                    .disabled(name.isEmpty)
                }
            }
        }
    }
}

// MARK: - Waivers View
struct WaiversView: View {
    @StateObject private var viewModel = ConflictsViewModel()
    @State private var showAddWaiver = false

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.isLoading {
                ProgressView("Loading waivers...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if viewModel.waivers.isEmpty {
                EmptyStateView(
                    icon: "doc.badge.ellipsis",
                    title: "No Waivers",
                    message: "Conflict waivers will appear here",
                    actionTitle: "Add Waiver",
                    action: { showAddWaiver = true }
                )
            } else {
                List {
                    ForEach(viewModel.waivers) { waiver in
                        WaiverRow(waiver: waiver)
                            .listRowBackground(Color.cardBackground)
                    }
                    .onDelete { indexSet in
                        for index in indexSet {
                            viewModel.deleteWaiver(viewModel.waivers[index])
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Conflict Waivers")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAddWaiver = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddWaiver) {
            AddWaiverView(viewModel: viewModel)
        }
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadAllWaivers()
        }
        .refreshable {
            await viewModel.loadAllWaivers()
        }
    }
}

struct WaiverRow: View {
    let waiver: ConflictWaiver

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: waiver.signedAt != nil ? "checkmark.seal.fill" : "doc.text.fill")
                .foregroundColor(waiver.signedAt != nil ? .green : .orange)
                .font(.title2)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(waiver.clientName)
                        .font(.body)
                        .fontWeight(.medium)

                    Text(waiver.waiverType.replacingOccurrences(of: "_", with: " ").capitalized)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.purple.opacity(0.2))
                        .foregroundColor(.purple)
                        .clipShape(Capsule())
                }

                if !waiver.conflictDescription.isEmpty {
                    Text(waiver.conflictDescription)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }

                HStack(spacing: AppSpacing.md) {
                    if let signedAt = waiver.signedAt {
                        Label(signedAt.formatted(date: .abbreviated, time: .omitted), systemImage: "checkmark.circle.fill")
                            .font(.caption2)
                            .foregroundColor(.green)
                    } else {
                        Label("Pending Signature", systemImage: "clock")
                            .font(.caption2)
                            .foregroundColor(.orange)
                    }

                    if let signedBy = waiver.signedBy, !signedBy.isEmpty {
                        Text("by \(signedBy)")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }

            Spacer()

            // Status badge
            Text(waiver.signedAt != nil ? "Signed" : "Pending")
                .font(.caption2)
                .fontWeight(.medium)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(waiver.signedAt != nil ? Color.green.opacity(0.2) : Color.orange.opacity(0.2))
                .foregroundColor(waiver.signedAt != nil ? .green : .orange)
                .clipShape(Capsule())
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

struct AddWaiverView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: ConflictsViewModel

    @State private var clientName = ""
    @State private var conflictDescription = ""
    @State private var waiverType = "informed_consent"
    @State private var expiresAt = Date().addingTimeInterval(365 * 24 * 60 * 60)
    @State private var hasExpiration = false
    @State private var notes = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Waiver Details") {
                    TextField("Client Name", text: $clientName)
                    TextField("Conflict Description", text: $conflictDescription)

                    Picker("Waiver Type", selection: $waiverType) {
                        Text("Informed Consent").tag("informed_consent")
                        Text("Advance Waiver").tag("advance_waiver")
                    }
                }

                Section("Expiration") {
                    Toggle("Has Expiration", isOn: $hasExpiration)
                    if hasExpiration {
                        DatePicker("Expires", selection: $expiresAt, displayedComponents: .date)
                    }
                }

                Section("Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 80)
                }
            }
            .navigationTitle("Add Waiver")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let waiver = ConflictWaiver(
                            conflictCheckId: "",
                            clientName: clientName,
                            conflictDescription: conflictDescription,
                            waiverType: waiverType,
                            expiresAt: hasExpiration ? expiresAt : nil,
                            notes: notes.isEmpty ? nil : notes
                        )
                        viewModel.addWaiver(waiver)
                        dismiss()
                    }
                    .disabled(clientName.isEmpty || conflictDescription.isEmpty)
                }
            }
        }
    }
}
