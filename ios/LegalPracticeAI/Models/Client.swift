//
//  Client.swift
//  LegalPracticeAI
//
//  Client model and related types
//

import Foundation

// MARK: - Client Model
struct Client: Codable, Identifiable {
    let id: String
    var clientType: String?
    var firstName: String?
    var lastName: String?
    var companyName: String?
    var email: String?
    var phone: String?
    var address: String?
    var city: String?
    var state: String?
    var zip: String?
    var notes: String?
    var status: String?
    let createdAt: Date?
    var updatedAt: Date?

    // CodingKeys - standard snake_case is handled automatically by APIService decoder
    enum CodingKeys: String, CodingKey {
        case id
        case clientType          // auto: client_type → clientType
        case firstName           // auto: first_name → firstName
        case lastName            // auto: last_name → lastName
        case companyName         // auto: company_name → companyName
        case email, phone, address, city, state, zip, notes, status
        case createdAt           // auto: created_at → createdAt
        case updatedAt           // auto: updated_at → updatedAt
    }

    // Computed property for display name
    var displayName: String {
        if clientType == "business", let company = companyName, !company.isEmpty {
            return company
        }
        let first = firstName ?? ""
        let last = lastName ?? ""
        let fullName = "\(first) \(last)".trimmingCharacters(in: .whitespaces)
        return fullName.isEmpty ? "Unknown Client" : fullName
    }

    var initials: String {
        let components = displayName.split(separator: " ")
        let initials = components.prefix(2).compactMap { $0.first }
        let result = String(initials).uppercased()
        return result.isEmpty ? "?" : result
    }

}

// MARK: - Create Client Request
struct CreateClientRequest: Codable {
    let clientType: String
    let firstName: String?
    let lastName: String?
    let companyName: String?
    let email: String?
    let phone: String?
    let address: String?
    let city: String?
    let state: String?
    let zip: String?
    let notes: String?
}

// MARK: - Clients Response
struct ClientsResponse: Codable {
    let success: Bool
    let clients: [Client]
    let count: Int
}
