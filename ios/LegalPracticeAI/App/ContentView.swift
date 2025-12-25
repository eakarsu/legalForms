//
//  ContentView.swift
//  LegalPracticeAI
//
//  Root view that handles navigation between auth and main app
//

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authViewModel: AuthViewModel

    var body: some View {
        Group {
            if authViewModel.isAuthenticated {
                MainTabView()
            } else {
                AuthNavigationView()
            }
        }
        .animation(.easeInOut, value: authViewModel.isAuthenticated)
    }
}

// MARK: - Preview
#Preview {
    ContentView()
        .environmentObject(AuthViewModel())
        .environmentObject(ThemeManager())
}
