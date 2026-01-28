//
//  Case.swift
//  LegalPracticeAI
//
//  Case/Matter model and related types
//

import Foundation

// MARK: - Case Model
struct Case: Identifiable {
    let id: String
    var caseNumber: String?
    var title: String?
    var description: String?
    var caseType: String?
    var status: String?
    var priority: String?
    var clientId: String?
    var courtName: String?
    var courtCaseNumber: String?
    var judgeName: String?
    var opposingParty: String?
    var opposingCounsel: String?
    var dateOpened: Date?
    var dateClosed: Date?
    var statuteOfLimitations: Date?
    var billingType: String?
    var billingRate: Double?
    var retainerAmount: Double?
    var notes: String?
    let createdAt: Date?

    // Client info from join
    var clientFirstName: String?
    var clientLastName: String?
    var clientCompany: String?
    var clientType: String?

    var clientDisplayName: String {
        if clientType == "business", let company = clientCompany, !company.isEmpty {
            return company
        }
        let first = clientFirstName ?? ""
        let last = clientLastName ?? ""
        let fullName = "\(first) \(last)".trimmingCharacters(in: .whitespaces)
        return fullName.isEmpty ? "No Client" : fullName
    }

    var statusColor: String {
        switch status?.lowercased() {
        case "open": return "green"
        case "pending": return "orange"
        case "closed": return "gray"
        case "archived": return "secondary"
        default: return "blue"
        }
    }

    var priorityColor: String {
        switch priority?.lowercased() {
        case "high": return "red"
        case "medium": return "orange"
        case "low": return "green"
        default: return "blue"
        }
    }
}

extension Case: Codable {
    // CodingKeys - standard snake_case is handled automatically by APIService decoder
    enum CodingKeys: String, CodingKey {
        case id
        case caseNumber          // auto: case_number → caseNumber
        case title, description
        case caseType            // auto: case_type → caseType
        case status, priority
        case clientId            // auto: client_id → clientId
        case courtName           // auto: court_name → courtName
        case courtCaseNumber     // auto: court_case_number → courtCaseNumber
        case judgeName           // auto: judge_name → judgeName
        case opposingParty       // auto: opposing_party → opposingParty
        case opposingCounsel     // auto: opposing_counsel → opposingCounsel
        case dateOpened          // auto: date_opened → dateOpened
        case dateClosed          // auto: date_closed → dateClosed
        case statuteOfLimitations // auto: statute_of_limitations → statuteOfLimitations
        case billingType         // auto: billing_type → billingType
        case billingRate         // auto: billing_rate → billingRate
        case retainerAmount      // auto: retainer_amount → retainerAmount
        case notes
        case createdAt           // auto: created_at → createdAt
        case clientFirstName     // auto: client_first_name → clientFirstName
        case clientLastName      // auto: client_last_name → clientLastName
        case clientCompany       // auto: client_company → clientCompany
        case clientType          // auto: client_type → clientType
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        id = try container.decode(String.self, forKey: .id)
        caseNumber = try container.decodeIfPresent(String.self, forKey: .caseNumber)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        caseType = try container.decodeIfPresent(String.self, forKey: .caseType)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        priority = try container.decodeIfPresent(String.self, forKey: .priority)
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
        courtName = try container.decodeIfPresent(String.self, forKey: .courtName)
        courtCaseNumber = try container.decodeIfPresent(String.self, forKey: .courtCaseNumber)
        judgeName = try container.decodeIfPresent(String.self, forKey: .judgeName)
        opposingParty = try container.decodeIfPresent(String.self, forKey: .opposingParty)
        opposingCounsel = try container.decodeIfPresent(String.self, forKey: .opposingCounsel)
        dateOpened = try container.decodeIfPresent(Date.self, forKey: .dateOpened)
        dateClosed = try container.decodeIfPresent(Date.self, forKey: .dateClosed)
        statuteOfLimitations = try container.decodeIfPresent(Date.self, forKey: .statuteOfLimitations)
        billingType = try container.decodeIfPresent(String.self, forKey: .billingType)
        notes = try container.decodeIfPresent(String.self, forKey: .notes)
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt)
        clientFirstName = try container.decodeIfPresent(String.self, forKey: .clientFirstName)
        clientLastName = try container.decodeIfPresent(String.self, forKey: .clientLastName)
        clientCompany = try container.decodeIfPresent(String.self, forKey: .clientCompany)
        clientType = try container.decodeIfPresent(String.self, forKey: .clientType)

        // Flexible decoding for DECIMAL fields (may come as strings from PostgreSQL)
        billingRate = try container.decodeFlexibleDoubleIfPresent(forKey: .billingRate)
        retainerAmount = try container.decodeFlexibleDoubleIfPresent(forKey: .retainerAmount)
    }
}

// MARK: - Case Note
struct CaseNote: Codable, Identifiable {
    let id: String
    var caseId: String
    var userId: String?
    var content: String
    var noteType: String?
    var isBillable: Bool?
    let createdAt: Date?

    // User info from join
    var firstName: String?
    var lastName: String?

    var authorName: String {
        let first = firstName ?? ""
        let last = lastName ?? ""
        return "\(first) \(last)".trimmingCharacters(in: .whitespaces)
    }
}

// MARK: - Create Case Request
struct CreateCaseRequest: Codable {
    var clientId: String?
    var title: String
    var description: String?
    var caseType: String?
    var status: String?
    var priority: String?
    var courtName: String?
    var courtCaseNumber: String?
    var judgeName: String?
    var opposingParty: String?
    var opposingCounsel: String?
    var dateOpened: Date?
    var statuteOfLimitations: Date?
    var billingType: String?
    var billingRate: Double?
    var retainerAmount: Double?
    var notes: String?
}

// MARK: - Cases Response
struct CasesResponse: Codable {
    let success: Bool
    let cases: [Case]
}

// MARK: - Single Case Response
struct SingleCaseResponse: Codable {
    let success: Bool
    let `case`: Case
}

// MARK: - Case Note Response
struct CaseNoteResponse: Codable {
    let success: Bool
    let note: CaseNote
}

// MARK: - Case Types
enum CaseType: String, CaseIterable {
    case general = "general"
    case litigation = "litigation"
    case corporate = "corporate"
    case realEstate = "real_estate"
    case familyLaw = "family_law"
    case estatePlanning = "estate_planning"
    case bankruptcy = "bankruptcy"
    case criminal = "criminal"
    case immigration = "immigration"
    case intellectualProperty = "intellectual_property"
    case employment = "employment"

    var displayName: String {
        switch self {
        case .general: return "General"
        case .litigation: return "Litigation"
        case .corporate: return "Corporate"
        case .realEstate: return "Real Estate"
        case .familyLaw: return "Family Law"
        case .estatePlanning: return "Estate Planning"
        case .bankruptcy: return "Bankruptcy"
        case .criminal: return "Criminal"
        case .immigration: return "Immigration"
        case .intellectualProperty: return "Intellectual Property"
        case .employment: return "Employment"
        }
    }
}

// MARK: - Case Status
enum CaseStatus: String, CaseIterable {
    case open = "open"
    case pending = "pending"
    case closed = "closed"
    case archived = "archived"

    var displayName: String {
        rawValue.capitalized
    }
}

// MARK: - Case Priority
enum CasePriority: String, CaseIterable {
    case high = "high"
    case medium = "medium"
    case low = "low"

    var displayName: String {
        rawValue.capitalized
    }
}
