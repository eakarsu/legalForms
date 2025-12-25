//
//  LoginView.swift
//  LegalPracticeAI
//
//  Login screen
//

import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false
    @FocusState private var focusedField: Field?

    enum Field {
        case email, password
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.lg) {
                // Title
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text("Welcome Back")
                        .font(.largeTitle)
                        .fontWeight(.bold)

                    Text("Sign in to access your documents and clients")
                        .font(.body)
                        .foregroundColor(.secondary)
                }
                .padding(.top, AppSpacing.lg)

                // Error Message
                if let error = authViewModel.error {
                    HStack {
                        Image(systemName: "exclamationmark.circle.fill")
                            .foregroundColor(.red)

                        Text(error)
                            .font(.subheadline)
                            .foregroundColor(.red)

                        Spacer()

                        Button {
                            authViewModel.clearError()
                        } label: {
                            Image(systemName: "xmark")
                                .foregroundColor(.red)
                        }
                    }
                    .padding()
                    .background(Color.red.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                }

                // Form
                VStack(spacing: AppSpacing.md) {
                    // Email
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text("Email")
                            .font(.subheadline)
                            .fontWeight(.medium)

                        HStack {
                            Image(systemName: "envelope")
                                .foregroundColor(.secondary)

                            TextField("Enter your email", text: $email)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .autocapitalization(.none)
                                .focused($focusedField, equals: .email)
                        }
                        .padding()
                        .background(Color.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                    }

                    // Password
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text("Password")
                            .font(.subheadline)
                            .fontWeight(.medium)

                        HStack {
                            Image(systemName: "lock")
                                .foregroundColor(.secondary)

                            if showPassword {
                                TextField("Enter your password", text: $password)
                                    .focused($focusedField, equals: .password)
                            } else {
                                SecureField("Enter your password", text: $password)
                                    .focused($focusedField, equals: .password)
                            }

                            Button {
                                showPassword.toggle()
                            } label: {
                                Image(systemName: showPassword ? "eye.slash" : "eye")
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding()
                        .background(Color.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                    }

                    // Forgot Password
                    HStack {
                        Spacer()
                        NavigationLink("Forgot Password?") {
                            ForgotPasswordView()
                        }
                        .font(.subheadline)
                        .fontWeight(.medium)
                    }
                }

                // Sign In Button
                Button {
                    Task {
                        await authViewModel.login(email: email, password: password)
                    }
                } label: {
                    HStack {
                        if authViewModel.isLoading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            Text("Sign In")
                                .fontWeight(.semibold)
                        }
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(Color.accentColor)
                    .clipShape(Capsule())
                }
                .disabled(authViewModel.isLoading)
                .padding(.top, AppSpacing.sm)

                // Divider
                HStack {
                    Rectangle()
                        .frame(height: 1)
                        .foregroundColor(.secondary.opacity(0.3))

                    Text("or continue with")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Rectangle()
                        .frame(height: 1)
                        .foregroundColor(.secondary.opacity(0.3))
                }
                .padding(.vertical, AppSpacing.md)

                // Social Login
                HStack(spacing: AppSpacing.md) {
                    SocialLoginButton(provider: .google)
                    SocialLoginButton(provider: .apple)
                }

                // Register Link
                HStack {
                    Spacer()
                    Text("Don't have an account?")
                        .foregroundColor(.secondary)
                    NavigationLink("Sign Up") {
                        RegisterView()
                    }
                    .fontWeight(.semibold)
                    Spacer()
                }
                .padding(.top, AppSpacing.lg)
            }
            .padding(.horizontal, AppSpacing.lg)
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "arrow.left")
                        .foregroundColor(.primary)
                }
            }
        }
    }
}

// MARK: - Social Login Button
struct SocialLoginButton: View {
    enum Provider {
        case google, apple, microsoft

        var name: String {
            switch self {
            case .google: return "Google"
            case .apple: return "Apple"
            case .microsoft: return "Microsoft"
            }
        }

        var icon: String {
            switch self {
            case .google: return "g.circle.fill"
            case .apple: return "apple.logo"
            case .microsoft: return "rectangle.stack.fill"
            }
        }
    }

    let provider: Provider

    var body: some View {
        Button {
            // Handle social login
        } label: {
            HStack {
                Image(systemName: provider.icon)
                Text(provider.name)
                    .fontWeight(.medium)
            }
            .foregroundColor(.primary)
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(Color.cardBackground)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(Color.secondary.opacity(0.3), lineWidth: 1)
            )
        }
    }
}

// MARK: - Preview
#Preview {
    NavigationStack {
        LoginView()
            .environmentObject(AuthViewModel())
    }
}
