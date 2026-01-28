//
//  InvoicesView.swift
//  LegalPracticeAI
//
//  Invoices and billing management screen
//

import SwiftUI

struct InvoicesView: View {
    @State private var invoices: [Invoice] = []
    @State private var searchText = ""
    @State private var selectedStatus = "all"
    @State private var isLoading = false
    @State private var showAddInvoice = false

    var filteredInvoices: [Invoice] {
        var result = invoices

        if selectedStatus != "all" {
            result = result.filter { $0.status?.lowercased() == selectedStatus.lowercased() }
        }

        if !searchText.isEmpty {
            result = result.filter {
                ($0.invoiceNumber?.localizedCaseInsensitiveContains(searchText) ?? false) ||
                $0.clientDisplayName.localizedCaseInsensitiveContains(searchText)
            }
        }

        return result
    }

    var totalOutstanding: Double {
        invoices.reduce(0) { $0 + $1.outstanding }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Summary Card
                HStack(spacing: AppSpacing.lg) {
                    SummaryItem(title: "Outstanding", value: "$\(String(format: "%.0f", totalOutstanding))", color: .orange)
                    SummaryItem(title: "Invoices", value: "\(invoices.count)", color: .blue)
                    SummaryItem(title: "Paid", value: "\(invoices.filter { $0.isPaid }.count)", color: .green)
                }
                .padding()
                .background(Color.cardBackground)

                // Status Filter
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: AppSpacing.sm) {
                        ForEach(["all", "draft", "sent", "paid", "overdue"], id: \.self) { status in
                            Button {
                                selectedStatus = status
                            } label: {
                                Text(status.capitalized)
                                    .font(.subheadline)
                                    .fontWeight(selectedStatus == status ? .semibold : .regular)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 8)
                                    .background(selectedStatus == status ? Color.accentColor.opacity(0.15) : Color.clear)
                                    .foregroundColor(selectedStatus == status ? .accentColor : .secondary)
                                    .clipShape(Capsule())
                                    .overlay(
                                        Capsule()
                                            .stroke(selectedStatus == status ? Color.accentColor : Color.secondary.opacity(0.3), lineWidth: 1)
                                    )
                            }
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, AppSpacing.sm)
                }

                // Content
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if filteredInvoices.isEmpty {
                    VStack(spacing: AppSpacing.lg) {
                        Image(systemName: "doc.text")
                            .font(.system(size: 60))
                            .foregroundColor(.secondary)

                        Text("No Invoices")
                            .font(.title3)
                            .fontWeight(.semibold)

                        Text("Create your first invoice to track payments")
                            .font(.subheadline)
                            .foregroundColor(.secondary)

                        Button {
                            showAddInvoice = true
                        } label: {
                            Label("New Invoice", systemImage: "plus")
                                .fontWeight(.semibold)
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(filteredInvoices) { invoice in
                            NavigationLink(destination: InvoiceDetailView(invoice: invoice)) {
                                InvoiceListRow(invoice: invoice)
                            }
                            .listRowBackground(Color.cardBackground)
                        }
                    }
                    .listStyle(.plain)
                    .refreshable {
                        await loadInvoices()
                    }
                }
            }
            .navigationTitle("Invoices")
            .searchable(text: $searchText, prompt: "Search invoices")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showAddInvoice = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showAddInvoice) {
                AddInvoiceView()
            }
            .background(Color(UIColor.systemGroupedBackground))
        }
        .task {
            await loadInvoices()
        }
    }

    func loadInvoices() async {
        isLoading = true
        do {
            let response = try await APIService.shared.getInvoices()
            invoices = response.invoices
        } catch {
            print("Failed to load invoices: \(error)")
        }
        isLoading = false
    }
}

// MARK: - Summary Item
struct SummaryItem: View {
    let title: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(color)

            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Invoice List Row
struct InvoiceListRow: View {
    let invoice: Invoice

