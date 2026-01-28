//
//  LoginView.swift
//  LegalPracticeAI
//
//  Login screen
//

import SwiftUI
import AuthenticationServices
import CommonCrypto

struct LoginView: View {
    @EnvironmentObject var authViewModel: AuthViewModel

    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false
    @State private var showSocialLoginError = false
    @State private var socialLoginErrorMessage = ""
    @FocusState private var focusedField: Field?

    enum Field {
        case email, password
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.lg) {
                // Title
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text("Welcome Back")
                        .font(.largeTitle)
                        .fontWeight(.bold)

                    Text("Sign in to access your documents and clients")
                        .font(.body)
                        .foregroundColor(.secondary)
                }
                .padding(.top, AppSpacing.lg)

                // Error Message
                if let error = authViewModel.error {
                    HStack {
                        Image(systemName: "exclamationmark.circle.fill")
                            .foregroundColor(.red)

                        Text(error)
                            .font(.subheadline)
                            .foregroundColor(.red)

                        Spacer()

                        Button {
                            authViewModel.clearError()
                        } label: {
                            Image(systemName: "xmark")
                                .foregroundColor(.red)
                        }
                    }
                    .padding()
                    .background(Color.red.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                }

                // Form
                VStack(spacing: AppSpacing.md) {
                    // Email
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
                                .focused($focusedField, equals: .email)
                        }
                        .padding()
                        .background(Color.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                    }

                    // Password
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text("Password")
                            .font(.subheadline)
                            .fontWeight(.medium)

                        HStack {
                            Image(systemName: "lock")
                                .foregroundColor(.secondary)

                            if showPassword {
                                TextField("Enter your password", text: $password)
                                    .focused($focusedField, equals: .password)
                            } else {
                                SecureField("Enter your password", text: $password)
                                    .focused($focusedField, equals: .password)
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

                    // Forgot Password
                    HStack {
                        Spacer()
                        NavigationLink("Forgot Password?") {
                            ForgotPasswordView()
                        }
                        .font(.subheadline)
                        .fontWeight(.medium)
                    }
                }

                // Sign In Button
                Button {
                    Task {
                        await authViewModel.login(email: email, password: password)
                    }
                } label: {
                    HStack {
                        if authViewModel.isLoading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            Text("Sign In")
                                .fontWeight(.semibold)
                        }
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(Color.accentColor)
                    .clipShape(Capsule())
                }
                .disabled(authViewModel.isLoading)
                .padding(.top, AppSpacing.sm)

                // Divider
                HStack {
                    Rectangle()
                        .frame(height: 1)
                        .foregroundColor(.secondary.opacity(0.3))

                    Text("or continue with")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Rectangle()
                        .frame(height: 1)
                        .foregroundColor(.secondary.opacity(0.3))
                }
                .padding(.vertical, AppSpacing.md)

                // Social Login
                VStack(spacing: AppSpacing.sm) {
                    HStack(spacing: AppSpacing.md) {
                        SocialLoginButton(provider: .google) {
                            Task { await handleGoogleLogin() }
                        }
                        SocialLoginButton(provider: .apple) {
                            // Apple Sign In handled by SignInWithAppleButton
                        }
                    }

                    SocialLoginButton(provider: .microsoft) {
                        Task { await handleMicrosoftLogin() }
                    }
                }
                .alert("Login Error", isPresented: $showSocialLoginError) {
                    Button("OK", role: .cancel) { }
                } message: {
                    Text(socialLoginErrorMessage)
                }

                // Register Link
                HStack {
                    Spacer()
                    Text("Don't have an account?")
                        .foregroundColor(.secondary)
                    NavigationLink("Sign Up") {
                        RegisterView()
                    }
                    .fontWeight(.semibold)
                    Spacer()
                }
                .padding(.top, AppSpacing.lg)
            }
            .padding(.horizontal, AppSpacing.lg)
        }
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Social Login Handlers

