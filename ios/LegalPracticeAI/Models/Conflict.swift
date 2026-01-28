//
//  Conflict.swift
//  LegalPracticeAI
//
//  Conflict check data models
//

import Foundation

// MARK: - Conflict Status
enum ConflictStatus: String, CaseIterable, Codable {
    case clear = "clear"
    case potential = "potential"
    case confirmed = "confirmed"
    case waived = "waived"

    var displayName: String {
        switch self {
        case .clear: return "Clear"
        case .potential: return "Potential Conflict"
        case .confirmed: return "Confirmed Conflict"
        case .waived: return "Waived"
        }
    }
}

// MARK: - Conflict Check
struct ConflictCheck: Identifiable, Codable {
    let id: String
    var searchName: String
    var searchType: String // "client", "matter", "party"
    var status: ConflictStatus
    var results: [ConflictResult]
    var checkedBy: String?
    var checkedAt: Date?
    var notes: String?
    var createdAt: Date?

    // CodingKeys - standard snake_case is handled automatically by APIService decoder
    enum CodingKeys: String, CodingKey {
        case id
        case searchName          // auto: search_name → searchName
        case searchType          // auto: search_type → searchType
        case status, results, notes
        case checkedBy           // auto: checked_by → checkedBy
        case checkedAt           // auto: checked_at → checkedAt
        case createdAt           // auto: created_at → createdAt
    }

    init(id: String = UUID().uuidString,
         searchName: String,
         searchType: String = "client",
         status: ConflictStatus = .clear,
         results: [ConflictResult] = [],
         checkedBy: String? = nil,
         checkedAt: Date? = Date(),
         notes: String? = nil,
         createdAt: Date? = Date()) {
        self.id = id
        self.searchName = searchName
        self.searchType = searchType
        self.status = status
        self.results = results
        self.checkedBy = checkedBy
        self.checkedAt = checkedAt
        self.notes = notes
        self.createdAt = createdAt
    }
}

// MARK: - Conflict Result
struct ConflictResult: Identifiable, Codable {
    let id: String
    var matchedName: String
    var matchType: String // "exact", "partial", "related"
    var relatedCase: String?
    var relatedClient: String?
    var relationship: String?
    var matchScore: Double // 0-1

    // CodingKeys - standard snake_case is handled automatically by APIService decoder
    enum CodingKeys: String, CodingKey {
        case id
        case matchedName         // auto: matched_name → matchedName
        case matchType           // auto: match_type → matchType
        case relatedCase         // auto: related_case → relatedCase
        case relatedClient       // auto: related_client → relatedClient
        case relationship
        case matchScore          // auto: match_score → matchScore
    }

    init(id: String = UUID().uuidString,
         matchedName: String,
         matchType: String = "partial",
         relatedCase: String? = nil,
         relatedClient: String? = nil,
         relationship: String? = nil,
         matchScore: Double = 0.5) {
        self.id = id
        self.matchedName = matchedName
        self.matchType = matchType
        self.relatedCase = relatedCase
        self.relatedClient = relatedClient
        self.relationship = relationship
        self.matchScore = matchScore
    }
}

// MARK: - Related Party
struct RelatedParty: Identifiable, Codable {
    let id: String
    var name: String
    var relationship: String // "spouse", "business_partner", "employer", "opposing_party", etc.
    var clientId: String?
    var caseId: String?
    var notes: String?
    var createdAt: Date?

    init(id: String = UUID().uuidString,
         name: String,
         relationship: String,
         clientId: String? = nil,
         caseId: String? = nil,
         notes: String? = nil,
         createdAt: Date? = Date()) {
        self.id = id
        self.name = name
        self.relationship = relationship
        self.clientId = clientId
        self.caseId = caseId
        self.notes = notes
        self.createdAt = createdAt
    }

    var relationshipDisplay: String {
        switch relationship {
        case "spouse": return "Spouse"
        case "business_partner": return "Business Partner"
        case "employer": return "Employer"
        case "employee": return "Employee"
        case "opposing_party": return "Opposing Party"
        case "witness": return "Witness"
        case "co_defendant": return "Co-Defendant"
        case "co_plaintiff": return "Co-Plaintiff"
        default: return relationship.capitalized
        }
    }
}

