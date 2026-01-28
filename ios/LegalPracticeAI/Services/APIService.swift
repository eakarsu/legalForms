//
//  APIService.swift
//  LegalPracticeAI
//
//  Network layer using URLSession
//

import Foundation

// MARK: - Flexible Decimal Decoder
// PostgreSQL returns DECIMAL fields as strings, but we need Double in Swift
struct FlexibleDouble: Codable {
    let value: Double

    init(_ value: Double) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        // Try decoding as Double first
        if let doubleValue = try? container.decode(Double.self) {
            self.value = doubleValue
            return
        }

        // Try decoding as Int
        if let intValue = try? container.decode(Int.self) {
            self.value = Double(intValue)
            return
        }

        // Try decoding as String (PostgreSQL DECIMAL format)
        if let stringValue = try? container.decode(String.self),
           let doubleValue = Double(stringValue) {
            self.value = doubleValue
            return
        }

        // Default to 0
        self.value = 0
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(value)
    }
}

// Helper extension to decode PostgreSQL Decimal from any decoder container
extension KeyedDecodingContainer {
    func decodeFlexibleDouble(forKey key: Key) throws -> Double {
        // Try Double
        if let value = try? decode(Double.self, forKey: key) {
            return value
        }
        // Try Int
        if let value = try? decode(Int.self, forKey: key) {
            return Double(value)
        }
        // Try String (PostgreSQL Decimal)
        if let value = try? decode(String.self, forKey: key),
           let doubleValue = Double(value) {
            return doubleValue
        }
        return 0
    }

    func decodeFlexibleDoubleIfPresent(forKey key: Key) throws -> Double? {
        guard contains(key) else { return nil }
        // Check for null
        if try decodeNil(forKey: key) {
            return nil
        }
        // Try Double
        if let value = try? decode(Double.self, forKey: key) {
            return value
        }
        // Try Int
        if let value = try? decode(Int.self, forKey: key) {
            return Double(value)
        }
        // Try String (PostgreSQL Decimal)
        if let value = try? decode(String.self, forKey: key),
           let doubleValue = Double(value) {
            return doubleValue
        }
        return nil
    }
}

// MARK: - API Configuration
enum APIConfig {
    #if DEBUG
    static let baseURL = "http://localhost:3000/api"
    #else
    static let baseURL = "https://api.legalpracticeai.com/api"
    #endif

    static let timeout: TimeInterval = 120  // AI document generation can take 60+ seconds
}

// MARK: - HTTP Method
enum HTTPMethod: String {
    case GET
    case POST
    case PUT
    case DELETE
    case PATCH
}

// MARK: - API Error Types
enum APIServiceError: Error, LocalizedError {
    case invalidURL
    case noData
    case decodingError(Error)
    case networkError(Error)
    case serverError(Int, String?)
    case unauthorized
    case notFound

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .noData:
            return "No data received"
        case .decodingError(let error):
            return "Decoding error: \(error.localizedDescription)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .serverError(let code, let message):
            return message ?? "Server error (code: \(code))"
        case .unauthorized:
            return "Unauthorized. Please log in again."
        case .notFound:
            return "Resource not found"
        }
    }
}

// MARK: - API Service
actor APIService {
    static let shared = APIService()

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = APIConfig.timeout
        config.timeoutIntervalForResource = APIConfig.timeout * 2

        self.session = URLSession(configuration: config)

        self.decoder = JSONDecoder()
        // Custom date decoding to handle ISO8601 with and without fractional seconds
        self.decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)

            // Try different ISO8601 formats
            let formatters: [ISO8601DateFormatter] = {
                let withFractionalSeconds = ISO8601DateFormatter()
                withFractionalSeconds.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

                let standard = ISO8601DateFormatter()
                standard.formatOptions = [.withInternetDateTime]

                return [withFractionalSeconds, standard]
            }()

            for formatter in formatters {
                if let date = formatter.date(from: dateString) {
                    return date
                }
            }

            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode date: \(dateString)")
        }
        self.decoder.keyDecodingStrategy = .convertFromSnakeCase

        self.encoder = JSONEncoder()
        self.encoder.dateEncodingStrategy = .iso8601
        self.encoder.keyEncodingStrategy = .convertToSnakeCase
    }

    // MARK: - Generic Request
    func request<T: Decodable>(
        endpoint: String,
        method: HTTPMethod = .GET,
        body: Encodable? = nil,
        queryItems: [URLQueryItem]? = nil
    ) async throws -> T {
        // Build URL
        guard var urlComponents = URLComponents(string: APIConfig.baseURL + endpoint) else {
            throw APIServiceError.invalidURL
        }

        if let queryItems = queryItems {
            urlComponents.queryItems = queryItems
        }

        guard let url = urlComponents.url else {
            throw APIServiceError.invalidURL
        }

        print("DEBUG: Making request to \(url.absoluteString)")

        // Build request
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        // Add auth token if available
        if let token = KeychainService.shared.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            print("DEBUG: Auth token present (length: \(token.count))")
        } else {
            print("DEBUG: No auth token found!")
        }

        // Add body if present
        if let body = body {
            request.httpBody = try encoder.encode(body)
        }

        // Perform request
        let (data, response) = try await session.data(for: request)

        // Check response
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIServiceError.networkError(NSError(domain: "Invalid response", code: 0))
        }

        print("DEBUG: Response status code: \(httpResponse.statusCode)")

        // Handle status codes
        switch httpResponse.statusCode {
        case 200...299:
            break
        case 401:
            print("DEBUG: Unauthorized - token may be expired or invalid")
            throw APIServiceError.unauthorized
        case 404:
            throw APIServiceError.notFound
        default:
            let message = try? decoder.decode(APIError.self, from: data).message
            print("DEBUG: Server error \(httpResponse.statusCode): \(message ?? "no message")")
            throw APIServiceError.serverError(httpResponse.statusCode, message)
        }

        // Decode response
        do {
            return try decoder.decode(T.self, from: data)
        } catch let decodingError as DecodingError {
            // Debug: print detailed decoding error
            if let responseString = String(data: data, encoding: .utf8) {
                print("DEBUG: Raw response for \(endpoint): \(responseString.prefix(1000))")
            }

            // Print detailed error info
            switch decodingError {
            case .keyNotFound(let key, let context):
                print("DEBUG: Key '\(key.stringValue)' not found: \(context.debugDescription)")
                print("DEBUG: CodingPath: \(context.codingPath.map { $0.stringValue })")
            case .typeMismatch(let type, let context):
                print("DEBUG: Type mismatch for \(type): \(context.debugDescription)")
                print("DEBUG: CodingPath: \(context.codingPath.map { $0.stringValue })")
            case .valueNotFound(let type, let context):
                print("DEBUG: Value not found for \(type): \(context.debugDescription)")
                print("DEBUG: CodingPath: \(context.codingPath.map { $0.stringValue })")
            case .dataCorrupted(let context):
                print("DEBUG: Data corrupted: \(context.debugDescription)")
                print("DEBUG: CodingPath: \(context.codingPath.map { $0.stringValue })")
            @unknown default:
                print("DEBUG: Unknown decoding error: \(decodingError)")
            }

            throw APIServiceError.decodingError(decodingError)
        } catch {
            print("DEBUG: Other error for \(endpoint): \(error)")
            throw APIServiceError.decodingError(error)
        }
    }

    // MARK: - Request without response body
    func requestNoContent(
        endpoint: String,
        method: HTTPMethod = .POST,
        body: Encodable? = nil
    ) async throws {
        guard let url = URL(string: APIConfig.baseURL + endpoint) else {
            throw APIServiceError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = KeychainService.shared.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = body {
            request.httpBody = try encoder.encode(body)
        }

        let (_, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIServiceError.networkError(NSError(domain: "Invalid response", code: 0))
        }

        switch httpResponse.statusCode {
        case 200...299:
            return
        case 401:
            throw APIServiceError.unauthorized
        case 404:
            throw APIServiceError.notFound
        default:
            throw APIServiceError.serverError(httpResponse.statusCode, nil)
        }
    }
}

