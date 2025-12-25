//
//  ProfileView.swift
//  LegalPracticeAI
//
//  Profile and settings screen
//

import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @EnvironmentObject var themeManager: ThemeManager
    @State private var showLogoutConfirmation = false

    var body: some View {
        NavigationStack {
            List {
                // Profile Header
                Section {
                    HStack(spacing: AppSpacing.md) {
                        Text(authViewModel.user?.name.prefix(2).uppercased() ?? "U")
                            .font(.title)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                            .frame(width: 70, height: 70)
                            .background(Color.accentColor)
                            .clipShape(Circle())

                        VStack(alignment: .leading, spacing: 4) {
                            Text(authViewModel.user?.name ?? "User")
                                .font(.title3)
                                .fontWeight(.bold)

                            Text(authViewModel.user?.email ?? "")
                                .font(.subheadline)
                                .foregroundColor(.secondary)

                            HStack(spacing: 4) {
                                Image(systemName: "star.fill")
                                    .font(.caption)
                                    .foregroundColor(.orange)

                                Text("\(authViewModel.user?.subscription.rawValue.capitalized ?? "Free") Plan")
                                    .font(.caption)
                                    .fontWeight(.medium)
                                    .foregroundColor(.orange)
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.orange.opacity(0.1))
                            .clipShape(Capsule())
                        }
                    }
                    .padding(.vertical, AppSpacing.sm)
                }

                // Account
                Section("Account") {
                    NavigationLink {
                        SettingsView()
                    } label: {
                        SettingsRow(icon: "person", title: "Edit Profile", color: .blue)
                    }

                    NavigationLink {
                        Text("Change Password")
                    } label: {
                        SettingsRow(icon: "lock", title: "Change Password", color: .green)
                    }

                    NavigationLink {
                        Text("Two-Factor Authentication")
                    } label: {
                        SettingsRow(icon: "shield", title: "Two-Factor Auth", color: .purple)
                    }
                }

                // Preferences
                Section("Preferences") {
                    HStack {
                        SettingsRow(icon: "moon", title: "Dark Mode", color: .indigo)
                        Spacer()
                        Toggle("", isOn: $themeManager.isDarkMode)
                            .onChange(of: themeManager.isDarkMode) { _ in
                                themeManager.useSystemTheme = false
                            }
                    }

                    NavigationLink {
                        Text("Notifications")
                    } label: {
                        SettingsRow(icon: "bell", title: "Notifications", color: .red)
                    }
                }

                // Subscription
                Section("Subscription") {
                    NavigationLink {
                        Text("Upgrade")
                    } label: {
                        SettingsRow(icon: "crown", title: "Upgrade to Pro", color: .orange)
                    }

                    NavigationLink {
                        Text("Billing")
                    } label: {
                        SettingsRow(icon: "creditcard", title: "Billing History", color: .green)
                    }
                }

                // Support
                Section("Support") {
                    NavigationLink {
                        Text("Help")
                    } label: {
                        SettingsRow(icon: "questionmark.circle", title: "Help Center", color: .blue)
                    }

                    NavigationLink {
                        Text("Contact")
                    } label: {
                        SettingsRow(icon: "envelope", title: "Contact Support", color: .cyan)
                    }

                    NavigationLink {
                        Text("Terms")
                    } label: {
                        SettingsRow(icon: "doc.text", title: "Terms of Service", color: .gray)
                    }

                    NavigationLink {
                        Text("Privacy")
                    } label: {
                        SettingsRow(icon: "hand.raised", title: "Privacy Policy", color: .gray)
                    }
                }

                // Sign Out
                Section {
                    Button(role: .destructive) {
                        showLogoutConfirmation = true
                    } label: {
                        HStack {
                            SettingsRow(icon: "arrow.right.square", title: "Sign Out", color: .red)
                            Spacer()
                        }
                    }
                }

                // App Version
                Section {
                    HStack {
                        Spacer()
                        Text("LegalPracticeAI v1.0.0")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Spacer()
                    }
                }
                .listRowBackground(Color.clear)
            }
            .navigationTitle("Profile")
            .confirmationDialog(
                "Are you sure you want to sign out?",
                isPresented: $showLogoutConfirmation,
                titleVisibility: .visible
            ) {
                Button("Sign Out", role: .destructive) {
                    Task {
                        await authViewModel.logout()
                    }
                }
                Button("Cancel", role: .cancel) {}
            }
        }
    }
}

// MARK: - Settings Row
struct SettingsRow: View {
    let icon: String
    let title: String
    let color: Color

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: icon)
                .font(.body)
                .foregroundColor(.white)
                .frame(width: 28, height: 28)
                .background(color)
                .clipShape(RoundedRectangle(cornerRadius: 6))

            Text(title)
                .foregroundColor(.primary)
        }
    }
}

// MARK: - Settings View
struct SettingsView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var name: String = ""
    @State private var email: String = ""

    var body: some View {
        Form {
            Section("Profile Information") {
                TextField("Name", text: $name)
                TextField("Email", text: $email)
                    .keyboardType(.emailAddress)
                    .autocapitalization(.none)
            }

            Section {
                Button("Save Changes") {
                    // Save changes
                    dismiss()
                }
                .frame(maxWidth: .infinity)
            }
        }
        .navigationTitle("Edit Profile")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            name = authViewModel.user?.name ?? ""
            email = authViewModel.user?.email ?? ""
        }
    }
}

// MARK: - Preview
#Preview {
    ProfileView()
        .environmentObject(AuthViewModel())
        .environmentObject(ThemeManager())
}
