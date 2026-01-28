//
//  TrustViews.swift
//  LegalPracticeAI
//
//  Trust accounting views
//

import SwiftUI

// MARK: - Trust ViewModel
@MainActor
final class TrustViewModel: ObservableObject {
    @Published var accounts: [TrustAccount] = []
    @Published var transactions: [TrustTransaction] = []
    @Published var reconciliations: [Reconciliation] = []
    @Published var isLoading = false
    @Published var error: String?

    private let api = APIService.shared

    init() {
        // Reconciliations now loaded from API
    }

    // MARK: - Load Reconciliations from API
    func loadReconciliations() async {
        do {
            let response = try await api.getReconciliations()
            reconciliations = response.reconciliations
        } catch {
            print("DEBUG: Failed to load reconciliations: \(error)")
        }
    }

    // MARK: - Load Accounts from API
    func loadAccounts(clientId: String? = nil) async {
        isLoading = true
        error = nil

        do {
            let response = try await api.getTrustAccounts(clientId: clientId)
            accounts = response.accounts
        } catch {
            self.error = "Failed to load trust accounts: \(error.localizedDescription)"
            print("DEBUG: Failed to load trust accounts: \(error)")
        }

        isLoading = false
    }

    // MARK: - Load Transactions from API (for specific account)
    func loadTransactions(for accountId: String) async {
        isLoading = true

        do {
            let response = try await api.getTrustTransactions(accountId: accountId)
            transactions = response.transactions
        } catch {
            print("DEBUG: Failed to load trust transactions: \(error)")
        }

        isLoading = false
    }

    // MARK: - Load ALL Transactions from API (all accounts)
    func loadAllTransactions() async {
        isLoading = true

        do {
            let response = try await api.getAllTrustTransactions()
            transactions = response.transactions
        } catch {
            print("DEBUG: Failed to load all trust transactions: \(error)")
        }

        isLoading = false
    }

    // MARK: - Load Ledger from API (for specific account)
    func loadLedger(for accountId: String) async {
        do {
            let response = try await api.getTrustLedger(accountId: accountId)
            transactions = response.entries
        } catch {
            print("DEBUG: Failed to load trust ledger: \(error)")
        }
    }

    // MARK: - Load ALL Ledger entries from API (all accounts)
    func loadAllLedger() async {
        isLoading = true

        do {
            let response = try await api.getAllTrustLedger()
            transactions = response.entries
        } catch {
            print("DEBUG: Failed to load all trust ledger: \(error)")
        }

        isLoading = false
    }

    var totalBalance: Double {
        accounts.filter { $0.status == "active" }.reduce(0) { $0 + $1.balance }
    }

    var activeAccounts: [TrustAccount] {
        accounts.filter { $0.status == "active" }
    }

    func transactionsForAccount(_ accountId: String) -> [TrustTransaction] {
        transactions.filter { $0.accountId == accountId }
            .sorted { $0.date > $1.date }
    }

    // MARK: - Add Account via API
    func addAccount(name: String, accountNumber: String, bankName: String, clientId: String?, caseId: String?, initialBalance: Double?) async -> Bool {
        isLoading = true
        error = nil

        do {
            let request = CreateTrustAccountRequest(
                name: name,
                accountNumber: accountNumber,
                bankName: bankName,
                clientId: clientId,
                caseId: caseId,
                initialBalance: initialBalance
            )
            let account = try await api.createTrustAccount(request: request)
            accounts.insert(account, at: 0)
            isLoading = false
            return true
        } catch {
            self.error = "Failed to create trust account: \(error.localizedDescription)"
            isLoading = false
            return false
        }
    }

    // Local add for compatibility
    func addAccount(_ account: TrustAccount) {
        accounts.insert(account, at: 0)
    }

    func updateAccount(_ account: TrustAccount) {
        if let index = accounts.firstIndex(where: { $0.id == account.id }) {
            accounts[index] = account
        }
    }

    func deleteAccount(_ account: TrustAccount) {
        accounts.removeAll { $0.id == account.id }
        transactions.removeAll { $0.accountId == account.id }
    }

