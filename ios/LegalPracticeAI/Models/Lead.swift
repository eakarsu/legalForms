//
//  Lead.swift
//  LegalPracticeAI
//
//  Lead data model
//

import Foundation

// MARK: - Lead Status
enum LeadStatus: String, CaseIterable, Codable {
    case new = "new"
    case contacted = "contacted"
    case qualified = "qualified"
    case proposal = "proposal"
    case converted = "converted"
    case lost = "lost"

    var displayName: String {
        switch self {
        case .new: return "New"
        case .contacted: return "Contacted"
        case .qualified: return "Qualified"
        case .proposal: return "Proposal Sent"
        case .converted: return "Converted"
        case .lost: return "Lost"
        }
    }

    var color: String {
        switch self {
        case .new: return "green"
        case .contacted: return "blue"
        case .qualified: return "purple"
        case .proposal: return "orange"
        case .converted: return "teal"
        case .lost: return "red"
        }
    }
}

// MARK: - Lead Source
enum LeadSource: String, CaseIterable, Codable {
    case website = "website"
    case referral = "referral"
    case advertising = "advertising"
    case advertisement = "advertisement"
    case socialMedia = "social_media"
    case directContact = "direct_contact"
    case google = "google"
    case directory = "directory"
    case manual = "manual"
    case other = "other"

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let value = try container.decode(String.self)
        self = LeadSource(rawValue: value) ?? .other
    }

    var displayName: String {
        switch self {
        case .website: return "Website"
        case .referral: return "Referral"
        case .advertising, .advertisement: return "Advertising"
        case .socialMedia: return "Social Media"
        case .directContact: return "Direct Contact"
        case .google: return "Google"
        case .directory: return "Directory"
        case .manual: return "Manual"
        case .other: return "Other"
        }
    }

    var icon: String {
        switch self {
        case .website: return "globe"
        case .referral: return "person.2.fill"
        case .advertising, .advertisement: return "megaphone.fill"
        case .socialMedia: return "bubble.left.and.bubble.right.fill"
        case .directContact: return "phone.fill"
        case .google: return "magnifyingglass"
        case .directory: return "book.fill"
        case .manual: return "hand.raised.fill"
        case .other: return "ellipsis.circle.fill"
        }
    }
}

// MARK: - Lead Model
struct Lead: Identifiable, Codable {
    let id: String
    var firstName: String?
    var lastName: String?
    var email: String?
    var phone: String?
    var companyName: String?
    var status: LeadStatus
    var source: LeadSource
    var caseType: String?
    var notes: String?
    var estimatedValue: Double?
    var followUpDate: Date?
    var createdAt: Date?
    var updatedAt: Date?
    var convertedClientId: String?
    var assignedTo: String?

    // CodingKeys - only define non-standard mappings
    // Standard snake_case → camelCase is handled automatically by APIService decoder
    enum CodingKeys: String, CodingKey {
        case id
        case firstName           // auto: first_name → firstName
        case lastName            // auto: last_name → lastName
        case email, phone
        case companyName = "company"  // non-standard: "company" not "company_name"
        case status, source
        case caseType = "practiceArea"  // auto-converted from practice_area
        case notes
        case estimatedValue      // auto: estimated_value → estimatedValue
        case followUpDate        // auto: follow_up_date → followUpDate
        case createdAt           // auto: created_at → createdAt
        case updatedAt           // auto: updated_at → updatedAt
        case convertedClientId = "convertedToClientId"  // auto-converted, but property name differs
        case assignedTo          // auto: assigned_to → assignedTo
    }

    var displayName: String {
        if let first = firstName, let last = lastName, !first.isEmpty, !last.isEmpty {
            return "\(first) \(last)"
        } else if let first = firstName, !first.isEmpty {
            return first
        } else if let company = companyName, !company.isEmpty {
            return company
        }
        return "Unknown Lead"
    }

    var initials: String {
        let first = firstName?.first.map(String.init) ?? ""
        let last = lastName?.first.map(String.init) ?? ""
        let result = "\(first)\(last)".uppercased()
        return result.isEmpty ? "?" : result
    }

    // For local storage
    init(id: String = UUID().uuidString,
         firstName: String? = nil,
         lastName: String? = nil,
         email: String? = nil,
         phone: String? = nil,
         companyName: String? = nil,
         status: LeadStatus = .new,
         source: LeadSource = .other,
         caseType: String? = nil,
         notes: String? = nil,
         estimatedValue: Double? = nil,
         followUpDate: Date? = nil,
         createdAt: Date? = Date(),
         updatedAt: Date? = nil,
         convertedClientId: String? = nil,
         assignedTo: String? = nil) {
        self.id = id
        self.firstName = firstName
        self.lastName = lastName
        self.email = email
        self.phone = phone
        self.companyName = companyName
        self.status = status
        self.source = source
        self.caseType = caseType
        self.notes = notes
        self.estimatedValue = estimatedValue
        self.followUpDate = followUpDate
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.convertedClientId = convertedClientId
        self.assignedTo = assignedTo
    }
}

// MARK: - Follow Up
struct FollowUp: Identifiable, Codable {
    let id: String
    var leadId: String
    var leadName: String?
    var dueDate: Date
    var notes: String?
    var isCompleted: Bool
    var completedAt: Date?
    var createdAt: Date?

    init(id: String = UUID().uuidString,
         leadId: String,
         leadName: String? = nil,
         dueDate: Date,
         notes: String? = nil,
         isCompleted: Bool = false,
         completedAt: Date? = nil,
         createdAt: Date? = Date()) {
        self.id = id
        self.leadId = leadId
        self.leadName = leadName
        self.dueDate = dueDate
        self.notes = notes
        self.isCompleted = isCompleted
        self.completedAt = completedAt
        self.createdAt = createdAt
    }
}

// MARK: - Lead Activity
struct LeadActivity: Identifiable, Codable {
    let id: String
    var leadId: String
    var type: String // "call", "email", "meeting", "note"
    var description: String
    var notes: String?
    var createdBy: String?
    var createdAt: Date?

    init(id: String = UUID().uuidString,
         leadId: String,
         type: String,
         description: String,
         notes: String? = nil,
         createdBy: String? = nil,
         createdAt: Date? = Date()) {
        self.id = id
        self.leadId = leadId
        self.type = type
        self.description = description
        self.notes = notes
        self.createdBy = createdBy
        self.createdAt = createdAt
    }

    var typeIcon: String {
        switch type {
        case "call": return "phone.fill"
        case "email": return "envelope.fill"
        case "meeting": return "person.2.fill"
        case "note": return "note.text"
        default: return "circle.fill"
        }
    }
}

// MARK: - Lead API Response Types
struct LeadsResponse: Codable {
    let success: Bool
    let leads: [Lead]
    let count: Int?
}

struct SingleLeadResponse: Codable {
    let success: Bool
    let lead: Lead
}

struct CreateLeadRequest: Codable {
    let firstName: String?
    let lastName: String?
    let email: String?
    let phone: String?
    let companyName: String?
    let source: String?
    let caseType: String?
    let notes: String?
    let estimatedValue: Double?
    let followUpDate: Date?
}

struct LeadActivitiesResponse: Codable {
    let success: Bool
    let activities: [LeadActivity]
}

struct SingleLeadActivityResponse: Codable {
    let success: Bool
    let activity: LeadActivity
}
