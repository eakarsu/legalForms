//
//  AIModels.swift
//  LegalPracticeAI
//
//  AI-related models for document drafting, analysis, and more
//

import Foundation

// MARK: - AI Draft Session
struct AIDraftSession: Identifiable {
    let id: String
    var title: String?
    var documentType: String?
    var status: String?
    var clientId: String?
    var caseId: String?
    var style: String?
    var length: String?
    var totalTokens: Int?
    var estimatedCost: Double?
    let createdAt: Date?
    let updatedAt: Date?

    // Latest version
    var latestContent: String?
    var versionCount: Int?
}

extension AIDraftSession: Codable {
    enum CodingKeys: String, CodingKey {
        case id, title, documentType, status, clientId, caseId
        case style, length, totalTokens, estimatedCost
        case createdAt, updatedAt, latestContent, versionCount
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        documentType = try container.decodeIfPresent(String.self, forKey: .documentType)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
        caseId = try container.decodeIfPresent(String.self, forKey: .caseId)
        style = try container.decodeIfPresent(String.self, forKey: .style)
        length = try container.decodeIfPresent(String.self, forKey: .length)
        totalTokens = try container.decodeIfPresent(Int.self, forKey: .totalTokens)
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(Date.self, forKey: .updatedAt)
        latestContent = try container.decodeIfPresent(String.self, forKey: .latestContent)
        versionCount = try container.decodeIfPresent(Int.self, forKey: .versionCount)
        estimatedCost = try container.decodeFlexibleDoubleIfPresent(forKey: .estimatedCost)
    }
}

// MARK: - AI Draft Version
struct AIDraftVersion: Codable, Identifiable {
    let id: String
    var sessionId: String
    var versionNumber: Int
    var content: String
    var promptUsed: String?
    var tokensUsed: Int?
    var feedback: String?
    let createdAt: Date?
}

// MARK: - AI Draft Template
struct AIDraftTemplate: Codable, Identifiable {
    let id: String
    var name: String
    var category: String?
    var description: String?
    var promptTemplate: String?
    var requiredFields: [String]?
    var isSystem: Bool?
}

// MARK: - Generate Draft Request
struct GenerateDraftRequest: Codable {
    var documentType: String
    var templateId: String?
    var title: String?
    var context: String?
    var style: String?  // formal, persuasive, neutral, firm
    var length: String? // concise, standard, detailed
    var clientId: String?
    var caseId: String?
    var jurisdiction: String?
    var additionalInstructions: String?
}

// MARK: - Revise Draft Request
struct ReviseDraftRequest: Codable {
    var instructions: String
    var style: String?
    var length: String?
}

// MARK: - AI Draft Response
struct AIDraftResponse: Codable {
    let success: Bool
    let session: AIDraftSession?
    let version: AIDraftVersion?
    let content: String?
    let tokensUsed: Int?
    let estimatedCost: Double?
}

// MARK: - AI Draft Sessions Response
struct AIDraftSessionsResponse: Codable {
    let success: Bool
    let sessions: [AIDraftSession]
}

// MARK: - AI Draft Templates Response
struct AIDraftTemplatesResponse: Codable {
    let success: Bool
    let templates: [AIDraftTemplate]
}

// MARK: - Voice Transcription
struct VoiceTranscription: Codable, Identifiable {
    let id: String
    var title: String?
    var originalText: String?
    var cleanedText: String?
    var summary: String?
    var duration: Int?
    var source: String?
    var caseId: String?
    var clientId: String?
    var tags: [String]?
    var extractedDates: [String]?
    var extractedNames: [String]?
    var extractedAmounts: [String]?
    let createdAt: Date?

    var displayDuration: String {
        guard let dur = duration else { return "0:00" }
        let mins = dur / 60
        let secs = dur % 60
        return String(format: "%d:%02d", mins, secs)
    }
}

// MARK: - Transcribe Request
struct TranscribeRequest: Codable {
    var title: String?
    var caseId: String?
    var clientId: String?
}

// MARK: - Voice Transcription Response
struct VoiceTranscriptionResponse: Codable {
    let success: Bool
    let transcription: VoiceTranscription?
}

