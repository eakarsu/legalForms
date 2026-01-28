//
//  TrustAccount.swift
//  LegalPracticeAI
//
//  Trust accounting models
//

import Foundation

// MARK: - Trust Account
struct TrustAccount: Identifiable, Codable {
    let id: String
    var accountName: String
    var accountNumber: String
    var bankName: String
    var balance: Double
    var currentBalance: Double?
    var clientId: String?
    var clientName: String?
    var caseId: String?
    var caseName: String?
    var status: String? // "active", "closed"
    var isActive: Bool?
    var createdAt: Date?
    var updatedAt: Date?
    var lastReconciled: Date?

    // CodingKeys - standard snake_case is handled automatically by APIService decoder
    enum CodingKeys: String, CodingKey {
        case id, status
        case accountName         // auto: account_name → accountName
        case accountNumber       // auto: account_number → accountNumber
        case bankName            // auto: bank_name → bankName
        case balance
        case currentBalance      // auto: current_balance → currentBalance
        case clientId            // auto: client_id → clientId
        case clientName          // auto: client_name → clientName
        case caseId              // auto: case_id → caseId
        case caseName            // auto: case_name → caseName
        case isActive            // auto: is_active → isActive
        case createdAt           // auto: created_at → createdAt
        case updatedAt           // auto: updated_at → updatedAt
        case lastReconciled      // auto: last_reconciled → lastReconciled
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        accountName = try container.decodeIfPresent(String.self, forKey: .accountName) ?? "Unknown"
        accountNumber = try container.decodeIfPresent(String.self, forKey: .accountNumber) ?? ""
        bankName = try container.decodeIfPresent(String.self, forKey: .bankName) ?? "Unknown Bank"
        status = try container.decodeIfPresent(String.self, forKey: .status)
        isActive = try container.decodeIfPresent(Bool.self, forKey: .isActive)
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
        clientName = try container.decodeIfPresent(String.self, forKey: .clientName)
        caseId = try container.decodeIfPresent(String.self, forKey: .caseId)
        caseName = try container.decodeIfPresent(String.self, forKey: .caseName)
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(Date.self, forKey: .updatedAt)
        lastReconciled = try container.decodeIfPresent(Date.self, forKey: .lastReconciled)

        // Handle balance as String or Double
        balance = try container.decodeFlexibleDoubleIfPresent(forKey: .balance) ?? 0
        currentBalance = try container.decodeFlexibleDoubleIfPresent(forKey: .currentBalance)
    }

    init(id: String = UUID().uuidString,
         accountName: String,
         accountNumber: String,
         bankName: String,
         balance: Double = 0,
         currentBalance: Double? = nil,
         clientId: String? = nil,
         clientName: String? = nil,
         caseId: String? = nil,
         caseName: String? = nil,
         status: String? = "active",
         isActive: Bool? = true,
         createdAt: Date? = Date(),
         updatedAt: Date? = nil,
         lastReconciled: Date? = nil) {
        self.id = id
        self.accountName = accountName
        self.accountNumber = accountNumber
        self.bankName = bankName
        self.balance = balance
        self.currentBalance = currentBalance
        self.clientId = clientId
        self.clientName = clientName
        self.caseId = caseId
        self.caseName = caseName
        self.status = status
        self.isActive = isActive
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.lastReconciled = lastReconciled
    }

    // Convenience accessors
    var name: String { accountName }

    var effectiveBalance: Double {
        balance
    }

    var maskedAccountNumber: String {
        guard accountNumber.count > 4 else { return accountNumber }
        return "****" + accountNumber.suffix(4)
    }
}

// MARK: - Trust Transaction
struct TrustTransaction: Identifiable, Codable {
    let id: String
    var accountId: String
    var type: TransactionType
    var amount: Double
    var date: Date
    var description: String
    var clientName: String?
    var checkNumber: String?
    var reference: String?
    var status: String // "pending", "cleared", "void"
    var createdAt: Date?
    var accountName: String?  // From API join
    var bankName: String?     // From API join

    enum TransactionType: String, CaseIterable, Codable {
        case deposit = "deposit"
        case withdrawal = "withdrawal"
        case transfer = "transfer"
        case fee = "fee"
        case interest = "interest"
        case refund = "refund"
        case disbursement = "disbursement"

        var displayName: String {
            rawValue.capitalized
        }

        var icon: String {
            switch self {
            case .deposit: return "arrow.down.circle.fill"
            case .withdrawal: return "arrow.up.circle.fill"
            case .transfer: return "arrow.left.arrow.right.circle.fill"
            case .fee: return "dollarsign.circle.fill"
            case .interest: return "percent"
            case .refund: return "arrow.uturn.backward.circle.fill"
            case .disbursement: return "arrow.up.circle.fill"
            }
        }
    }

    // CodingKeys - APIService uses convertFromSnakeCase, so we map to the auto-converted camelCase names
    // API returns trust_account_id → trustAccountId, transaction_type → transactionType, etc.
    enum CodingKeys: String, CodingKey {
        case id
        case accountId = "trustAccountId"         // API: trust_account_id → trustAccountId
        case type = "transactionType"             // API: transaction_type → transactionType
        case amount
        case date = "transactionDate"             // API: transaction_date → transactionDate
        case description
        case reference = "referenceNumber"        // API: reference_number → referenceNumber
        case status
        case clientName                           // API: client_name → clientName (auto)
        case checkNumber                          // API: check_number → checkNumber (auto)
        case createdAt                            // API: created_at → createdAt (auto)
        case accountName                          // API: account_name → accountName (auto)
        case bankName                             // API: bank_name → bankName (auto)
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        accountId = try container.decodeIfPresent(String.self, forKey: .accountId) ?? ""
        description = try container.decodeIfPresent(String.self, forKey: .description) ?? ""
        reference = try container.decodeIfPresent(String.self, forKey: .reference)
        clientName = try container.decodeIfPresent(String.self, forKey: .clientName)
        checkNumber = try container.decodeIfPresent(String.self, forKey: .checkNumber)
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt)
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "cleared"
        accountName = try container.decodeIfPresent(String.self, forKey: .accountName)
        bankName = try container.decodeIfPresent(String.self, forKey: .bankName)

