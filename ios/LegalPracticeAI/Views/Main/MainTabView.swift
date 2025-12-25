//
//  MainTabView.swift
//  LegalPracticeAI
//
//  Main tab navigation for authenticated users
//

import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0
    @State private var showCreateDocument = false

    var body: some View {
        ZStack(alignment: .bottom) {
            TabView(selection: $selectedTab) {
                HomeView()
                    .tag(0)

                DocumentsView()
                    .tag(1)

                // Placeholder for center button
                Color.clear
                    .tag(2)

                ClientsView()
                    .tag(3)

                ProfileView()
                    .tag(4)
            }

            // Custom Tab Bar
            CustomTabBar(
                selectedTab: $selectedTab,
                showCreateDocument: $showCreateDocument
            )
        }
        .sheet(isPresented: $showCreateDocument) {
            CreateDocumentView()
        }
    }
}

// MARK: - Custom Tab Bar
struct CustomTabBar: View {
    @Binding var selectedTab: Int
    @Binding var showCreateDocument: Bool

    var body: some View {
        HStack {
            // Home
            TabBarButton(
                icon: "house",
                iconFilled: "house.fill",
                title: "Home",
                isSelected: selectedTab == 0
            ) {
                selectedTab = 0
            }

            // Documents
            TabBarButton(
                icon: "doc.text",
                iconFilled: "doc.text.fill",
                title: "Documents",
                isSelected: selectedTab == 1
            ) {
                selectedTab = 1
            }

            // Create Button (Center)
            Button {
                showCreateDocument = true
            } label: {
                ZStack {
                    Circle()
                        .fill(LinearGradient.primaryGradient)
                        .frame(width: 56, height: 56)
                        .shadow(color: Color.accentColor.opacity(0.4), radius: 8, y: 4)

                    Image(systemName: "plus")
                        .font(.title2)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                }
            }
            .offset(y: -16)

            // Clients
            TabBarButton(
                icon: "person.2",
                iconFilled: "person.2.fill",
                title: "Clients",
                isSelected: selectedTab == 3
            ) {
                selectedTab = 3
            }

            // Profile
            TabBarButton(
                icon: "person.circle",
                iconFilled: "person.circle.fill",
                title: "Profile",
                isSelected: selectedTab == 4
            ) {
                selectedTab = 4
            }
        }
        .padding(.horizontal, AppSpacing.md)
        .padding(.top, AppSpacing.md)
        .padding(.bottom, AppSpacing.sm)
        .background(
            Color(UIColor.systemBackground)
                .shadow(color: .black.opacity(0.1), radius: 10, y: -5)
                .ignoresSafeArea()
        )
    }
}

// MARK: - Tab Bar Button
struct TabBarButton: View {
    let icon: String
    let iconFilled: String
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: isSelected ? iconFilled : icon)
                    .font(.system(size: 22))

                Text(title)
                    .font(.caption2)
                    .fontWeight(.medium)
            }
            .foregroundColor(isSelected ? .accentColor : .secondary)
            .frame(maxWidth: .infinity)
        }
    }
}

// MARK: - Preview
#Preview {
    MainTabView()
        .environmentObject(AuthViewModel())
        .environmentObject(ThemeManager())
}
