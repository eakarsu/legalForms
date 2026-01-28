//
//  PaymentsViews.swift
//  LegalPracticeAI
//
//  Payment-related views
//

import SwiftUI

// MARK: - Payment Record Model
struct PaymentRecord: Identifiable, Codable {
    let id: String
    var clientId: String?
    var clientName: String
    var invoiceId: String?
    var invoiceNumber: String?
    var amount: Double
    var paymentMethod: PaymentMethod
    var date: Date
    var reference: String?
    var notes: String?
    var status: String // "completed", "pending", "failed", "refunded"

    enum PaymentMethod: String, CaseIterable, Codable {
        case cash = "cash"
        case check = "check"
        case creditCard = "credit_card"
        case bankTransfer = "bank_transfer"
        case online = "online"
        case other = "other"

        var displayName: String {
            switch self {
            case .cash: return "Cash"
            case .check: return "Check"
            case .creditCard: return "Credit Card"
            case .bankTransfer: return "Bank Transfer"
            case .online: return "Online Payment"
            case .other: return "Other"
            }
        }

        var icon: String {
            switch self {
            case .cash: return "banknote.fill"
            case .check: return "doc.text.fill"
            case .creditCard: return "creditcard.fill"
            case .bankTransfer: return "building.columns.fill"
            case .online: return "globe"
            case .other: return "ellipsis.circle.fill"
            }
        }
    }

    init(id: String = UUID().uuidString,
         clientId: String? = nil,
         clientName: String,
         invoiceId: String? = nil,
         invoiceNumber: String? = nil,
         amount: Double,
         paymentMethod: PaymentMethod = .check,
         date: Date = Date(),
         reference: String? = nil,
         notes: String? = nil,
         status: String = "completed") {
        self.id = id
        self.clientId = clientId
        self.clientName = clientName
        self.invoiceId = invoiceId
        self.invoiceNumber = invoiceNumber
        self.amount = amount
        self.paymentMethod = paymentMethod
        self.date = date
        self.reference = reference
        self.notes = notes
        self.status = status
    }
}

// MARK: - Payment Plan Model
struct PaymentPlan: Identifiable, Codable {
    let id: String
    var clientName: String
    var totalAmount: Double
    var paidAmount: Double
    var numberOfPayments: Int
    var paymentAmount: Double
    var frequency: String // "weekly", "biweekly", "monthly"
    var startDate: Date
    var nextPaymentDate: Date?
    var status: String // "active", "completed", "defaulted"
    var notes: String?

    init(id: String = UUID().uuidString,
         clientName: String,
         totalAmount: Double,
         paidAmount: Double = 0,
         numberOfPayments: Int,
         frequency: String = "monthly",
         startDate: Date = Date(),
         status: String = "active",
         notes: String? = nil) {
        self.id = id
        self.clientName = clientName
        self.totalAmount = totalAmount
        self.paidAmount = paidAmount
        self.numberOfPayments = numberOfPayments
        self.paymentAmount = totalAmount / Double(numberOfPayments)
        self.frequency = frequency
        self.startDate = startDate
        self.nextPaymentDate = startDate
        self.status = status
        self.notes = notes
    }

    var remainingAmount: Double {
        totalAmount - paidAmount
    }

    var completedPayments: Int {
        Int(paidAmount / paymentAmount)
    }

    var remainingPayments: Int {
        numberOfPayments - completedPayments
    }

    var progressPercentage: Double {
        guard totalAmount > 0 else { return 0 }
        return (paidAmount / totalAmount) * 100
    }
}

// MARK: - Payments ViewModel
@MainActor
final class PaymentsViewModel: ObservableObject {
    @Published var payments: [PaymentRecord] = []
    @Published var apiPayments: [Payment] = []
    @Published var paymentPlans: [PaymentPlan] = []
    @Published var apiPaymentPlans: [PaymentPlanAPI] = []
    @Published var refunds: [RefundAPI] = []
    @Published var paymentSettings: PaymentSettings?
    @Published var isLoading = false
    @Published var error: String?

    private let api = APIService.shared

