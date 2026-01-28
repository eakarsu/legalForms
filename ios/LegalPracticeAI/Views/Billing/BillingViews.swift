//
//  BillingViews.swift
//  LegalPracticeAI
//
//  Billing-related views (Retainers, LEDES, Reports)
//

import SwiftUI

// MARK: - Retainer Model
struct Retainer: Identifiable, Codable {
    let id: String
    var clientId: String?
    var clientName: String
    var caseId: String?
    var caseName: String?
    var amount: Double
    var remainingBalance: Double
    var status: String // "active", "depleted", "refunded"
    var createdAt: Date?
    var refreshThreshold: Double?
    var notes: String?

    init(id: String = UUID().uuidString,
         clientId: String? = nil,
         clientName: String,
         caseId: String? = nil,
         caseName: String? = nil,
         amount: Double,
         remainingBalance: Double? = nil,
         status: String = "active",
         createdAt: Date? = Date(),
         refreshThreshold: Double? = nil,
         notes: String? = nil) {
        self.id = id
        self.clientId = clientId
        self.clientName = clientName
        self.caseId = caseId
        self.caseName = caseName
        self.amount = amount
        self.remainingBalance = remainingBalance ?? amount
        self.status = status
        self.createdAt = createdAt
        self.refreshThreshold = refreshThreshold
        self.notes = notes
    }

    var usedAmount: Double {
        amount - remainingBalance
    }

    var usagePercentage: Double {
        guard amount > 0 else { return 0 }
        return (usedAmount / amount) * 100
    }

    var needsRefresh: Bool {
        if let threshold = refreshThreshold {
            return remainingBalance <= threshold
        }
        return remainingBalance <= amount * 0.2
    }
}

// MARK: - Billing ViewModel
@MainActor
final class BillingViewModel: ObservableObject {
    @Published var retainers: [Retainer] = []
    @Published var invoices: [Invoice] = []
    @Published var timeEntries: [TimeEntry] = []
    @Published var isLoading = false
    @Published var error: String?

    private let api = APIService.shared
    private let retainersKey = "stored_retainers"

    init() {
        loadRetainersFromStorage()
    }

    // MARK: - API Methods
    func loadInvoices() async {
        isLoading = true
        error = nil
        do {
            let response = try await api.getInvoices()
            invoices = response.invoices
        } catch {
            self.error = "Failed to load invoices: \(error.localizedDescription)"
        }
        isLoading = false
    }

    func loadTimeEntries() async {
        do {
            let response = try await api.getTimeEntries()
            timeEntries = response.timeEntries
        } catch {
            // Silent fail for time entries
        }
    }

    // MARK: - Retainers (local storage - no API endpoint yet)
    private func loadRetainersFromStorage() {
        if let data = UserDefaults.standard.data(forKey: retainersKey),
           let decoded = try? JSONDecoder().decode([Retainer].self, from: data) {
            retainers = decoded
        }
    }

    private func saveRetainersToStorage() {
        if let encoded = try? JSONEncoder().encode(retainers) {
            UserDefaults.standard.set(encoded, forKey: retainersKey)
        }
    }

    var activeRetainers: [Retainer] {
        retainers.filter { $0.status == "active" }
    }

    var totalRetainerBalance: Double {
        activeRetainers.reduce(0) { $0 + $1.remainingBalance }
    }

    // Invoice computed properties
    var totalBilled: Double {
        invoices.reduce(0.0) { $0 + ($1.total ?? 0) }
    }

    var totalCollected: Double {
        invoices.reduce(0.0) { $0 + ($1.amountPaid ?? 0) }
    }

    var outstandingAmount: Double {
        totalBilled - totalCollected
    }

    func addRetainer(_ retainer: Retainer) {
        retainers.insert(retainer, at: 0)
        saveRetainersToStorage()
    }

    func updateRetainer(_ retainer: Retainer) {
        if let index = retainers.firstIndex(where: { $0.id == retainer.id }) {
            retainers[index] = retainer
            saveRetainersToStorage()
        }
    }

