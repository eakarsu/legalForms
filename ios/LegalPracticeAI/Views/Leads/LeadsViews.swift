//
//  LeadsViews.swift
//  LegalPracticeAI
//
//  All Leads-related views
//

import SwiftUI

// MARK: - New Leads View
struct NewLeadsView: View {
    @StateObject private var viewModel = LeadsViewModel()
    @State private var showAddLead = false

    var body: some View {
        LeadListView(
            leads: viewModel.newLeads,
            title: "New Leads",
            emptyIcon: "person.badge.plus",
            emptyMessage: "No new leads yet",
            viewModel: viewModel,
            showAddLead: $showAddLead
        )
        .task {
            await viewModel.loadLeads()
        }
        .refreshable {
            await viewModel.loadLeads()
        }
        .sheet(isPresented: $showAddLead) {
            AddLeadView(viewModel: viewModel)
        }
    }
}

// MARK: - Active Leads View
struct ActiveLeadsView: View {
    @StateObject private var viewModel = LeadsViewModel()
    @State private var showAddLead = false

    var body: some View {
        LeadListView(
            leads: viewModel.activeLeads,
            title: "Active Leads",
            emptyIcon: "person.wave.2.fill",
            emptyMessage: "No active leads",
            viewModel: viewModel,
            showAddLead: $showAddLead
        )
        .task {
            await viewModel.loadLeads()
        }
        .refreshable {
            await viewModel.loadLeads()
        }
        .sheet(isPresented: $showAddLead) {
            AddLeadView(viewModel: viewModel)
        }
    }
}

// MARK: - Converted Leads View
struct ConvertedLeadsView: View {
    @StateObject private var viewModel = LeadsViewModel()

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.convertedLeads.isEmpty {
                EmptyStateView(
                    icon: "checkmark.circle.fill",
                    title: "No Converted Leads",
                    message: "Leads that become clients will appear here"
                )
            } else {
                List {
                    ForEach(viewModel.convertedLeads) { lead in
                        NavigationLink(destination: LeadDetailView(lead: lead, viewModel: viewModel)) {
                            LeadRowView(lead: lead)
                        }
                        .listRowBackground(Color.cardBackground)
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Converted Leads")
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadLeads()
        }
        .refreshable {
            await viewModel.loadLeads()
        }
    }
}

// MARK: - Lost Leads View
struct LostLeadsView: View {
    @StateObject private var viewModel = LeadsViewModel()

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.lostLeads.isEmpty {
                EmptyStateView(
                    icon: "person.fill.xmark",
                    title: "No Lost Leads",
                    message: "Lost leads will appear here"
                )
            } else {
                List {
                    ForEach(viewModel.lostLeads) { lead in
                        NavigationLink(destination: LeadDetailView(lead: lead, viewModel: viewModel)) {
                            LeadRowView(lead: lead)
                        }
                        .listRowBackground(Color.cardBackground)
                        .swipeActions(edge: .trailing) {
                            Button {
                                Task {
                                    await viewModel.updateLeadStatus(lead, status: .new)
                                }
                            } label: {
                                Label("Reactivate", systemImage: "arrow.uturn.left")
                            }
                            .tint(.green)
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Lost Leads")
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadLeads()
        }
        .refreshable {
            await viewModel.loadLeads()
        }
    }
}

// MARK: - Lead Sources View
struct LeadSourcesView: View {
    @StateObject private var viewModel = LeadsViewModel()

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Summary Stats
                VStack(spacing: AppSpacing.md) {
                    Text("Lead Sources Overview")
                        .font(.headline)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal)

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: AppSpacing.md) {
                        ForEach(LeadSource.allCases, id: \.self) { source in
                            LeadSourceCard(
                                source: source,
                                count: viewModel.leadsBySource[source] ?? 0,
                                total: viewModel.leads.count
                            )
                        }
                    }
                    .padding(.horizontal)
                }