    // Local storage for payment records and plans (may not have full backend)
    private let paymentsKey = "stored_payments"
    private let plansKey = "stored_payment_plans"

    init() {
        // Don't load from storage anymore - we use API
    }

    // MARK: - Load Payment History from API
    func loadPaymentHistory(clientId: String? = nil, invoiceId: String? = nil) async {
        isLoading = true
        error = nil

        do {
            let response = try await api.getPaymentHistory(clientId: clientId, invoiceId: invoiceId)
            apiPayments = response.payments
            // Convert API payments to PaymentRecord for display
            payments = response.payments.map { apiPayment in
                PaymentRecord(
                    id: apiPayment.id,
                    clientId: nil,
                    clientName: apiPayment.clientDisplayName,
                    invoiceId: apiPayment.invoiceId,
                    invoiceNumber: apiPayment.invoiceNumber,
                    amount: apiPayment.amount,
                    paymentMethod: PaymentRecord.PaymentMethod(rawValue: apiPayment.paymentMethod ?? "other") ?? .other,
                    date: apiPayment.paymentDate ?? apiPayment.createdAt ?? Date(),
                    reference: apiPayment.transactionId,
                    notes: apiPayment.notes,
                    status: "completed"
                )
            }
            print("DEBUG: Loaded \(payments.count) payments from API")
        } catch {
            self.error = "Failed to load payment history: \(error.localizedDescription)"
            print("DEBUG: Failed to load payment history: \(error)")
        }

        isLoading = false
    }

    // MARK: - Load Payment Settings from API
    func loadPaymentSettings() async {
        do {
            let response = try await api.getPaymentSettings()
            paymentSettings = response.settings
        } catch {
            print("DEBUG: Failed to load payment settings: \(error)")
        }
    }

    // MARK: - Load Payment Plans from API
    func loadPaymentPlans() async {
        isLoading = true
        do {
            let response = try await api.getPaymentPlans()
            apiPaymentPlans = response.plans
            // Convert API plans to PaymentPlan for display
            paymentPlans = response.plans.map { apiPlan in
                PaymentPlan(
                    id: apiPlan.id,
                    clientName: apiPlan.clientName,
                    totalAmount: apiPlan.totalAmount,
                    paidAmount: apiPlan.paidAmount,
                    numberOfPayments: apiPlan.numberOfPayments,
                    frequency: apiPlan.frequency,
                    startDate: apiPlan.startDate ?? Date(),
                    status: apiPlan.status,
                    notes: apiPlan.notes
                )
            }
            print("DEBUG: Loaded \(paymentPlans.count) payment plans from API")
        } catch {
            print("DEBUG: Failed to load payment plans: \(error)")
        }
        isLoading = false
    }

    // MARK: - Load Refunds from API
    func loadRefunds() async {
        isLoading = true
        do {
            let response = try await api.getRefunds()
            refunds = response.refunds
            print("DEBUG: Loaded \(refunds.count) refunds from API")
        } catch {
            print("DEBUG: Failed to load refunds: \(error)")
        }
        isLoading = false
    }

    // MARK: - Create Payment Link via API
    func createPaymentLink(for invoiceId: String) async -> String? {
        isLoading = true
        error = nil

        do {
            let response = try await api.createPaymentLink(invoiceId: invoiceId)
            isLoading = false
            return response.paymentUrl
        } catch {
            self.error = "Failed to create payment link: \(error.localizedDescription)"
            isLoading = false
            return nil
        }
    }

    // MARK: - Update Payment Settings via API
    func updatePaymentSettings(stripeEnabled: Bool?, acceptedMethods: [String]?, autoSendReceipts: Bool?, lateFeePercentage: Double?, lateFeeGraceDays: Int?) async -> Bool {
        isLoading = true
        error = nil

        do {
            let request = UpdatePaymentSettingsRequest(
                stripeEnabled: stripeEnabled,
                acceptedMethods: acceptedMethods,
                autoSendReceipts: autoSendReceipts,
                lateFeePercentage: lateFeePercentage,
                lateFeeGraceDays: lateFeeGraceDays
            )
            let response = try await api.updatePaymentSettings(request: request)
            paymentSettings = response.settings
            isLoading = false
            return true
        } catch {
            self.error = "Failed to update payment settings: \(error.localizedDescription)"
            isLoading = false
            return false
        }
    }