// MARK: - Voice Transcriptions Response
struct VoiceTranscriptionsResponse: Codable {
    let success: Bool
    let transcriptions: [VoiceTranscription]
}

// MARK: - Document Summary
struct DocumentSummary: Codable, Identifiable {
    let id: String
    var documentId: String?
    var title: String?
    var originalLength: Int?
    var summaryLength: String?  // brief, medium, detailed
    var targetAudience: String? // attorney, client, court
    var summary: String?
    var caseId: String?
    var clientId: String?
    let createdAt: Date?

    var keyPoints: [SummaryKeyPoint]?
}

// MARK: - Summary Key Point
struct SummaryKeyPoint: Codable, Identifiable {
    let id: String
    var category: String?  // fact, issue, holding, date, obligation, party
    var content: String
    var importance: String? // normal, high, critical
    var sourceExcerpt: String?
}

// MARK: - Summarize Request
struct SummarizeRequest: Codable {
    var content: String
    var title: String?
    var summaryLength: String?  // brief, medium, detailed
    var targetAudience: String? // attorney, client, court
    var caseId: String?
    var clientId: String?
}

// MARK: - Document Summary Response
struct DocumentSummaryResponse: Codable {
    let success: Bool
    let summary: DocumentSummary?
}

// MARK: - Document Summaries Response
struct DocumentSummariesResponse: Codable {
    let success: Bool
    let summaries: [DocumentSummary]
}

// MARK: - Contract Analysis
struct ContractAnalysis: Codable, Identifiable {
    let id: String
    var title: String?
    var contractType: String?
    var overallRisk: String?  // low, medium, high, critical
    var riskScore: Int?
    var summary: String?
    var caseId: String?
    var clientId: String?
    let createdAt: Date?

    var clauses: [ContractClause]?
    var keyTerms: [ContractKeyTerm]?
    var missingProvisions: [String]?
    var recommendations: [String]?
}

// MARK: - Contract Clause
struct ContractClause: Codable, Identifiable {
    let id: String
    var clauseType: String?
    var title: String?
    var content: String?
    var riskLevel: String?  // low, medium, high, critical
    var riskExplanation: String?
    var recommendation: String?
}

// MARK: - Contract Key Term
struct ContractKeyTerm: Codable, Identifiable {
    let id: String
    var termType: String?
    var term: String
    var value: String?
    var location: String?
}

// MARK: - Analyze Contract Request
struct AnalyzeContractRequest: Codable {
    var content: String
    var title: String?
    var contractType: String?
    var caseId: String?
    var clientId: String?
}

// MARK: - Contract Analysis Response
struct ContractAnalysisResponse: Codable {
    let success: Bool
    let analysis: ContractAnalysis?
}

// MARK: - Contract Analyses Response
struct ContractAnalysesResponse: Codable {
    let success: Bool
    let analyses: [ContractAnalysis]
}

// MARK: - AI Billing Suggestion
struct AIBillingSuggestion: Identifiable {
    let id: String
    var caseId: String?
    var noteId: String?
    var activityType: String?  // research, drafting, court, meeting, call, review, travel, filing
    var description: String?
    var suggestedMinutes: Int?
    var suggestedRate: Double?
    var suggestedAmount: Double?
    var confidence: Double?
    var status: String?  // pending, accepted, rejected
    var sourceExcerpt: String?
    let createdAt: Date?

    // Case info
    var caseTitle: String?
    var caseNumber: String?

    var formattedDuration: String {
        guard let mins = suggestedMinutes else { return "0m" }
        let h = mins / 60
        let m = mins % 60
        if h > 0 {
            return "\(h)h \(m)m"
        }
        return "\(m)m"
    }

    var confidencePercentage: Int {
        Int((confidence ?? 0) * 100)
    }
}

