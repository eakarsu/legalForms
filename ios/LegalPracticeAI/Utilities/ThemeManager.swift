//
//  ThemeManager.swift
//  LegalPracticeAI
//
//  Theme and appearance management
//

import SwiftUI

// MARK: - Theme Manager
final class ThemeManager: ObservableObject {
    @Published var isDarkMode: Bool {
        didSet {
            UserDefaults.standard.set(isDarkMode, forKey: "isDarkMode")
        }
    }

    @Published var useSystemTheme: Bool {
        didSet {
            UserDefaults.standard.set(useSystemTheme, forKey: "useSystemTheme")
        }
    }

    var colorScheme: ColorScheme? {
        if useSystemTheme {
            return nil
        }
        return isDarkMode ? .dark : .light
    }

    init() {
        self.useSystemTheme = UserDefaults.standard.object(forKey: "useSystemTheme") as? Bool ?? true
        self.isDarkMode = UserDefaults.standard.bool(forKey: "isDarkMode")
    }

    func toggleTheme() {
        isDarkMode.toggle()
        useSystemTheme = false
    }

    func setSystemTheme() {
        useSystemTheme = true
    }
}

// MARK: - App Colors
extension Color {
    static let primaryGradientStart = Color("AccentColor")
    static let primaryGradientEnd = Color("PurpleAccent")

    static let cardBackground = Color(UIColor.secondarySystemBackground)
    static let textPrimary = Color(UIColor.label)
    static let textSecondary = Color(UIColor.secondaryLabel)
    static let textMuted = Color(UIColor.tertiaryLabel)

    static let successColor = Color.green
    static let warningColor = Color.orange
    static let errorColor = Color.red
}

// MARK: - Gradients
extension LinearGradient {
    static let primaryGradient = LinearGradient(
        colors: [Color.accentColor, Color.purple],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let cardGradient = LinearGradient(
        colors: [Color.accentColor.opacity(0.1), Color.purple.opacity(0.1)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

// MARK: - Typography
struct AppTypography {
    static let largeTitle = Font.system(size: 34, weight: .bold, design: .default)
    static let title = Font.system(size: 28, weight: .bold, design: .default)
    static let title2 = Font.system(size: 22, weight: .bold, design: .default)
    static let title3 = Font.system(size: 20, weight: .semibold, design: .default)
    static let headline = Font.system(size: 17, weight: .semibold, design: .default)
    static let body = Font.system(size: 17, weight: .regular, design: .default)
    static let callout = Font.system(size: 16, weight: .regular, design: .default)
    static let subheadline = Font.system(size: 15, weight: .regular, design: .default)
    static let footnote = Font.system(size: 13, weight: .regular, design: .default)
    static let caption = Font.system(size: 12, weight: .regular, design: .default)
}

// MARK: - Spacing
struct AppSpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 48
}

// MARK: - Corner Radius
struct AppRadius {
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 20
    static let full: CGFloat = 9999
}
