//
//  SettingsView.swift
//  LegalPracticeAI
//
//  App settings and preferences screen
//

import SwiftUI

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var authViewModel: AuthViewModel

    @State private var name: String = ""
    @State private var email: String = ""
    @State private var pushNotifications = true
    @State private var emailNotifications = true
    @State private var showDeleteConfirmation = false

    var body: some View {
        NavigationStack {
            List {
                // Profile Section
                Section("Profile") {
                    TextField("Full Name", text: $name)
                        .textContentType(.name)

                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)

                    Button("Save Changes") {
                        // Save profile changes
                    }
                    .frame(maxWidth: .infinity)
                    .buttonStyle(.borderedProminent)
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                }

                // Notifications Section
                Section("Notifications") {
                    Toggle(isOn: $pushNotifications) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Push Notifications")
                            Text("Receive notifications about document updates")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }

                    Toggle(isOn: $emailNotifications) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Email Notifications")
                            Text("Receive email updates about your account")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }

                // Security Section
                Section("Security") {
                    Button {
                        // Change password
                    } label: {
                        Label("Change Password", systemImage: "lock.fill")
                    }

                    Button {
                        // 2FA settings
                    } label: {
                        Label("Two-Factor Authentication", systemImage: "shield.checkered")
                    }
                }

                // Data Section
                Section("Data & Storage") {
                    Button {
                        // Export data
                    } label: {
                        Label("Export My Data", systemImage: "arrow.down.doc.fill")
                    }

                    Button {
                        // Clear cache
                    } label: {
                        Label("Clear Cache", systemImage: "arrow.triangle.2.circlepath")
                    }
                }

                // Danger Zone
                Section {
                    Button(role: .destructive) {
                        showDeleteConfirmation = true
                    } label: {
                        Label("Delete Account", systemImage: "trash.fill")
                    }
                } header: {
                    Text("Danger Zone")
                        .foregroundColor(.red)
                } footer: {
                    Text("Deleting your account will permanently remove all your data.")
                }

                // App Info
                Section("About") {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0.0")
                            .foregroundColor(.secondary)
                    }

                    Link(destination: URL(string: "https://legalpracticeai.com/privacy")!) {
                        Label("Privacy Policy", systemImage: "hand.raised.fill")
                    }

                    Link(destination: URL(string: "https://legalpracticeai.com/terms")!) {
                        Label("Terms of Service", systemImage: "doc.text.fill")
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                if let user = authViewModel.user {
                    name = user.name
                    email = user.email
                }
            }
            .confirmationDialog(
                "Delete Account",
                isPresented: $showDeleteConfirmation,
                titleVisibility: .visible
            ) {
                Button("Delete Account", role: .destructive) {
                    // Delete account
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This will permanently delete your account and all data. This cannot be undone.")
            }
        }
    }
}

// MARK: - Preview
#Preview {
    SettingsView()
        .environmentObject(AuthViewModel())
}