// MARK: - Auth Service Extension
extension APIService {
    func login(email: String, password: String) async throws -> AuthResponse {
        let request = LoginRequest(email: email, password: password)
        return try await self.request(endpoint: "/auth/login", method: .POST, body: request)
    }

    func register(name: String, email: String, password: String) async throws -> AuthResponse {
        let request = RegisterRequest(name: name, email: email, password: password)
        return try await self.request(endpoint: "/auth/register", method: .POST, body: request)
    }

    func logout() async throws {
        try await requestNoContent(endpoint: "/auth/logout", method: .POST)
    }

    func verifyToken() async throws -> User {
        return try await request(endpoint: "/auth/verify")
    }

    func socialLogin(provider: String, code: String, codeVerifier: String? = nil) async throws -> AuthResponse {
        struct SocialLoginRequest: Codable {
            let provider: String
            let code: String
            let codeVerifier: String?

            enum CodingKeys: String, CodingKey {
                case provider, code
                case codeVerifier = "code_verifier"
            }
        }
        let request = SocialLoginRequest(provider: provider, code: code, codeVerifier: codeVerifier)
        return try await self.request(endpoint: "/auth/social", method: .POST, body: request)
    }
}

// MARK: - Document Service Extension
extension APIService {
    func getDocuments(page: Int = 1, limit: Int = 20, category: DocumentCategory? = nil) async throws -> DocumentsResponse {
        var queryItems: [URLQueryItem] = []

        if let category = category {
            queryItems.append(URLQueryItem(name: "source_type", value: category.rawValue))
        }

        // Use document-summary endpoint since /documents/history doesn't exist
        // Note: baseURL already includes /api, so we use /document-summary not /api/document-summary
        let response: DocumentSummariesAPIResponse = try await request(endpoint: "/document-summary", queryItems: queryItems.isEmpty ? nil : queryItems)

        // Convert summaries to documents for compatibility
        let documents = response.summaries.map { summary -> Document in
            Document(
                id: summary.id,
                title: summary.sourceName ?? summary.title,
                category: summary.sourceType,
                content: summary.executiveSummary ?? summary.summary,
                status: summary.status,
                createdAt: summary.createdAt,
                updatedAt: summary.updatedAt,
                caseId: summary.caseId,
                clientId: summary.clientId,
                documentType: summary.sourceType,
                sourceType: summary.sourceType
            )
        }

        return DocumentsResponse(documents: documents, total: documents.count, page: page, limit: limit)
    }

    func getDocument(id: String) async throws -> Document {
        return try await request(endpoint: "/documents/\(id)")
    }

    func generateDocument(request: GenerateDocumentRequest) async throws -> GenerateDocumentResponse {
        // Call the /generate endpoint which uses OpenRouter API with keys from .env
        return try await self.request(endpoint: "/generate", method: .POST, body: request)
    }

    func deleteDocument(id: String) async throws {
        try await requestNoContent(endpoint: "/documents/\(id)", method: .DELETE)
    }

    func getTemplates(category: DocumentCategory? = nil) async throws -> [DocumentTemplate] {
        var queryItems: [URLQueryItem]? = nil
        if let category = category {
            queryItems = [URLQueryItem(name: "category", value: category.rawValue)]
        }
        return try await request(endpoint: "/documents/templates", queryItems: queryItems)
    }
}

// MARK: - Client API Response Types
struct SingleClientResponse: Codable {
    let success: Bool
    let client: Client
}

