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
            if authViewModel.isLoading {
                SplashView()
            } else if authViewModel.isAuthenticated {
                MainTabView()
            } else {
                AuthNavigationView()
            }
        }
        .animation(.easeInOut, value: authViewModel.isAuthenticated)
    }
}

// MARK: - Splash View
struct SplashView: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color.accentColor, Color.purple],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 20) {
                Image(systemName: "scale.3d")
                    .font(.system(size: 60))
                    .foregroundColor(.white)

                Text("LegalPracticeAI")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .foregroundColor(.white)

                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    .scaleEffect(1.2)
            }
        }
    }
}

// MARK: - Preview
#Preview {
    ContentView()
        .environmentObject(AuthViewModel())
        .environmentObject(ThemeManager())
}
