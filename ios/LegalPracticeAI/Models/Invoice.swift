//
//  Invoice.swift
//  LegalPracticeAI
//
//  Invoice and billing models
//

import Foundation

// MARK: - Invoice Model
struct Invoice: Identifiable {
    let id: String
    var invoiceNumber: String?
    var clientId: String?
    var caseId: String?
    var status: String?
    var issueDate: Date?
    var dueDate: Date?
    var subtotal: Double?
    var taxRate: Double?
    var taxAmount: Double?
    var total: Double?
    var amountPaid: Double?
    var notes: String?
    let createdAt: Date?

    // Client info from join (backend returns without client_ prefix)
    var firstName: String?
    var lastName: String?
    var companyName: String?

    // Convenience accessors for compatibility
    var clientFirstName: String? { firstName }
    var clientLastName: String? { lastName }
    var clientCompany: String? { companyName }

    var clientDisplayName: String {
        let first = firstName ?? ""
        let last = lastName ?? ""
        if let company = companyName, !company.isEmpty {
            return company
        }
        let fullName = "\(first) \(last)".trimmingCharacters(in: .whitespaces)
        return fullName.isEmpty ? "No Client" : fullName
    }

    var outstanding: Double {
        (total ?? 0) - (amountPaid ?? 0)
    }

    var isPaid: Bool {
        outstanding <= 0
    }

    var isOverdue: Bool {
        guard let dueDate = dueDate, status != "paid" else { return false }
        return dueDate < Date()
    }

    var statusColor: String {
        switch status?.lowercased() {
        case "paid": return "green"
        case "sent": return "blue"
        case "overdue": return "red"
        case "draft": return "gray"
        default: return "orange"
        }
    }
}

extension Invoice: Codable {
    // CodingKeys - standard snake_case is handled automatically by APIService decoder
    enum CodingKeys: String, CodingKey {
        case id, status, subtotal, total, notes
        case invoiceNumber       // auto: invoice_number → invoiceNumber
        case clientId            // auto: client_id → clientId
        case caseId              // auto: case_id → caseId
        case issueDate           // auto: issue_date → issueDate
        case dueDate             // auto: due_date → dueDate
        case taxRate             // auto: tax_rate → taxRate
        case taxAmount           // auto: tax_amount → taxAmount
        case amountPaid          // auto: amount_paid → amountPaid
        case createdAt           // auto: created_at → createdAt
        case firstName           // auto: first_name → firstName
        case lastName            // auto: last_name → lastName
        case companyName         // auto: company_name → companyName
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        id = try container.decode(String.self, forKey: .id)
        invoiceNumber = try container.decodeIfPresent(String.self, forKey: .invoiceNumber)
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
        caseId = try container.decodeIfPresent(String.self, forKey: .caseId)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        issueDate = try container.decodeIfPresent(Date.self, forKey: .issueDate)
        dueDate = try container.decodeIfPresent(Date.self, forKey: .dueDate)
        notes = try container.decodeIfPresent(String.self, forKey: .notes)
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt)
        firstName = try container.decodeIfPresent(String.self, forKey: .firstName)
        lastName = try container.decodeIfPresent(String.self, forKey: .lastName)
        companyName = try container.decodeIfPresent(String.self, forKey: .companyName)

        // Flexible decoding for DECIMAL fields
        subtotal = try container.decodeFlexibleDoubleIfPresent(forKey: .subtotal)
        taxRate = try container.decodeFlexibleDoubleIfPresent(forKey: .taxRate)
        taxAmount = try container.decodeFlexibleDoubleIfPresent(forKey: .taxAmount)
        total = try container.decodeFlexibleDoubleIfPresent(forKey: .total)
        amountPaid = try container.decodeFlexibleDoubleIfPresent(forKey: .amountPaid)
    }
}

// MARK: - Invoice Item
struct InvoiceItem: Identifiable {
    let id: String
    var invoiceId: String
    var description: String
    var quantity: Double?
    var rate: Double?
    var amount: Double?
    let createdAt: Date?
}