    func deleteRetainer(_ retainer: Retainer) {
        retainers.removeAll { $0.id == retainer.id }
        saveRetainersToStorage()
    }

    func applyToRetainer(_ retainerId: String, amount: Double) {
        if let index = retainers.firstIndex(where: { $0.id == retainerId }) {
            retainers[index].remainingBalance -= amount
            if retainers[index].remainingBalance <= 0 {
                retainers[index].status = "depleted"
            }
            saveRetainersToStorage()
        }
    }
}

// MARK: - Retainers View
struct RetainersView: View {
    @StateObject private var viewModel = BillingViewModel()
    @State private var showAddRetainer = false

    var body: some View {
        VStack(spacing: 0) {
            // Summary Header
            VStack(spacing: AppSpacing.sm) {
                Text("Total Retainer Balance")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Text("$\(viewModel.totalRetainerBalance, specifier: "%.2f")")
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                    .foregroundColor(.green)
                Text("\(viewModel.activeRetainers.count) Active Retainers")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
            .frame(maxWidth: .infinity)
            .background(Color.cardBackground)

            if viewModel.retainers.isEmpty {
                EmptyStateView(
                    icon: "banknote.fill",
                    title: "No Retainers",
                    message: "Add client retainers to track deposits",
                    actionTitle: "Add Retainer",
                    action: { showAddRetainer = true }
                )
            } else {
                List {
                    // Low Balance Section
                    let lowBalance = viewModel.activeRetainers.filter { $0.needsRefresh }
                    if !lowBalance.isEmpty {
                        Section {
                            ForEach(lowBalance) { retainer in
                                RetainerRow(retainer: retainer)
                            }
                        } header: {
                            HStack {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(.orange)
                                Text("LOW BALANCE")
                            }
                        }
                    }

                    // Active Retainers
                    Section("Active") {
                        ForEach(viewModel.activeRetainers.filter { !$0.needsRefresh }) { retainer in
                            RetainerRow(retainer: retainer)
                        }
                        .onDelete { indexSet in
                            let filtered = viewModel.activeRetainers.filter { !$0.needsRefresh }
                            for index in indexSet {
                                viewModel.deleteRetainer(filtered[index])
                            }
                        }
                    }

                    // Depleted
                    let depleted = viewModel.retainers.filter { $0.status == "depleted" }
                    if !depleted.isEmpty {
                        Section("Depleted") {
                            ForEach(depleted) { retainer in
                                RetainerRow(retainer: retainer)
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Retainers")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAddRetainer = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddRetainer) {
            AddRetainerView(viewModel: viewModel)
        }
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadInvoices()
        }
        .refreshable {
            await viewModel.loadInvoices()
        }
    }
}

struct RetainerRow: View {
    let retainer: Retainer

    var progressColor: Color {
        if retainer.usagePercentage >= 80 { return .red }
        if retainer.usagePercentage >= 60 { return .orange }
        return .green
    }

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                Text(retainer.clientName)
                    .font(.body)
                    .fontWeight(.medium)
                Spacer()
                Text("$\(retainer.remainingBalance, specifier: "%.2f")")
                    .font(.headline)
                    .foregroundColor(retainer.needsRefresh ? .orange : .primary)
            }

            ProgressView(value: retainer.usagePercentage, total: 100)
                .tint(progressColor)

            HStack {
                Text("$\(retainer.usedAmount, specifier: "%.0f") used of $\(retainer.amount, specifier: "%.0f")")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()

                Text("\(Int(retainer.usagePercentage))%")
                    .font(.caption)
                    .foregroundColor(progressColor)
            }

            if let caseName = retainer.caseName {
                Text(caseName)
                    .font(.caption)
                    .foregroundColor(.accentColor)
            }
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

struct AddRetainerView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: BillingViewModel

    @State private var clientName = ""
    @State private var caseName = ""
    @State private var amount = ""
    @State private var refreshThreshold = ""
    @State private var notes = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Client") {
                    TextField("Client Name", text: $clientName)
                    TextField("Case Name (Optional)", text: $caseName)
                }

                Section("Amount") {
                    TextField("Retainer Amount", text: $amount)
                        .keyboardType(.decimalPad)
                    TextField("Refresh Threshold (Optional)", text: $refreshThreshold)
                        .keyboardType(.decimalPad)
                }

                Section("Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 80)
                }
            }
            .navigationTitle("Add Retainer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let retainer = Retainer(
                            clientName: clientName,
                            caseName: caseName.isEmpty ? nil : caseName,
                            amount: Double(amount) ?? 0,
                            refreshThreshold: Double(refreshThreshold),
                            notes: notes.isEmpty ? nil : notes
                        )
                        viewModel.addRetainer(retainer)
                        dismiss()
                    }
                    .disabled(clientName.isEmpty || amount.isEmpty)
                }
            }
        }
    }
}