    // MARK: - Local Storage
    private func loadFromStorage() {
        if let data = UserDefaults.standard.data(forKey: paymentsKey),
           let decoded = try? JSONDecoder().decode([PaymentRecord].self, from: data) {
            payments = decoded
        }
        if let data = UserDefaults.standard.data(forKey: plansKey),
           let decoded = try? JSONDecoder().decode([PaymentPlan].self, from: data) {
            paymentPlans = decoded
        }
    }

    private func saveToStorage() {
        if let encoded = try? JSONEncoder().encode(payments) {
            UserDefaults.standard.set(encoded, forKey: paymentsKey)
        }
        if let encoded = try? JSONEncoder().encode(paymentPlans) {
            UserDefaults.standard.set(encoded, forKey: plansKey)
        }
    }

    var totalReceived: Double {
        payments.filter { $0.status == "completed" }.reduce(0) { $0 + $1.amount }
    }

    var recentPayments: [PaymentRecord] {
        payments.sorted { $0.date > $1.date }
    }

    var activePlans: [PaymentPlan] {
        paymentPlans.filter { $0.status == "active" }
    }

    func addPayment(_ payment: PaymentRecord) {
        payments.insert(payment, at: 0)
        saveToStorage()
    }

    func addPaymentPlan(_ plan: PaymentPlan) {
        paymentPlans.insert(plan, at: 0)
        saveToStorage()
    }

    func deletePayment(_ payment: PaymentRecord) {
        payments.removeAll { $0.id == payment.id }
        saveToStorage()
    }

    func deletePlan(_ plan: PaymentPlan) {
        paymentPlans.removeAll { $0.id == plan.id }
        saveToStorage()
    }

    func refundPayment(_ payment: PaymentRecord) {
        if let index = payments.firstIndex(where: { $0.id == payment.id }) {
            payments[index].status = "refunded"
            saveToStorage()
        }
    }
}

// MARK: - Receive Payment View
struct ReceivePaymentView: View {
    @StateObject private var viewModel = PaymentsViewModel()
    @State private var clientName = ""
    @State private var amount = ""
    @State private var paymentMethod: PaymentRecord.PaymentMethod = .check
    @State private var reference = ""
    @State private var notes = ""
    @State private var date = Date()
    @State private var showSuccess = false

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Amount Input
                VStack(spacing: AppSpacing.sm) {
                    Text("Amount")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    HStack {
                        Text("$")
                            .font(.largeTitle)
                            .foregroundColor(.secondary)
                        TextField("0.00", text: $amount)
                            .font(.system(size: 48, weight: .bold, design: .rounded))
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Payment Details
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Payment Details")
                        .font(.headline)

                    TextField("Client Name", text: $clientName)
                        .textFieldStyle(.roundedBorder)

                    Picker("Payment Method", selection: $paymentMethod) {
                        ForEach(PaymentRecord.PaymentMethod.allCases, id: \.self) { method in
                            Label(method.displayName, systemImage: method.icon).tag(method)
                        }
                    }

                    DatePicker("Date", selection: $date, displayedComponents: .date)

                    TextField("Reference/Check #", text: $reference)
                        .textFieldStyle(.roundedBorder)
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Notes
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Notes")
                        .font(.headline)

                    TextEditor(text: $notes)
                        .frame(minHeight: 80)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.secondary.opacity(0.2), lineWidth: 1)
                        )
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Record Button
                Button {
                    let payment = PaymentRecord(
                        clientName: clientName,
                        amount: Double(amount) ?? 0,
                        paymentMethod: paymentMethod,
                        date: date,
                        reference: reference.isEmpty ? nil : reference,
                        notes: notes.isEmpty ? nil : notes
                    )
                    viewModel.addPayment(payment)
                    showSuccess = true
                    // Reset form
                    clientName = ""
                    amount = ""
                    reference = ""
                    notes = ""
                } label: {
                    Label("Record Payment", systemImage: "checkmark.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(clientName.isEmpty || amount.isEmpty)
                .padding(.horizontal)
            }
            .padding(.vertical)
        }
        .navigationTitle("Receive Payment")
        .alert("Payment Recorded", isPresented: $showSuccess) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("The payment has been successfully recorded.")
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

// MARK: - Payment History View
struct PaymentHistoryView: View {
    @StateObject private var viewModel = PaymentsViewModel()

