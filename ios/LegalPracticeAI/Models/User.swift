//
//  User.swift
//  LegalPracticeAI
//
//  User model and related types
//

import Foundation

// MARK: - User Model
struct User: Codable, Identifiable {
    let id: String
    let email: String
    let name: String
    var avatar: String?
    var subscription: SubscriptionType
    let createdAt: Date

    enum SubscriptionType: String, Codable {
        case free
        case pro
        case enterprise
    }
}

// MARK: - Auth Response
struct AuthResponse: Codable {
    let user: User
    let token: String
}

// MARK: - Login Request
struct LoginRequest: Codable {
    let email: String
    let password: String
}

// MARK: - Register Request
struct RegisterRequest: Codable {
    let name: String
    let email: String
    let password: String
}

// MARK: - API Error
struct APIError: Codable, Error {
    let message: String
    let code: String?
}

// MARK: - Generic API Response
struct APIResponse<T: Codable>: Codable {
    let success: Bool
    let data: T?
    let error: APIError?
}