        // Handle transaction_type as string
        let typeString = try container.decodeIfPresent(String.self, forKey: .type) ?? "deposit"
        type = TransactionType(rawValue: typeString) ?? .deposit

        // Handle amount as String or Double
        if let amountString = try? container.decode(String.self, forKey: .amount) {
            amount = Double(amountString) ?? 0
        } else {
            amount = try container.decodeIfPresent(Double.self, forKey: .amount) ?? 0
        }

        // Handle date
        date = try container.decodeIfPresent(Date.self, forKey: .date) ?? Date()
    }

    init(id: String = UUID().uuidString,
         accountId: String,
         type: TransactionType,
         amount: Double,
         date: Date = Date(),
         description: String,
         clientName: String? = nil,
         checkNumber: String? = nil,
         reference: String? = nil,
         status: String = "cleared",
         createdAt: Date? = Date(),
         accountName: String? = nil,
         bankName: String? = nil) {
        self.id = id
        self.accountId = accountId
        self.type = type
        self.amount = amount
        self.date = date
        self.description = description
        self.clientName = clientName
        self.checkNumber = checkNumber
        self.reference = reference
        self.status = status
        self.createdAt = createdAt
        self.accountName = accountName
        self.bankName = bankName
    }

    var signedAmount: Double {
        switch type {
        case .deposit, .interest: return amount
        case .withdrawal, .fee, .disbursement: return -amount
        case .transfer, .refund: return amount // Could be positive or negative
        }
    }
}

// MARK: - Reconciliation
struct Reconciliation: Identifiable, Codable {
    let id: String
    var accountId: String
    var accountName: String
    var reconciliationDate: Date
    var bankBalance: Double
    var bookBalance: Double
    var difference: Double
    var status: String // "matched", "unmatched", "in_progress"
    var notes: String?
    var completedBy: String?
    var completedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, accountId, accountName, reconciliationDate
        case bankBalance, bookBalance, difference, status
        case notes, completedBy, completedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        accountId = try container.decodeIfPresent(String.self, forKey: .accountId) ?? ""
        accountName = try container.decodeIfPresent(String.self, forKey: .accountName) ?? "Unknown"
        reconciliationDate = try container.decodeIfPresent(Date.self, forKey: .reconciliationDate) ?? Date()
        bankBalance = try container.decodeIfPresent(Double.self, forKey: .bankBalance) ?? 0
        bookBalance = try container.decodeIfPresent(Double.self, forKey: .bookBalance) ?? 0
        difference = try container.decodeIfPresent(Double.self, forKey: .difference) ?? 0
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "unmatched"
        notes = try container.decodeIfPresent(String.self, forKey: .notes)
        completedBy = try container.decodeIfPresent(String.self, forKey: .completedBy)
        completedAt = try container.decodeIfPresent(Date.self, forKey: .completedAt)
    }

    init(id: String = UUID().uuidString,
         accountId: String,
         accountName: String,
         reconciliationDate: Date = Date(),
         bankBalance: Double,
         bookBalance: Double,
         notes: String? = nil,
         completedBy: String? = nil,
         completedAt: Date? = nil) {
        self.id = id
        self.accountId = accountId
        self.accountName = accountName
        self.reconciliationDate = reconciliationDate
        self.bankBalance = bankBalance
        self.bookBalance = bookBalance
        self.difference = bankBalance - bookBalance
        self.status = abs(bankBalance - bookBalance) < 0.01 ? "matched" : "unmatched"
        self.notes = notes
        self.completedBy = completedBy
        self.completedAt = completedAt
    }
}

// MARK: - Trust Account API Response Types
struct TrustAccountsResponse: Codable {
    let success: Bool
    let accounts: [TrustAccount]
    let count: Int?
}

struct SingleTrustAccountResponse: Codable {
    let success: Bool
    let account: TrustAccount
}

struct CreateTrustAccountRequest: Codable {
    let name: String
    let accountNumber: String
    let bankName: String
    let clientId: String?
    let caseId: String?
    let initialBalance: Double?
}

struct TrustLedgerResponse: Codable {
    let success: Bool
    let entries: [TrustTransaction]
    let balance: Double?
}

struct CreateTrustLedgerEntryRequest: Codable {
    let type: String // "deposit", "withdrawal", "transfer", "fee", "interest"
    let amount: Double
    let description: String
    let clientName: String?
    let checkNumber: String?
    let reference: String?
    let date: Date?
}

struct SingleTrustTransactionResponse: Codable {
    let success: Bool
    let transaction: TrustTransaction
}

struct TrustTransactionsResponse: Codable {
    let success: Bool
    let transactions: [TrustTransaction]
}

struct ReconcileTrustRequest: Codable {
    let bankBalance: Double
    let reconciliationDate: Date?
    let notes: String?
}

struct SingleReconciliationResponse: Codable {
    let success: Bool
    let reconciliation: Reconciliation
}

struct ReconciliationsResponse: Codable {
    let success: Bool
    let reconciliations: [Reconciliation]
}