    var body: some View {
        VStack(spacing: 0) {
            // Summary Header
            HStack(spacing: AppSpacing.xl) {
                VStack {
                    Text("$\(viewModel.totalReceived, specifier: "%.2f")")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.green)
                    Text("Total Received")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                VStack {
                    Text("\(viewModel.payments.count)")
                        .font(.title2)
                        .fontWeight(.bold)
                    Text("Payments")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding()
            .frame(maxWidth: .infinity)
            .background(Color.cardBackground)

            if viewModel.payments.isEmpty {
                EmptyStateView(
                    icon: "clock.arrow.circlepath",
                    title: "No Payment History",
                    message: "Recorded payments will appear here"
                )
            } else {
                List {
                    ForEach(viewModel.recentPayments) { payment in
                        PaymentRow(payment: payment)
                            .listRowBackground(Color.cardBackground)
                    }
                    .onDelete { indexSet in
                        for index in indexSet {
                            viewModel.deletePayment(viewModel.recentPayments[index])
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Payment History")
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadPaymentHistory()
        }
        .refreshable {
            await viewModel.loadPaymentHistory()
        }
    }
}

struct PaymentRow: View {
    let payment: PaymentRecord

    var statusColor: Color {
        switch payment.status {
        case "completed": return .green
        case "pending": return .orange
        case "refunded": return .gray
        default: return .red
        }
    }

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: payment.paymentMethod.icon)
                .foregroundColor(.accentColor)
                .font(.title2)

            VStack(alignment: .leading, spacing: 2) {
                Text(payment.clientName)
                    .font(.body)
                    .fontWeight(.medium)

                Text(payment.date.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text(payment.paymentMethod.displayName)
                    .font(.caption)
                    .foregroundColor(.accentColor)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text("$\(payment.amount, specifier: "%.2f")")
                    .font(.headline)
                    .foregroundColor(payment.status == "refunded" ? .gray : .primary)

                if payment.status != "completed" {
                    Text(payment.status.capitalized)
                        .font(.caption2)
                        .foregroundColor(statusColor)
                }
            }
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

// MARK: - Payment Plans View
struct PaymentPlansView: View {
    @StateObject private var viewModel = PaymentsViewModel()
    @State private var showAddPlan = false

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.paymentPlans.isEmpty {
                EmptyStateView(
                    icon: "calendar.badge.clock",
                    title: "No Payment Plans",
                    message: "Create payment plans for clients",
                    actionTitle: "Create Plan",
                    action: { showAddPlan = true }
                )
            } else {
                List {
                    Section("Active Plans") {
                        ForEach(viewModel.activePlans) { plan in
                            PaymentPlanRow(plan: plan)
                        }
                    }

                    let completedPlans = viewModel.paymentPlans.filter { $0.status == "completed" }
                    if !completedPlans.isEmpty {
                        Section("Completed") {
                            ForEach(completedPlans) { plan in
                                PaymentPlanRow(plan: plan)
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Payment Plans")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAddPlan = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddPlan) {
            AddPaymentPlanView(viewModel: viewModel)
        }
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadPaymentPlans()
        }
        .refreshable {
            await viewModel.loadPaymentPlans()
        }
    }
}

struct PaymentPlanRow: View {
    let plan: PaymentPlan

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                Text(plan.clientName)
                    .font(.body)
                    .fontWeight(.medium)
                Spacer()
                Text("$\(plan.remainingAmount, specifier: "%.2f") remaining")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            ProgressView(value: plan.progressPercentage, total: 100)
                .tint(.green)

            HStack {
                Text("\(plan.completedPayments) of \(plan.numberOfPayments) payments")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()

                Text("$\(plan.paymentAmount, specifier: "%.2f")/\(plan.frequency)")
                    .font(.caption)
                    .foregroundColor(.accentColor)
            }
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

struct AddPaymentPlanView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: PaymentsViewModel

    @State private var clientName = ""
    @State private var totalAmount = ""
    @State private var numberOfPayments = 3
    @State private var frequency = "monthly"
    @State private var startDate = Date()
    @State private var notes = ""

    let frequencies = ["weekly", "biweekly", "monthly"]

    var paymentAmount: Double {
        guard let total = Double(totalAmount), numberOfPayments > 0 else { return 0 }
        return total / Double(numberOfPayments)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Client") {
                    TextField("Client Name", text: $clientName)
                }

                Section("Plan Details") {
                    TextField("Total Amount", text: $totalAmount)
                        .keyboardType(.decimalPad)

                    Stepper("Number of Payments: \(numberOfPayments)", value: $numberOfPayments, in: 2...24)

                    Picker("Frequency", selection: $frequency) {
                        Text("Weekly").tag("weekly")
                        Text("Bi-weekly").tag("biweekly")
                        Text("Monthly").tag("monthly")
                    }

                    DatePicker("Start Date", selection: $startDate, displayedComponents: .date)
                }

                Section("Payment Amount") {
                    HStack {
                        Text("Each Payment")
                        Spacer()
                        Text("$\(paymentAmount, specifier: "%.2f")")
                            .fontWeight(.semibold)
                    }
                }

                Section("Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 80)
                }
            }
            .navigationTitle("Create Payment Plan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        let plan = PaymentPlan(
                            clientName: clientName,
                            totalAmount: Double(totalAmount) ?? 0,
                            numberOfPayments: numberOfPayments,
                            frequency: frequency,
                            startDate: startDate,
                            notes: notes.isEmpty ? nil : notes
                        )
                        viewModel.addPaymentPlan(plan)
                        dismiss()
                    }
                    .disabled(clientName.isEmpty || totalAmount.isEmpty)
                }
            }
        }
    }
}

// MARK: - Online Payments View
struct OnlinePaymentsView: View {
    @StateObject private var viewModel = PaymentsViewModel()
    @State private var stripeConnected = false
    @State private var paymentMethods: [PaymentMethodInfo] = []
    @State private var isLoading = true
    @State private var showingStripeSetup = false
    @State private var setupClientSecret: String?

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                if isLoading {
                    ProgressView("Checking connection status...")
                        .frame(maxWidth: .infinity, minHeight: 100)
                } else {
                    // Connection Status
                    VStack(spacing: AppSpacing.md) {
                        Image(systemName: stripeConnected ? "checkmark.circle.fill" : "creditcard.fill")
                            .font(.system(size: 60))
                            .foregroundColor(stripeConnected ? .green : .secondary)

                        Text(stripeConnected ? "Stripe Connected" : "Not Connected")
                            .font(.title2)
                            .fontWeight(.bold)

                        if stripeConnected {
                            Text("\(paymentMethods.count) payment method(s) on file")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        } else {
                            Text("Connect Stripe to accept online payments from clients.")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal)
                        }
                    }
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                    .padding(.horizontal)

                    // Payment Methods (if connected)
                    if stripeConnected && !paymentMethods.isEmpty {
                        VStack(alignment: .leading, spacing: AppSpacing.md) {
                            Text("SAVED CARDS")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundColor(.secondary)
                                .padding(.horizontal)

                            VStack(spacing: 0) {
                                ForEach(paymentMethods, id: \.id) { method in
                                    HStack {
                                        Image(systemName: cardIcon(for: method.brand ?? ""))
                                            .foregroundColor(.accentColor)
                                        Text("\(method.brand?.capitalized ?? "Card") •••• \(method.last4 ?? "****")")
                                            .font(.body)
                                        Spacer()
                                        Text("Exp \(method.expMonth ?? 0)/\(method.expYear ?? 0)")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                    .padding()
                                    if method.id != paymentMethods.last?.id {
                                        Divider().padding(.leading)
                                    }
                                }
                            }
                            .background(Color.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                            .padding(.horizontal)
                        }
                    }

                    // Payment Processors
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("PAYMENT PROCESSORS")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)

                        VStack(spacing: 0) {
                            ProcessorRow(name: "Stripe", icon: "creditcard.fill", isConnected: stripeConnected) {
                                if !stripeConnected {
                                    Task { await connectStripe() }
                                }
                            }
                            Divider().padding(.leading, 60)
                            ProcessorRow(name: "LawPay", icon: "building.columns.fill", isConnected: false) {
                                // LawPay connection - not implemented
                            }
                            Divider().padding(.leading, 60)
                            ProcessorRow(name: "PayPal", icon: "p.circle.fill", isConnected: false) {
                                // PayPal connection - not implemented
                            }
                        }
                        .background(Color.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                        .padding(.horizontal)
                    }

                    // Add Payment Method button (if connected)
                    if stripeConnected {
                        Button {
                            Task { await setupNewCard() }
                        } label: {
                            Label("Add Payment Method", systemImage: "plus.circle.fill")
                                .frame(maxWidth: .infinity)
                                .padding()
                        }
                        .buttonStyle(.borderedProminent)
                        .padding(.horizontal)
                    }

                    // Features
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("FEATURES")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)

                        VStack(spacing: AppSpacing.sm) {
                            FeatureRow(icon: "link", title: "Payment Links", description: "Send clients secure payment links")
                            FeatureRow(icon: "arrow.clockwise", title: "Recurring Payments", description: "Set up automatic recurring billing")
                            FeatureRow(icon: "creditcard", title: "Card on File", description: "Securely store client payment methods")
                            FeatureRow(icon: "chart.bar", title: "Reporting", description: "Track all online transactions")
                        }
                        .padding()
                        .background(Color.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                        .padding(.horizontal)
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Online Payments")
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await checkStripeStatus()
        }
        .refreshable {
            await checkStripeStatus()
        }
    }

    func cardIcon(for brand: String) -> String {
        switch brand.lowercased() {
        case "visa": return "creditcard.fill"
        case "mastercard": return "creditcard.fill"
        case "amex": return "creditcard.fill"
        default: return "creditcard"
        }
    }

    func checkStripeStatus() async {
        isLoading = true
        do {
            let response = try await APIService.shared.getStripePaymentMethods()
            stripeConnected = true
            paymentMethods = response.paymentMethods
        } catch {
            stripeConnected = false
            paymentMethods = []
            print("Stripe not connected or error: \(error)")
        }
        isLoading = false
    }

    func connectStripe() async {
        do {
            let response = try await APIService.shared.createStripeSetupIntent()
            setupClientSecret = response.clientSecret
            stripeConnected = true
            // In a real app, you'd open Stripe's card setup UI here
            await checkStripeStatus()
        } catch {
            print("Failed to connect Stripe: \(error)")
        }
    }

    func setupNewCard() async {
        do {
            let response = try await APIService.shared.createStripeSetupIntent()
            setupClientSecret = response.clientSecret
            // In a real app, you'd open Stripe's card setup UI here
            print("Setup intent created: \(response.clientSecret ?? "none")")
        } catch {
            print("Failed to create setup intent: \(error)")
        }
    }
}

// Payment method info from API
struct PaymentMethodInfo: Codable {
    let id: String
    let brand: String?
    let last4: String?
    let expMonth: Int?
    let expYear: Int?
}

struct StripePaymentMethodsResponse: Codable {
    let success: Bool
    let paymentMethods: [PaymentMethodInfo]
}

struct StripeSetupIntentResponse: Codable {
    let success: Bool
    let clientSecret: String?
}

struct ProcessorRow: View {
    let name: String
    let icon: String
    let isConnected: Bool
    var onConnect: (() -> Void)? = nil

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(.accentColor)
                .frame(width: 40)

            Text(name)
                .font(.body)

            Spacer()

            if isConnected {
                Label("Connected", systemImage: "checkmark.circle.fill")
                    .font(.caption)
                    .foregroundColor(.green)
            } else {
                Button("Connect") {
                    onConnect?()
                }
                .font(.caption)
                .buttonStyle(.bordered)
            }
        }
        .padding()
    }
}

struct FeatureRow: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: icon)
                .foregroundColor(.accentColor)
                .frame(width: 30)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()
        }
    }
}

