//
//  Document.swift
//  LegalPracticeAI
//
//  Document models and related types
//

import Foundation

// MARK: - Document Model
struct Document: Identifiable {
    let id: String
    var title: String?
    var category: String?  // Use String instead of enum for flexibility
    var content: String?
    var status: String?
    var createdAt: Date?
    var updatedAt: Date?
    var caseId: String?
    var clientId: String?
    var documentType: String?
    var sourceType: String?

    // Memberwise initializer
    init(id: String, title: String? = nil, category: String? = nil, content: String? = nil,
         status: String? = nil, createdAt: Date? = nil, updatedAt: Date? = nil,
         caseId: String? = nil, clientId: String? = nil, documentType: String? = nil, sourceType: String? = nil) {
        self.id = id
        self.title = title
        self.category = category
        self.content = content
        self.status = status
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.caseId = caseId
        self.clientId = clientId
        self.documentType = documentType
        self.sourceType = sourceType
    }

    // Computed properties for display
    var displayCategory: DocumentCategory? {
        guard let cat = category else { return nil }
        return DocumentCategory(rawValue: cat)
    }

    var displayStatus: DocumentStatus? {
        guard let stat = status else { return nil }
        return DocumentStatus(rawValue: stat)
    }

    enum DocumentStatus: String, Codable {
        case draft
        case final
        case signed
        case pending
        case completed
    }
}

extension Document: Codable {
    // CodingKeys - standard snake_case is handled automatically by APIService decoder
    enum CodingKeys: String, CodingKey {
        case id, title, category, content, status
        case createdAt           // auto: created_at → createdAt
        case updatedAt           // auto: updated_at → updatedAt
        case caseId              // auto: case_id → caseId
        case clientId            // auto: client_id → clientId
        case documentType        // auto: document_type → documentType
        case sourceType          // auto: source_type → sourceType
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        category = try container.decodeIfPresent(String.self, forKey: .category)
        content = try container.decodeIfPresent(String.self, forKey: .content)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(Date.self, forKey: .updatedAt)
        caseId = try container.decodeIfPresent(String.self, forKey: .caseId)
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
        documentType = try container.decodeIfPresent(String.self, forKey: .documentType)
        sourceType = try container.decodeIfPresent(String.self, forKey: .sourceType)
    }
}

// MARK: - Document Category
// Matches JavaScript FORM_TYPES in server.js
enum DocumentCategory: String, Codable, CaseIterable {
    case businessFormation = "business_formation"
    case realEstate = "real_estate"
    case familyLaw = "family_law"
    case estatePlanning = "estate_planning"
    case employmentLaw = "employment_law"
    case civilLitigation = "civil_litigation"
    case contracts = "contracts"
    case intellectualProperty = "intellectual_property"
    case immigration = "immigration"
    case healthcare = "healthcare"
    case nonprofit = "nonprofit"
    case bankruptcy = "bankruptcy"
    case criminalLaw = "criminal_law"
    case taxLaw = "tax_law"
    case securitiesLaw = "securities_law"
    case insuranceLaw = "insurance_law"
    case environmentalLaw = "environmental_law"
    case maritimeLaw = "maritime_law"
    case consumerProtection = "consumer_protection"
    case landlordTenant = "landlord_tenant"
    case debtCollection = "debt_collection"
    case entertainmentLaw = "entertainment_law"

    var displayName: String {
        switch self {
        case .businessFormation: return "Business Entity Formation"
        case .realEstate: return "Real Estate & Property"
        case .familyLaw: return "Family Law & Domestic Relations"
        case .estatePlanning: return "Estate Planning & Asset Protection"
        case .employmentLaw: return "Employment & Labor Law"
        case .civilLitigation: return "Civil Litigation & Disputes"
        case .contracts: return "Commercial Contracts & Agreements"
        case .intellectualProperty: return "Intellectual Property"
        case .immigration: return "Immigration & Visa Documents"
        case .healthcare: return "Healthcare & Medical"
        case .nonprofit: return "Nonprofit & Tax-Exempt Organizations"
        case .bankruptcy: return "Bankruptcy & Debt Relief"
        case .criminalLaw: return "Criminal Law & Defense"
        case .taxLaw: return "Tax Law & IRS Matters"
        case .securitiesLaw: return "Securities & Investment Law"
        case .insuranceLaw: return "Insurance Law & Claims"
        case .environmentalLaw: return "Environmental Law & Compliance"
        case .maritimeLaw: return "Maritime & Admiralty Law"
        case .consumerProtection: return "Consumer Protection"
        case .landlordTenant: return "Landlord-Tenant Law"
        case .debtCollection: return "Debt Collection"
        case .entertainmentLaw: return "Sports & Entertainment Law"
        }
    }

