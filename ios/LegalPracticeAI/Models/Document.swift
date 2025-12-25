//
//  Document.swift
//  LegalPracticeAI
//
//  Document models and related types
//

import Foundation

// MARK: - Document Model
struct Document: Codable, Identifiable {
    let id: String
    let title: String
    let category: DocumentCategory
    let content: String
    let status: DocumentStatus
    let createdAt: Date
    let updatedAt: Date

    enum DocumentStatus: String, Codable {
        case draft
        case final
        case signed
    }
}

// MARK: - Document Category
enum DocumentCategory: String, Codable, CaseIterable {
    case businessFormation = "business_formation"
    case realEstate = "real_estate"
    case familyLaw = "family_law"
    case estatePlanning = "estate_planning"
    case employment = "employment"
    case civilLitigation = "civil_litigation"
    case contracts = "contracts"

    var displayName: String {
        switch self {
        case .businessFormation: return "Business Formation"
        case .realEstate: return "Real Estate"
        case .familyLaw: return "Family Law"
        case .estatePlanning: return "Estate Planning"
        case .employment: return "Employment"
        case .civilLitigation: return "Civil Litigation"
        case .contracts: return "Contracts"
        }
    }

    var icon: String {
        switch self {
        case .businessFormation: return "building.2"
        case .realEstate: return "house"
        case .familyLaw: return "person.2"
        case .estatePlanning: return "scroll"
        case .employment: return "briefcase"
        case .civilLitigation: return "building.columns"
        case .contracts: return "doc.text"
        }
    }

    var color: String {
        switch self {
        case .businessFormation: return "AccentColor"
        case .realEstate: return "GreenAccent"
        case .familyLaw: return "OrangeAccent"
        case .estatePlanning: return "PurpleAccent"
        case .employment: return "PinkAccent"
        case .civilLitigation: return "TealAccent"
        case .contracts: return "BlueAccent"
        }
    }

    var templates: [String] {
        switch self {
        case .businessFormation:
            return ["LLC Operating Agreement", "Articles of Incorporation", "Partnership Agreement", "Bylaws"]
        case .realEstate:
            return ["Purchase Agreement", "Lease Agreement", "Quitclaim Deed", "Rental Application"]
        case .familyLaw:
            return ["Divorce Petition", "Child Custody Agreement", "Prenuptial Agreement", "Child Support"]
        case .estatePlanning:
            return ["Last Will and Testament", "Living Trust", "Power of Attorney", "Healthcare Directive"]
        case .employment:
            return ["Employment Contract", "NDA", "Non-Compete Agreement", "Offer Letter"]
        case .civilLitigation:
            return ["Complaint", "Motion to Dismiss", "Interrogatories", "Subpoena"]
        case .contracts:
            return ["Service Agreement", "Licensing Agreement", "Sales Contract", "Consulting Agreement"]
        }
    }
}

// MARK: - Document Template
struct DocumentTemplate: Codable, Identifiable {
    let id: String
    let name: String
    let category: DocumentCategory
    let description: String
    let fields: [DocumentField]
}

// MARK: - Document Field
struct DocumentField: Codable, Identifiable {
    let id: String
    let name: String
    let label: String
    let type: FieldType
    let required: Bool
    let placeholder: String?
    let options: [String]?

    enum FieldType: String, Codable {
        case text
        case textarea
        case select
        case date
        case number
        case checkbox
        case email
        case phone
    }
}

// MARK: - Generate Document Request
struct GenerateDocumentRequest: Codable {
    let templateId: String
    let formData: [String: String]
    let state: String
}

// MARK: - Documents Response
struct DocumentsResponse: Codable {
    let documents: [Document]
    let total: Int
    let page: Int
    let limit: Int
}