// MARK: - Refunds View
struct RefundsView: View {
    @StateObject private var viewModel = PaymentsViewModel()

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.refunds.isEmpty {
                EmptyStateView(
                    icon: "arrow.uturn.backward.circle.fill",
                    title: "No Refunds",
                    message: "Refunded payments will appear here"
                )
            } else {
                List {
                    ForEach(viewModel.refunds) { refund in
                        RefundRow(refund: refund)
                            .listRowBackground(Color.cardBackground)
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Refunds")
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadRefunds()
        }
        .refreshable {
            await viewModel.loadRefunds()
        }
    }
}

struct RefundRow: View {
    let refund: RefundAPI

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: "arrow.uturn.backward.circle.fill")
                .foregroundColor(.orange)
                .font(.title2)

            VStack(alignment: .leading, spacing: 2) {
                Text(refund.clientDisplayName)
                    .font(.body)
                    .fontWeight(.medium)

                if let invoiceNumber = refund.invoiceNumber {
                    Text("Invoice #\(invoiceNumber)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                if let reason = refund.refundReason {
                    Text(reason)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text("$\(refund.refundAmount ?? refund.amount, specifier: "%.2f")")
                    .font(.headline)
                    .foregroundColor(.orange)

                Text("Refunded")
                    .font(.caption2)
                    .foregroundColor(.gray)
            }
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

// MARK: - Payment Reports View
struct PaymentReportsView: View {
    @StateObject private var viewModel = PaymentsViewModel()
    @State private var selectedPeriod = "This Month"

    let periods = ["This Week", "This Month", "This Quarter", "This Year"]

    var paymentsByMethod: [(method: PaymentRecord.PaymentMethod, count: Int, amount: Double)] {
        var result: [(method: PaymentRecord.PaymentMethod, count: Int, amount: Double)] = []
        for method in PaymentRecord.PaymentMethod.allCases {
            let filtered = viewModel.payments.filter { $0.paymentMethod == method && $0.status == "completed" }
            if !filtered.isEmpty {
                result.append((method: method, count: filtered.count, amount: filtered.reduce(0) { $0 + $1.amount }))
            }
        }
        return result.sorted { $0.amount > $1.amount }
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

                // Summary
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: AppSpacing.md) {
                    ReportCard(title: "Total Received", value: String(format: "$%.0f", viewModel.totalReceived), color: .green)
                    ReportCard(title: "Transactions", value: "\(viewModel.payments.filter { $0.status == "completed" }.count)", color: .blue)
                    ReportCard(title: "Active Plans", value: "\(viewModel.activePlans.count)", color: .orange)
                    ReportCard(title: "Refunded", value: "\(viewModel.payments.filter { $0.status == "refunded" }.count)", color: .red)
                }
                .padding(.horizontal)

                // By Payment Method
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("By Payment Method")
                        .font(.headline)
                        .padding(.horizontal)

                    VStack(spacing: 0) {
                        ForEach(paymentsByMethod, id: \.method) { item in
                            HStack(spacing: AppSpacing.md) {
                                Image(systemName: item.method.icon)
                                    .foregroundColor(.accentColor)
                                    .frame(width: 30)

                                VStack(alignment: .leading) {
                                    Text(item.method.displayName)
                                        .font(.subheadline)
                                    Text("\(item.count) payments")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }

                                Spacer()

                                Text("$\(item.amount, specifier: "%.2f")")
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                            }
                            .padding()

                            if item.method != paymentsByMethod.last?.method {
                                Divider().padding(.leading, 60)
                            }
                        }
                    }
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                    .padding(.horizontal)
                }

                // Recent Payments
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Recent Payments")
                        .font(.headline)
                        .padding(.horizontal)

                    ForEach(viewModel.recentPayments.prefix(5)) { payment in
                        PaymentRow(payment: payment)
                            .padding(.horizontal)
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Payment Reports")
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadPaymentHistory()
        }
        .refreshable {
            await viewModel.loadPaymentHistory()
        }
    }
}