    var icon: String {
        switch self {
        case .businessFormation: return "building.2"
        case .realEstate: return "house"
        case .familyLaw: return "person.2"
        case .estatePlanning: return "scroll"
        case .employmentLaw: return "briefcase"
        case .civilLitigation: return "building.columns"
        case .contracts: return "doc.text"
        case .intellectualProperty: return "lightbulb"
        case .immigration: return "airplane"
        case .healthcare: return "cross.case"
        case .nonprofit: return "heart.circle"
        case .bankruptcy: return "dollarsign.circle"
        case .criminalLaw: return "shield"
        case .taxLaw: return "percent"
        case .securitiesLaw: return "chart.line.uptrend.xyaxis"
        case .insuranceLaw: return "umbrella"
        case .environmentalLaw: return "leaf"
        case .maritimeLaw: return "ferry"
        case .consumerProtection: return "person.badge.shield.checkmark"
        case .landlordTenant: return "key"
        case .debtCollection: return "creditcard"
        case .entertainmentLaw: return "sportscourt"
        }
    }

    var color: String {
        switch self {
        case .businessFormation: return "AccentColor"
        case .realEstate: return "GreenAccent"
        case .familyLaw: return "OrangeAccent"
        case .estatePlanning: return "PurpleAccent"
        case .employmentLaw: return "PinkAccent"
        case .civilLitigation: return "TealAccent"
        case .contracts: return "BlueAccent"
        case .intellectualProperty: return "YellowAccent"
        case .immigration: return "CyanAccent"
        case .healthcare: return "RedAccent"
        case .nonprofit: return "MagentaAccent"
        case .bankruptcy: return "BrownAccent"
        case .criminalLaw: return "IndigoAccent"
        case .taxLaw: return "GrayAccent"
        case .securitiesLaw: return "GoldAccent"
        case .insuranceLaw: return "SkyBlueAccent"
        case .environmentalLaw: return "ForestGreenAccent"
        case .maritimeLaw: return "NavyAccent"
        case .consumerProtection: return "CoralAccent"
        case .landlordTenant: return "SandAccent"
        case .debtCollection: return "SlateAccent"
        case .entertainmentLaw: return "VioletAccent"
        }
    }