    var statusColor: Color {
        switch invoice.status?.lowercased() {
        case "paid": return .green
        case "sent": return .blue
        case "overdue": return .red
        case "draft": return .gray
        default: return .orange
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                Text(invoice.invoiceNumber ?? "INV-???")
                    .font(.body)
                    .fontWeight(.medium)

                Spacer()

                Text(invoice.status?.uppercased() ?? "DRAFT")
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundColor(statusColor)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(statusColor.opacity(0.1))
                    .clipShape(Capsule())
            }

            Text(invoice.clientDisplayName)
                .font(.subheadline)
                .foregroundColor(.secondary)

            HStack {
                Text("$\(String(format: "%.2f", invoice.total ?? 0))")
                    .font(.headline)
                    .foregroundColor(.primary)

                Spacer()

                if let dueDate = invoice.dueDate {
                    Text("Due \(dueDate.formatted(date: .abbreviated, time: .omitted))")
                        .font(.caption)
                        .foregroundColor(invoice.isOverdue ? .red : .secondary)
                }
            }
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

// MARK: - Invoice Detail View
struct InvoiceDetailView: View {
    let invoice: Invoice

    var statusColor: Color {
        switch invoice.status?.lowercased() {
        case "paid": return .green
        case "sent": return .blue
        case "overdue": return .red
        case "draft": return .gray
        default: return .orange
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.lg) {
                // Header
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    HStack {
                        Text(invoice.invoiceNumber ?? "Invoice")
                            .font(.title2)
                            .fontWeight(.bold)

                        Spacer()

                        Text(invoice.status?.uppercased() ?? "DRAFT")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(statusColor)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(statusColor.opacity(0.1))
                            .clipShape(Capsule())
                    }

                    Text(invoice.clientDisplayName)
                        .font(.headline)
                        .foregroundColor(.secondary)
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Amount Details
                VStack(spacing: AppSpacing.md) {
                    HStack {
                        Text("Subtotal")
                        Spacer()
                        Text("$\(String(format: "%.2f", invoice.subtotal ?? 0))")
                    }

                    if let taxAmount = invoice.taxAmount, taxAmount > 0 {
                        HStack {
                            Text("Tax (\(String(format: "%.1f", invoice.taxRate ?? 0))%)")
                            Spacer()
                            Text("$\(String(format: "%.2f", taxAmount))")
                        }
                    }

                    Divider()

                    HStack {
                        Text("Total")
                            .fontWeight(.bold)
                        Spacer()
                        Text("$\(String(format: "%.2f", invoice.total ?? 0))")
                            .fontWeight(.bold)
                    }

                    if invoice.amountPaid ?? 0 > 0 {
                        HStack {
                            Text("Paid")
                                .foregroundColor(.green)
                            Spacer()
                            Text("-$\(String(format: "%.2f", invoice.amountPaid ?? 0))")
                                .foregroundColor(.green)
                        }

                        HStack {
                            Text("Outstanding")
                                .fontWeight(.semibold)
                            Spacer()
                            Text("$\(String(format: "%.2f", invoice.outstanding))")
                                .fontWeight(.semibold)
                                .foregroundColor(invoice.outstanding > 0 ? .orange : .green)
                        }
                    }
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Dates
                VStack(spacing: 0) {
                    if let issueDate = invoice.issueDate {
                        InfoRow(icon: "calendar", label: "Issue Date", value: issueDate.formatted(date: .abbreviated, time: .omitted))
                        Divider().padding(.leading, 44)
                    }
                    if let dueDate = invoice.dueDate {
                        InfoRow(icon: "calendar.badge.exclamationmark", label: "Due Date", value: dueDate.formatted(date: .abbreviated, time: .omitted))
                    }
                }
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Actions
                if invoice.status != "paid" {
                    VStack(spacing: AppSpacing.sm) {
                        Button {
                            // Send invoice
                        } label: {
                            Label("Send Invoice", systemImage: "paperplane.fill")
                                .font(.headline)
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 50)
                                .background(Color.accentColor)
                                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                        }

                        Button {
                            // Record payment
                        } label: {
                            Label("Record Payment", systemImage: "creditcard.fill")
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
            }
            .padding(.top)
            .padding(.bottom, AppSpacing.xxl)
        }
        .background(Color(UIColor.systemGroupedBackground))
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Add Invoice View
struct AddInvoiceView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var clientsViewModel = ClientsViewModel()

    @State private var selectedClientId: String?
    @State private var dueDate = Date().addingTimeInterval(30 * 24 * 60 * 60)
    @State private var notes = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Client") {
                    Picker("Select Client", selection: $selectedClientId) {
                        Text("Select a client").tag(nil as String?)
                        ForEach(clientsViewModel.clients, id: \.id) { client in
                            Text(client.displayName).tag(client.id as String?)
                        }
                    }
                }

                Section("Details") {
                    DatePicker("Due Date", selection: $dueDate, displayedComponents: .date)
                }

                Section("Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 80)
                }
            }
            .navigationTitle("New Invoice")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        dismiss()
                    }
                    .disabled(selectedClientId == nil)
                }
            }
        }
        .task {
            await clientsViewModel.loadClients()
        }
    }
}

// MARK: - Preview
#Preview {
    InvoicesView()
}