    // MARK: - Add Transaction via API
    func addTransaction(accountId: String, type: String, amount: Double, description: String, clientName: String?, checkNumber: String?, reference: String?, date: Date?) async -> Bool {
        isLoading = true
        error = nil

        do {
            let request = CreateTrustLedgerEntryRequest(
                type: type,
                amount: amount,
                description: description,
                clientName: clientName,
                checkNumber: checkNumber,
                reference: reference,
                date: date
            )
            let transaction = try await api.addTrustLedgerEntry(accountId: accountId, request: request)
            transactions.insert(transaction, at: 0)
            // Update local account balance
            if let index = accounts.firstIndex(where: { $0.id == accountId }) {
                accounts[index].balance += transaction.signedAmount
            }
            isLoading = false
            return true
        } catch {
            self.error = "Failed to add transaction: \(error.localizedDescription)"
            isLoading = false
            return false
        }
    }

    // Local add for compatibility
    func addTransaction(_ transaction: TrustTransaction) {
        transactions.insert(transaction, at: 0)
        // Update account balance
        if let index = accounts.firstIndex(where: { $0.id == transaction.accountId }) {
            accounts[index].balance += transaction.signedAmount
        }
    }

    // MARK: - Reconcile Account via API
    func reconcileAccount(accountId: String, bankBalance: Double, reconciliationDate: Date?, notes: String?) async -> Bool {
        isLoading = true
        error = nil

        do {
            let request = ReconcileTrustRequest(
                bankBalance: bankBalance,
                reconciliationDate: reconciliationDate,
                notes: notes
            )
            let reconciliation = try await api.reconcileTrustAccount(accountId: accountId, request: request)
            reconciliations.insert(reconciliation, at: 0)
            // Update last reconciled date
            if let index = accounts.firstIndex(where: { $0.id == accountId }) {
                accounts[index].lastReconciled = reconciliation.reconciliationDate
            }
            isLoading = false
            return true
        } catch {
            self.error = "Failed to reconcile account: \(error.localizedDescription)"
            isLoading = false
            return false
        }
    }

    // Local add for compatibility
    func addReconciliation(_ reconciliation: Reconciliation) {
        reconciliations.insert(reconciliation, at: 0)
        // Update last reconciled date
        if let index = accounts.firstIndex(where: { $0.id == reconciliation.accountId }) {
            accounts[index].lastReconciled = reconciliation.reconciliationDate
        }
    }
}

// MARK: - Trust Accounts View
struct TrustAccountsView: View {
    @StateObject private var viewModel = TrustViewModel()
    @State private var showAddAccount = false

