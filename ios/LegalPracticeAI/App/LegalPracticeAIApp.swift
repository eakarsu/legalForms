//
//  LegalPracticeAIApp.swift
//  LegalPracticeAI
//
//  Native iOS app for legal document generation
//

import SwiftUI

@main
struct LegalPracticeAIApp: App {
    @StateObject private var authViewModel = AuthViewModel()
    @StateObject private var themeManager = ThemeManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authViewModel)
                .environmentObject(themeManager)
                .preferredColorScheme(themeManager.colorScheme)
        }
    }
}
