//
//  ForgotPasswordView.swift
//  LegalPracticeAI
//
//  Forgot password screen
//

import SwiftUI

struct ForgotPasswordView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var isLoading = false
    @State private var isSuccess = false
    @State private var error: String?

    var body: some View {
        if isSuccess {
            SuccessView(email: email) {
                dismiss()
            }
        } else {
            FormView(
                email: $email,
                isLoading: $isLoading,
                error: $error,
                onSubmit: handleSubmit,
                onDismiss: { dismiss() }
            )
        }
    }

    private func handleSubmit() {
        guard !email.isEmpty else {
            error = "Please enter your email"
            return
        }

        isLoading = true
        error = nil

        // Simulate API call
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            isLoading = false
            isSuccess = true
        }
    }
}

// MARK: - Form View
private struct FormView: View {
    @Binding var email: String
    @Binding var isLoading: Bool
    @Binding var error: String?
    let onSubmit: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(spacing: AppSpacing.lg) {
            Spacer()

            // Icon
            Image(systemName: "lock.circle")
                .font(.system(size: 60))
                .foregroundColor(.accentColor)
                .padding(.bottom, AppSpacing.md)

            // Title
            VStack(spacing: AppSpacing.sm) {
                Text("Forgot Password?")
                    .font(.title)
                    .fontWeight(.bold)

                Text("No worries! Enter your email and we'll send you a reset link.")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            // Error
            if let error = error {
                HStack {
                    Image(systemName: "exclamationmark.circle.fill")
                    Text(error)
                }
                .font(.subheadline)
                .foregroundColor(.red)
                .padding()
                .background(Color.red.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                .padding(.horizontal)
            }

            // Email Field
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
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
            }
            .padding(.horizontal)

            // Submit Button
            Button(action: onSubmit) {
                HStack {
                    if isLoading {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else {
                        Text("Send Reset Link")
                            .fontWeight(.semibold)
                    }
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(Color.accentColor)
                .clipShape(Capsule())
            }
            .disabled(isLoading)
            .padding(.horizontal)

            Spacer()

            // Back to Login
            HStack {
                Text("Remember your password?")
                    .foregroundColor(.secondary)
                Button("Sign In") {
                    onDismiss()
                }
                .fontWeight(.semibold)
            }
            .font(.subheadline)
            .padding(.bottom)
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: onDismiss) {
                    Image(systemName: "arrow.left")
                        .foregroundColor(.primary)
                }
            }
        }
    }
}

// MARK: - Success View
private struct SuccessView: View {
    let email: String
    let onDone: () -> Void

    var body: some View {
        VStack(spacing: AppSpacing.xl) {
            Spacer()

            // Icon
            Image(systemName: "envelope.badge.fill")
                .font(.system(size: 80))
                .foregroundColor(.green)

            // Title
            VStack(spacing: AppSpacing.md) {
                Text("Check Your Email")
                    .font(.title)
                    .fontWeight(.bold)

                Text("We've sent a password reset link to")
                    .foregroundColor(.secondary)

                Text(email)
                    .fontWeight(.semibold)
            }
            .multilineTextAlignment(.center)

            Spacer()

            // Done Button
            Button(action: onDone) {
                Text("Back to Sign In")
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(Color.accentColor)
                    .clipShape(Capsule())
            }
            .padding(.horizontal)
            .padding(.bottom, AppSpacing.xl)
        }
        .navigationBarHidden(true)
    }
}

// MARK: - Preview
#Preview {
    NavigationStack {
        ForgotPasswordView()
    }
}