extension AIBillingSuggestion: Codable {
    enum CodingKeys: String, CodingKey {
        case id, caseId, noteId, activityType, description
        case suggestedMinutes, suggestedRate, suggestedAmount, confidence
        case status, sourceExcerpt, createdAt, caseTitle, caseNumber
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        caseId = try container.decodeIfPresent(String.self, forKey: .caseId)
        noteId = try container.decodeIfPresent(String.self, forKey: .noteId)
        activityType = try container.decodeIfPresent(String.self, forKey: .activityType)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        suggestedMinutes = try container.decodeIfPresent(Int.self, forKey: .suggestedMinutes)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        sourceExcerpt = try container.decodeIfPresent(String.self, forKey: .sourceExcerpt)
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt)
        caseTitle = try container.decodeIfPresent(String.self, forKey: .caseTitle)
        caseNumber = try container.decodeIfPresent(String.self, forKey: .caseNumber)
        suggestedRate = try container.decodeFlexibleDoubleIfPresent(forKey: .suggestedRate)
        suggestedAmount = try container.decodeFlexibleDoubleIfPresent(forKey: .suggestedAmount)
        confidence = try container.decodeFlexibleDoubleIfPresent(forKey: .confidence)
    }
}

// MARK: - AI Billing Suggestions Response
struct AIBillingSuggestionsResponse: Codable {
    let success: Bool
    let suggestions: [AIBillingSuggestion]
}

// MARK: - Scan Notes Request
struct ScanNotesRequest: Codable {
    var caseId: String?
    var days: Int?  // Look back period (default 7)
}

// MARK: - AI Case Prediction
struct AICasePrediction: Identifiable {
    let id: String
    var caseId: String
    var analysisType: String?
    var favorableLikelihood: Double?
    var unfavorableLikelihood: Double?
    var settlementLikelihood: Double?
    var strengths: [String]?
    var weaknesses: [String]?
    var riskFactors: [CaseRiskFactor]?
    var recommendations: [String]?
    var disclaimer: String?
    let createdAt: Date?
}

extension AICasePrediction: Codable {
    enum CodingKeys: String, CodingKey {
        case id, caseId, analysisType, favorableLikelihood
        case unfavorableLikelihood, settlementLikelihood
        case strengths, weaknesses, riskFactors, recommendations
        case disclaimer, createdAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        caseId = try container.decode(String.self, forKey: .caseId)
        analysisType = try container.decodeIfPresent(String.self, forKey: .analysisType)
        strengths = try container.decodeIfPresent([String].self, forKey: .strengths)
        weaknesses = try container.decodeIfPresent([String].self, forKey: .weaknesses)
        riskFactors = try container.decodeIfPresent([CaseRiskFactor].self, forKey: .riskFactors)
        recommendations = try container.decodeIfPresent([String].self, forKey: .recommendations)
        disclaimer = try container.decodeIfPresent(String.self, forKey: .disclaimer)
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt)
        favorableLikelihood = try container.decodeFlexibleDoubleIfPresent(forKey: .favorableLikelihood)
        unfavorableLikelihood = try container.decodeFlexibleDoubleIfPresent(forKey: .unfavorableLikelihood)
        settlementLikelihood = try container.decodeFlexibleDoubleIfPresent(forKey: .settlementLikelihood)
    }
}

// MARK: - Case Risk Factor
struct CaseRiskFactor: Codable, Identifiable {
    var id: String { factor }
    var factor: String
    var severity: String?  // low, medium, high
    var explanation: String?
}

// MARK: - AI Case Prediction Response
struct AICasePredictionResponse: Codable {
    let success: Bool
    let prediction: AICasePrediction?
}

// MARK: - OCR Job
struct OCRJob: Identifiable {
    let id: String
    var filename: String?
    var status: String?  // pending, processing, completed, failed
    var progress: Int?
    var extractedText: String?
    var pageCount: Int?
    var confidence: Double?
    var caseId: String?
    var clientId: String?
    let createdAt: Date?

    var entities: [OCREntity]?
}

extension OCRJob: Codable {
    enum CodingKeys: String, CodingKey {
        case id, filename, status, progress, extractedText
        case pageCount, confidence, caseId, clientId, createdAt, entities
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        filename = try container.decodeIfPresent(String.self, forKey: .filename)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        progress = try container.decodeIfPresent(Int.self, forKey: .progress)
        extractedText = try container.decodeIfPresent(String.self, forKey: .extractedText)
        pageCount = try container.decodeIfPresent(Int.self, forKey: .pageCount)
        caseId = try container.decodeIfPresent(String.self, forKey: .caseId)
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt)
        entities = try container.decodeIfPresent([OCREntity].self, forKey: .entities)
        confidence = try container.decodeFlexibleDoubleIfPresent(forKey: .confidence)
    }
}