    var body: some View {
        VStack(spacing: 0) {
            // Total Balance Header
            VStack(spacing: AppSpacing.sm) {
                Text("Total Trust Balance")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Text("$\(viewModel.totalBalance, specifier: "%.2f")")
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                    .foregroundColor(.accentColor)
                Text("\(viewModel.activeAccounts.count) Active Accounts")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
            .frame(maxWidth: .infinity)
            .background(Color.cardBackground)

            if viewModel.accounts.isEmpty {
                EmptyStateView(
                    icon: "building.columns.circle.fill",
                    title: "No Trust Accounts",
                    message: "Add trust accounts to manage client funds",
                    actionTitle: "Add Account",
                    action: { showAddAccount = true }
                )
            } else {
                List {
                    ForEach(viewModel.accounts) { account in
                        NavigationLink(destination: TrustAccountDetailView(account: account, viewModel: viewModel)) {
                            TrustAccountRow(account: account)
                        }
                        .listRowBackground(Color.cardBackground)
                    }
                    .onDelete { indexSet in
                        for index in indexSet {
                            viewModel.deleteAccount(viewModel.accounts[index])
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Trust Accounts")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAddAccount = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddAccount) {
            AddTrustAccountView(viewModel: viewModel)
        }
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadAccounts()
        }
        .refreshable {
            await viewModel.loadAccounts()
        }
    }
}

struct TrustAccountRow: View {
    let account: TrustAccount

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: "building.columns.fill")
                .foregroundColor(.accentColor)
                .font(.title2)

            VStack(alignment: .leading, spacing: 2) {
                Text(account.name)
                    .font(.body)
                    .fontWeight(.medium)

                Text("\(account.bankName) - \(account.maskedAccountNumber)")
                    .font(.caption)
                    .foregroundColor(.secondary)

                if let clientName = account.clientName {
                    Text(clientName)
                        .font(.caption)
                        .foregroundColor(.accentColor)
                }
            }

            Spacer()

            Text("$\(account.balance, specifier: "%.2f")")
                .font(.headline)
                .foregroundColor(account.balance >= 0 ? .primary : .red)
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

struct TrustAccountDetailView: View {
    let account: TrustAccount
    @ObservedObject var viewModel: TrustViewModel
    @State private var showAddTransaction = false

    var accountTransactions: [TrustTransaction] {
        viewModel.transactionsForAccount(account.id)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Balance Header
            VStack(spacing: AppSpacing.sm) {
                Text("Current Balance")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Text("$\(account.balance, specifier: "%.2f")")
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                    .foregroundColor(account.balance >= 0 ? .green : .red)

                if let lastReconciled = account.lastReconciled {
                    Text("Last Reconciled: \(lastReconciled.formatted(date: .abbreviated, time: .omitted))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding()
            .frame(maxWidth: .infinity)
            .background(Color.cardBackground)

            // Transactions
            if accountTransactions.isEmpty {
                VStack(spacing: AppSpacing.md) {
                    Image(systemName: "list.bullet.rectangle")
                        .font(.system(size: 40))
                        .foregroundColor(.secondary)
                    Text("No transactions")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(accountTransactions) { transaction in
                        TransactionRow(transaction: transaction)
                            .listRowBackground(Color.cardBackground)
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle(account.name)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAddTransaction = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddTransaction) {
            AddTransactionView(viewModel: viewModel, accountId: account.id)
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

struct TransactionRow: View {
    let transaction: TrustTransaction

    var amountColor: Color {
        transaction.signedAmount >= 0 ? .green : .red
    }

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: transaction.type.icon)
                .foregroundColor(amountColor)
                .font(.title2)

            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.description)
                    .font(.body)
                    .fontWeight(.medium)

                Text(transaction.date.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption)
                    .foregroundColor(.secondary)

                if let clientName = transaction.clientName {
                    Text(clientName)
                        .font(.caption)
                        .foregroundColor(.accentColor)
                }
            }

            Spacer()

            Text("\(transaction.signedAmount >= 0 ? "+" : "")$\(abs(transaction.signedAmount), specifier: "%.2f")")
                .font(.headline)
                .foregroundColor(amountColor)
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

// MARK: - Trust Ledger View
struct TrustLedgerView: View {
    @StateObject private var viewModel = TrustViewModel()
    @State private var selectedAccountId: String?

    var allTransactions: [TrustTransaction] {
        if let accountId = selectedAccountId {
            return viewModel.transactionsForAccount(accountId)
        }
        return viewModel.transactions.sorted { $0.date > $1.date }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Account Filter
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: AppSpacing.sm) {
                    FilterChip(title: "All", isSelected: selectedAccountId == nil) {
                        selectedAccountId = nil
                    }
                    ForEach(viewModel.accounts) { account in
                        FilterChip(title: account.name, isSelected: selectedAccountId == account.id) {
                            selectedAccountId = account.id
                        }
                    }
                }
                .padding()
            }
            .background(Color.cardBackground)

            if allTransactions.isEmpty {
                EmptyStateView(
                    icon: "list.bullet.rectangle.fill",
                    title: "No Transactions",
                    message: "Transaction history will appear here"
                )
            } else {
                List {
                    ForEach(allTransactions) { transaction in
                        TransactionRow(transaction: transaction)
                            .listRowBackground(Color.cardBackground)
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Trust Ledger")
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadAccounts()
            await viewModel.loadAllLedger()
        }
        .refreshable {
            await viewModel.loadAccounts()
            await viewModel.loadAllLedger()
        }
    }
}

struct FilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption)
                .fontWeight(isSelected ? .semibold : .regular)
                .foregroundColor(isSelected ? .white : .primary)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? Color.accentColor : Color.secondary.opacity(0.2))
                .clipShape(Capsule())
        }
    }
}

// MARK: - Trust Transactions View
struct TrustTransactionsView: View {
    @StateObject private var viewModel = TrustViewModel()
    @State private var showAddTransaction = false

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.transactions.isEmpty {
                EmptyStateView(
                    icon: "arrow.left.arrow.right.circle.fill",
                    title: "No Transactions",
                    message: "Add trust account transactions",
                    actionTitle: "Add Transaction",
                    action: { showAddTransaction = true }
                )
            } else {
                List {
                    ForEach(viewModel.transactions.sorted { $0.date > $1.date }) { transaction in
                        TransactionRow(transaction: transaction)
                            .listRowBackground(Color.cardBackground)
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Transactions")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAddTransaction = true
                } label: {
                    Image(systemName: "plus")
                }
                .disabled(viewModel.accounts.isEmpty)
            }
        }
        .sheet(isPresented: $showAddTransaction) {
            if let firstAccount = viewModel.accounts.first {
                AddTransactionView(viewModel: viewModel, accountId: firstAccount.id)
            }
        }
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadAccounts()
            await viewModel.loadAllTransactions()
        }
        .refreshable {
            await viewModel.loadAccounts()
            await viewModel.loadAllTransactions()
        }
    }
}

// MARK: - Trust Reports View
struct TrustReportsView: View {
    @StateObject private var viewModel = TrustViewModel()

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Summary Cards
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: AppSpacing.md) {
                    ReportCard(title: "Total Balance", value: String(format: "$%.2f", viewModel.totalBalance), color: .blue)
                    ReportCard(title: "Accounts", value: "\(viewModel.activeAccounts.count)", color: .green)
                    ReportCard(title: "Transactions", value: "\(viewModel.transactions.count)", color: .orange)
                    ReportCard(title: "Reconciled", value: "\(viewModel.reconciliations.count)", color: .purple)
                }
                .padding(.horizontal)

                // Accounts Summary
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Account Balances")
                        .font(.headline)
                        .padding(.horizontal)

                    ForEach(viewModel.activeAccounts) { account in
                        HStack {
                            Text(account.name)
                                .font(.subheadline)
                            Spacer()
                            Text("$\(account.balance, specifier: "%.2f")")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                        }
                        .padding()
                        .background(Color.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                        .padding(.horizontal)
                    }
                }

                // Recent Activity
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Recent Activity")
                        .font(.headline)
                        .padding(.horizontal)

                    ForEach(viewModel.transactions.prefix(5)) { transaction in
                        TransactionRow(transaction: transaction)
                            .padding(.horizontal)
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Trust Reports")
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadAccounts()
            await viewModel.loadAllTransactions()
        }
        .refreshable {
            await viewModel.loadAccounts()
            await viewModel.loadAllTransactions()
        }
    }
}

struct ReportCard: View {
    let title: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: AppSpacing.sm) {
            Text(value)
                .font(.title2)
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

// MARK: - Reconciliation View
struct ReconciliationView: View {
    @StateObject private var viewModel = TrustViewModel()
    @State private var showNewReconciliation = false

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.reconciliations.isEmpty {
                EmptyStateView(
                    icon: "checkmark.rectangle.stack.fill",
                    title: "No Reconciliations",
                    message: "Start reconciling your trust accounts",
                    actionTitle: "New Reconciliation",
                    action: { showNewReconciliation = true }
                )
            } else {
                List {
                    ForEach(viewModel.reconciliations) { reconciliation in
                        ReconciliationRow(reconciliation: reconciliation)
                            .listRowBackground(Color.cardBackground)
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Reconciliation")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showNewReconciliation = true
                } label: {
                    Image(systemName: "plus")
                }
                .disabled(viewModel.accounts.isEmpty)
            }
        }
        .sheet(isPresented: $showNewReconciliation) {
            NewReconciliationView(viewModel: viewModel)
        }
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadAccounts()
            await viewModel.loadReconciliations()
        }
        .refreshable {
            await viewModel.loadAccounts()
            await viewModel.loadReconciliations()
        }
    }
}