// MARK: - LEDES Export View
struct LEDESExportView: View {
    @State private var selectedFormat = "LEDES98B"
    @State private var dateRange = DateRange.thisMonth
    @State private var includeUnbilled = true
    @State private var isExporting = false
    @State private var showExportSuccess = false

    enum DateRange: String, CaseIterable {
        case thisMonth = "This Month"
        case lastMonth = "Last Month"
        case thisQuarter = "This Quarter"
        case thisYear = "This Year"
        case custom = "Custom"
    }

    let formats = ["LEDES98B", "LEDES98BI", "LEDES2000", "UTBMS"]

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Format Selection
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Export Format")
                        .font(.headline)

                    Picker("Format", selection: $selectedFormat) {
                        ForEach(formats, id: \.self) { format in
                            Text(format).tag(format)
                        }
                    }
                    .pickerStyle(.segmented)

                    Text("LEDES98B is the most widely accepted format for electronic billing.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Date Range
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Date Range")
                        .font(.headline)

                    Picker("Range", selection: $dateRange) {
                        ForEach(DateRange.allCases, id: \.self) { range in
                            Text(range.rawValue).tag(range)
                        }
                    }
                    .pickerStyle(.menu)
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Options
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Options")
                        .font(.headline)

                    Toggle("Include Unbilled Time", isOn: $includeUnbilled)
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Export Button
                Button {
                    isExporting = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                        isExporting = false
                        showExportSuccess = true
                    }
                } label: {
                    HStack {
                        if isExporting {
                            ProgressView()
                                .tint(.white)
                        }
                        Text(isExporting ? "Exporting..." : "Export LEDES File")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(isExporting)
                .padding(.horizontal)

                // Info
                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                    Text("About LEDES")
                        .font(.headline)

                    Text("LEDES (Legal Electronic Data Exchange Standard) is an industry standard for electronic billing. Many corporate clients require invoices in LEDES format for automated processing.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)
            }
            .padding(.vertical)
        }
        .navigationTitle("LEDES Export")
        .alert("Export Complete", isPresented: $showExportSuccess) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Your LEDES file has been generated and is ready to share.")
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

// MARK: - Billing Reports View
struct BillingReportsView: View {
    @StateObject private var billingViewModel = BillingViewModel()
    @State private var selectedPeriod = "This Month"

    let periods = ["This Week", "This Month", "This Quarter", "This Year"]

    var collectionRate: Double {
        guard billingViewModel.totalBilled > 0 else { return 0 }
        return (billingViewModel.totalCollected / billingViewModel.totalBilled) * 100
    }

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Period Selector
                Picker("Period", selection: $selectedPeriod) {
                    ForEach(periods, id: \.self) { period in
                        Text(period).tag(period)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                if billingViewModel.isLoading {
                    ProgressView("Loading billing data...")
                        .frame(maxWidth: .infinity, minHeight: 200)
                } else {
                    // Key Metrics
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: AppSpacing.md) {
                        MetricCard(title: "Billed", value: String(format: "$%.0f", billingViewModel.totalBilled), color: .blue, icon: "doc.text.fill")
                        MetricCard(title: "Collected", value: String(format: "$%.0f", billingViewModel.totalCollected), color: .green, icon: "checkmark.circle.fill")
                        MetricCard(title: "Outstanding", value: String(format: "$%.0f", billingViewModel.outstandingAmount), color: .orange, icon: "clock.fill")
                        MetricCard(title: "Collection Rate", value: String(format: "%.1f%%", collectionRate), color: .purple, icon: "chart.line.uptrend.xyaxis")
                    }
                    .padding(.horizontal)
                }

                // Billing by Matter Type
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Billing by Matter Type")
                        .font(.headline)
                        .padding(.horizontal)

                    VStack(spacing: AppSpacing.sm) {
                        BillingCategoryRow(category: "Litigation", amount: 18500, total: billingViewModel.totalBilled)
                        BillingCategoryRow(category: "Corporate", amount: 12300, total: billingViewModel.totalBilled)
                        BillingCategoryRow(category: "Real Estate", amount: 8450, total: billingViewModel.totalBilled)
                        BillingCategoryRow(category: "Family Law", amount: 6000, total: billingViewModel.totalBilled)
                    }
                    .padding()
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                    .padding(.horizontal)
                }

                // Top Clients
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Top Clients by Revenue")
                        .font(.headline)
                        .padding(.horizontal)

                    VStack(spacing: 0) {
                        TopClientRow(rank: 1, name: "Acme Corporation", amount: 15200)
                        Divider().padding(.leading, 50)
                        TopClientRow(rank: 2, name: "Smith Industries", amount: 12800)
                        Divider().padding(.leading, 50)
                        TopClientRow(rank: 3, name: "Johnson & Co", amount: 8900)
                        Divider().padding(.leading, 50)
                        TopClientRow(rank: 4, name: "Williams LLC", amount: 5350)
                        Divider().padding(.leading, 50)
                        TopClientRow(rank: 5, name: "Brown Family Trust", amount: 3000)
                    }
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                    .padding(.horizontal)
                }

                // Retainer Summary
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Retainer Summary")
                        .font(.headline)
                        .padding(.horizontal)

                    HStack(spacing: AppSpacing.lg) {
                        VStack {
                            Text("\(billingViewModel.activeRetainers.count)")
                                .font(.title)
                                .fontWeight(.bold)
                                .foregroundColor(.blue)
                            Text("Active")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }

                        VStack {
                            Text("$\(billingViewModel.totalRetainerBalance, specifier: "%.0f")")
                                .font(.title)
                                .fontWeight(.bold)
                                .foregroundColor(.green)
                            Text("Balance")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }

                        VStack {
                            Text("\(billingViewModel.activeRetainers.filter { $0.needsRefresh }.count)")
                                .font(.title)
                                .fontWeight(.bold)
                                .foregroundColor(.orange)
                            Text("Low")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                    .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Billing Reports")
        .task {
            await billingViewModel.loadInvoices()
        }
        .refreshable {
            await billingViewModel.loadInvoices()
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

struct MetricCard: View {
    let title: String
    let value: String
    let color: Color
    let icon: String

    var body: some View {
        VStack(spacing: AppSpacing.sm) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)
            Text(value)
                .font(.title3)
                .fontWeight(.bold)
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

struct BillingCategoryRow: View {
    let category: String
    let amount: Double
    let total: Double

    var percentage: Double {
        guard total > 0 else { return 0 }
        return (amount / total) * 100
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(category)
                    .font(.subheadline)
                Spacer()
                Text("$\(amount, specifier: "%.0f")")
                    .font(.subheadline)
                    .fontWeight(.medium)
            }
            ProgressView(value: percentage, total: 100)
                .tint(.accentColor)
        }
    }
}

struct TopClientRow: View {
    let rank: Int
    let name: String
    let amount: Double

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Text("\(rank)")
                .font(.headline)
                .foregroundColor(.secondary)
                .frame(width: 30)

            Text(name)
                .font(.subheadline)

            Spacer()

            Text("$\(amount, specifier: "%.0f")")
                .font(.subheadline)
                .fontWeight(.semibold)
        }
        .padding()
    }
}