                // Leads by Source
                ForEach(LeadSource.allCases, id: \.self) { source in
                    let sourceLeads = viewModel.leads.filter { $0.source == source }
                    if !sourceLeads.isEmpty {
                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            HStack {
                                Image(systemName: source.icon)
                                    .foregroundColor(.accentColor)
                                Text(source.displayName)
                                    .font(.headline)
                                Spacer()
                                Text("\(sourceLeads.count)")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                            .padding(.horizontal)

                            ForEach(sourceLeads.prefix(3)) { lead in
                                NavigationLink(destination: LeadDetailView(lead: lead, viewModel: viewModel)) {
                                    LeadRowView(lead: lead)
                                        .padding(.horizontal)
                                }
                                .buttonStyle(PlainButtonStyle())
                            }
                        }
                        .padding(.vertical, AppSpacing.sm)
                        .background(Color.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                        .padding(.horizontal)
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Lead Sources")
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadLeads()
        }
        .refreshable {
            await viewModel.loadLeads()
        }
    }
}

// MARK: - Follow-ups View
struct FollowUpsView: View {
    @StateObject private var viewModel = LeadsViewModel()
    @State private var showAddFollowUp = false

    var body: some View {
        VStack(spacing: 0) {
            // Overdue Section
            if !viewModel.overdueFollowUps.isEmpty {
                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.red)
                        Text("Overdue (\(viewModel.overdueFollowUps.count))")
                            .font(.headline)
                            .foregroundColor(.red)
                    }
                    .padding(.horizontal)
                    .padding(.top)

                    ForEach(viewModel.overdueFollowUps) { followUp in
                        FollowUpRowView(followUp: followUp, viewModel: viewModel, isOverdue: true)
                            .padding(.horizontal)
                    }
                }
            }

            // Upcoming Section
            if viewModel.pendingFollowUps.isEmpty && viewModel.overdueFollowUps.isEmpty {
                EmptyStateView(
                    icon: "arrow.uturn.forward.circle.fill",
                    title: "No Follow-ups",
                    message: "Schedule follow-ups with your leads"
                )
            } else {
                List {
                    let upcomingFollowUps = viewModel.pendingFollowUps.filter { $0.dueDate >= Date() }
                    ForEach(upcomingFollowUps) { followUp in
                        FollowUpRowView(followUp: followUp, viewModel: viewModel, isOverdue: false)
                            .listRowBackground(Color.cardBackground)
                    }
                    .onDelete { indexSet in
                        for index in indexSet {
                            viewModel.deleteFollowUp(upcomingFollowUps[index])
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Follow-ups")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAddFollowUp = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddFollowUp) {
            AddFollowUpView(viewModel: viewModel)
        }
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadLeads()
        }
        .refreshable {
            await viewModel.loadLeads()
        }
    }
}

// MARK: - Supporting Views

struct LeadListView: View {
    let leads: [Lead]
    let title: String
    let emptyIcon: String
    let emptyMessage: String
    @ObservedObject var viewModel: LeadsViewModel
    @Binding var showAddLead: Bool