struct ReconciliationRow: View {
    let reconciliation: Reconciliation

    var statusColor: Color {
        reconciliation.status == "matched" ? .green : .orange
    }

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: reconciliation.status == "matched" ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                .foregroundColor(statusColor)
                .font(.title2)

            VStack(alignment: .leading, spacing: 2) {
                Text(reconciliation.accountName)
                    .font(.body)
                    .fontWeight(.medium)

                Text(reconciliation.reconciliationDate.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption)
                    .foregroundColor(.secondary)

                if reconciliation.status != "matched" {
                    Text("Difference: $\(abs(reconciliation.difference), specifier: "%.2f")")
                        .font(.caption)
                        .foregroundColor(.orange)
                }
            }

            Spacer()

            Text(reconciliation.status == "matched" ? "Matched" : "Review")
                .font(.caption)
                .foregroundColor(statusColor)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(statusColor.opacity(0.1))
                .clipShape(Capsule())
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

// MARK: - Three-Way Reconciliation View
struct ThreeWayReconcileView: View {
    @StateObject private var viewModel = TrustViewModel()
    @State private var selectedAccountId: String?
    @State private var bankBalance = ""
    @State private var clientLedgerBalance = ""

    var selectedAccount: TrustAccount? {
        viewModel.accounts.first { $0.id == selectedAccountId }
    }