// MARK: - OCR Entity
struct OCREntity: Identifiable {
    let id: String
    var entityType: String?  // email, phone, money, date
    var value: String
    var confidence: Double?
    var pageNumber: Int?
}

extension OCREntity: Codable {
    enum CodingKeys: String, CodingKey {
        case id, entityType, value, confidence, pageNumber
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        entityType = try container.decodeIfPresent(String.self, forKey: .entityType)
        value = try container.decode(String.self, forKey: .value)
        pageNumber = try container.decodeIfPresent(Int.self, forKey: .pageNumber)
        confidence = try container.decodeFlexibleDoubleIfPresent(forKey: .confidence)
    }
}

// MARK: - OCR Response
struct OCRResponse: Codable {
    let success: Bool
    let job: OCRJob?
}

// MARK: - OCR Jobs Response
struct OCRJobsResponse: Codable {
    let success: Bool
    let jobs: [OCRJob]
}

// MARK: - AI Usage Stats
struct AIUsageStats: Codable {
    var totalSessions: Int?
    var totalTokens: Int?
    var totalCost: Double?
    var sessionsThisMonth: Int?
    var tokensThisMonth: Int?
    var costThisMonth: Double?
}

// MARK: - AI Usage Response
struct AIUsageResponse: Codable {
    let success: Bool
    let usage: AIUsageStats?
}

// MARK: - AI Communication Draft
struct AICommunicationDraft: Codable, Identifiable {
    let id: String
    var subject: String?
    var body: String?
    var tone: String?  // professional, friendly, empathetic, urgent, formal
    var recipientEmail: String?
    var clientId: String?
    var caseId: String?
    var status: String?  // draft, sent
    var keyPoints: [String]?
    var followUpActions: [String]?
    let createdAt: Date?
}

// MARK: - Draft Email Request
struct DraftEmailRequest: Codable {
    var context: String
    var tone: String?
    var recipientName: String?
    var clientId: String?
    var caseId: String?
    var additionalInstructions: String?
}

// MARK: - AI Communication Response
struct AICommunicationResponse: Codable {
    let success: Bool
    let draft: AICommunicationDraft?
}

// MARK: - Legal Citation
struct LegalCitation: Codable, Identifiable {
    let id: String
    var citation: String
    var caseName: String?
    var court: String?
    var year: Int?
    var jurisdiction: String?
    var summary: String?
    var relevanceScore: Double?
    var searchId: String?
}

// MARK: - Citation Search Request
struct CitationSearchRequest: Codable {
    var legalIssue: String
    var jurisdiction: String?
    var practiceArea: String?
    var caseId: String?
}

// MARK: - Citation Search Response
struct CitationSearchResponse: Codable {
    let success: Bool
    let searchId: String?
    let citations: [LegalCitation]?
}

// MARK: - AI Conflict Analysis
struct AIConflictAnalysis: Codable, Identifiable {
    let id: String
    var partyName: String
    var partyType: String?  // individual, company
    var status: String?  // clear, potential_conflict, conflict_found
    var matches: [ConflictMatch]?
    var reviewed: Bool?
    var reviewedBy: String?
    var reviewNotes: String?
    let createdAt: Date?
}

// MARK: - Conflict Match
struct ConflictMatch: Codable, Identifiable {
    var id: String { "\(matchedPartyId)-\(matchType ?? "")" }
    var matchedPartyId: String
    var matchedPartyName: String
    var matchType: String?  // phonetic, nickname, spelling, corporate
    var confidence: Double?
    var relationship: String?
    var clientId: String?
    var caseId: String?
}

// MARK: - Conflict Check Request
struct ConflictCheckRequest: Codable {
    var partyName: String
    var partyType: String?
    var relatedParties: [String]?
}

// MARK: - Conflict Analysis Response
struct ConflictAnalysisResponse: Codable {
    let success: Bool
    let analysis: AIConflictAnalysis?
}