    var body: some View {
        VStack(spacing: 0) {
            if leads.isEmpty {
                EmptyStateView(
                    icon: emptyIcon,
                    title: "No \(title)",
                    message: emptyMessage,
                    actionTitle: "Add Lead",
                    action: { showAddLead = true }
                )
            } else {
                List {
                    ForEach(leads) { lead in
                        NavigationLink(destination: LeadDetailView(lead: lead, viewModel: viewModel)) {
                            LeadRowView(lead: lead)
                        }
                        .listRowBackground(Color.cardBackground)
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                Task {
                                    await viewModel.deleteLead(lead)
                                }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                        .swipeActions(edge: .leading) {
                            if lead.status != .converted {
                                Button {
                                    Task {
                                        await viewModel.convertToClient(lead)
                                    }
                                } label: {
                                    Label("Convert", systemImage: "person.badge.plus")
                                }
                                .tint(.green)
                            }
                        }
                    }
                }
                .listStyle(.plain)
                .searchable(text: $viewModel.searchText, prompt: "Search leads")
            }
        }
        .navigationTitle(title)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAddLead = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

struct LeadRowView: View {
    let lead: Lead

    var statusColor: Color {
        switch lead.status {
        case .new: return .green
        case .contacted: return .blue
        case .qualified: return .purple
        case .proposal: return .orange
        case .converted: return .teal
        case .lost: return .red
        }
    }

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Text(lead.initials)
                .font(.headline)
                .foregroundColor(.white)
                .frame(width: 44, height: 44)
                .background(statusColor)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(lead.displayName)
                    .font(.body)
                    .fontWeight(.medium)

                if let email = lead.email, !email.isEmpty {
                    Text(email)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                HStack(spacing: AppSpacing.sm) {
                    Text(lead.status.displayName)
                        .font(.caption2)
                        .foregroundColor(statusColor)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(statusColor.opacity(0.1))
                        .clipShape(Capsule())

                    Text(lead.source.displayName)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            if let value = lead.estimatedValue, value > 0 {
                Text("$\(Int(value))")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.green)
            }
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

struct LeadSourceCard: View {
    let source: LeadSource
    let count: Int
    let total: Int

    var percentage: Double {
        guard total > 0 else { return 0 }
        return Double(count) / Double(total) * 100
    }

    var body: some View {
        VStack(spacing: AppSpacing.sm) {
            Image(systemName: source.icon)
                .font(.title2)
                .foregroundColor(.accentColor)

            Text(source.displayName)
                .font(.caption)
                .fontWeight(.medium)

            Text("\(count)")
                .font(.title2)
                .fontWeight(.bold)

            Text("\(Int(percentage))%")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
    }
}

struct FollowUpRowView: View {
    let followUp: FollowUp
    @ObservedObject var viewModel: LeadsViewModel
    let isOverdue: Bool

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Button {
                viewModel.completeFollowUp(followUp)
            } label: {
                Image(systemName: followUp.isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.title2)
                    .foregroundColor(followUp.isCompleted ? .green : (isOverdue ? .red : .secondary))
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(followUp.leadName ?? "Unknown Lead")
                    .font(.body)
                    .fontWeight(.medium)
                    .strikethrough(followUp.isCompleted)

                if let notes = followUp.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }

                Text(followUp.dueDate.formatted(date: .abbreviated, time: .shortened))
                    .font(.caption)
                    .foregroundColor(isOverdue ? .red : .secondary)
            }

            Spacer()
        }
        .padding(.vertical, AppSpacing.xs)
        .opacity(followUp.isCompleted ? 0.6 : 1)
    }
}

// MARK: - Lead Detail View
struct LeadDetailView: View {
    @State var lead: Lead
    @ObservedObject var viewModel: LeadsViewModel
    @State private var showEditLead = false
    @State private var showAddFollowUp = false
    @State private var showConvertAlert = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Header
                VStack(spacing: AppSpacing.md) {
                    Text(lead.initials)
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .frame(width: 80, height: 80)
                        .background(Color.accentColor)
                        .clipShape(Circle())

                    Text(lead.displayName)
                        .font(.title2)
                        .fontWeight(.bold)

                    Text(lead.status.displayName)
                        .font(.subheadline)
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 4)
                        .background(statusColor)
                        .clipShape(Capsule())
                }
                .padding()
                .frame(maxWidth: .infinity)
                .background(Color.cardBackground)

                // Contact Info
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Contact Information")
                        .font(.headline)
                        .padding(.horizontal)

                    VStack(spacing: 0) {
                        if let email = lead.email, !email.isEmpty {
                            DetailRow(icon: "envelope.fill", title: "Email", value: email)
                            Divider().padding(.leading, 50)
                        }

                        if let phone = lead.phone, !phone.isEmpty {
                            DetailRow(icon: "phone.fill", title: "Phone", value: phone)
                            Divider().padding(.leading, 50)
                        }

                        if let company = lead.companyName, !company.isEmpty {
                            DetailRow(icon: "building.2.fill", title: "Company", value: company)
                        }
                    }
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                    .padding(.horizontal)
                }

                // Lead Info
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Lead Information")
                        .font(.headline)
                        .padding(.horizontal)