// MARK: - Client Service Extension
extension APIService {
    func getClients(page: Int = 1, limit: Int = 50, search: String? = nil) async throws -> ClientsResponse {
        var queryItems = [
            URLQueryItem(name: "page", value: String(page)),
            URLQueryItem(name: "limit", value: String(limit))
        ]

        if let search = search, !search.isEmpty {
            queryItems.append(URLQueryItem(name: "search", value: search))
        }

        return try await request(endpoint: "/clients", queryItems: queryItems)
    }

    func getClient(id: String) async throws -> Client {
        let response: SingleClientResponse = try await request(endpoint: "/clients/\(id)")
        return response.client
    }

    func createClient(request: CreateClientRequest) async throws -> Client {
        let response: SingleClientResponse = try await self.request(endpoint: "/clients", method: .POST, body: request)
        return response.client
    }

    func updateClient(id: String, request: CreateClientRequest) async throws -> Client {
        let response: SingleClientResponse = try await self.request(endpoint: "/clients/\(id)", method: .PUT, body: request)
        return response.client
    }

    func deleteClient(id: String) async throws {
        try await requestNoContent(endpoint: "/clients/\(id)", method: .DELETE)
    }
}

// MARK: - Cases Service Extension
extension APIService {
    func getCases(status: String? = nil, clientId: String? = nil) async throws -> CasesResponse {
        var queryItems: [URLQueryItem] = []

        if let status = status {
            queryItems.append(URLQueryItem(name: "status", value: status))
        }
        if let clientId = clientId {
            queryItems.append(URLQueryItem(name: "client_id", value: clientId))
        }

        return try await request(endpoint: "/cases", queryItems: queryItems.isEmpty ? nil : queryItems)
    }

    func getCase(id: String) async throws -> Case {
        let response: SingleCaseResponse = try await request(endpoint: "/cases/\(id)")
        return response.case
    }

    func createCase(request: CreateCaseRequest) async throws -> Case {
        let response: SingleCaseResponse = try await self.request(endpoint: "/cases", method: .POST, body: request)
        return response.case
    }

    func updateCase(id: String, request: CreateCaseRequest) async throws -> Case {
        let response: SingleCaseResponse = try await self.request(endpoint: "/cases/\(id)", method: .PUT, body: request)
        return response.case
    }

    func deleteCase(id: String) async throws {
        try await requestNoContent(endpoint: "/cases/\(id)", method: .DELETE)
    }

    func addCaseNote(caseId: String, content: String, noteType: String?, isBillable: Bool) async throws -> CaseNote {
        struct NoteRequest: Codable {
            let content: String
            let noteType: String?
            let isBillable: Bool
        }
        let body = NoteRequest(content: content, noteType: noteType, isBillable: isBillable)
        let response: CaseNoteResponse = try await request(endpoint: "/cases/\(caseId)/notes", method: .POST, body: body)
        return response.note
    }
}

// MARK: - Invoices Service Extension
extension APIService {
    func getInvoices(status: String? = nil, clientId: String? = nil) async throws -> InvoicesResponse {
        var queryItems: [URLQueryItem] = []

        if let status = status {
            queryItems.append(URLQueryItem(name: "status", value: status))
        }
        if let clientId = clientId {
            queryItems.append(URLQueryItem(name: "client_id", value: clientId))
        }

        return try await request(endpoint: "/invoices", queryItems: queryItems.isEmpty ? nil : queryItems)
    }

    func getInvoice(id: String) async throws -> Invoice {
        let response: SingleInvoiceResponse = try await request(endpoint: "/invoices/\(id)")
        return response.invoice
    }

    func createInvoice(request: CreateInvoiceRequest) async throws -> Invoice {
        let response: SingleInvoiceResponse = try await self.request(endpoint: "/invoices", method: .POST, body: request)
        return response.invoice
    }

    func deleteInvoice(id: String) async throws {
        try await requestNoContent(endpoint: "/invoices/\(id)", method: .DELETE)
    }
}

// MARK: - Time Entries Service Extension
extension APIService {
    func getTimeEntries(caseId: String? = nil, clientId: String? = nil) async throws -> TimeEntriesResponse {
        var queryItems: [URLQueryItem] = []

        if let caseId = caseId {
            queryItems.append(URLQueryItem(name: "case_id", value: caseId))
        }
        if let clientId = clientId {
            queryItems.append(URLQueryItem(name: "client_id", value: clientId))
        }

        return try await request(endpoint: "/time-entries", queryItems: queryItems.isEmpty ? nil : queryItems)
    }

    func createTimeEntry(request: CreateTimeEntryRequest) async throws -> TimeEntry {
        struct TimeEntryResponse: Codable {
            let success: Bool
            let timeEntry: TimeEntry
        }
        let response: TimeEntryResponse = try await self.request(endpoint: "/time-entries", method: .POST, body: request)
        return response.timeEntry
    }

    func deleteTimeEntry(id: String) async throws {
        try await requestNoContent(endpoint: "/time-entries/\(id)", method: .DELETE)
    }
}

// MARK: - Calendar Service Extension
extension APIService {
    func getCalendarEvents(startDate: Date? = nil, endDate: Date? = nil) async throws -> CalendarEventsResponse {
        var queryItems: [URLQueryItem] = []

        let formatter = ISO8601DateFormatter()
        if let startDate = startDate {
            queryItems.append(URLQueryItem(name: "start", value: formatter.string(from: startDate)))
        }
        if let endDate = endDate {
            queryItems.append(URLQueryItem(name: "end", value: formatter.string(from: endDate)))
        }

        return try await request(endpoint: "/calendar/events", queryItems: queryItems.isEmpty ? nil : queryItems)
    }

    func createCalendarEvent(request: CreateCalendarEventRequest) async throws -> CalendarEvent {
        struct EventResponse: Codable {
            let success: Bool
            let event: CalendarEvent
        }
        let response: EventResponse = try await self.request(endpoint: "/calendar/events", method: .POST, body: request)
        return response.event
    }