    var bookBalance: Double {
        selectedAccount?.balance ?? 0
    }

    var difference: Double {
        let bank = Double(bankBalance) ?? 0
        let client = Double(clientLedgerBalance) ?? 0
        return bank - bookBalance - client
    }

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Account Selection
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Select Account")
                        .font(.headline)

                    Picker("Account", selection: $selectedAccountId) {
                        Text("Select Account").tag(nil as String?)
                        ForEach(viewModel.accounts) { account in
                            Text(account.name).tag(account.id as String?)
                        }
                    }
                    .pickerStyle(.menu)
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                if selectedAccountId != nil {
                    // Three Balances
                    VStack(spacing: AppSpacing.md) {
                        BalanceInputRow(title: "Bank Statement Balance", value: $bankBalance, color: .blue)
                        BalanceInputRow(title: "Client Ledger Balance", value: $clientLedgerBalance, color: .purple)

                        HStack {
                            Text("Book Balance (Trust Account)")
                                .font(.subheadline)
                            Spacer()
                            Text("$\(bookBalance, specifier: "%.2f")")
                                .font(.headline)
                                .foregroundColor(.green)
                        }
                        .padding()
                        .background(Color.green.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                    }
                    .padding()
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                    .padding(.horizontal)

                    // Result
                    VStack(spacing: AppSpacing.md) {
                        HStack {
                            Text("Difference")
                                .font(.headline)
                            Spacer()
                            Text("$\(abs(difference), specifier: "%.2f")")
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundColor(abs(difference) < 0.01 ? .green : .red)
                        }

                        if abs(difference) < 0.01 {
                            Label("Reconciled Successfully", systemImage: "checkmark.circle.fill")
                                .foregroundColor(.green)
                                .font(.headline)
                        } else {
                            Label("Discrepancy Found", systemImage: "exclamationmark.triangle.fill")
                                .foregroundColor(.red)
                                .font(.headline)
                        }
                    }
                    .padding()
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                    .padding(.horizontal)

                    // Save Button
                    Button {
                        if let account = selectedAccount {
                            let reconciliation = Reconciliation(
                                accountId: account.id,
                                accountName: account.name,
                                bankBalance: Double(bankBalance) ?? 0,
                                bookBalance: bookBalance
                            )
                            viewModel.addReconciliation(reconciliation)
                            selectedAccountId = nil
                            bankBalance = ""
                            clientLedgerBalance = ""
                        }
                    } label: {
                        Text("Save Reconciliation")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .padding(.horizontal)
                }

                Spacer()
            }
            .padding(.vertical)
        }
        .navigationTitle("3-Way Reconciliation")
        .background(Color(UIColor.systemGroupedBackground))
    }
}

struct BalanceInputRow: View {
    let title: String
    @Binding var value: String
    let color: Color

