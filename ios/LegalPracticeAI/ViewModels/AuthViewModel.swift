//
//  AuthViewModel.swift
//  LegalPracticeAI
//
//  Authentication state management
//

import Foundation
import SwiftUI

@MainActor
final class AuthViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published var user: User?
    @Published var isAuthenticated = false
    @Published var isLoading = true
    @Published var error: String?

    // MARK: - Private
    private let api = APIService.shared
    private let keychain = KeychainService.shared

    // MARK: - Init
    init() {
        Task {
            await checkAuth()
        }
    }

    // MARK: - Check Existing Auth
    func checkAuth() async {
        isLoading = true

        // Check for stored token
        guard keychain.getToken() != nil else {
            isLoading = false
            return
        }

        // Verify token with server
        do {
            let user = try await api.verifyToken()
            self.user = user
            self.isAuthenticated = true
        } catch {
            // Token invalid, clear storage
            keychain.clearAll()
        }

        isLoading = false
    }

    // MARK: - Login
    func login(email: String, password: String) async -> Bool {
        guard !email.isEmpty, !password.isEmpty else {
            self.error = "Please enter email and password"
            return false
        }

        isLoading = true
        error = nil

        do {
            let response = try await api.login(email: email, password: password)

            // Save to keychain
            _ = keychain.saveToken(response.token)
            _ = keychain.saveUser(response.user)

            self.user = response.user
            self.isAuthenticated = true
            isLoading = false
            return true
        } catch let apiError as APIServiceError {
            self.error = apiError.localizedDescription
            isLoading = false
            return false
        } catch {
            self.error = "Login failed. Please try again."
            isLoading = false
            return false
        }
    }

    // MARK: - Register
    func register(name: String, email: String, password: String) async -> Bool {
        guard !name.isEmpty, !email.isEmpty, !password.isEmpty else {
            self.error = "Please fill in all fields"
            return false
        }

        guard password.count >= 8 else {
            self.error = "Password must be at least 8 characters"
            return false
        }

        isLoading = true
        error = nil

        do {
            let response = try await api.register(name: name, email: email, password: password)

            _ = keychain.saveToken(response.token)
            _ = keychain.saveUser(response.user)

            self.user = response.user
            self.isAuthenticated = true
            isLoading = false
            return true
        } catch let apiError as APIServiceError {
            self.error = apiError.localizedDescription
            isLoading = false
            return false
        } catch {
            self.error = "Registration failed. Please try again."
            isLoading = false
            return false
        }
    }

    // MARK: - Logout
    func logout() async {
        isLoading = true

        do {
            try await api.logout()
        } catch {
            // Continue with local logout even if API fails
        }

        keychain.clearAll()
        user = nil
        isAuthenticated = false
        isLoading = false
    }

    // MARK: - Clear Error
    func clearError() {
        error = nil
    }
}
