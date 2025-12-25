//
//  DocumentDetailView.swift
//  LegalPracticeAI
//
//  Document detail and preview screen
//

import SwiftUI

struct DocumentDetailView: View {
    @Environment(\.dismiss) private var dismiss
    let document: Document

    @State private var showShareSheet = false
    @State private var showDeleteConfirmation = false

    var statusColor: Color {
        switch document.status {
        case .draft: return .orange
        case .final: return .green
        case .signed: return .blue
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.lg) {
                // Document Info
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text(document.title)
                        .font(.title2)
                        .fontWeight(.bold)

                    HStack(spacing: AppSpacing.md) {
                        // Status Badge
                        Text(document.status.rawValue.uppercased())
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(statusColor)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(statusColor.opacity(0.1))
                            .clipShape(Capsule())

                        Text("Created \(document.createdAt.formatted(date: .abbreviated, time: .omitted))")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .padding(.horizontal)

                // Document Preview
                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                    Text("Document Preview")
                        .font(.headline)
                        .foregroundColor(.secondary)

                    ScrollView {
                        Text(document.content)
                            .font(.system(.body, design: .monospaced))
                            .padding()
                    }
                    .frame(maxHeight: 300)
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                }
                .padding(.horizontal)

                // Actions
                VStack(spacing: AppSpacing.sm) {
                    Button {
                        // Download PDF
                    } label: {
                        Label("Download PDF", systemImage: "arrow.down.doc.fill")
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(Color.accentColor)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                    }

                    Button {
                        // Download Word
                    } label: {
                        Label("Download Word", systemImage: "doc.text.fill")
                            .font(.headline)
                            .foregroundColor(.accentColor)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(Color.accentColor.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                    }
                }
                .padding(.horizontal)

                // E-Signature Card
                HStack(spacing: AppSpacing.md) {
                    Image(systemName: "signature")
                        .font(.title2)
                        .foregroundColor(.accentColor)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Need Signatures?")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(.accentColor)

                        Text("Send this document for electronic signature via DocuSign")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    Button("Send") {
                        // Send for signature
                    }
                    .font(.subheadline)
                    .fontWeight(.medium)
                }
                .padding()
                .background(Color.accentColor.opacity(0.05))
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                .overlay(
                    RoundedRectangle(cornerRadius: AppRadius.md)
                        .stroke(Color.accentColor.opacity(0.2), lineWidth: 1)
                )
                .padding(.horizontal)
            }
            .padding(.top)
            .padding(.bottom, AppSpacing.xxl)
        }
        .background(Color(UIColor.systemGroupedBackground))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button {
                        showShareSheet = true
                    } label: {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }

                    Divider()

                    Button(role: .destructive) {
                        showDeleteConfirmation = true
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .confirmationDialog(
            "Delete this document?",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This action cannot be undone.")
        }
        .sheet(isPresented: $showShareSheet) {
            ShareSheet(items: [document.title])
        }
    }
}

// MARK: - Share Sheet
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Client Detail View
struct ClientDetailView: View {
    @Environment(\.dismiss) private var dismiss
    let client: Client

    @State private var showDeleteConfirmation = false

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.xl) {
                // Header
                VStack(spacing: AppSpacing.md) {
                    Text(client.initials)
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .frame(width: 80, height: 80)
                        .background(Color.accentColor)
                        .clipShape(Circle())

                    Text(client.name)
                        .font(.title2)
                        .fontWeight(.bold)

                    if let company = client.company, !company.isEmpty {
                        Text(company)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                }
                .padding(.top)

                // Quick Actions
                HStack(spacing: AppSpacing.md) {
                    Button {
                        if let phone = client.phone, let url = URL(string: "tel:\(phone)") {
                            UIApplication.shared.open(url)
                        }
                    } label: {
                        Label("Call", systemImage: "phone.fill")
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                            .background(Color.accentColor)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                    }
                    .disabled(client.phone == nil)

                    Button {
                        if let url = URL(string: "mailto:\(client.email)") {
                            UIApplication.shared.open(url)
                        }
                    } label: {
                        Label("Email", systemImage: "envelope.fill")
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                            .background(Color.accentColor)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                    }
                }
                .padding(.horizontal)

                // Contact Info
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("CONTACT INFORMATION")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.secondary)

                    VStack(spacing: 0) {
                        ContactRow(icon: "envelope", label: "Email", value: client.email)
                        Divider().padding(.leading, 44)

                        if let phone = client.phone {
                            ContactRow(icon: "phone", label: "Phone", value: phone)
                            Divider().padding(.leading, 44)
                        }

                        if let address = client.address {
                            ContactRow(icon: "mappin", label: "Address", value: address)
                        }
                    }
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                }
                .padding(.horizontal)

                // Notes
                if let notes = client.notes, !notes.isEmpty {
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("NOTES")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)

                        Text(notes)
                            .font(.body)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                    }
                    .padding(.horizontal)
                }

                // Documents Button
                Button {
                    // View client documents
                } label: {
                    Label("View Client Documents", systemImage: "doc.text.fill")
                        .font(.headline)
                        .foregroundColor(.accentColor)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Color.accentColor.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                }
                .padding(.horizontal)
            }
            .padding(.bottom, AppSpacing.xxl)
        }
        .background(Color(UIColor.systemGroupedBackground))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button {
                        // Edit client
                    } label: {
                        Label("Edit", systemImage: "pencil")
                    }

                    Divider()

                    Button(role: .destructive) {
                        showDeleteConfirmation = true
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .confirmationDialog(
            "Delete this client?",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will also remove all associated data.")
        }
    }
}

// MARK: - Contact Row
struct ContactRow: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: icon)
                .foregroundColor(.accentColor)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text(value)
                    .font(.body)
            }

            Spacer()
        }
        .padding()
    }
}

// MARK: - Preview
#Preview {
    NavigationStack {
        DocumentDetailView(document: Document(
            id: "1",
            title: "LLC Operating Agreement",
            category: .businessFormation,
            content: "This is a sample document content...",
            status: .final,
            createdAt: Date(),
            updatedAt: Date()
        ))
    }
}