    var body: some View {
        HStack {
            Text(title)
                .font(.subheadline)
            Spacer()
            TextField("0.00", text: $value)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .font(.headline)
                .frame(width: 120)
        }
        .padding()
        .background(color.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
    }
}

// MARK: - Add Views
struct AddTrustAccountView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: TrustViewModel

    @State private var name = ""
    @State private var accountNumber = ""
    @State private var bankName = ""
    @State private var initialBalance = ""
    @State private var clientName = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Account Details") {
                    TextField("Account Name", text: $name)
                    TextField("Account Number", text: $accountNumber)
                        .keyboardType(.numberPad)
                    TextField("Bank Name", text: $bankName)
                }

                Section("Balance") {
                    TextField("Initial Balance", text: $initialBalance)
                        .keyboardType(.decimalPad)
                }

                Section("Client (Optional)") {
                    TextField("Client Name", text: $clientName)
                }
            }
            .navigationTitle("Add Trust Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let account = TrustAccount(
                            accountName: name,
                            accountNumber: accountNumber,
                            bankName: bankName,
                            balance: Double(initialBalance) ?? 0,
                            clientName: clientName.isEmpty ? nil : clientName
                        )
                        viewModel.addAccount(account)
                        dismiss()
                    }
                    .disabled(name.isEmpty || accountNumber.isEmpty || bankName.isEmpty)
                }
            }
        }
    }
}

struct AddTransactionView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: TrustViewModel
    var accountId: String

    @State private var type: TrustTransaction.TransactionType = .deposit
    @State private var amount = ""
    @State private var description = ""
    @State private var date = Date()
    @State private var clientName = ""
    @State private var checkNumber = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Transaction Type") {
                    Picker("Type", selection: $type) {
                        ForEach(TrustTransaction.TransactionType.allCases, id: \.self) { t in
                            Label(t.displayName, systemImage: t.icon).tag(t)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section("Details") {
                    TextField("Amount", text: $amount)
                        .keyboardType(.decimalPad)
                    TextField("Description", text: $description)
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                }

                Section("Additional") {
                    TextField("Client Name", text: $clientName)
                    if type == .withdrawal {
                        TextField("Check Number", text: $checkNumber)
                            .keyboardType(.numberPad)
                    }
                }
            }
            .navigationTitle("Add Transaction")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let transaction = TrustTransaction(
                            accountId: accountId,
                            type: type,
                            amount: Double(amount) ?? 0,
                            date: date,
                            description: description,
                            clientName: clientName.isEmpty ? nil : clientName,
                            checkNumber: checkNumber.isEmpty ? nil : checkNumber
                        )
                        viewModel.addTransaction(transaction)
                        dismiss()
                    }
                    .disabled(amount.isEmpty || description.isEmpty)
                }
            }
        }
    }
}

struct NewReconciliationView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: TrustViewModel

    @State private var selectedAccountId: String?
    @State private var bankBalance = ""
    @State private var notes = ""

    var selectedAccount: TrustAccount? {
        viewModel.accounts.first { $0.id == selectedAccountId }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Account") {
                    Picker("Select Account", selection: $selectedAccountId) {
                        Text("Select").tag(nil as String?)
                        ForEach(viewModel.accounts) { account in
                            Text(account.name).tag(account.id as String?)
                        }
                    }
                }

                if let account = selectedAccount {
                    Section("Balances") {
                        HStack {
                            Text("Book Balance")
                            Spacer()
                            Text("$\(account.balance, specifier: "%.2f")")
                                .foregroundColor(.secondary)
                        }

                        TextField("Bank Statement Balance", text: $bankBalance)
                            .keyboardType(.decimalPad)
                    }
                }

                Section("Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 80)
                }
            }
            .navigationTitle("New Reconciliation")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        if let account = selectedAccount {
                            let reconciliation = Reconciliation(
                                accountId: account.id,
                                accountName: account.name,
                                bankBalance: Double(bankBalance) ?? 0,
                                bookBalance: account.balance,
                                notes: notes.isEmpty ? nil : notes
                            )
                            viewModel.addReconciliation(reconciliation)
                        }
                        dismiss()
                    }
                    .disabled(selectedAccountId == nil || bankBalance.isEmpty)
                }
            }
        }
    }
}
