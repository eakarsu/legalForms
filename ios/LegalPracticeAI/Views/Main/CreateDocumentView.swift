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
    @State private var clientName: String = ""
    @State private var clientEmail: String = ""
    @State private var naturalLanguageInput = ""
    @State private var generationMethod: GenerationModeType = .template
    @State private var documentFormat: DocumentFormatType = .pdf
    @State private var showSuccess = false
    @State private var showError = false

    var isFormValid: Bool {
        !clientName.isEmpty && !clientEmail.isEmpty && !naturalLanguageInput.isEmpty
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.xl) {
                // Required Contact Information
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Your Information")
                        .font(.headline)

                    VStack(spacing: AppSpacing.md) {
                        // Full Legal Name
                        VStack(alignment: .leading, spacing: AppSpacing.xs) {
                            HStack {
                                Text("Your Full Legal Name")
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                Text("*")
                                    .foregroundColor(.red)
                            }
                            TextField("Enter your full legal name", text: $clientName)
                                .textContentType(.name)
                                .padding()
                                .background(Color.cardBackground)
                                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                        }

                        // Email Address
                        VStack(alignment: .leading, spacing: AppSpacing.xs) {
                            HStack {
                                Text("Email Address")
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                Text("*")
                                    .foregroundColor(.red)
                            }
                            TextField("Enter your email address", text: $clientEmail)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .autocapitalization(.none)
                                .padding()
                                .background(Color.cardBackground)
                                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                        }
                    }
                }
                .padding(.horizontal)

                // Natural Language Input Section
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Describe Your Legal Needs")
                        .font(.headline)

                    TextEditor(text: $naturalLanguageInput)
                        .frame(minHeight: 80)
                        .padding(AppSpacing.sm)
                        .background(Color.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                        .overlay(
                            RoundedRectangle(cornerRadius: AppRadius.md)
                                .stroke(Color.secondary.opacity(0.2), lineWidth: 1)
                        )

                    Text("Type or speak to describe what you need in plain English, and we'll help fill out the form.")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    // Example Buttons
                    HStack(spacing: AppSpacing.sm) {
                        Button {
                            loadExample1()
                        } label: {
                            Label("Example 1", systemImage: "lightbulb")
                                .font(.caption)
                                .foregroundColor(.accentColor)
                                .padding(.horizontal, AppSpacing.sm)
                                .padding(.vertical, 6)
                                .background(Color.accentColor.opacity(0.1))
                                .clipShape(Capsule())
                        }

                        Button {
                            loadExample2()
                        } label: {
                            Label("Example 2", systemImage: "lightbulb")
                                .font(.caption)
                                .foregroundColor(.accentColor)
                                .padding(.horizontal, AppSpacing.sm)
                                .padding(.vertical, 6)
                                .background(Color.accentColor.opacity(0.1))
                                .clipShape(Capsule())
                        }

                        Spacer()

                        Button {
                            // Parse natural language
                        } label: {
                            Label("Parse", systemImage: "wand.and.stars")
                                .font(.caption)
                                .foregroundColor(.white)
                                .padding(.horizontal, AppSpacing.sm)
                                .padding(.vertical, 6)
                                .background(Color.accentColor)
                                .clipShape(Capsule())
                        }
                    }
                }
                .padding(.horizontal)

                // Template Selection
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Select Document Type")
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

                // Generation Method
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Generation Method")
                        .font(.headline)

                    HStack(spacing: AppSpacing.md) {
                        // Professional Template
                        Button {
                            generationMethod = .template
                        } label: {
                            VStack(spacing: AppSpacing.sm) {
                                Image(systemName: "doc.text")
                                    .font(.title2)
                                    .foregroundColor(generationMethod == .template ? .accentColor : .primary)
                                Text("Professional Template")
                                    .font(.caption)
                                    .fontWeight(.medium)
                                    .foregroundColor(.primary)
                                Text("Use professionally drafted legal templates")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                                    .multilineTextAlignment(.center)
                                Text("Recommended")
                                    .font(.caption2)
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 2)
                                    .background(Color.green)
                                    .clipShape(Capsule())
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(generationMethod == .template ? Color.accentColor.opacity(0.15) : Color.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                            .overlay(
                                RoundedRectangle(cornerRadius: AppRadius.md)
                                    .stroke(generationMethod == .template ? Color.accentColor : Color.secondary.opacity(0.2), lineWidth: generationMethod == .template ? 2 : 1)
                            )
                        }
                        .buttonStyle(.plain)

                        // AI Generated
                        Button {
                            generationMethod = .ai
                        } label: {
                            VStack(spacing: AppSpacing.sm) {
                                Image(systemName: "cpu")
                                    .font(.title2)
                                    .foregroundColor(generationMethod == .ai ? .accentColor : .primary)
                                Text("AI Generated")
                                    .font(.caption)
                                    .fontWeight(.medium)
                                    .foregroundColor(.primary)
                                Text("Generate custom documents using AI")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                                    .multilineTextAlignment(.center)
                                Text("Custom")
                                    .font(.caption2)
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 2)
                                    .background(Color.blue)
                                    .clipShape(Capsule())
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(generationMethod == .ai ? Color.accentColor.opacity(0.15) : Color.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                            .overlay(
                                RoundedRectangle(cornerRadius: AppRadius.md)
                                    .stroke(generationMethod == .ai ? Color.accentColor : Color.secondary.opacity(0.2), lineWidth: generationMethod == .ai ? 2 : 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal)

                // Document Format Selection
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Document Format")
                        .font(.headline)

                    Picker("Format", selection: $documentFormat) {
                        ForEach(DocumentFormatType.allCases, id: \.self) { format in
                            Text(format.rawValue).tag(format)
                        }
                    }
                    .pickerStyle(.menu)
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
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
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
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
                    let success = await viewModel.generateDocument(
                        category: category,
                        template: selectedTemplate.isEmpty ? nil : selectedTemplate,
                        clientName: clientName,
                        clientEmail: clientEmail,
                        naturalLanguageInput: naturalLanguageInput,
                        format: documentFormat,
                        generationMode: generationMethod
                    )
                    if success {
                        showSuccess = true
                    } else {
                        showError = true
                    }
                }
            } label: {
                HStack {
                    if viewModel.isGenerating {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else {
                        Image(systemName: "doc.text")
                        Text("Generate Document")
                            .fontWeight(.semibold)
                    }
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(isFormValid ? Color.accentColor : Color.gray)
                .clipShape(Capsule())
            }
            .disabled(viewModel.isGenerating || !isFormValid)
            .padding()
            .background(Color(UIColor.systemBackground))
        }
        .alert("Document Generated!", isPresented: $showSuccess) {
            Button("View Document") {
                // Open the document in Safari/default viewer
                if let response = viewModel.generatedResponse {
                    let downloadURL = "http://localhost:3000/download/\(response.filename)"
                    if let url = URL(string: downloadURL) {
                        UIApplication.shared.open(url)
                    }
                }
                dismiss()
            }
            Button("Done", role: .cancel) {
                dismiss()
            }
        } message: {
            if let response = viewModel.generatedResponse {
                Text("Your \(response.format.uppercased()) document '\(response.filename)' has been created successfully.")
            } else {
                Text("Your document has been created successfully.")
            }
        }
        .alert("Error", isPresented: $showError) {
            Button("OK", role: .cancel) { }
        } message: {
            Text(viewModel.error ?? "Failed to generate document. Please try again.")
        }
        .onAppear {
            if let first = category.templates.first {
                selectedTemplate = first
            }
        }
    }

    // MARK: - Example Data (matches JavaScript form.ejs examples)
    private func loadExample1() {
        naturalLanguageInput = getExample1ForCategory()
    }

    private func loadExample2() {
        naturalLanguageInput = getExample2ForCategory()
    }

    private func getExample1ForCategory() -> String {
        switch category {
        case .businessFormation:
            return "I want to form a Limited Liability Company (LLC) for my consulting business. The company name is TechConsult Solutions LLC. The business will be registered in California. The registered agent is Sarah Johnson located at 456 Business Ave, Suite 200, Los Angeles, CA 90012. The business purpose is to provide technology consulting and software development services. There are two members: Michael Chen who owns 60% and holds the title of Managing Member, and Lisa Wong who owns 40% and is a Member. The company will be member-managed. The initial capital contribution is $50,000. The fiscal year will be calendar year. The business address is 789 Tech Park Drive, San Francisco, CA 94105."
        case .realEstate:
            return "I need to create a residential lease agreement for a property located at 123 Main Street, Apartment 4B, New York, NY 10001. The monthly rent is $2,500 and the security deposit is $2,500. The lease term is 12 months starting on January 1, 2026 and ending on December 31, 2026. The landlord is John Smith, phone number 555-123-4567, email john.smith@email.com. The tenant is Jane Doe, phone number 555-987-6543, email jane.doe@email.com. Utilities included are water and trash removal. Tenant is responsible for electricity and internet. Pets are allowed with a $300 pet deposit. No smoking is allowed on the property."
        case .familyLaw:
            return "I need to file for divorce. My name is Amanda Roberts and my spouse is James Roberts. We were married on June 15, 2015 in Miami, Florida. We have been separated since January 1, 2025. We have two minor children: Emma Roberts age 8 and Noah Roberts age 5. We agree on joint legal custody with primary physical custody to me. We own a home at 789 Maple Drive, Miami, FL 33101 valued at $400,000 with a mortgage of $250,000. We have a joint savings account with $30,000 and a joint checking account with $5,000. My spouse has a 401k worth $80,000. We agree to divide assets equally. I am requesting child support based on state guidelines."
        case .estatePlanning:
            return "I need to create a Last Will and Testament. My name is Robert Wilson, residing at 123 Oak Lane, Chicago, IL 60601. I am 65 years old, married to Helen Wilson. I have two adult children: Jennifer Wilson and Michael Wilson. I want to leave my estate as follows: 50% to my spouse Helen, 25% to Jennifer, and 25% to Michael. I own a home valued at $500,000, investment accounts totaling $300,000, and personal property valued at $50,000. I name my spouse Helen as executor, with my son Michael as alternate executor. I want my daughter Jennifer to be guardian of any minor grandchildren."
        case .employmentLaw:
            return "I need an employment agreement for a new hire. The company is Tech Innovations LLC located at 100 Tech Plaza, San Jose, CA 95101. The employee is Alex Morgan. The position is Senior Software Engineer. The start date is February 1, 2026. The annual salary is $120,000 paid bi-weekly. The employee is eligible for health insurance, dental insurance, and 401k with 4% company match. The employee will receive 15 days of PTO per year. The employment is at-will. The employee must sign a confidentiality agreement. The probationary period is 90 days."
        case .civilLitigation:
            return "I need to file a civil complaint. I am the plaintiff, Thomas Anderson, residing at 700 Elm Street, Phoenix, AZ 85001. The defendant is Global Services Corp located at 800 Corporate Drive, Phoenix, AZ 85002. On September 15, 2025, I entered into a contract with the defendant to provide consulting services for $50,000. I completed all services by November 1, 2025 as agreed. Despite multiple demands, the defendant has refused to pay the agreed amount. I am owed $50,000 plus interest. I am requesting judgment for $60,000 plus interest, costs, and attorney fees."
        case .contracts:
            return "I need a service agreement between my company and a client. My company is ABC Services LLC located at 300 Business Park, Seattle, WA 98101. The client is XYZ Corporation at 400 Corporate Center, Portland, OR 97201. We will provide IT support and maintenance services. The contract term is one year starting March 1, 2026. The monthly fee is $3,000 for up to 40 hours of service per month. Additional hours are billed at $100 per hour. Payment is due within 15 days of invoice."
        case .intellectualProperty:
            return "I need a trademark application. My company is Bright Ideas Inc at 100 Innovation Drive, San Francisco, CA 94102. I want to register the trademark \"BRIGHTTECH\" for software products and technology consulting services. The mark has been in use since January 2024. The mark is a word mark in standard characters. The goods/services fall under Class 9 (software) and Class 42 (consulting)."
        case .immigration:
            return "I need an employer sponsorship letter for H-1B visa. The employer is TechCorp USA Inc at 100 Silicon Way, Palo Alto, CA 94301, EIN 12-3456789. The beneficiary is Raj Patel from India. The position is Software Engineer at $95,000 annual salary. The job requires a Bachelor's degree in Computer Science. The position involves developing web applications using Python and JavaScript."
        case .healthcare:
            return "I need a HIPAA Authorization Form. The patient is John Smith, DOB 05/15/1975, residing at 123 Health Way, Boston, MA 02101. I authorize Dr. Sarah Johnson at Boston Medical Center to release my complete medical records to Attorney Mark Brown at Brown Law Firm for a personal injury claim. This authorization is valid until December 31, 2026."
        case .nonprofit:
            return "I need to create nonprofit bylaws. The organization is Community Youth Foundation, a California nonprofit corporation. The purpose is to provide educational programs and mentorship for underprivileged youth. The board will have 7 directors serving 3-year terms. Board meetings will be held quarterly. A quorum is a majority of directors. The fiscal year ends December 31."
        case .bankruptcy:
            return "I need to prepare Chapter 7 bankruptcy documents. My name is David Miller at 456 Main Street, Detroit, MI 48201, SSN 123-45-6789. My total unsecured debt is $75,000 including $40,000 in credit cards, $25,000 in medical bills, and $10,000 in personal loans. My monthly income is $3,500 and monthly expenses are $3,200. I own a car worth $8,000 with $5,000 owed. I rent my apartment."
        case .criminalLaw:
            return "I need to file a motion to suppress evidence. The defendant is Marcus Johnson. The case number is CR-2025-1234. On October 15, 2025, police officers conducted a search of my client's vehicle without a warrant or valid consent. The officers claim they smelled marijuana, but my client denies this. The search yielded evidence that should be excluded as it was obtained in violation of the Fourth Amendment."
        case .taxLaw:
            return "I need to submit an Offer in Compromise to the IRS. The taxpayer is Jennifer Adams, SSN 987-65-4321. The total tax liability is $45,000 for tax years 2020-2023. I am offering to settle for $15,000 based on doubt as to collectibility. My monthly income is $4,000 and monthly expenses are $3,800. I have minimal assets: a 10-year-old vehicle worth $5,000 and $2,000 in savings."
        case .securitiesLaw:
            return "I need a Private Placement Memorandum. The company is Growth Ventures LLC, a Delaware limited liability company. We are raising $2,000,000 through the sale of membership interests. The minimum investment is $50,000. This is a Rule 506(b) offering limited to accredited investors. The funds will be used for expansion of our software platform. The company has been operating since 2022 with annual revenue of $500,000."
        case .insuranceLaw:
            return "I need to file an insurance claim dispute. The policyholder is Robert Chen. The policy number is AUTO-789456. On November 1, 2025, my vehicle was damaged in an accident. The estimated repair cost is $12,000. The insurance company, SafeGuard Insurance, has offered only $5,000 claiming pre-existing damage. I dispute this assessment and have photographs showing the vehicle's condition before the accident."
        case .environmentalLaw:
            return "I need to prepare an Environmental Impact Assessment. The project is a new manufacturing facility to be built at 500 Industrial Parkway, Houston, TX 77001. The facility will be 50,000 square feet on a 10-acre site. The project involves construction of a chemical processing plant. Potential environmental impacts include air emissions, wastewater discharge, and noise. We need to assess impacts on nearby wetlands and residential areas."
        case .maritimeLaw:
            return "I need to file a cargo claim. The shipper is Pacific Trading Co. The vessel is MV Ocean Star. The bill of lading number is BL-2025-789. The cargo consists of 500 containers of electronics valued at $2,000,000. Upon delivery at Port of Los Angeles on December 1, 2025, 50 containers were found to have water damage. The estimated loss is $200,000. We are filing against the carrier for damage during transit."
        case .consumerProtection:
            return "I need to send an FDCPA violation letter. The consumer is Sarah Martinez. The debt collector is Aggressive Collections Inc. The alleged debt is $5,000 on a credit card account. The debt collector has been calling my workplace despite being told not to, calling before 8am, and using threatening language. I am demanding they cease all contact and providing notice of their violations of the Fair Debt Collection Practices Act."
        case .landlordTenant:
            return "I need to create a residential lease agreement. The property is located at 789 Oak Street, Apt 301, Denver, CO 80202. The landlord is Mountain Property Management LLC. The tenant is Emily Watson. The lease term is 12 months from February 1, 2026 to January 31, 2027. Monthly rent is $1,800 due on the 1st of each month. Security deposit is $1,800. One pet allowed with $250 pet deposit. Utilities included: water, trash. Tenant pays: electric, gas, internet."
        case .debtCollection:
            return "I need to send a debt collection letter. The creditor is First National Bank. The debtor is James Thompson at 456 Pine Avenue, Atlanta, GA 30301. The original debt was $8,000 for a personal loan. Current balance with interest is $9,500. The account became delinquent on August 1, 2025. We are providing the required 30-day validation notice and demand for payment within 30 days to avoid further collection action."
        case .entertainmentLaw:
            return "I need a talent representation agreement. The talent is Jessica Kim, an actress. The agent is Star Talent Agency LLC at 100 Hollywood Blvd, Los Angeles, CA 90028. The agreement covers film, television, and commercial work. The commission rate is 10% of gross compensation. The initial term is 2 years with automatic renewal. The agent has exclusive representation rights in North America."
        }
    }

    private func getExample2ForCategory() -> String {
        switch category {
        case .businessFormation:
            return "I need to create a Corporation for my manufacturing business. The corporation name is Advanced Manufacturing Inc. It will be registered in Delaware. The registered agent is Corporate Services LLC at 100 Corporate Blvd, Wilmington, DE 19801. The corporation purpose is to manufacture and distribute industrial equipment. The corporation will issue 10,000 shares of common stock with a par value of $1.00 per share. The incorporator is David Martinez. There are three directors: Jennifer Lee, Robert Brown, and Susan Taylor. The principal office is located at 500 Industrial Way, Chicago, IL 60601. The fiscal year ends on December 31."
        case .realEstate:
            return "I want to create a real estate purchase agreement. The property is a single-family home located at 456 Oak Avenue, Los Angeles, CA 90015. The purchase price is $750,000. The buyer is Mark Thompson and spouse Emily Thompson. The seller is Patricia Williams. The earnest money deposit is $25,000 to be held in escrow by ABC Title Company. The closing date is March 15, 2026. The sale includes all appliances, window treatments, and garage door openers. The property is being sold as-is. The buyer will obtain conventional financing. Contingencies include home inspection within 10 days and loan approval within 30 days."
        case .familyLaw:
            return "I want to create a prenuptial agreement. My name is Christopher Davis and my future spouse is Rachel Martinez. We plan to marry on August 20, 2026 in Austin, Texas. I own a business called Davis Tech Solutions valued at $500,000. I also own a rental property at 234 River Road, Austin, TX 78701. My future spouse owns a home at 567 Hill Street, Austin, TX 78702 valued at $350,000. We agree that all property owned before marriage will remain separate property. Any property acquired during marriage will be community property. We each have separate retirement accounts that will remain separate."
        case .estatePlanning:
            return "I want to create a Living Trust. My name is Elizabeth Taylor, residing at 456 Maple Street, San Diego, CA 92101. I want to create a revocable living trust to avoid probate. I am single with three adult children: David, Sarah, and Thomas. I want to transfer my home at 456 Maple Street, my investment accounts at Fidelity and Schwab, and my rental property at 789 Beach Road into the trust. Upon my death, assets should be distributed equally among my three children. I name myself as initial trustee, with my daughter Sarah as successor trustee."
        case .employmentLaw:
            return "I want to create a Non-Disclosure Agreement. The company is Innovation Labs Inc at 200 Tech Center, Austin, TX 78701. The employee/contractor is Jordan Lee. The agreement covers all proprietary information including software code, customer lists, business strategies, and financial data. The NDA is effective for 3 years after employment ends. Violations may result in injunctive relief and damages."
        case .civilLitigation:
            return "I want to send a demand letter. I am Maria Garcia at 900 Main Avenue, Miami, FL 33101. The recipient is Quick Fix Repairs owned by Tom Wilson at 1000 Service Road, Miami, FL 33102. On July 20, 2025, I paid $3,500 for roof repair. The work was incomplete and substandard. The roof still leaks. I demand a full refund of $3,500 within 10 business days or I will file a lawsuit and seek additional damages."
        case .contracts:
            return "I want to create a consulting agreement. The consultant is Jennifer Adams doing business as Adams Consulting at 500 Professional Plaza, Denver, CO 80201. The client is Mountain Corp at 600 Corporate Way, Boulder, CO 80301. The consulting services include business strategy and marketing advisory. The engagement is for 6 months at $10,000 per month. The consultant will provide monthly reports and attend bi-weekly meetings."
        case .intellectualProperty:
            return "I want to create an IP License Agreement. The licensor is Creative Works LLC owning copyright in a software application called \"TaskMaster Pro\". The licensee is Enterprise Solutions Inc. The license is non-exclusive for North America. The license fee is $50,000 upfront plus 5% royalty on net sales. The license term is 5 years with option to renew."
        case .immigration:
            return "I need an employment verification letter for visa application. The employee is Maria Santos who has worked at Global Finance Corp since March 2020. Her current position is Senior Financial Analyst with annual salary of $85,000. The letter should confirm her full-time permanent employment status and good standing."
        case .healthcare:
            return "I need a Business Associate Agreement. The covered entity is City Medical Group at 200 Healthcare Plaza, Chicago, IL 60601. The business associate is MedTech Solutions providing electronic health records management services. The agreement covers access to patient health information for system maintenance and support purposes."
        case .nonprofit:
            return "I need a 501(c)(3) application package. The organization is Green Earth Alliance incorporated in Oregon on January 15, 2025. Our mission is environmental conservation and education. Activities include tree planting programs, recycling initiatives, and environmental education workshops. We expect annual revenue of $100,000 from donations and grants. Initial board members are Jane Green (President), Mark Rivers (Treasurer), and Lisa Forest (Secretary)."
        case .bankruptcy:
            return "I need a debt settlement agreement. The debtor is Susan Clark. The creditor is First National Bank. The original debt was $15,000 on a credit card. The debtor offers to pay $7,500 as full settlement. Payment will be made in 3 monthly installments of $2,500. Upon receipt of final payment, the creditor agrees to report the account as \"settled in full\" to credit bureaus."
        case .criminalLaw:
            return "I need to prepare an expungement petition. The petitioner is Michael Brown. The case number is CR-2020-5678. The conviction was for misdemeanor possession, entered on March 15, 2020. Five years have passed since completion of probation. The petitioner has had no subsequent arrests or convictions. The petitioner has completed community service and rehabilitation programs."
        case .taxLaw:
            return "I need to request an Installment Agreement with the IRS. The taxpayer is Robert Martinez, SSN 456-78-9012. The total tax liability is $25,000 for tax years 2023-2024. I am requesting to pay $500 per month over 50 months. My monthly income is $5,500 and monthly expenses are $4,800. I can demonstrate ability to make the proposed monthly payments."
        case .securitiesLaw:
            return "I need a SAFE Agreement for an early-stage investment. The company is TechStartup Inc, a Delaware corporation. The investor is Angel Investor LLC. The investment amount is $100,000. The valuation cap is $5,000,000. The discount rate is 20%. The SAFE converts upon a qualified financing round of at least $1,000,000."
        case .insuranceLaw:
            return "I need to file a bad faith insurance claim. The policyholder is Lisa Anderson. The policy is a homeowner's policy with Reliable Insurance Co, policy number HO-456789. A covered water damage claim was filed on September 1, 2025. The claim was unreasonably delayed for 4 months. The insurer requested excessive documentation and made lowball offers. Total damages sought include policy benefits of $50,000 plus bad faith damages."
        case .environmentalLaw:
            return "I need to prepare a Remediation Plan. The site is a former gas station at 100 Main Street, Newark, NJ 07101. Soil and groundwater contamination has been identified. Contaminants include petroleum hydrocarbons and MTBE. The plan includes soil excavation, groundwater treatment, and long-term monitoring. Estimated cleanup costs are $500,000. Timeline is 18 months for active remediation."
        case .maritimeLaw:
            return "I need a Charter Party Agreement. The vessel owner is Maritime Holdings LLC. The charterer is Global Shipping Corp. The vessel is MV Pacific Trader, a 50,000 DWT bulk carrier. The charter type is time charter for 12 months. The daily rate is $15,000. The trading area is Pacific Ocean ports. The vessel will carry grain and bulk commodities."
        case .consumerProtection:
            return "I need to file a Lemon Law claim. The consumer is David Park. The vehicle is a 2025 Model X electric car, VIN 1234567890. The vehicle was purchased on January 15, 2025 from AutoDealer LLC. The vehicle has been in for repair 5 times for the same electrical system defect. The vehicle has been out of service for 45 days total. I am demanding a full refund or replacement vehicle under the state Lemon Law."
        case .landlordTenant:
            return "I need to prepare an eviction notice. The landlord is Sunset Properties LLC. The tenant is Michael Johnson at 123 Elm Street, Unit 5, Portland, OR 97201. The grounds for eviction are non-payment of rent. The tenant owes $4,500 in back rent for October, November, and December 2025. This is a 72-hour pay or vacate notice as required by Oregon law."
        case .debtCollection:
            return "I need a payment plan agreement for debt. The creditor is City Hospital. The debtor is Patricia White. The total debt is $12,000 for medical services. The debtor agrees to pay $400 per month for 30 months. Payments are due on the 15th of each month. A missed payment will result in the full balance becoming due. Upon completion, the debt will be marked as paid in full."
        case .entertainmentLaw:
            return "I need a music licensing agreement. The licensor is Songwriter Productions LLC, owner of the song \"Summer Dreams\". The licensee is AdAgency Inc for use in a television commercial. The license is for a 30-second clip. The territory is United States. The term is one year. The license fee is $25,000 for broadcast and $10,000 for digital use."
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