    func deleteCalendarEvent(id: String) async throws {
        try await requestNoContent(endpoint: "/calendar/events/\(id)", method: .DELETE)
    }

    func getDeadlines(status: String? = nil, caseId: String? = nil) async throws -> DeadlinesResponse {
        var queryItems: [URLQueryItem] = []

        if let status = status {
            queryItems.append(URLQueryItem(name: "status", value: status))
        }
        if let caseId = caseId {
            queryItems.append(URLQueryItem(name: "case_id", value: caseId))
        }

        return try await request(endpoint: "/deadlines", queryItems: queryItems.isEmpty ? nil : queryItems)
    }

    func createDeadline(request: CreateDeadlineRequest) async throws -> Deadline {
        struct DeadlineResponse: Codable {
            let success: Bool
            let deadline: Deadline
        }
        let response: DeadlineResponse = try await self.request(endpoint: "/deadlines", method: .POST, body: request)
        return response.deadline
    }

    func completeDeadline(id: String) async throws {
        try await requestNoContent(endpoint: "/deadlines/\(id)/complete", method: .POST)
    }
}

// MARK: - Dashboard Service Extension
extension APIService {
    func getDashboardStats() async throws -> DashboardResponse {
        return try await request(endpoint: "/dashboard")
    }
}

// MARK: - AI Drafting Service Extension
extension APIService {
    func getAIDraftSessions() async throws -> AIDraftSessionsResponse {
        return try await request(endpoint: "/ai/drafts")
    }

    func getAIDraftSession(id: String) async throws -> AIDraftResponse {
        return try await request(endpoint: "/ai/drafts/\(id)")
    }

    func generateAIDraft(request: GenerateDraftRequest) async throws -> AIDraftResponse {
        return try await self.request(endpoint: "/ai/drafts/generate", method: .POST, body: request)
    }

    func reviseAIDraft(sessionId: String, request: ReviseDraftRequest) async throws -> AIDraftResponse {
        return try await self.request(endpoint: "/ai/drafts/\(sessionId)/revise", method: .POST, body: request)
    }

    func deleteAIDraft(id: String) async throws {
        try await requestNoContent(endpoint: "/ai/drafts/\(id)", method: .DELETE)
    }

    func getAIDraftTemplates() async throws -> AIDraftTemplatesResponse {
        return try await request(endpoint: "/ai/drafts/templates")
    }
}

// MARK: - AI Billing Suggestions Service Extension
extension APIService {
    func getBillingSuggestions(caseId: String? = nil) async throws -> AIBillingSuggestionsResponse {
        var queryItems: [URLQueryItem] = []
        if let caseId = caseId {
            queryItems.append(URLQueryItem(name: "case_id", value: caseId))
        }
        return try await request(endpoint: "/ai/billing/suggestions", queryItems: queryItems.isEmpty ? nil : queryItems)
    }

    func scanNotesForBilling(request: ScanNotesRequest) async throws -> AIBillingSuggestionsResponse {
        return try await self.request(endpoint: "/ai/billing/scan", method: .POST, body: request)
    }

    func acceptBillingSuggestion(id: Int) async throws {
        try await requestNoContent(endpoint: "/ai/billing/suggestions/\(id)/accept", method: .POST)
    }

    func rejectBillingSuggestion(id: Int) async throws {
        try await requestNoContent(endpoint: "/ai/billing/suggestions/\(id)/reject", method: .POST)
    }
}

// MARK: - Voice Transcription Service Extension
extension APIService {
    func getVoiceTranscriptions() async throws -> VoiceTranscriptionsResponse {
        return try await request(endpoint: "/ai/voice/transcriptions")
    }

    func getVoiceTranscription(id: Int) async throws -> VoiceTranscriptionResponse {
        return try await request(endpoint: "/ai/voice/transcriptions/\(id)")
    }

    func transcribeAudio(audioData: Data, request: TranscribeRequest) async throws -> VoiceTranscriptionResponse {
        // Note: This would need multipart form data upload in production
        return try await self.request(endpoint: "/ai/voice/transcribe", method: .POST, body: request)
    }

    func deleteVoiceTranscription(id: Int) async throws {
        try await requestNoContent(endpoint: "/ai/voice/transcriptions/\(id)", method: .DELETE)
    }
}

// MARK: - Document Summary Service Extension
extension APIService {
    func getDocumentSummaries() async throws -> DocumentSummariesResponse {
        return try await request(endpoint: "/ai/summaries")
    }

    func getDocumentSummary(id: Int) async throws -> DocumentSummaryResponse {
        return try await request(endpoint: "/ai/summaries/\(id)")
    }

    func summarizeDocument(request: SummarizeRequest) async throws -> DocumentSummaryResponse {
        return try await self.request(endpoint: "/ai/summarize", method: .POST, body: request)
    }

    func deleteDocumentSummary(id: Int) async throws {
        try await requestNoContent(endpoint: "/ai/summaries/\(id)", method: .DELETE)
    }
}

// MARK: - Contract Analysis Service Extension
extension APIService {
    func getContractAnalyses() async throws -> ContractAnalysesResponse {
        return try await request(endpoint: "/ai/contracts")
    }

    func getContractAnalysis(id: Int) async throws -> ContractAnalysisResponse {
        return try await request(endpoint: "/ai/contracts/\(id)")
    }

    func analyzeContract(request: AnalyzeContractRequest) async throws -> ContractAnalysisResponse {
        return try await self.request(endpoint: "/ai/contracts/analyze", method: .POST, body: request)
    }

    func deleteContractAnalysis(id: Int) async throws {
        try await requestNoContent(endpoint: "/ai/contracts/\(id)", method: .DELETE)
    }
}