extension InvoiceItem: Codable {
    // CodingKeys - standard snake_case is handled automatically by APIService decoder
    enum CodingKeys: String, CodingKey {
        case id, description, quantity, rate, amount
        case invoiceId           // auto: invoice_id → invoiceId
        case createdAt           // auto: created_at → createdAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        invoiceId = try container.decode(String.self, forKey: .invoiceId)
        description = try container.decode(String.self, forKey: .description)
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt)
        quantity = try container.decodeFlexibleDoubleIfPresent(forKey: .quantity)
        rate = try container.decodeFlexibleDoubleIfPresent(forKey: .rate)
        amount = try container.decodeFlexibleDoubleIfPresent(forKey: .amount)
    }
}

// MARK: - Time Entry
struct TimeEntry: Identifiable {
    let id: String
    var caseId: String?
    var clientId: String?
    var userId: String?
    var date: Date?
    var durationMinutes: Int?
    var description: String?
    var hourlyRate: Double?
    var amount: Double?
    var isBillable: Bool?
    var isBilled: Bool?
    var invoiceId: String?
    var activityType: String?
    let createdAt: Date?

    // Case info from join
    var caseTitle: String?
    var caseNumber: String?

    // Client info from join (without client_ prefix)
    var firstName: String?
    var lastName: String?
    var companyName: String?

    // Convenience accessor for compatibility
    var billingRate: Double? { hourlyRate }

    var hours: Double {
        Double(durationMinutes ?? 0) / 60.0
    }

    var formattedDuration: String {
        let mins = durationMinutes ?? 0
        let h = mins / 60
        let m = mins % 60
        if h > 0 {
            return "\(h)h \(m)m"
        }
        return "\(m)m"
    }
}

extension TimeEntry: Codable {
    // CodingKeys - standard snake_case is handled automatically by APIService decoder
    enum CodingKeys: String, CodingKey {
        case id, date, description, amount
        case caseId              // auto: case_id → caseId
        case clientId            // auto: client_id → clientId
        case userId              // auto: user_id → userId
        case durationMinutes     // auto: duration_minutes → durationMinutes
        case hourlyRate          // auto: hourly_rate → hourlyRate
        case isBillable          // auto: is_billable → isBillable
        case isBilled            // auto: is_billed → isBilled
        case invoiceId           // auto: invoice_id → invoiceId
        case activityType        // auto: activity_type → activityType
        case createdAt           // auto: created_at → createdAt
        case caseTitle           // auto: case_title → caseTitle
        case caseNumber          // auto: case_number → caseNumber
        case firstName           // auto: first_name → firstName
        case lastName            // auto: last_name → lastName
        case companyName         // auto: company_name → companyName
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        caseId = try container.decodeIfPresent(String.self, forKey: .caseId)
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
        userId = try container.decodeIfPresent(String.self, forKey: .userId)
        date = try container.decodeIfPresent(Date.self, forKey: .date)
        durationMinutes = try container.decodeIfPresent(Int.self, forKey: .durationMinutes)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        isBillable = try container.decodeIfPresent(Bool.self, forKey: .isBillable)
        isBilled = try container.decodeIfPresent(Bool.self, forKey: .isBilled)
        invoiceId = try container.decodeIfPresent(String.self, forKey: .invoiceId)
        activityType = try container.decodeIfPresent(String.self, forKey: .activityType)
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt)
        caseTitle = try container.decodeIfPresent(String.self, forKey: .caseTitle)
        caseNumber = try container.decodeIfPresent(String.self, forKey: .caseNumber)
        firstName = try container.decodeIfPresent(String.self, forKey: .firstName)
        lastName = try container.decodeIfPresent(String.self, forKey: .lastName)
        companyName = try container.decodeIfPresent(String.self, forKey: .companyName)
        hourlyRate = try container.decodeFlexibleDoubleIfPresent(forKey: .hourlyRate)
        amount = try container.decodeFlexibleDoubleIfPresent(forKey: .amount)
    }
}

// MARK: - Payment
struct Payment: Identifiable {
    let id: String
    var invoiceId: String
    var amount: Double
    var paymentDate: Date?
    var paymentMethod: String?
    var transactionId: String?
    var notes: String?
    let createdAt: Date?

    // Client info from join
    var firstName: String?
    var lastName: String?
    var companyName: String?
    var invoiceNumber: String?

    var clientDisplayName: String {
        if let company = companyName, !company.isEmpty {
            return company
        }
        let first = firstName ?? ""
        let last = lastName ?? ""
        let fullName = "\(first) \(last)".trimmingCharacters(in: .whitespaces)
        return fullName.isEmpty ? "Unknown Client" : fullName
    }
}

