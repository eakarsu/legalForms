//
//  KeychainService.swift
//  LegalPracticeAI
//
//  Secure storage using iOS Keychain
//

import Foundation
import Security

// MARK: - Keychain Service
final class KeychainService {
    static let shared = KeychainService()

    private let service = "com.legalpracticeai.ios"

    private enum Keys {
        static let token = "auth_token"
        static let user = "user_data"
    }

    private init() {}

    // MARK: - Token Management
    func saveToken(_ token: String) -> Bool {
        guard let data = token.data(using: .utf8) else { return false }
        return save(data: data, forKey: Keys.token)
    }

    func getToken() -> String? {
        guard let data = getData(forKey: Keys.token) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func deleteToken() {
        delete(forKey: Keys.token)
    }

    // MARK: - User Management
    func saveUser(_ user: User) -> Bool {
        guard let data = try? JSONEncoder().encode(user) else { return false }
        return save(data: data, forKey: Keys.user)
    }

    func getUser() -> User? {
        guard let data = getData(forKey: Keys.user) else { return nil }
        return try? JSONDecoder().decode(User.self, from: data)
    }

    func deleteUser() {
        delete(forKey: Keys.user)
    }

    // MARK: - Clear All
    func clearAll() {
        deleteToken()
        deleteUser()
    }

    // MARK: - Private Methods
    private func save(data: Data, forKey key: String) -> Bool {
        // Delete existing item first
        delete(forKey: key)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    }

    private func getData(forKey key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess else { return nil }
        return result as? Data
    }

    private func delete(forKey key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]

        SecItemDelete(query as CFDictionary)
    }
}