// MARK: - AI Case Prediction Service Extension
extension APIService {
    func getCasePrediction(caseId: String) async throws -> AICasePredictionResponse {
        return try await request(endpoint: "/ai/cases/\(caseId)/prediction")
    }

    func generateCasePrediction(caseId: String) async throws -> AICasePredictionResponse {
        return try await self.request(endpoint: "/ai/cases/\(caseId)/predict", method: .POST)
    }
}

// MARK: - OCR Service Extension
extension APIService {
    func getOCRJobs() async throws -> OCRJobsResponse {
        return try await request(endpoint: "/ai/ocr")
    }

    func getOCRJob(id: Int) async throws -> OCRResponse {
        return try await request(endpoint: "/ai/ocr/\(id)")
    }

    func processOCR(fileData: Data, caseId: String?, clientId: String?) async throws -> OCRResponse {
        // Note: This would need multipart form data upload in production
        struct OCRRequest: Codable {
            let caseId: String?
            let clientId: String?
        }
        return try await self.request(endpoint: "/ai/ocr/process", method: .POST, body: OCRRequest(caseId: caseId, clientId: clientId))
    }

    func deleteOCRJob(id: Int) async throws {
        try await requestNoContent(endpoint: "/ai/ocr/\(id)", method: .DELETE)
    }
}

// MARK: - AI Communications Service Extension
extension APIService {
    func draftEmail(request: DraftEmailRequest) async throws -> AICommunicationResponse {
        return try await self.request(endpoint: "/ai/communications/draft-email", method: .POST, body: request)
    }
}

// MARK: - Citation Finder Service Extension
extension APIService {
    func searchCitations(request: CitationSearchRequest) async throws -> CitationSearchResponse {
        return try await self.request(endpoint: "/ai/citations/search", method: .POST, body: request)
    }
}

// MARK: - Conflict Check Service Extension
extension APIService {
    func checkConflicts(request: ConflictCheckRequest) async throws -> ConflictAnalysisResponse {
        return try await self.request(endpoint: "/ai/conflicts/check", method: .POST, body: request)
    }
}

// MARK: - AI Usage Stats Service Extension
extension APIService {
    func getAIUsageStats() async throws -> AIUsageResponse {
        return try await request(endpoint: "/ai/usage")
    }
}

// MARK: - Leads Service Extension
extension APIService {
    func getLeads(status: String? = nil) async throws -> LeadsResponse {
        var queryItems: [URLQueryItem] = []
        if let status = status {
            queryItems.append(URLQueryItem(name: "status", value: status))
        }
        return try await request(endpoint: "/leads", queryItems: queryItems.isEmpty ? nil : queryItems)
    }

    func getLead(id: String) async throws -> Lead {
        let response: SingleLeadResponse = try await request(endpoint: "/leads/\(id)")
        return response.lead
    }

    func createLead(request: CreateLeadRequest) async throws -> Lead {
        let response: SingleLeadResponse = try await self.request(endpoint: "/leads", method: .POST, body: request)
        return response.lead
    }

    func updateLead(id: String, request: CreateLeadRequest) async throws -> Lead {
        let response: SingleLeadResponse = try await self.request(endpoint: "/leads/\(id)", method: .PUT, body: request)
        return response.lead
    }

    func deleteLead(id: String) async throws {
        try await requestNoContent(endpoint: "/leads/\(id)", method: .DELETE)
    }

    func updateLeadStatus(id: String, status: String) async throws -> Lead {
        struct StatusRequest: Codable {
            let status: String
        }
        let response: SingleLeadResponse = try await self.request(endpoint: "/leads/\(id)/status", method: .PUT, body: StatusRequest(status: status))
        return response.lead
    }

    func getLeadActivities(leadId: String) async throws -> LeadActivitiesResponse {
        return try await request(endpoint: "/leads/\(leadId)/activities")
    }

    func addLeadActivity(leadId: String, type: String, description: String, notes: String?) async throws -> LeadActivity {
        struct ActivityRequest: Codable {
            let type: String
            let description: String
            let notes: String?
        }
        let response: SingleLeadActivityResponse = try await self.request(
            endpoint: "/leads/\(leadId)/activities",
            method: .POST,
            body: ActivityRequest(type: type, description: description, notes: notes)
        )
        return response.activity
    }

    func convertLeadToClient(leadId: String) async throws -> Client {
        let response: SingleClientResponse = try await self.request(endpoint: "/leads/\(leadId)/convert", method: .POST)
        return response.client
    }
}

// MARK: - Conflicts Database Service Extension
extension APIService {
    func getConflictParties(search: String? = nil) async throws -> ConflictPartiesResponse {
        var queryItems: [URLQueryItem] = []
        if let search = search {
            queryItems.append(URLQueryItem(name: "search", value: search))
        }
        return try await request(endpoint: "/conflicts/parties", queryItems: queryItems.isEmpty ? nil : queryItems)
    }

    func addConflictParty(request: CreateConflictPartyRequest) async throws -> ConflictParty {
        let response: SingleConflictPartyResponse = try await self.request(endpoint: "/conflicts/parties", method: .POST, body: request)
        return response.party
    }

    func runConflictCheck(request: RunConflictCheckRequest) async throws -> ConflictCheckResultResponse {
        return try await self.request(endpoint: "/conflicts/check", method: .POST, body: request)
    }

    func getConflictWaivers(conflictId: String) async throws -> ConflictWaiversResponse {
        return try await request(endpoint: "/conflicts/\(conflictId)/waivers")
    }

    func addConflictWaiver(conflictId: String, request: CreateConflictWaiverRequest) async throws -> ConflictWaiver {
        let response: SingleConflictWaiverResponse = try await self.request(
            endpoint: "/conflicts/\(conflictId)/waivers",
            method: .POST,
            body: request
        )
        return response.waiver
    }

