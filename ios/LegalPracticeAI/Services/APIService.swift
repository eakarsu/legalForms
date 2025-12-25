//
//  APIService.swift
//  LegalPracticeAI
//
//  Network layer using URLSession
//

import Foundation

// MARK: - API Configuration
enum APIConfig {
    #if DEBUG
    static let baseURL = "http://localhost:3000/api"
    #else
    static let baseURL = "https://api.legalpracticeai.com/api"
    #endif

    static let timeout: TimeInterval = 30
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
        self.decoder.dateDecodingStrategy = .iso8601
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

        // Build request
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        // Add auth token if available
        if let token = KeychainService.shared.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
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

        // Handle status codes
        switch httpResponse.statusCode {
        case 200...299:
            break
        case 401:
            throw APIServiceError.unauthorized
        case 404:
            throw APIServiceError.notFound
        default:
            let message = try? decoder.decode(APIError.self, from: data).message
            throw APIServiceError.serverError(httpResponse.statusCode, message)
        }

        // Decode response
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
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
}

// MARK: - Document Service Extension
extension APIService {
    func getDocuments(page: Int = 1, limit: Int = 20, category: DocumentCategory? = nil) async throws -> DocumentsResponse {
        var queryItems = [
            URLQueryItem(name: "page", value: String(page)),
            URLQueryItem(name: "limit", value: String(limit))
        ]

        if let category = category {
            queryItems.append(URLQueryItem(name: "category", value: category.rawValue))
        }

        return try await request(endpoint: "/documents/history", queryItems: queryItems)
    }

    func getDocument(id: String) async throws -> Document {
        return try await request(endpoint: "/documents/\(id)")
    }

    func generateDocument(request: GenerateDocumentRequest) async throws -> Document {
        return try await self.request(endpoint: "/documents/generate", method: .POST, body: request)
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
        return try await request(endpoint: "/clients/\(id)")
    }

    func createClient(request: CreateClientRequest) async throws -> Client {
        return try await self.request(endpoint: "/clients", method: .POST, body: request)
    }

    func updateClient(id: String, request: CreateClientRequest) async throws -> Client {
        return try await self.request(endpoint: "/clients/\(id)", method: .PUT, body: request)
    }

    func deleteClient(id: String) async throws {
        try await requestNoContent(endpoint: "/clients/\(id)", method: .DELETE)
    }
}