    func handleGoogleLogin() async {
        // Google OAuth URL - credentials from Configuration.plist
        let clientId = Config.googleClientID
        let redirectUri = Config.googleRedirectURI
        let scope = "email profile openid"

        guard !clientId.isEmpty else {
            await MainActor.run {
                socialLoginErrorMessage = "Google Client ID not configured"
                showSocialLoginError = true
            }
            return
        }

        // Generate PKCE code verifier and challenge (required for iOS OAuth without client secret)
        let codeVerifier = generateCodeVerifier()
        let codeChallenge = generateCodeChallenge(from: codeVerifier)

        var urlComponents = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        urlComponents.queryItems = [
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "redirect_uri", value: redirectUri),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: scope),
            URLQueryItem(name: "code_challenge", value: codeChallenge),
            URLQueryItem(name: "code_challenge_method", value: "S256")
        ]

        guard let authURL = urlComponents.url else {
            await MainActor.run {
                socialLoginErrorMessage = "Invalid Google OAuth URL"
                showSocialLoginError = true
            }
            return
        }

        // Use reversed client ID as callback scheme for Google iOS OAuth
        let callbackScheme = "com.googleusercontent.apps." + clientId.replacingOccurrences(of: ".apps.googleusercontent.com", with: "")
        await startOAuthSession(url: authURL, callbackScheme: callbackScheme, provider: "google", codeVerifier: codeVerifier)
    }

    // MARK: - PKCE Helpers

    func generateCodeVerifier() -> String {
        var buffer = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, buffer.count, &buffer)
        return Data(buffer).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    func generateCodeChallenge(from verifier: String) -> String {
        guard let data = verifier.data(using: .utf8) else { return "" }
        var hash = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        data.withUnsafeBytes {
            _ = CC_SHA256($0.baseAddress, CC_LONG(data.count), &hash)
        }
        return Data(hash).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    func handleMicrosoftLogin() async {
        // Microsoft OAuth URL - credentials from Configuration.plist
        let clientId = Config.microsoftClientID
        let redirectUri = Config.microsoftRedirectURI
        let scope = "openid profile email User.Read"
        let tenant = "common"

        guard !clientId.isEmpty else {
            await MainActor.run {
                socialLoginErrorMessage = "Microsoft Client ID not configured"
                showSocialLoginError = true
            }
            return
        }

        guard let authURL = URL(string: "https://login.microsoftonline.com/\(tenant)/oauth2/v2.0/authorize?client_id=\(clientId)&redirect_uri=\(redirectUri.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? redirectUri)&response_type=code&scope=\(scope.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? scope)") else {
            await MainActor.run {
                socialLoginErrorMessage = "Invalid Microsoft OAuth URL"
                showSocialLoginError = true
            }
            return
        }

        // Use MSAL redirect URI scheme for Microsoft
        let callbackScheme = "msal" + clientId
        await startOAuthSession(url: authURL, callbackScheme: callbackScheme, provider: "microsoft", codeVerifier: nil)
    }

    @MainActor
    func startOAuthSession(url: URL, callbackScheme: String, provider: String, codeVerifier: String?) async {
        let contextProvider = WebAuthContextProvider()
        let verifier = codeVerifier // Capture for closure

        let session = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackScheme) { [weak contextProvider] callbackURL, error in
            _ = contextProvider // Keep reference alive

            if let error = error {
                if (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin {
                    return
                }
                DispatchQueue.main.async {
                    self.socialLoginErrorMessage = error.localizedDescription
                    self.showSocialLoginError = true
                }
                return
            }

            guard let callbackURL = callbackURL,
                  let code = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?
                    .queryItems?.first(where: { $0.name == "code" })?.value else {
                DispatchQueue.main.async {
                    self.socialLoginErrorMessage = "Failed to get authorization code"
                    self.showSocialLoginError = true
                }
                return
            }

            Task { @MainActor in
                do {
                    try await self.authViewModel.socialLogin(provider: provider, code: code, codeVerifier: verifier)
                } catch {
                    self.socialLoginErrorMessage = error.localizedDescription
                    self.showSocialLoginError = true
                }
            }
        }

        session.presentationContextProvider = contextProvider
        session.prefersEphemeralWebBrowserSession = false

        if !session.start() {
            socialLoginErrorMessage = "Failed to start authentication session"
            showSocialLoginError = true
        }
    }
}

// MARK: - Web Auth Context Provider
class WebAuthContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = scene.windows.first else {
            return ASPresentationAnchor()
        }
        return window
    }
}

// MARK: - Social Login Button
struct SocialLoginButton: View {
    enum Provider {
        case google, apple, microsoft

        var name: String {
            switch self {
            case .google: return "Google"
            case .apple: return "Apple"
            case .microsoft: return "Microsoft"
            }
        }

        var icon: String {
            switch self {
            case .google: return "globe"
            case .apple: return "apple.logo"
            case .microsoft: return "window.casement"
            }
        }

        var iconColor: Color {
            switch self {
            case .google: return .red
            case .apple: return .primary
            case .microsoft: return .blue
            }
        }
    }

    let provider: Provider
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: provider.icon)
                    .foregroundColor(provider.iconColor)
                Text(provider.name)
                    .fontWeight(.medium)
            }
            .foregroundColor(.primary)
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(Color.cardBackground)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(Color.secondary.opacity(0.3), lineWidth: 1)
            )
        }
    }
}

// MARK: - Preview
#Preview {
    NavigationStack {
        LoginView()
            .environmentObject(AuthViewModel())
    }
}