    // Get all conflict check history
    func getConflictHistory() async throws -> ConflictChecksResponse {
        return try await request(endpoint: "/conflicts/history")
    }

    // Get all conflict waivers (without requiring a specific conflict ID)
    func getAllConflictWaivers() async throws -> ConflictWaiversResponse {
        return try await request(endpoint: "/conflicts/waivers")
    }
}

// MARK: - Trust Accounting Service Extension
extension APIService {
    func getTrustAccounts(clientId: String? = nil) async throws -> TrustAccountsResponse {
        var queryItems: [URLQueryItem] = []
        if let clientId = clientId {
            queryItems.append(URLQueryItem(name: "client_id", value: clientId))
        }
        return try await request(endpoint: "/trust/accounts", queryItems: queryItems.isEmpty ? nil : queryItems)
    }

    func getTrustAccount(id: String) async throws -> TrustAccount {
        let response: SingleTrustAccountResponse = try await request(endpoint: "/trust/accounts/\(id)")
        return response.account
    }

    func createTrustAccount(request: CreateTrustAccountRequest) async throws -> TrustAccount {
        let response: SingleTrustAccountResponse = try await self.request(endpoint: "/trust/accounts", method: .POST, body: request)
        return response.account
    }

    func getTrustLedger(accountId: String) async throws -> TrustLedgerResponse {
        return try await request(endpoint: "/trust/accounts/\(accountId)/ledger")
    }

    func addTrustLedgerEntry(accountId: String, request: CreateTrustLedgerEntryRequest) async throws -> TrustTransaction {
        let response: SingleTrustTransactionResponse = try await self.request(
            endpoint: "/trust/accounts/\(accountId)/ledger",
            method: .POST,
            body: request
        )
        return response.transaction
    }

    func getTrustTransactions(accountId: String) async throws -> TrustTransactionsResponse {
        return try await request(endpoint: "/trust/accounts/\(accountId)/transactions")
    }

    func reconcileTrustAccount(accountId: String, request: ReconcileTrustRequest) async throws -> Reconciliation {
        let response: SingleReconciliationResponse = try await self.request(
            endpoint: "/trust/accounts/\(accountId)/reconcile",
            method: .POST,
            body: request
        )
        return response.reconciliation
    }

    func getReconciliations() async throws -> ReconciliationsResponse {
        return try await request(endpoint: "/trust/reconciliations")
    }

    // Get ALL transactions across all accounts
    func getAllTrustTransactions() async throws -> TrustTransactionsResponse {
        return try await request(endpoint: "/trust/transactions")
    }

    // Get ALL ledger entries across all accounts
    func getAllTrustLedger() async throws -> TrustLedgerResponse {
        return try await request(endpoint: "/trust/ledger")
    }
}

// MARK: - Payments Service Extension
extension APIService {
    func createPaymentLink(invoiceId: String) async throws -> PaymentLinkResponse {
        return try await self.request(endpoint: "/invoices/\(invoiceId)/payment-link", method: .POST)
    }

    func getPaymentSettings() async throws -> PaymentSettingsResponse {
        return try await request(endpoint: "/payments/settings")
    }

    func updatePaymentSettings(request: UpdatePaymentSettingsRequest) async throws -> PaymentSettingsResponse {
        return try await self.request(endpoint: "/payments/settings", method: .PUT, body: request)
    }

    func getPaymentHistory(clientId: String? = nil, invoiceId: String? = nil) async throws -> PaymentHistoryResponse {
        var queryItems: [URLQueryItem] = []
        if let clientId = clientId {
            queryItems.append(URLQueryItem(name: "client_id", value: clientId))
        }
        if let invoiceId = invoiceId {
            queryItems.append(URLQueryItem(name: "invoice_id", value: invoiceId))
        }
        return try await request(endpoint: "/payments", queryItems: queryItems.isEmpty ? nil : queryItems)
    }

    func getPaymentPlans() async throws -> PaymentPlansResponse {
        return try await request(endpoint: "/payment-plans")
    }

    func getRefunds() async throws -> RefundsResponse {
        return try await request(endpoint: "/payments/refunds")
    }
}

// MARK: - Payment Plans Response
struct PaymentPlansResponse: Codable {
    let success: Bool
    let plans: [PaymentPlanAPI]
    let count: Int?
}

struct PaymentPlanAPI: Codable, Identifiable {
    let id: String
    var clientId: String?
    var clientName: String
    var invoiceId: String?
    var totalAmount: Double
    var paidAmount: Double
    var numberOfPayments: Int
    var paymentAmount: Double
    var frequency: String
    var startDate: Date?
    var nextPaymentDate: Date?
    var status: String
    var notes: String?
    var createdAt: Date?

    var remainingAmount: Double {
        totalAmount - paidAmount
    }

    var completedPayments: Int {
        guard paymentAmount > 0 else { return 0 }
        return Int(paidAmount / paymentAmount)
    }

    var remainingPayments: Int {
        numberOfPayments - completedPayments
    }

    var progressPercentage: Double {
        guard totalAmount > 0 else { return 0 }
        return (paidAmount / totalAmount) * 100
    }
}

// MARK: - Refunds Response
struct RefundsResponse: Codable {
    let success: Bool
    let refunds: [RefundAPI]
}

struct RefundAPI: Codable, Identifiable {
    let id: String
    var invoiceId: String?
    var invoiceNumber: String?
    var clientId: String?
    var firstName: String?
    var lastName: String?
    var companyName: String?
    var amount: Double
    var refundAmount: Double?
    var refundReason: String?
    var status: String
    var refundedAt: Date?
    var createdAt: Date?

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

// MARK: - Tasks Service Extension
extension APIService {
    func getTasks(status: String? = nil, caseId: String? = nil, assignedTo: String? = nil) async throws -> TasksResponse {
        var queryItems: [URLQueryItem] = []
        if let status = status {
            queryItems.append(URLQueryItem(name: "status", value: status))
        }
        if let caseId = caseId {
            queryItems.append(URLQueryItem(name: "case_id", value: caseId))
        }
        if let assignedTo = assignedTo {
            queryItems.append(URLQueryItem(name: "assigned_to", value: assignedTo))
        }
        return try await request(endpoint: "/tasks", queryItems: queryItems.isEmpty ? nil : queryItems)
    }