extension Payment: Codable {
    // CodingKeys - standard snake_case is handled automatically by APIService decoder
    enum CodingKeys: String, CodingKey {
        case id, amount, notes
        case invoiceId           // auto: invoice_id → invoiceId
        case paymentDate         // auto: payment_date → paymentDate
        case paymentMethod       // auto: payment_method → paymentMethod
        case transactionId       // auto: transaction_id → transactionId
        case createdAt           // auto: created_at → createdAt
        case firstName           // auto: first_name → firstName
        case lastName            // auto: last_name → lastName
        case companyName         // auto: company_name → companyName
        case invoiceNumber       // auto: invoice_number → invoiceNumber
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        invoiceId = try container.decodeIfPresent(String.self, forKey: .invoiceId) ?? ""
        amount = try container.decodeFlexibleDouble(forKey: .amount)
        paymentDate = try container.decodeIfPresent(Date.self, forKey: .paymentDate)
        paymentMethod = try container.decodeIfPresent(String.self, forKey: .paymentMethod)
        transactionId = try container.decodeIfPresent(String.self, forKey: .transactionId)
        notes = try container.decodeIfPresent(String.self, forKey: .notes)
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt)
        firstName = try container.decodeIfPresent(String.self, forKey: .firstName)
        lastName = try container.decodeIfPresent(String.self, forKey: .lastName)
        companyName = try container.decodeIfPresent(String.self, forKey: .companyName)
        invoiceNumber = try container.decodeIfPresent(String.self, forKey: .invoiceNumber)
    }
}

// MARK: - Create Invoice Request
struct CreateInvoiceRequest: Codable {
    var clientId: String
    var caseId: String?
    var dueDate: Date?
    var notes: String?
    var items: [CreateInvoiceItemRequest]?
}

// MARK: - Create Invoice Item Request
struct CreateInvoiceItemRequest: Codable {
    var description: String
    var quantity: Double
    var rate: Double
}

// MARK: - Create Time Entry Request
struct CreateTimeEntryRequest: Codable {
    var caseId: String?
    var clientId: String?
    var date: Date?
    var durationMinutes: Int
    var description: String?
    var hourlyRate: Double?    // Backend uses hourly_rate
    var isBillable: Bool?
    var activityType: String?
}

// MARK: - Invoices Response
struct InvoicesResponse: Codable {
    let success: Bool
    let invoices: [Invoice]
}

// MARK: - Single Invoice Response
struct SingleInvoiceResponse: Codable {
    let success: Bool
    let invoice: Invoice
    let items: [InvoiceItem]?
}

// MARK: - Time Entries Response
struct TimeEntriesResponse: Codable {
    let success: Bool
    let timeEntries: [TimeEntry]
}

// MARK: - Billing Summary
struct BillingSummary: Codable {
    var totalBilled: Double?
    var totalPaid: Double?
    var outstanding: Double?
    var unbilledAmount: Double?
    var unbilledMinutes: Int?
}

// MARK: - Invoice Status
enum InvoiceStatus: String, CaseIterable {
    case draft = "draft"
    case sent = "sent"
    case paid = "paid"
    case overdue = "overdue"
    case cancelled = "cancelled"

    var displayName: String {
        rawValue.capitalized
    }
}

// MARK: - Payment API Response Types
struct PaymentLinkResponse: Codable {
    let success: Bool
    let paymentUrl: String?
    let expiresAt: Date?
}

struct PaymentSettings: Codable {
    var stripeEnabled: Bool?
    var stripePublicKey: String?
    var acceptedMethods: [String]?
    var autoSendReceipts: Bool?
    var lateFeePercentage: Double?
    var lateFeeGraceDays: Int?
}

struct PaymentSettingsResponse: Codable {
    let success: Bool
    let settings: PaymentSettings
}

struct UpdatePaymentSettingsRequest: Codable {
    let stripeEnabled: Bool?
    let acceptedMethods: [String]?
    let autoSendReceipts: Bool?
    let lateFeePercentage: Double?
    let lateFeeGraceDays: Int?
}

struct PaymentHistoryResponse: Codable {
    let success: Bool
    let payments: [Payment]
    let count: Int?
}