// MARK: - Conflict Waiver
struct ConflictWaiver: Identifiable, Codable {
    let id: String
    var conflictCheckId: String
    var clientName: String
    var conflictDescription: String
    var waiverType: String // "informed_consent", "advance_waiver"
    var signedAt: Date?
    var signedBy: String?
    var documentPath: String?
    var expiresAt: Date?
    var notes: String?
    var createdAt: Date?

    init(id: String = UUID().uuidString,
         conflictCheckId: String,
         clientName: String,
         conflictDescription: String,
         waiverType: String = "informed_consent",
         signedAt: Date? = nil,
         signedBy: String? = nil,
         documentPath: String? = nil,
         expiresAt: Date? = nil,
         notes: String? = nil,
         createdAt: Date? = Date()) {
        self.id = id
        self.conflictCheckId = conflictCheckId
        self.clientName = clientName
        self.conflictDescription = conflictDescription
        self.waiverType = waiverType
        self.signedAt = signedAt
        self.signedBy = signedBy
        self.documentPath = documentPath
        self.expiresAt = expiresAt
        self.notes = notes
        self.createdAt = createdAt
    }
}

// MARK: - Conflict Party (for database)
struct ConflictParty: Identifiable, Codable {
    let id: String
    var name: String
    var partyType: String // "individual", "company", "organization"
    var relationship: String? // "client", "opposing_party", "witness", etc.
    var caseId: String?
    var clientId: String?
    var aliases: [String]?
    var email: String?
    var phone: String?
    var company: String?
    var address: String?
    var notes: String?
    var createdAt: Date?

    // CodingKeys for snake_case mapping
    enum CodingKeys: String, CodingKey {
        case id, name, relationship, aliases, email, phone, company, address, notes
        case partyType       // auto: party_type → partyType
        case caseId          // auto: case_id → caseId
        case clientId        // auto: client_id → clientId
        case createdAt       // auto: created_at → createdAt
    }

    // Convenience accessor for role (maps to relationship)
    var role: String? { relationship }

    init(id: String = UUID().uuidString,
         name: String,
         partyType: String = "individual",
         relationship: String? = nil,
         caseId: String? = nil,
         clientId: String? = nil,
         aliases: [String]? = nil,
         email: String? = nil,
         phone: String? = nil,
         company: String? = nil,
         address: String? = nil,
         notes: String? = nil,
         createdAt: Date? = Date()) {
        self.id = id
        self.name = name
        self.partyType = partyType
        self.relationship = relationship
        self.caseId = caseId
        self.clientId = clientId
        self.aliases = aliases
        self.email = email
        self.phone = phone
        self.company = company
        self.address = address
        self.notes = notes
        self.createdAt = createdAt
    }
}

// MARK: - Conflict API Response Types
struct ConflictPartiesResponse: Codable {
    let success: Bool
    let parties: [ConflictParty]
    let count: Int?
}

struct SingleConflictPartyResponse: Codable {
    let success: Bool
    let party: ConflictParty
}

struct CreateConflictPartyRequest: Codable {
    let name: String
    let partyType: String?
    let role: String?
    let caseId: String?
    let clientId: String?
    let notes: String?
}

struct RunConflictCheckRequest: Codable {
    let searchName: String
    let searchType: String? // "client", "matter", "party"
    let includeRelated: Bool?
}

struct ConflictCheckResultResponse: Codable {
    let success: Bool
    let hasConflict: Bool
    let matches: [ConflictResult]
    let checkId: String?
}

struct ConflictChecksResponse: Codable {
    let success: Bool
    let checks: [ConflictCheck]
    let count: Int?
}

struct ConflictWaiversResponse: Codable {
    let success: Bool
    let waivers: [ConflictWaiver]
    let count: Int?
}

struct SingleConflictWaiverResponse: Codable {
    let success: Bool
    let waiver: ConflictWaiver
}

struct CreateConflictWaiverRequest: Codable {
    let clientName: String
    let conflictDescription: String
    let waiverType: String?
    let signedBy: String?
    let signedAt: Date?
    let expiresAt: Date?
    let notes: String?
}
