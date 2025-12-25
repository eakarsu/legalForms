//
//  RegisterView.swift
//  LegalPracticeAI
//
//  Registration screen
//

import SwiftUI

struct RegisterView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var showPassword = false
    @State private var acceptTerms = false

    var isFormValid: Bool {
        !name.isEmpty &&
        !email.isEmpty &&
        password.count >= 8 &&
        password == confirmPassword &&
        acceptTerms
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.lg) {
                // Title
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text("Create Account")
                        .font(.largeTitle)
                        .fontWeight(.bold)

                    Text("Start generating professional legal documents")
                        .font(.body)
                        .foregroundColor(.secondary)
                }
                .padding(.top, AppSpacing.lg)

                // Error Message
                if let error = authViewModel.error {
                    ErrorBanner(message: error) {
                        authViewModel.clearError()
                    }
                }

                // Form
                VStack(spacing: AppSpacing.md) {
                    // Name
                    FormField(
                        title: "Full Name",
                        icon: "person",
                        text: $name,
                        placeholder: "Enter your full name"
                    )

                    // Email
                    FormField(
                        title: "Email",
                        icon: "envelope",
                        text: $email,
                        placeholder: "Enter your email",
                        keyboardType: .emailAddress
                    )

                    // Password
                    SecureFormField(
                        title: "Password",
                        text: $password,
                        showPassword: $showPassword,
                        placeholder: "Create a password (min 8 characters)"
                    )

                    // Confirm Password
                    SecureFormField(
                        title: "Confirm Password",
                        text: $confirmPassword,
                        showPassword: $showPassword,
                        placeholder: "Confirm your password"
                    )

                    // Password Requirements
                    if !password.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            RequirementRow(
                                text: "At least 8 characters",
                                isMet: password.count >= 8
                            )
                            RequirementRow(
                                text: "Passwords match",
                                isMet: !confirmPassword.isEmpty && password == confirmPassword
                            )
                        }
                        .padding(.horizontal, AppSpacing.xs)
                    }

                    // Terms
                    HStack(alignment: .top, spacing: AppSpacing.sm) {
                        Button {
                            acceptTerms.toggle()
                        } label: {
                            Image(systemName: acceptTerms ? "checkmark.square.fill" : "square")
                                .font(.title3)
                                .foregroundColor(acceptTerms ? .accentColor : .secondary)
                        }

                        Text("I agree to the ")
                            .foregroundColor(.secondary)
                        + Text("Terms of Service")
                            .foregroundColor(.accentColor)
                        + Text(" and ")
                            .foregroundColor(.secondary)
                        + Text("Privacy Policy")
                            .foregroundColor(.accentColor)
                    }
                    .font(.subheadline)
                    .padding(.top, AppSpacing.sm)
                }

                // Create Account Button
                Button {
                    Task {
                        await authViewModel.register(name: name, email: email, password: password)
                    }
                } label: {
                    HStack {
                        if authViewModel.isLoading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            Text("Create Account")
                                .fontWeight(.semibold)
                        }
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(isFormValid ? Color.accentColor : Color.gray)
                    .clipShape(Capsule())
                }
                .disabled(!isFormValid || authViewModel.isLoading)
                .padding(.top, AppSpacing.md)

                // Login Link
                HStack {
                    Spacer()
                    Text("Already have an account?")
                        .foregroundColor(.secondary)
                    NavigationLink("Sign In") {
                        LoginView()
                    }
                    .fontWeight(.semibold)
                    Spacer()
                }
                .padding(.top, AppSpacing.lg)
                .padding(.bottom, AppSpacing.xl)
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

// MARK: - Form Field
struct FormField: View {
    let title: String
    let icon: String
    @Binding var text: String
    var placeholder: String = ""
    var keyboardType: UIKeyboardType = .default

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Text(title)
                .font(.subheadline)
                .fontWeight(.medium)

            HStack {
                Image(systemName: icon)
                    .foregroundColor(.secondary)

                TextField(placeholder, text: $text)
                    .keyboardType(keyboardType)
                    .autocapitalization(keyboardType == .emailAddress ? .none : .words)
            }
            .padding()
            .background(Color.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
        }
    }
}

// MARK: - Secure Form Field
struct SecureFormField: View {
    let title: String
    @Binding var text: String
    @Binding var showPassword: Bool
    var placeholder: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Text(title)
                .font(.subheadline)
                .fontWeight(.medium)

            HStack {
                Image(systemName: "lock")
                    .foregroundColor(.secondary)

                if showPassword {
                    TextField(placeholder, text: $text)
                } else {
                    SecureField(placeholder, text: $text)
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
    }
}

// MARK: - Requirement Row
struct RequirementRow: View {
    let text: String
    let isMet: Bool

    var body: some View {
        HStack(spacing: AppSpacing.xs) {
            Image(systemName: isMet ? "checkmark.circle.fill" : "circle")
                .font(.caption)
                .foregroundColor(isMet ? .green : .secondary)

            Text(text)
                .font(.caption)
                .foregroundColor(isMet ? .primary : .secondary)
        }
    }
}

// MARK: - Error Banner
struct ErrorBanner: View {
    let message: String
    let onDismiss: () -> Void

    var body: some View {
        HStack {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundColor(.red)

            Text(message)
                .font(.subheadline)
                .foregroundColor(.red)

            Spacer()

            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .foregroundColor(.red)
            }
        }
        .padding()
        .background(Color.red.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
    }
}

// MARK: - Preview
#Preview {
    NavigationStack {
        RegisterView()
            .environmentObject(AuthViewModel())
    }
}
