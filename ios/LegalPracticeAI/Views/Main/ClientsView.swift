//
//  ClientsView.swift
//  LegalPracticeAI
//
//  Clients list screen
//

import SwiftUI

// MARK: - Client Category
enum ClientCategory: String, CaseIterable {
    case individual = "individual"
    case business = "business"
    case active = "active"
    case inactive = "inactive"
    case prospect = "prospect"
    case allClients = "all"

    var displayName: String {
        switch self {
        case .individual: return "Individuals"
        case .business: return "Businesses"
        case .active: return "Active"
        case .inactive: return "Inactive"
        case .prospect: return "Prospects"
        case .allClients: return "All Clients"
        }
    }

    var icon: String {
        switch self {
        case .individual: return "person.fill"
        case .business: return "building.2.fill"
        case .active: return "checkmark.circle.fill"
        case .inactive: return "moon.fill"
        case .prospect: return "star.fill"
        case .allClients: return "person.2.fill"
        }
    }

    var color: Color {
        switch self {
        case .individual: return .blue
        case .business: return .purple
        case .active: return .green
        case .inactive: return .gray
        case .prospect: return .orange
        case .allClients: return .accentColor
        }
    }
}

struct ClientsView: View {
    @StateObject private var viewModel = ClientsViewModel()
    @State private var showAddClient = false

    // Categories for grid
    let clientCategories: [ClientCategory] = [
        .individual,
        .business,
        .active,
        .inactive,
        .prospect,
        .allClients
    ]

    let columns = [
        GridItem(.flexible(), spacing: AppSpacing.md),
        GridItem(.flexible(), spacing: AppSpacing.md)
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.lg) {
                    // Client Categories Grid (2x3)
                    LazyVGrid(columns: columns, spacing: AppSpacing.md) {
                        ForEach(clientCategories, id: \.self) { category in
                            NavigationLink(destination: ClientCategoryView(category: category)) {
                                ClientCategoryCard(category: category, count: countClients(for: category))
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
                    }
                    .padding(.horizontal)

                    // Recent Clients Section
                    if !viewModel.clients.isEmpty {
                        VStack(alignment: .leading, spacing: AppSpacing.md) {
                            Text("Recent Clients")
                                .font(.headline)
                                .foregroundColor(.primary)
                                .padding(.horizontal)

                            ForEach(viewModel.clients.prefix(5)) { client in
                                NavigationLink(destination: ClientDetailView(client: client)) {
                                    ClientListRow(client: client)
                                        .padding(.horizontal)
                                }
                                .buttonStyle(PlainButtonStyle())
                            }
                        }
                    }
                }
                .padding(.top)
            }
            .navigationTitle("Clients")
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

    func countClients(for category: ClientCategory) -> Int {
        switch category {
        case .individual:
            return viewModel.clients.filter { $0.clientType == "individual" }.count
        case .business:
            return viewModel.clients.filter { $0.clientType == "business" }.count
        case .active:
            return viewModel.clients.filter { $0.status?.lowercased() == "active" || $0.status == nil }.count
        case .inactive:
            return viewModel.clients.filter { $0.status?.lowercased() == "inactive" }.count
        case .prospect:
            return viewModel.clients.filter { $0.status?.lowercased() == "prospect" }.count
        case .allClients:
            return viewModel.clients.count
        }
    }
}

// MARK: - Client Category Card
struct ClientCategoryCard: View {
    let category: ClientCategory
    let count: Int

    var body: some View {
        VStack(spacing: AppSpacing.sm) {
            Image(systemName: category.icon)
                .font(.system(size: 32))
                .foregroundColor(category.color)

            Text(category.displayName)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(.primary)
                .multilineTextAlignment(.center)
                .lineLimit(2)

            Text("\(count) clients")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 120)
        .padding()
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
        .shadow(color: Color.black.opacity(0.05), radius: 5, x: 0, y: 2)
    }
}

// MARK: - Client Category View
struct ClientCategoryView: View {
    let category: ClientCategory
    @StateObject private var viewModel = ClientsViewModel()
    @State private var showAddClient = false

    var filteredClients: [Client] {
        switch category {
        case .individual:
            return viewModel.clients.filter { $0.clientType == "individual" }
        case .business:
            return viewModel.clients.filter { $0.clientType == "business" }
        case .active:
            return viewModel.clients.filter { $0.status?.lowercased() == "active" || $0.status == nil }
        case .inactive:
            return viewModel.clients.filter { $0.status?.lowercased() == "inactive" }
        case .prospect:
            return viewModel.clients.filter { $0.status?.lowercased() == "prospect" }
        case .allClients:
            return viewModel.clients
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.isLoading && viewModel.clients.isEmpty {
                Spacer()
                ProgressView()
                Spacer()
            } else if filteredClients.isEmpty {
                Spacer()
                VStack(spacing: AppSpacing.lg) {
                    Image(systemName: category.icon)
                        .font(.system(size: 60))
                        .foregroundColor(category.color.opacity(0.5))

                    Text("No \(category.displayName)")
                        .font(.headline)
                        .foregroundColor(.secondary)

                    Text("Add a new client to get started")
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
                .padding()
                Spacer()
            } else {
                List {
                    ForEach(filteredClients) { client in
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
                    await viewModel.loadClients()
                }
            }
        }
        .navigationTitle(category.displayName)
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $viewModel.searchText, prompt: "Search \(category.displayName.lowercased())")
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
                Text(client.displayName)
                    .font(.body)
                    .fontWeight(.medium)

                if let email = client.email, !email.isEmpty {
                    Text(email)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                if client.clientType == "individual", let company = client.companyName, !company.isEmpty {
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

    @State private var clientType = "individual"
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var companyName = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var address = ""
    @State private var city = ""
    @State private var state = ""
    @State private var zip = ""
    @State private var notes = ""

    var isValid: Bool {
        if clientType == "business" {
            return !companyName.isEmpty
        }
        return !firstName.isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Client Type") {
                    Picker("Type", selection: $clientType) {
                        Text("Individual").tag("individual")
                        Text("Business").tag("business")
                    }
                    .pickerStyle(.segmented)
                }

                if clientType == "individual" {
                    Section("Name") {
                        TextField("First Name", text: $firstName)
                        TextField("Last Name", text: $lastName)
                    }
                } else {
                    Section("Business") {
                        TextField("Company Name", text: $companyName)
                    }
                }

                Section("Contact") {
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                    TextField("Phone", text: $phone)
                        .keyboardType(.phonePad)
                }

                Section("Address") {
                    TextField("Street Address", text: $address)
                    TextField("City", text: $city)
                    TextField("State", text: $state)
                    TextField("ZIP", text: $zip)
                        .keyboardType(.numberPad)
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
                                clientType: clientType,
                                firstName: firstName.isEmpty ? nil : firstName,
                                lastName: lastName.isEmpty ? nil : lastName,
                                companyName: companyName.isEmpty ? nil : companyName,
                                email: email.isEmpty ? nil : email,
                                phone: phone.isEmpty ? nil : phone,
                                address: address.isEmpty ? nil : address,
                                city: city.isEmpty ? nil : city,
                                state: state.isEmpty ? nil : state,
                                zip: zip.isEmpty ? nil : zip,
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
