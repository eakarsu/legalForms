//
//  Config.swift
//  LegalPracticeAI
//
//  Central configuration for the app - reads from Configuration.plist
//

import Foundation

enum Config {
    // MARK: - API Configuration
    static var apiBaseURL: String {
        getValue(for: "API_BASE_URL") ?? "http://localhost:3000"
    }

    // MARK: - OAuth Configuration
    static var googleClientID: String {
        getValue(for: "GOOGLE_CLIENT_ID") ?? ""
    }

    static var microsoftClientID: String {
        getValue(for: "MICROSOFT_CLIENT_ID") ?? ""
    }

    static var googleRedirectURI: String {
        getValue(for: "GOOGLE_REDIRECT_URI") ?? "com.legalpracticeai.ios:/oauth2callback"
    }

    static var microsoftRedirectURI: String {
        getValue(for: "MICROSOFT_REDIRECT_URI") ?? "msauth.com.legalpracticeai.ios://auth"
    }

    // MARK: - Private Helper
    private static func getValue(for key: String) -> String? {
        // First try Configuration.plist
        if let path = Bundle.main.path(forResource: "Configuration", ofType: "plist"),
           let config = NSDictionary(contentsOfFile: path),
           let value = config[key] as? String,
           !value.isEmpty {
            return value
        }

        // Fallback to Info.plist
        return Bundle.main.infoDictionary?[key] as? String
    }
}