                    VStack(spacing: 0) {
                        DetailRow(icon: "arrow.triangle.branch", title: "Source", value: lead.source.displayName)
                        Divider().padding(.leading, 50)

                        if let caseType = lead.caseType, !caseType.isEmpty {
                            DetailRow(icon: "folder.fill", title: "Case Type", value: caseType)
                            Divider().padding(.leading, 50)
                        }

                        if let value = lead.estimatedValue, value > 0 {
                            DetailRow(icon: "dollarsign.circle.fill", title: "Est. Value", value: "$\(Int(value))")
                        }
                    }
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                    .padding(.horizontal)
                }

                // Notes
                if let notes = lead.notes, !notes.isEmpty {
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("Notes")
                            .font(.headline)
                            .padding(.horizontal)

                        Text(notes)
                            .font(.body)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                            .padding(.horizontal)
                    }
                }

                // Actions
                VStack(spacing: AppSpacing.md) {
                    if lead.status != .converted {
                        Button {
                            showConvertAlert = true
                        } label: {
                            Label("Convert to Client", systemImage: "person.badge.plus")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .padding(.horizontal)
                    }

                    Button {
                        showAddFollowUp = true
                    } label: {
                        Label("Schedule Follow-up", systemImage: "calendar.badge.plus")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .padding(.horizontal)
                }
                .padding(.vertical)
            }
        }
        .navigationTitle("Lead Details")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Edit") {
                    showEditLead = true
                }
            }
        }
        .sheet(isPresented: $showEditLead) {
            EditLeadView(lead: $lead, viewModel: viewModel)
        }
        .sheet(isPresented: $showAddFollowUp) {
            AddFollowUpView(viewModel: viewModel, preselectedLead: lead)
        }
        .alert("Convert to Client", isPresented: $showConvertAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Convert") {
                Task {
                    if await viewModel.convertToClient(lead) {
                        dismiss()
                    }
                }
            }
        } message: {
            Text("This will create a new client from this lead and mark the lead as converted.")
        }
        .background(Color(UIColor.systemGroupedBackground))
    }

    var statusColor: Color {
        switch lead.status {
        case .new: return .green
        case .contacted: return .blue
        case .qualified: return .purple
        case .proposal: return .orange
        case .converted: return .teal
        case .lost: return .red
        }
    }
}

struct DetailRow: View {
    let icon: String
    let title: String
    let value: String

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: icon)
                .foregroundColor(.accentColor)
                .frame(width: 30)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
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

// MARK: - Add Lead View
struct AddLeadView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: LeadsViewModel

    @State private var firstName = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var companyName = ""
    @State private var source: LeadSource = .website
    @State private var caseType = ""
    @State private var estimatedValue = ""
    @State private var notes = ""

    var isValid: Bool {
        !firstName.isEmpty || !companyName.isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Contact") {
                    TextField("First Name", text: $firstName)
                    TextField("Last Name", text: $lastName)
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                    TextField("Phone", text: $phone)
                        .keyboardType(.phonePad)
                    TextField("Company", text: $companyName)
                }

                Section("Lead Details") {
                    Picker("Source", selection: $source) {
                        ForEach(LeadSource.allCases, id: \.self) { source in
                            Label(source.displayName, systemImage: source.icon).tag(source)
                        }
                    }

                    TextField("Case Type", text: $caseType)
                    TextField("Estimated Value ($)", text: $estimatedValue)
                        .keyboardType(.decimalPad)
                }

                Section("Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 80)
                }
            }
            .navigationTitle("Add Lead")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let lead = Lead(
                            firstName: firstName.isEmpty ? nil : firstName,
                            lastName: lastName.isEmpty ? nil : lastName,
                            email: email.isEmpty ? nil : email,
                            phone: phone.isEmpty ? nil : phone,
                            companyName: companyName.isEmpty ? nil : companyName,
                            source: source,
                            caseType: caseType.isEmpty ? nil : caseType,
                            notes: notes.isEmpty ? nil : notes,
                            estimatedValue: Double(estimatedValue)
                        )
                        viewModel.addLead(lead)
                        dismiss()
                    }
                    .disabled(!isValid)
                }
            }
        }
    }
}

