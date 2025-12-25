//
//  ClientsView.swift
//  LegalPracticeAI
//
//  Clients list screen
//

import SwiftUI

struct ClientsView: View {
    @StateObject private var viewModel = ClientsViewModel()
    @State private var showAddClient = false

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.clients.isEmpty {
                    ProgressView()
                } else if viewModel.filteredClients.isEmpty {
                    VStack(spacing: AppSpacing.lg) {
                        Image(systemName: "person.crop.circle.badge.plus")
                            .font(.system(size: 60))
                            .foregroundColor(.secondary)

                        Text("No Clients Yet")
                            .font(.title3)
                            .fontWeight(.semibold)

                        Text("Add your first client to start managing their documents")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)

                        Button {
                            showAddClient = true
                        } label: {
                            Label("Add Client", systemImage: "plus")
                                .fontWeight(.semibold)
                        }
                        .buttonStyle(.borderedProminent)
                    }
                } else {
                    List {
                        ForEach(viewModel.filteredClients) { client in
                            NavigationLink(destination: ClientDetailView(client: client)) {
                                ClientListRow(client: client)
                            }
                            .listRowBackground(Color.cardBackground)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    Task {
                                        await viewModel.deleteClient(client)
                                    }
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                    .refreshable {
                        await viewModel.refresh()
                    }
                }
            }
            .navigationTitle("Clients")
            .searchable(text: $viewModel.searchText, prompt: "Search clients")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showAddClient = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showAddClient) {
                AddClientView(viewModel: viewModel)
            }
            .background(Color(UIColor.systemGroupedBackground))
        }
        .task {
            await viewModel.loadClients()
        }
    }
}

// MARK: - Client List Row
struct ClientListRow: View {
    let client: Client

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            // Avatar
            Text(client.initials)
                .font(.headline)
                .foregroundColor(.white)
                .frame(width: 44, height: 44)
                .background(Color.accentColor)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(client.name)
                    .font(.body)
                    .fontWeight(.medium)

                Text(client.email)
                    .font(.caption)
                    .foregroundColor(.secondary)

                if let company = client.company, !company.isEmpty {
                    Text(company)
                        .font(.caption)
                        .foregroundColor(.accentColor)
                }
            }

            Spacer()
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

// MARK: - Add Client View
struct AddClientView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: ClientsViewModel

    @State private var name = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var company = ""
    @State private var address = ""
    @State private var notes = ""

    var isValid: Bool {
        !name.isEmpty && !email.isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Required") {
                    TextField("Full Name", text: $name)
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                }

                Section("Optional") {
                    TextField("Phone", text: $phone)
                        .keyboardType(.phonePad)
                    TextField("Company", text: $company)
                    TextField("Address", text: $address)
                }

                Section("Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 100)
                }
            }
            .navigationTitle("Add Client")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            let success = await viewModel.createClient(
                                name: name,
                                email: email,
                                phone: phone.isEmpty ? nil : phone,
                                company: company.isEmpty ? nil : company,
                                address: address.isEmpty ? nil : address,
                                notes: notes.isEmpty ? nil : notes
                            )
                            if success {
                                dismiss()
                            }
                        }
                    }
                    .disabled(!isValid || viewModel.isLoading)
                }
            }
        }
    }
}

// MARK: - Preview
#Preview {
    ClientsView()
}
