//
//  AuthNavigationView.swift
//  LegalPracticeAI
//
//  Authentication navigation container
//

import SwiftUI

struct AuthNavigationView: View {
    var body: some View {
        NavigationStack {
            WelcomeView()
        }
    }
}

// MARK: - Welcome View
struct WelcomeView: View {
    var body: some View {
        ZStack {
            // Background
            LinearGradient.primaryGradient
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Top Section
                VStack(spacing: AppSpacing.lg) {
                    // Logo
                    HStack {
                        Image(systemName: "scale.3d")
                            .font(.system(size: 28))
                            .foregroundColor(.accentColor)
                            .frame(width: 48, height: 48)
                            .background(Color.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))

                        Text("LegalPractice")
                            .font(.title2)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                        + Text("AI")
                            .font(.title2)
                            .fontWeight(.bold)
                            .foregroundColor(.white.opacity(0.7))

                        Spacer()
                    }
                    .padding(.horizontal)

                    // Hero Content
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("Professional Legal\nDocuments with AI")
                            .font(.system(size: 36, weight: .bold))
                            .foregroundColor(.white)
                            .lineSpacing(4)

                        Text("Generate accurate legal documents in minutes.\nBusiness formation, real estate, family law & more.")
                            .font(.body)
                            .foregroundColor(.white.opacity(0.85))
                            .lineSpacing(4)
                    }
                    .padding(.horizontal)

                    // Features
                    VStack(alignment: .leading, spacing: AppSpacing.sm) {
                        FeatureItem(text: "36+ Document Templates")
                        FeatureItem(text: "AI-Powered Generation")
                        FeatureItem(text: "State Compliance")
                    }
                    .padding(.horizontal)

                    Spacer()
                }
                .padding(.top, AppSpacing.xxl)

                // Bottom Section
                VStack(spacing: AppSpacing.md) {
                    NavigationLink(destination: RegisterView()) {
                        Text("Get Started Free")
                            .font(.headline)
                            .foregroundColor(.accentColor)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .background(Color.white)
                            .clipShape(Capsule())
                    }

                    NavigationLink(destination: LoginView()) {
                        Text("Sign In")
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .background(Color.white.opacity(0.2))
                            .clipShape(Capsule())
                            .overlay(
                                Capsule()
                                    .stroke(Color.white, lineWidth: 2)
                            )
                    }

                    Text("By continuing, you agree to our Terms of Service and Privacy Policy")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.7))
                        .multilineTextAlignment(.center)
                        .padding(.top, AppSpacing.sm)
                }
                .padding(.horizontal, AppSpacing.lg)
                .padding(.bottom, AppSpacing.xl)
                .padding(.top, AppSpacing.xl)
                .background(
                    Color.white
                        .clipShape(RoundedCorner(radius: 30, corners: [.topLeft, .topRight]))
                        .ignoresSafeArea()
                        .shadow(color: .black.opacity(0.1), radius: 20, y: -10)
                )
            }
        }
        .navigationBarHidden(true)
    }
}

// MARK: - Feature Item
struct FeatureItem: View {
    let text: String

    var body: some View {
        HStack(spacing: AppSpacing.sm) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(.green)

            Text(text)
                .font(.body)
                .fontWeight(.medium)
                .foregroundColor(.white)
        }
    }
}

// MARK: - Rounded Corner Helper
struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}

// MARK: - Preview
#Preview {
    AuthNavigationView()
}