    var templates: [String] {
        switch self {
        case .businessFormation:
            return ["LLC Operating Agreement", "Articles of Incorporation", "Partnership Agreement", "Bylaws", "Certificate of Formation", "Shareholder Agreement", "Corporate Resolution", "Stock Purchase Agreement"]
        case .realEstate:
            return ["Purchase Agreement", "Lease Agreement", "Quitclaim Deed", "Rental Application", "Deed of Trust", "Property Disclosure", "Easement Agreement", "Title Transfer"]
        case .familyLaw:
            return ["Divorce Petition", "Child Custody Agreement", "Prenuptial Agreement", "Child Support Order", "Postnuptial Agreement", "Adoption Petition", "Guardianship Petition", "Visitation Schedule"]
        case .estatePlanning:
            return ["Last Will and Testament", "Living Trust", "Power of Attorney", "Healthcare Directive", "Revocable Trust", "Irrevocable Trust", "Beneficiary Designation", "Estate Inventory"]
        case .employmentLaw:
            return ["Employment Contract", "NDA", "Non-Compete Agreement", "Offer Letter", "Severance Agreement", "Employee Handbook", "Independent Contractor Agreement", "Termination Letter"]
        case .civilLitigation:
            return ["Complaint", "Motion to Dismiss", "Interrogatories", "Subpoena", "Answer to Complaint", "Motion for Summary Judgment", "Discovery Request", "Settlement Agreement"]
        case .contracts:
            return ["Service Agreement", "Licensing Agreement", "Sales Contract", "Consulting Agreement", "Master Service Agreement", "Joint Venture Agreement", "Distribution Agreement", "Franchise Agreement"]
        case .intellectualProperty:
            return ["Trademark Application", "Copyright Registration", "Patent Application", "IP Assignment Agreement", "Licensing Agreement", "Cease and Desist Letter", "Trade Secret Agreement", "IP Purchase Agreement"]
        case .immigration:
            return ["I-130 Petition", "I-485 Application", "I-765 Work Permit", "I-140 Immigrant Petition", "N-400 Naturalization", "Visa Application Support Letter", "Affidavit of Support", "Employment Verification"]
        case .healthcare:
            return ["HIPAA Authorization", "Medical Power of Attorney", "Informed Consent", "Patient Release Form", "Medical Records Request", "Healthcare Proxy", "DNR Order", "Mental Health Directive"]
        case .nonprofit:
            return ["Articles of Incorporation (501c3)", "Bylaws for Nonprofit", "Conflict of Interest Policy", "Board Resolution", "Grant Application", "Donor Agreement", "Volunteer Agreement", "Fiscal Sponsorship Agreement"]
        case .bankruptcy:
            return ["Chapter 7 Petition", "Chapter 13 Petition", "Means Test Calculation", "Statement of Financial Affairs", "Creditor Matrix", "Reaffirmation Agreement", "Discharge Order", "Debt Repayment Plan"]
        case .criminalLaw:
            return ["Motion to Suppress", "Plea Agreement", "Bail Application", "Expungement Petition", "Appeal Brief", "Habeas Corpus Petition", "Character Reference Letter", "Sentencing Memorandum"]
        case .taxLaw:
            return ["IRS Power of Attorney (2848)", "Offer in Compromise", "Installment Agreement Request", "Innocent Spouse Relief", "Tax Court Petition", "Penalty Abatement Request", "Extension Request", "Amended Return"]
        case .securitiesLaw:
            return ["Private Placement Memorandum", "Subscription Agreement", "Investor Questionnaire", "SEC Registration", "Stock Option Agreement", "SAFE Agreement", "Convertible Note", "Shareholder Rights Agreement"]
        case .insuranceLaw:
            return ["Insurance Claim Form", "Demand Letter", "Policy Review Request", "Bad Faith Complaint", "Subrogation Agreement", "Coverage Dispute Letter", "Loss Documentation", "Appeal of Denial"]
        case .environmentalLaw:
            return ["Environmental Impact Assessment", "Compliance Audit Report", "Remediation Plan", "EPA Permit Application", "Environmental Covenant", "Hazardous Waste Manifest", "Air Quality Permit", "Water Discharge Permit"]
        case .maritimeLaw:
            return ["Bill of Lading", "Charter Party Agreement", "Maritime Lien", "Salvage Agreement", "Vessel Purchase Agreement", "Crew Employment Contract", "Cargo Claim", "Marine Insurance Claim"]
        case .consumerProtection:
            return ["FDCPA Violation Letter", "FTC Complaint", "Warranty Claim", "Product Liability Complaint", "Class Action Notice", "Consumer Fraud Complaint", "Lemon Law Claim", "Credit Report Dispute"]
        case .landlordTenant:
            return ["Residential Lease", "Commercial Lease", "Eviction Notice", "Security Deposit Return", "Lease Renewal", "Sublease Agreement", "Rent Increase Notice", "Lease Termination"]
        case .debtCollection:
            return ["Collection Letter", "Payment Plan Agreement", "Debt Validation Request", "Cease and Desist (Debt)", "Judgment Collection", "Garnishment Order", "Settlement Offer", "Debt Acknowledgment"]
        case .entertainmentLaw:
            return ["Talent Agreement", "Sponsorship Contract", "Licensing Deal", "Appearance Agreement", "Media Rights Agreement", "Agent Representation", "Endorsement Contract", "Production Agreement"]
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

// MARK: - Generate Document Request (matches server.js /generate endpoint)
struct GenerateDocumentRequest: Codable {
    let formType: String
    let specificType: String?
    let formData: [String: String]
    let format: String
    let generationMode: String

    // CodingKeys - standard camelCase → snake_case is handled automatically by APIService encoder
    enum CodingKeys: String, CodingKey {
        case formType            // auto: formType → form_type
        case specificType        // auto: specificType → specific_type
        case formData            // auto: formData → form_data
        case format
        case generationMode      // auto: generationMode → generation_mode
    }

    init(category: DocumentCategory, template: String?, clientName: String, clientEmail: String, naturalLanguageInput: String, format: DocumentFormatType, generationMode: GenerationModeType) {
        self.formType = category.rawValue
        // Convert template display name to snake_case for backend (e.g., "Purchase Agreement" -> "purchase_agreement")
        self.specificType = template?.toSnakeCase()
        self.formData = [
            "client_name": clientName,
            "client_email": clientEmail,
            "natural_language_input": naturalLanguageInput
        ]
        self.format = format.apiValue
        self.generationMode = generationMode.apiValue
    }
}

// MARK: - String Extension for snake_case conversion
extension String {
    func toSnakeCase() -> String {
        // Replace spaces and special characters with underscores, then lowercase
        let result = self
            .replacingOccurrences(of: " ", with: "_")
            .replacingOccurrences(of: "-", with: "_")
            .replacingOccurrences(of: "&", with: "and")
            .replacingOccurrences(of: "(", with: "")
            .replacingOccurrences(of: ")", with: "")
            .replacingOccurrences(of: "'", with: "")
            .lowercased()
        return result
    }
}

// MARK: - Document Format Type
enum DocumentFormatType: String, CaseIterable {
    case pdf = "PDF Document (.pdf)"
    case docx = "Microsoft Word (.docx)"
    case txt = "Text Document (.txt)"

    var apiValue: String {
        switch self {
        case .pdf: return "pdf"
        case .docx: return "docx"
        case .txt: return "txt"
        }
    }
}

// MARK: - Generation Mode Type
enum GenerationModeType: String, CaseIterable {
    case template = "Professional Template"
    case ai = "AI Generated"

    var apiValue: String {
        switch self {
        case .template: return "professional_template"
        case .ai: return "ai_summary"
        }
    }
}

// MARK: - Generate Document Response (matches server.js /generate response)
struct GenerateDocumentResponse: Codable {
    let success: Bool
    let document: String
    let filename: String
    let format: String
    let documentId: Int?

    enum CodingKeys: String, CodingKey {
        case success
        case document
        case filename
        case format
        case documentId
    }

    // Custom decoder to handle server response variations
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        success = try container.decode(Bool.self, forKey: .success)
        document = try container.decode(String.self, forKey: .document)
        filename = try container.decode(String.self, forKey: .filename)
        format = try container.decode(String.self, forKey: .format)
        documentId = try container.decodeIfPresent(Int.self, forKey: .documentId)
    }
}

// MARK: - Documents Response
struct DocumentsResponse: Codable {
    let documents: [Document]
    let total: Int
    let page: Int
    let limit: Int

    // Memberwise initializer for manual construction
    init(documents: [Document], total: Int, page: Int, limit: Int) {
        self.documents = documents
        self.total = total
        self.page = page
        self.limit = limit
    }
}

// MARK: - Document Summary API Response (from /api/document-summary)
struct DocumentSummariesAPIResponse: Codable {
    let success: Bool
    let summaries: [DocumentSummaryAPI]
}

// MARK: - Document Summary from API
struct DocumentSummaryAPI: Identifiable {
    let id: String
    var userId: String?
    var caseId: String?
    var clientId: String?
    var documentId: String?
    var ocrJobId: String?
    var sourceName: String?
    var sourceType: String?
    var title: String?
    var originalText: String?
    var wordCount: Int?
    var executiveSummary: String?
    var detailedSummary: String?
    var summary: String?
    var keyPoints: [String]?
    var summaryLength: String?
    var targetAudience: String?
    var status: String?
    var modelUsed: String?
    var tokensUsed: Int?
    var processingTimeMs: Int?
    var createdAt: Date?
    var updatedAt: Date?
    var firstName: String?
    var lastName: String?
    var caseTitle: String?
}

extension DocumentSummaryAPI: Codable {
    enum CodingKeys: String, CodingKey {
        case id, userId, caseId, clientId, documentId, ocrJobId
        case sourceName, sourceType, title, originalText, wordCount
        case executiveSummary, detailedSummary, summary, keyPoints
        case summaryLength, targetAudience, status
        case modelUsed, tokensUsed, processingTimeMs
        case createdAt, updatedAt
        case firstName, lastName, caseTitle
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        userId = try container.decodeIfPresent(String.self, forKey: .userId)
        caseId = try container.decodeIfPresent(String.self, forKey: .caseId)
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
        documentId = try container.decodeIfPresent(String.self, forKey: .documentId)
        ocrJobId = try container.decodeIfPresent(String.self, forKey: .ocrJobId)
        sourceName = try container.decodeIfPresent(String.self, forKey: .sourceName)
        sourceType = try container.decodeIfPresent(String.self, forKey: .sourceType)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        originalText = try container.decodeIfPresent(String.self, forKey: .originalText)
        wordCount = try container.decodeIfPresent(Int.self, forKey: .wordCount)
        executiveSummary = try container.decodeIfPresent(String.self, forKey: .executiveSummary)
        detailedSummary = try container.decodeIfPresent(String.self, forKey: .detailedSummary)
        summary = try container.decodeIfPresent(String.self, forKey: .summary)
        summaryLength = try container.decodeIfPresent(String.self, forKey: .summaryLength)
        targetAudience = try container.decodeIfPresent(String.self, forKey: .targetAudience)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        modelUsed = try container.decodeIfPresent(String.self, forKey: .modelUsed)
        tokensUsed = try container.decodeIfPresent(Int.self, forKey: .tokensUsed)
        processingTimeMs = try container.decodeIfPresent(Int.self, forKey: .processingTimeMs)
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(Date.self, forKey: .updatedAt)
        firstName = try container.decodeIfPresent(String.self, forKey: .firstName)
        lastName = try container.decodeIfPresent(String.self, forKey: .lastName)
        caseTitle = try container.decodeIfPresent(String.self, forKey: .caseTitle)

        // Handle keyPoints which can be a JSON array
        if let keyPointsData = try? container.decodeIfPresent([String].self, forKey: .keyPoints) {
            keyPoints = keyPointsData
        } else {
            keyPoints = nil
        }
    }
}
