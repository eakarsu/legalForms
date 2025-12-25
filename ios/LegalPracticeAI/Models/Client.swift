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
    var name: String
    var email: String
    var phone: String?
    var company: String?
    var address: String?
    var notes: String?
    let createdAt: Date

    var initials: String {
        let components = name.split(separator: " ")
        let initials = components.prefix(2).compactMap { $0.first }
        return String(initials).uppercased()
    }
}

// MARK: - Create Client Request
struct CreateClientRequest: Codable {
    let name: String
    let email: String
    let phone: String?
    let company: String?
    let address: String?
    let notes: String?
}

// MARK: - Clients Response
struct ClientsResponse: Codable {
    let clients: [Client]
    let total: Int
}
