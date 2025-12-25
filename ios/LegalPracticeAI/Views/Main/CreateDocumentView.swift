//
//  CreateDocumentView.swift
//  LegalPracticeAI
//
//  Document creation screen
//

import SwiftUI

struct CreateDocumentView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: AppSpacing.lg) {
                    // Header
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text("Create Document")
                            .font(.title)
                            .fontWeight(.bold)

                        Text("Select a category to get started")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding(.horizontal)

                    // Categories
                    VStack(spacing: AppSpacing.md) {
                        ForEach(DocumentCategory.allCases, id: \.self) { category in
                            NavigationLink(destination: DocumentFormView(category: category)) {
                                CategoryCard(category: category)
                            }
                        }
                    }
                    .padding(.horizontal)

                    // AI Suggestion
                    AIHelpCard()
                        .padding(.horizontal)
                        .padding(.bottom, AppSpacing.xl)
                }
                .padding(.top)
            }
            .background(Color(UIColor.systemGroupedBackground))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title2)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
    }
}

// MARK: - Category Card
struct CategoryCard: View {
    let category: DocumentCategory

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            // Icon
            Image(systemName: category.icon)
                .font(.title2)
                .foregroundColor(.accentColor)
                .frame(width: 52, height: 52)
                .background(Color.accentColor.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 14))

            // Info
            VStack(alignment: .leading, spacing: 4) {
                Text(category.displayName)
                    .font(.headline)
                    .foregroundColor(.primary)

                Text(category.templates.prefix(3).joined(separator: " • "))
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)

                // Template tags
                HStack(spacing: 6) {
                    ForEach(category.templates.prefix(2), id: \.self) { template in
                        Text(template)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 3)
                            .background(Color.secondary.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                    }

                    if category.templates.count > 2 {
                        Text("+\(category.templates.count - 2)")
                            .font(.caption2)
                            .foregroundColor(.accentColor)
                    }
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
    }
}

// MARK: - AI Help Card
struct AIHelpCard: View {
    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: "wand.and.stars")
                .font(.title2)
                .foregroundColor(.accentColor)
                .frame(width: 44, height: 44)
                .background(Color.accentColor.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 2) {
                Text("Need Help Choosing?")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.accentColor)

                Text("Describe what you need and our AI will suggest the right document.")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color.accentColor.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.md)
                .stroke(Color.accentColor.opacity(0.2), lineWidth: 1)
        )
    }
}

// MARK: - Document Form View
struct DocumentFormView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = CreateDocumentViewModel()

    let category: DocumentCategory

    @State private var selectedTemplate: String = ""
    @State private var fullName = ""
    @State private var address = ""
    @State private var city = ""
    @State private var stateAddress = ""
    @State private var zipCode = ""
    @State private var additionalDetails = ""
    @State private var showSuccess = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.xl) {
                // Template Selection
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Select Template")
                        .font(.headline)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: AppSpacing.sm) {
                            ForEach(category.templates, id: \.self) { template in
                                Button {
                                    selectedTemplate = template
                                } label: {
                                    Text(template)
                                        .font(.subheadline)
                                        .fontWeight(.medium)
                                        .foregroundColor(selectedTemplate == template ? .white : .primary)
                                        .padding(.horizontal, AppSpacing.md)
                                        .padding(.vertical, AppSpacing.sm)
                                        .background(selectedTemplate == template ? Color.accentColor : Color.cardBackground)
                                        .clipShape(Capsule())
                                        .overlay(
                                            Capsule()
                                                .stroke(selectedTemplate == template ? Color.clear : Color.secondary.opacity(0.3), lineWidth: 1)
                                        )
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal)

                // State/Jurisdiction
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Jurisdiction")
                        .font(.headline)

                    Picker("State", selection: $viewModel.selectedState) {
                        ForEach(viewModel.usStates, id: \.self) { state in
                            Text(state).tag(state)
                        }
                    }
                    .pickerStyle(.menu)
                    .padding()
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                }
                .padding(.horizontal)

                // Form Fields
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Document Details")
                        .font(.headline)

                    VStack(spacing: AppSpacing.md) {
                        FormTextField(title: "Full Legal Name", text: $fullName)
                        FormTextField(title: "Address", text: $address)
                        FormTextField(title: "City", text: $city)

                        HStack(spacing: AppSpacing.md) {
                            FormTextField(title: "State", text: $stateAddress)
                            FormTextField(title: "ZIP Code", text: $zipCode)
                                .keyboardType(.numberPad)
                        }

                        VStack(alignment: .leading, spacing: AppSpacing.xs) {
                            Text("Additional Details")
                                .font(.subheadline)
                                .fontWeight(.medium)

                            TextEditor(text: $additionalDetails)
                                .frame(minHeight: 100)
                                .padding(AppSpacing.sm)
                                .background(Color.cardBackground)
                                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                        }
                    }
                }
                .padding(.horizontal)

                // AI Info
                HStack(spacing: AppSpacing.md) {
                    Image(systemName: "cpu")
                        .foregroundColor(.accentColor)

                    Text("Our AI will generate a professionally formatted legal document based on your inputs, compliant with \(viewModel.selectedState) laws.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding()
                .background(Color.accentColor.opacity(0.05))
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                .padding(.horizontal)

                Spacer(minLength: 100)
            }
            .padding(.top)
        }
        .background(Color(UIColor.systemGroupedBackground))
        .navigationTitle(category.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            Button {
                Task {
                    showSuccess = await viewModel.generateDocument()
                }
            } label: {
                HStack {
                    if viewModel.isGenerating {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else {
                        Text("Generate Document")
                            .fontWeight(.semibold)
                    }
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(Color.accentColor)
                .clipShape(Capsule())
            }
            .disabled(viewModel.isGenerating)
            .padding()
            .background(Color(UIColor.systemBackground))
        }
        .alert("Document Generated!", isPresented: $showSuccess) {
            Button("View Document") {
                dismiss()
            }
        } message: {
            Text("Your document has been created successfully.")
        }
        .onAppear {
            if let first = category.templates.first {
                selectedTemplate = first
            }
        }
    }
}

// MARK: - Form Text Field
struct FormTextField: View {
    let title: String
    @Binding var text: String
    var keyboardType: UIKeyboardType = .default

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Text(title)
                .font(.subheadline)
                .fontWeight(.medium)

            TextField(title, text: $text)
                .keyboardType(keyboardType)
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
        }
    }
}

// MARK: - Preview
#Preview {
    CreateDocumentView()
}