    func getTask(id: String) async throws -> TaskItem {
        let response: SingleTaskResponse = try await request(endpoint: "/tasks/\(id)")
        return response.task
    }

    func createTask(request: CreateTaskRequest) async throws -> TaskItem {
        let response: SingleTaskResponse = try await self.request(endpoint: "/tasks", method: .POST, body: request)
        return response.task
    }

    func updateTask(id: String, request: UpdateTaskRequest) async throws -> TaskItem {
        let response: SingleTaskResponse = try await self.request(endpoint: "/tasks/\(id)", method: .PUT, body: request)
        return response.task
    }

    func deleteTask(id: String) async throws {
        try await requestNoContent(endpoint: "/tasks/\(id)", method: .DELETE)
    }

    func completeTask(id: String) async throws -> TaskItem {
        let response: SingleTaskResponse = try await self.request(endpoint: "/tasks/\(id)/complete", method: .POST)
        return response.task
    }
}

// MARK: - AI OpenRouter Service Extension
extension APIService {
    // AI Email Drafting (uses OpenRouter)
    func aiDraftEmail(recipient: String, subject: String, context: String, tone: String = "professional") async throws -> AIEmailDraftResponse {
        struct Request: Codable {
            let recipient: String
            let subject: String
            let context: String
            let tone: String
        }
        return try await self.request(
            endpoint: "/ai/draft-email",
            method: .POST,
            body: Request(recipient: recipient, subject: subject, context: context, tone: tone)
        )
    }

    // AI Case Predictions (uses OpenRouter)
    func aiPredictCase(caseName: String, caseType: String, facts: String, jurisdiction: String) async throws -> AICasePredictionAPIResponse {
        struct Request: Codable {
            let caseName: String
            let caseType: String
            let facts: String
            let jurisdiction: String
        }
        return try await self.request(
            endpoint: "/ai/predict-case",
            method: .POST,
            body: Request(caseName: caseName, caseType: caseType, facts: facts, jurisdiction: jurisdiction)
        )
    }

    // AI Citation Finder (uses OpenRouter)
    func aiFindCitations(query: String, jurisdiction: String = "Federal") async throws -> AICitationFinderResponse {
        struct Request: Codable {
            let query: String
            let jurisdiction: String
        }
        return try await self.request(
            endpoint: "/ai/find-citations",
            method: .POST,
            body: Request(query: query, jurisdiction: jurisdiction)
        )
    }

    // AI Legal Research (uses OpenRouter)
    func aiLegalResearch(query: String) async throws -> AILegalResearchResponse {
        struct Request: Codable {
            let query: String
        }
        return try await self.request(
            endpoint: "/ai/legal-research",
            method: .POST,
            body: Request(query: query)
        )
    }

    // AI Document Summarization (uses OpenRouter)
    func aiSummarize(content: String, documentType: String = "legal document") async throws -> AISummarizeResponse {
        struct Request: Codable {
            let content: String
            let documentType: String
        }
        return try await self.request(
            endpoint: "/ai/summarize",
            method: .POST,
            body: Request(content: content, documentType: documentType)
        )
    }

    // AI Contract Analysis (uses OpenRouter)
    func aiAnalyzeContract(content: String) async throws -> AIContractAnalysisResponse {
        struct Request: Codable {
            let content: String
        }
        return try await self.request(
            endpoint: "/ai/analyze-contract",
            method: .POST,
            body: Request(content: content)
        )
    }
}

// MARK: - AI Response Types for OpenRouter
struct AIEmailDraftResponse: Codable {
    let success: Bool
    let draft: String?
    let error: String?
}

struct AICasePredictionAPIResponse: Codable {
    let success: Bool
    let prediction: CasePredictionData?
    let error: String?

    struct CasePredictionData: Codable {
        let winProbability: Double?
        let settlementRangeLow: Double?
        let settlementRangeHigh: Double?
        let timeToResolution: String?
        let keyFactors: [String]?
        let risks: [String]?
        let recommendations: [String]?
    }
}

struct AICitationFinderResponse: Codable {
    let success: Bool
    let citations: [CitationData]?
    let error: String?

    struct CitationData: Codable {
        let caseName: String?
        let citation: String?
        let year: Int?
        let court: String?
        let relevance: Double?
        let keyHolding: String?
    }
}

struct AILegalResearchResponse: Codable {
    let success: Bool
    let research: ResearchData?
    let summary: String?
    let keyPoints: [String]?
    let error: String?

    struct ResearchData: Codable {
        let summary: String?
        let keyPoints: [String]?
        let relevantStatutes: [String]?
        let caseReferences: [CaseRef]?
        let practicalConsiderations: [String]?

        struct CaseRef: Codable {
            let name: String?
            let holding: String?
        }
    }
}

struct AISummarizeResponse: Codable {
    let success: Bool
    let summary: String?
    let keyPoints: [String]?
    let parties: [String]?
    let dates: [String]?
    let obligations: [String]?
    let risks: [String]?
    let error: String?
}

struct AIContractAnalysisResponse: Codable {
    let success: Bool
    let overallRisk: String?
    let riskScore: Int?
    let summary: String?
    let clauses: [ClauseData]?
    let missingClauses: [String]?
    let recommendations: [String]?
    let keyTerms: [KeyTermData]?
    let error: String?