// MARK: - Edit Lead View
struct EditLeadView: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var lead: Lead
    @ObservedObject var viewModel: LeadsViewModel

    @State private var firstName = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var companyName = ""
    @State private var status: LeadStatus = .new
    @State private var source: LeadSource = .website
    @State private var caseType = ""
    @State private var estimatedValue = ""
    @State private var notes = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Contact") {
                    TextField("First Name", text: $firstName)
                    TextField("Last Name", text: $lastName)
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                    TextField("Phone", text: $phone)
                        .keyboardType(.phonePad)
                    TextField("Company", text: $companyName)
                }

                Section("Status") {
                    Picker("Status", selection: $status) {
                        ForEach(LeadStatus.allCases, id: \.self) { status in
                            Text(status.displayName).tag(status)
                        }
                    }

                    Picker("Source", selection: $source) {
                        ForEach(LeadSource.allCases, id: \.self) { source in
                            Label(source.displayName, systemImage: source.icon).tag(source)
                        }
                    }
                }

                Section("Details") {
                    TextField("Case Type", text: $caseType)
                    TextField("Estimated Value ($)", text: $estimatedValue)
                        .keyboardType(.decimalPad)
                }

                Section("Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 80)
                }
            }
            .navigationTitle("Edit Lead")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        lead.firstName = firstName.isEmpty ? nil : firstName
                        lead.lastName = lastName.isEmpty ? nil : lastName
                        lead.email = email.isEmpty ? nil : email
                        lead.phone = phone.isEmpty ? nil : phone
                        lead.companyName = companyName.isEmpty ? nil : companyName
                        lead.status = status
                        lead.source = source
                        lead.caseType = caseType.isEmpty ? nil : caseType
                        lead.estimatedValue = Double(estimatedValue)
                        lead.notes = notes.isEmpty ? nil : notes
                        lead.updatedAt = Date()
                        viewModel.updateLead(lead)
                        dismiss()
                    }
                }
            }
            .onAppear {
                firstName = lead.firstName ?? ""
                lastName = lead.lastName ?? ""
                email = lead.email ?? ""
                phone = lead.phone ?? ""
                companyName = lead.companyName ?? ""
                status = lead.status
                source = lead.source
                caseType = lead.caseType ?? ""
                estimatedValue = lead.estimatedValue.map { String(Int($0)) } ?? ""
                notes = lead.notes ?? ""
            }
        }
    }
}

// MARK: - Add Follow-up View
struct AddFollowUpView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: LeadsViewModel
    var preselectedLead: Lead?

    @State private var selectedLeadId: String?
    @State private var dueDate = Date()
    @State private var notes = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Lead") {
                    Picker("Select Lead", selection: $selectedLeadId) {
                        Text("Select a lead").tag(nil as String?)
                        ForEach(viewModel.activeLeads) { lead in
                            Text(lead.displayName).tag(lead.id as String?)
                        }
                    }
                }

                Section("Schedule") {
                    DatePicker("Due Date", selection: $dueDate, displayedComponents: [.date, .hourAndMinute])
                }

                Section("Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 80)
                }
            }
            .navigationTitle("Schedule Follow-up")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        if let leadId = selectedLeadId {
                            let leadName = viewModel.leads.first { $0.id == leadId }?.displayName
                            let followUp = FollowUp(
                                leadId: leadId,
                                leadName: leadName,
                                dueDate: dueDate,
                                notes: notes.isEmpty ? nil : notes
                            )
                            viewModel.addFollowUp(followUp)
                        }
                        dismiss()
                    }
                    .disabled(selectedLeadId == nil)
                }
            }
            .onAppear {
                if let lead = preselectedLead {
                    selectedLeadId = lead.id
                }
            }
        }
    }
}

// MARK: - Empty State View
struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: AppSpacing.lg) {
            Spacer()

            Image(systemName: icon)
                .font(.system(size: 60))
                .foregroundColor(.secondary.opacity(0.5))

            Text(title)
                .font(.title3)
                .fontWeight(.semibold)

            Text(message)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            if let actionTitle = actionTitle, let action = action {
                Button(actionTitle) {
                    action()
                }
                .buttonStyle(.borderedProminent)
            }

            Spacer()
        }
    }
}