    struct ClauseData: Codable {
        let name: String?
        let type: String?
        let risk: String?
        let summary: String?
    }

    struct KeyTermData: Codable {
        let term: String?
        let definition: String?
        let concern: String?
    }
}

// MARK: - Leads Analytics Service Extension
extension APIService {
    func getLeadsAnalytics() async throws -> LeadsAnalyticsResponse {
        return try await request(endpoint: "/leads/analytics")
    }
}

struct LeadsAnalyticsResponse: Codable {
    let success: Bool
    let totalLeads: Int?
    let converted: Int?
    let conversionRate: String?
    let byStatus: [StatusCount]?
    let bySource: [SourceCount]?

    struct StatusCount: Codable {
        let status: String?
        let count: Int?
    }

    struct SourceCount: Codable {
        let source: String?
        let count: Int?
    }
}

// MARK: - Expenses Service Extension
extension APIService {
    func getExpenses() async throws -> ExpensesResponse {
        return try await request(endpoint: "/expenses")
    }

    func createExpense(description: String, amount: Double, category: String, caseId: String?, billable: Bool, date: String) async throws -> CreateExpenseResponse {
        struct Request: Codable {
            let description: String
            let amount: Double
            let category: String
            let case_id: String?
            let billable: Bool
            let date: String
        }
        return try await self.request(
            endpoint: "/expenses",
            method: .POST,
            body: Request(description: description, amount: amount, category: category, case_id: caseId, billable: billable, date: date)
        )
    }
}

struct ExpensesResponse: Codable {
    let success: Bool
    let expenses: [ExpenseData]?

    struct ExpenseData: Codable {
        let id: Int?
        let description: String?
        let amount: Double?
        let category: String?
        let case_id: String?
        let billable: Int?
        let date: String?
        let created_at: String?
    }
}

struct CreateExpenseResponse: Codable {
    let success: Bool
    let id: Int?
}

// MARK: - Reports Summary Service Extension
extension APIService {
    func getReportsSummary() async throws -> ReportsSummaryResponse {
        return try await request(endpoint: "/api/reports/summary")
    }
}

struct ReportsSummaryResponse: Codable {
    let success: Bool
    let totalRevenue: Double?
    let totalHours: Double?
    let activeCases: Int?
    let outstandingAr: Double?
    let totalCases: Int?
    let totalClients: Int?
}

// MARK: - Deadlines Database Service Extension
extension APIService {
    func getDeadlinesFromDB() async throws -> DeadlinesDBResponse {
        return try await request(endpoint: "/deadlines")
    }
}

struct DeadlinesDBResponse: Codable {
    let success: Bool
    let deadlines: [DeadlineDBData]?

    struct DeadlineDBData: Codable {
        let id: Int?
        let title: String?
        let description: String?
        let due_date: String?
        let case_id: String?
        let priority: String?
        let status: String?
    }
}

// MARK: - Messages Database Service Extension
extension APIService {
    func getMessages() async throws -> MessagesDBResponse {
        return try await request(endpoint: "/messages")
    }

    func createMessage(fromName: String, subject: String, content: String, clientId: String?) async throws -> CreateMessageResponse {
        struct Request: Codable {
            let from_name: String
            let subject: String
            let content: String
            let client_id: String?
        }
        return try await self.request(
            endpoint: "/messages",
            method: .POST,
            body: Request(from_name: fromName, subject: subject, content: content, client_id: clientId)
        )
    }
}

struct MessagesDBResponse: Codable {
    let success: Bool
    let messages: [MessageData]?

    struct MessageData: Codable {
        let id: Int?
        let from_name: String?
        let subject: String?
        let content: String?
        let client_id: String?
        let is_read: Int?
        let created_at: String?
    }
}

struct CreateMessageResponse: Codable {
    let success: Bool
    let id: Int?
}

// MARK: - Communications API Extension
extension APIService {
    func getCommunicationMessages() async throws -> MessagesResponse {
        return try await request(endpoint: "/communications/api/messages")
    }

    func getNotes() async throws -> NotesResponse {
        return try await request(endpoint: "/notes")
    }

    func getNotifications() async throws -> NotificationsResponse {
        return try await request(endpoint: "/communications/api/notifications")
    }

    func markMessageAsRead(id: String) async throws {
        let _: EmptyResponse = try await request(endpoint: "/communications/api/messages/\(id)/read", method: .PUT)
    }

    func markNotificationAsRead(id: String) async throws {
        let _: EmptyResponse = try await request(endpoint: "/communications/api/notifications/\(id)/read", method: .PUT)
    }
}

struct EmptyResponse: Codable {
    let success: Bool?
}

// MARK: - Additional Reports API Extension
extension APIService {
    func getRevenueReport(period: String = "month", groupBy: String = "client") async throws -> RevenueReportResponse {
        return try await request(endpoint: "/api/reports/revenue?period=\(period)&group_by=\(groupBy)")
    }

    func getProductivityReport(period: String = "month") async throws -> ProductivityReportResponse {
        return try await request(endpoint: "/api/reports/productivity?period=\(period)")
    }

    func getCasesReport() async throws -> CasesReportResponse {
        return try await request(endpoint: "/api/reports/cases")
    }

    func getClientsReport() async throws -> ClientsReportResponse {
        return try await request(endpoint: "/api/reports/clients")
    }

    func getARAgingReport() async throws -> ARAgingResponse {
        return try await request(endpoint: "/api/reports/aging")
    }
}

// MARK: - Stripe API Extension
extension APIService {
    func getStripePaymentMethods() async throws -> StripePaymentMethodsResponse {
        return try await request(endpoint: "/api/stripe/payment-methods")
    }

    func createStripeSetupIntent() async throws -> StripeSetupIntentResponse {
        return try await request(endpoint: "/api/stripe/setup-intent", method: .POST)
    }
}
