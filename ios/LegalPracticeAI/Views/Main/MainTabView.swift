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
    @State private var showMoreMenu = false

    var body: some View {
        TabView(selection: $selectedTab) {
            // Dashboard
            DashboardView()
                .tabItem {
                    Label("Home", systemImage: "house.fill")
                }
                .tag(0)

            // Cases
            CasesView()
                .tabItem {
                    Label("Cases", systemImage: "folder.fill")
                }
                .tag(1)

            // Clients
            ClientsView()
                .tabItem {
                    Label("Clients", systemImage: "person.2.fill")
                }
                .tag(2)

            // Documents
            DocumentsView()
                .tabItem {
                    Label("Docs", systemImage: "doc.text.fill")
                }
                .tag(3)

            // More
            MoreView()
                .tabItem {
                    Label("More", systemImage: "ellipsis.circle.fill")
                }
                .tag(4)
        }
        .tint(.accentColor)
    }
}

// MARK: - Dashboard View
struct DashboardView: View {
    @State private var cases: [Case] = []
    @State private var clients: [Client] = []
    @State private var invoices: [Invoice] = []
    @State private var deadlines: [Deadline] = []
    @State private var isLoading = false

    // Quick Actions sheets
    @State private var showAddCase = false
    @State private var showAddClient = false
    @State private var showCreateDocument = false
    @State private var showAddTimeEntry = false
    @State private var showAddInvoice = false

    // ViewModels for Add views
    @StateObject private var casesViewModel = CasesViewModel()
    @StateObject private var clientsViewModel = ClientsViewModel()

    var openCasesCount: Int {
        cases.filter { $0.status?.lowercased() == "open" }.count
    }

    var activeClientsCount: Int {
        clients.filter { $0.status?.lowercased() != "inactive" }.count
    }

    var outstandingAmount: Double {
        invoices.filter { $0.status?.lowercased() == "sent" || $0.status?.lowercased() == "overdue" }
            .reduce(0) { $0 + (($1.total ?? 0) - ($1.amountPaid ?? 0)) }
    }

    var upcomingDeadlinesCount: Int {
        deadlines.filter { $0.status?.lowercased() != "completed" }.count
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.lg) {
                    // Welcome Header
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Welcome back")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            Text("Dashboard")
                                .font(.title)
                                .fontWeight(.bold)
                        }
                        Spacer()
                    }
                    .padding(.horizontal)

                    // Quick Stats Grid
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: AppSpacing.md) {
                        DashboardStatCard(title: "Open Cases", value: "\(openCasesCount)", icon: "folder", color: .blue)
                        DashboardStatCard(title: "Active Clients", value: "\(activeClientsCount)", icon: "person.2", color: .green)
                        DashboardStatCard(title: "Outstanding", value: "$\(String(format: "%.0f", outstandingAmount))", icon: "dollarsign.circle", color: .orange)
                        DashboardStatCard(title: "Deadlines", value: "\(upcomingDeadlinesCount)", icon: "exclamationmark.circle", color: .red)
                    }
                    .padding(.horizontal)

                    // Quick Actions
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("QUICK ACTIONS")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: AppSpacing.md) {
                                QuickActionButton(title: "New Case", icon: "folder.badge.plus", color: .blue) {
                                    showAddCase = true
                                }
                                QuickActionButton(title: "New Client", icon: "person.badge.plus", color: .green) {
                                    showAddClient = true
                                }
                                QuickActionButton(title: "New Document", icon: "doc.badge.plus", color: .purple) {
                                    showCreateDocument = true
                                }
                                QuickActionButton(title: "Log Time", icon: "clock.badge.checkmark", color: .orange) {
                                    showAddTimeEntry = true
                                }
                                QuickActionButton(title: "New Invoice", icon: "doc.text.fill", color: .pink) {
                                    showAddInvoice = true
                                }
                            }
                            .padding(.horizontal)
                        }
                    }

                    // Recent Activity Section
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        HStack {
                            Text("RECENT CASES")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundColor(.secondary)
                            Spacer()
                            NavigationLink(destination: CasesView()) {
                                Text("See All")
                                    .font(.caption)
                                    .foregroundColor(.accentColor)
                            }
                        }
                        .padding(.horizontal)

                        VStack(spacing: AppSpacing.sm) {
                            if cases.isEmpty {
                                Text("No cases yet")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                                    .frame(maxWidth: .infinity)
                                    .padding()
                            } else {
                                ForEach(cases.prefix(3)) { caseItem in
                                    RecentItemRow(
                                        title: caseItem.title ?? "Untitled Case",
                                        subtitle: "\(caseItem.caseType?.capitalized ?? "General") - \(caseItem.status?.capitalized ?? "Open")",
                                        icon: "folder",
                                        color: .blue
                                    )
                                }
                            }
                        }
                        .padding(.horizontal)
                    }

                    // Upcoming Deadlines
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        HStack {
                            Text("UPCOMING DEADLINES")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundColor(.secondary)
                            Spacer()
                            NavigationLink(destination: CalendarView()) {
                                Text("See All")
                                    .font(.caption)
                                    .foregroundColor(.accentColor)
                            }
                        }
                        .padding(.horizontal)

                        if deadlines.isEmpty {
                            HStack {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.green)
                                Text("No upcoming deadlines")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                            .padding(.horizontal)
                        } else {
                            VStack(spacing: AppSpacing.sm) {
                                ForEach(deadlines.prefix(3)) { deadline in
                                    RecentItemRow(
                                        title: deadline.title ?? "Untitled",
                                        subtitle: deadline.dueDate?.formatted(date: .abbreviated, time: .omitted) ?? "No date",
                                        icon: "exclamationmark.circle",
                                        color: .red
                                    )
                                }
                            }
                            .padding(.horizontal)
                        }
                    }
                }
                .padding(.top)
                .padding(.bottom, AppSpacing.xxl)
            }
            .background(Color(UIColor.systemGroupedBackground))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    NavigationLink(destination: ProfileView()) {
                        Image(systemName: "person.circle")
                            .font(.title3)
                    }
                }
            }
        }
        .task {
            await loadDashboardData()
        }
        .refreshable {
            await loadDashboardData()
        }
        .sheet(isPresented: $showAddCase) {
            AddCaseView(viewModel: casesViewModel)
        }
        .sheet(isPresented: $showAddClient) {
            AddClientView(viewModel: clientsViewModel)
        }
        .sheet(isPresented: $showCreateDocument) {
            CreateDocumentView()
        }
        .sheet(isPresented: $showAddTimeEntry) {
            AddTimeEntryView()
        }
        .sheet(isPresented: $showAddInvoice) {
            AddInvoiceView()
        }
    }

    func loadDashboardData() async {
        isLoading = true

        // Fetch each endpoint separately to identify which one fails
        do {
            let casesResponse = try await APIService.shared.getCases()
            print("DEBUG: Loaded \(casesResponse.cases.count) cases")
            cases = casesResponse.cases
        } catch {
            print("DEBUG: Cases load error: \(error)")
        }

        do {
            let clientsResponse = try await APIService.shared.getClients()
            print("DEBUG: Loaded \(clientsResponse.clients.count) clients")
            clients = clientsResponse.clients
        } catch {
            print("DEBUG: Clients load error: \(error)")
        }

        do {
            let invoicesResponse = try await APIService.shared.getInvoices()
            print("DEBUG: Loaded \(invoicesResponse.invoices.count) invoices")
            invoices = invoicesResponse.invoices
        } catch {
            print("DEBUG: Invoices load error: \(error)")
        }

        do {
            let deadlinesResponse = try await APIService.shared.getDeadlines()
            print("DEBUG: Loaded \(deadlinesResponse.deadlines.count) deadlines")
            deadlines = deadlinesResponse.deadlines
        } catch {
            print("DEBUG: Deadlines load error: \(error)")
        }

        isLoading = false
    }
}

// MARK: - Dashboard Stat Card
struct DashboardStatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundColor(color)
                Spacer()
            }

            Text(value)
                .font(.title)
                .fontWeight(.bold)

            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
    }
}

// MARK: - Quick Action Button
struct QuickActionButton: View {
    let title: String
    let icon: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: AppSpacing.sm) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(.white)
                    .frame(width: 50, height: 50)
                    .background(color)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))

                Text(title)
                    .font(.caption)
                    .foregroundColor(.primary)
                    .multilineTextAlignment(.center)
            }
            .frame(width: 70)
        }
    }
}

// MARK: - Recent Item Row
struct RecentItemRow: View {
    let title: String
    let subtitle: String
    let icon: String
    let color: Color

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(.white)
                .frame(width: 40, height: 40)
                .background(color)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.sm))

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)

                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
    }
}

// MARK: - More View
struct MoreView: View {
    let columns = [
        GridItem(.flexible(), spacing: AppSpacing.md),
        GridItem(.flexible(), spacing: AppSpacing.md)
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.xl) {
                    // LEADS Section
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("LEADS")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)

                        LazyVGrid(columns: columns, spacing: AppSpacing.md) {
                            MoreMenuCard(
                                title: "New Leads",
                                icon: "person.badge.plus",
                                color: .green,
                                destination: AnyView(NewLeadsView())
                            )
                            MoreMenuCard(
                                title: "Active Leads",
                                icon: "person.wave.2.fill",
                                color: .blue,
                                destination: AnyView(ActiveLeadsView())
                            )
                            MoreMenuCard(
                                title: "Converted",
                                icon: "checkmark.circle.fill",
                                color: .teal,
                                destination: AnyView(ConvertedLeadsView())
                            )
                            MoreMenuCard(
                                title: "Lost Leads",
                                icon: "person.fill.xmark",
                                color: .red,
                                destination: AnyView(LostLeadsView())
                            )
                            MoreMenuCard(
                                title: "Lead Sources",
                                icon: "arrow.triangle.branch",
                                color: .purple,
                                destination: AnyView(LeadSourcesView())
                            )
                            MoreMenuCard(
                                title: "Follow-ups",
                                icon: "arrow.uturn.forward.circle.fill",
                                color: .orange,
                                destination: AnyView(FollowUpsView())
                            )
                            MoreMenuCard(
                                title: "Analytics",
                                icon: "chart.bar.xaxis",
                                color: .indigo,
                                destination: AnyView(LeadsAnalyticsView())
                            )
                            MoreMenuCard(
                                title: "Form Builder",
                                icon: "doc.badge.gearshape.fill",
                                color: .cyan,
                                destination: AnyView(LeadFormBuilderView())
                            )
                        }
                        .padding(.horizontal)
                    }

                    // CONFLICTS Section
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("CONFLICTS")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)

                        LazyVGrid(columns: columns, spacing: AppSpacing.md) {
                            MoreMenuCard(
                                title: "Conflict Check",
                                icon: "exclamationmark.triangle.fill",
                                color: .red,
                                destination: AnyView(ConflictCheckView())
                            )
                            MoreMenuCard(
                                title: "Conflict History",
                                icon: "clock.arrow.circlepath",
                                color: .orange,
                                destination: AnyView(ConflictHistoryView())
                            )
                            MoreMenuCard(
                                title: "Related Parties",
                                icon: "person.2.circle.fill",
                                color: .blue,
                                destination: AnyView(RelatedPartiesView())
                            )
                            MoreMenuCard(
                                title: "Waivers",
                                icon: "doc.badge.ellipsis",
                                color: .purple,
                                destination: AnyView(WaiversView())
                            )
                        }
                        .padding(.horizontal)
                    }

                    // CALENDAR Section
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("CALENDAR")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)

                        LazyVGrid(columns: columns, spacing: AppSpacing.md) {
                            MoreMenuCard(
                                title: "Calendar",
                                icon: "calendar",
                                color: .red,
                                destination: AnyView(CalendarView())
                            )
                            MoreMenuCard(
                                title: "Deadlines",
                                icon: "exclamationmark.circle.fill",
                                color: .yellow,
                                destination: AnyView(DeadlinesView())
                            )
                            MoreMenuCard(
                                title: "Court Dates",
                                icon: "building.columns.fill",
                                color: .blue,
                                destination: AnyView(CourtDatesView())
                            )
                            MoreMenuCard(
                                title: "Appointments",
                                icon: "person.crop.circle.badge.clock",
                                color: .green,
                                destination: AnyView(AppointmentsView())
                            )
                            MoreMenuCard(
                                title: "Reminders",
                                icon: "bell.fill",
                                color: .cyan,
                                destination: AnyView(RemindersView())
                            )
                            MoreMenuCard(
                                title: "Statute Limits",
                                icon: "hourglass",
                                color: .orange,
                                destination: AnyView(StatuteLimitsView())
                            )
                        }
                        .padding(.horizontal)
                    }

                    // BILLING Section
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("BILLING")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)

                        LazyVGrid(columns: columns, spacing: AppSpacing.md) {
                            MoreMenuCard(
                                title: "Invoices",
                                icon: "doc.text.fill",
                                color: .pink,
                                destination: AnyView(InvoicesView())
                            )
                            MoreMenuCard(
                                title: "Time Tracking",
                                icon: "clock.fill",
                                color: .orange,
                                destination: AnyView(TimeTrackingView())
                            )
                            MoreMenuCard(
                                title: "Expenses",
                                icon: "dollarsign.arrow.circlepath",
                                color: .red,
                                destination: AnyView(ExpensesView())
                            )
                            MoreMenuCard(
                                title: "Retainers",
                                icon: "banknote.fill",
                                color: .green,
                                destination: AnyView(RetainersView())
                            )
                            MoreMenuCard(
                                title: "LEDES Export",
                                icon: "square.and.arrow.up.fill",
                                color: .blue,
                                destination: AnyView(LEDESExportView())
                            )
                            MoreMenuCard(
                                title: "Billing Reports",
                                icon: "chart.bar.doc.horizontal.fill",
                                color: .purple,
                                destination: AnyView(BillingReportsView())
                            )
                        }
                        .padding(.horizontal)
                    }

                    // TRUST ACCOUNTING Section
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("TRUST ACCOUNTING")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)

                        LazyVGrid(columns: columns, spacing: AppSpacing.md) {
                            MoreMenuCard(
                                title: "Trust Accounts",
                                icon: "building.columns.circle.fill",
                                color: .blue,
                                destination: AnyView(TrustAccountsView())
                            )
                            MoreMenuCard(
                                title: "Trust Ledger",
                                icon: "list.bullet.rectangle.fill",
                                color: .indigo,
                                destination: AnyView(TrustLedgerView())
                            )
                            MoreMenuCard(
                                title: "Transactions",
                                icon: "arrow.left.arrow.right.circle.fill",
                                color: .green,
                                destination: AnyView(TrustTransactionsView())
                            )
                            MoreMenuCard(
                                title: "Trust Reports",
                                icon: "doc.richtext.fill",
                                color: .purple,
                                destination: AnyView(TrustReportsView())
                            )
                            MoreMenuCard(
                                title: "Reconciliation",
                                icon: "checkmark.rectangle.stack.fill",
                                color: .orange,
                                destination: AnyView(ReconciliationView())
                            )
                            MoreMenuCard(
                                title: "3-Way Reconcile",
                                icon: "rectangle.3.group.fill",
                                color: .teal,
                                destination: AnyView(ThreeWayReconcileView())
                            )
                        }
                        .padding(.horizontal)
                    }

                    // PAYMENTS Section
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("PAYMENTS")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)

                        LazyVGrid(columns: columns, spacing: AppSpacing.md) {
                            MoreMenuCard(
                                title: "Receive Payment",
                                icon: "plus.circle.fill",
                                color: .green,
                                destination: AnyView(ReceivePaymentView())
                            )
                            MoreMenuCard(
                                title: "Payment History",
                                icon: "clock.arrow.circlepath",
                                color: .blue,
                                destination: AnyView(PaymentHistoryView())
                            )
                            MoreMenuCard(
                                title: "Payment Plans",
                                icon: "calendar.badge.clock",
                                color: .orange,
                                destination: AnyView(PaymentPlansView())
                            )
                            MoreMenuCard(
                                title: "Online Payments",
                                icon: "creditcard.fill",
                                color: .purple,
                                destination: AnyView(OnlinePaymentsView())
                            )
                            MoreMenuCard(
                                title: "Refunds",
                                icon: "arrow.uturn.backward.circle.fill",
                                color: .red,
                                destination: AnyView(RefundsView())
                            )
                            MoreMenuCard(
                                title: "Payment Reports",
                                icon: "chart.bar.fill",
                                color: .teal,
                                destination: AnyView(PaymentReportsView())
                            )
                        }
                        .padding(.horizontal)
                    }

                    // AI Features Section
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("AI FEATURES")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)

                        LazyVGrid(columns: columns, spacing: AppSpacing.md) {
                            MoreMenuCard(
                                title: "AI Drafting",
                                icon: "doc.badge.gearshape.fill",
                                color: .purple,
                                destination: AnyView(AIDraftingView())
                            )
                            MoreMenuCard(
                                title: "AI Billing",
                                icon: "dollarsign.circle.fill",
                                color: .green,
                                destination: AnyView(AIBillingView())
                            )
                            MoreMenuCard(
                                title: "AI Communications",
                                icon: "envelope.badge.fill",
                                color: .blue,
                                destination: AnyView(AICommunicationsView())
                            )
                            MoreMenuCard(
                                title: "AI Predictions",
                                icon: "chart.line.uptrend.xyaxis.circle.fill",
                                color: .indigo,
                                destination: AnyView(AIPredictionsView())
                            )
                            MoreMenuCard(
                                title: "Citation Finder",
                                icon: "text.book.closed.fill",
                                color: .brown,
                                destination: AnyView(CitationFinderView())
                            )
                            MoreMenuCard(
                                title: "AI Intake Forms",
                                icon: "doc.badge.ellipsis",
                                color: .pink,
                                destination: AnyView(AIIntakeFormsView())
                            )
                            MoreMenuCard(
                                title: "Voice Notes",
                                icon: "waveform",
                                color: .orange,
                                destination: AnyView(VoiceNotesView())
                            )
                            MoreMenuCard(
                                title: "Summarization",
                                icon: "doc.text.magnifyingglass",
                                color: .cyan,
                                destination: AnyView(DocumentSummaryView())
                            )
                            MoreMenuCard(
                                title: "Contract Analysis",
                                icon: "shield.checkerboard",
                                color: .teal,
                                destination: AnyView(ContractAnalysisView())
                            )
                            MoreMenuCard(
                                title: "Legal Research",
                                icon: "books.vertical.fill",
                                color: .mint,
                                destination: AnyView(LegalResearchView())
                            )
                        }
                        .padding(.horizontal)
                    }

                    // Documents Section
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("DOCUMENTS")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)

                        LazyVGrid(columns: columns, spacing: AppSpacing.md) {
                            MoreMenuCard(
                                title: "Generate Doc",
                                icon: "doc.badge.plus",
                                color: .indigo,
                                destination: AnyView(CreateDocumentView())
                            )
                            MoreMenuCard(
                                title: "Templates",
                                icon: "doc.on.doc.fill",
                                color: .cyan,
                                destination: AnyView(TemplatesView())
                            )
                            MoreMenuCard(
                                title: "E-Signatures",
                                icon: "signature",
                                color: .purple,
                                destination: AnyView(ESignaturesView())
                            )
                            MoreMenuCard(
                                title: "OCR Scanner",
                                icon: "doc.viewfinder",
                                color: .mint,
                                destination: AnyView(OCRScannerView())
                            )
                        }
                        .padding(.horizontal)
                    }

                    // Court & Filings Section
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("COURT & FILINGS")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)

                        LazyVGrid(columns: columns, spacing: AppSpacing.md) {
                            MoreMenuCard(
                                title: "Filings",
                                icon: "tray.full.fill",
                                color: .indigo,
                                destination: AnyView(FilingsView())
                            )
                            MoreMenuCard(
                                title: "Discovery",
                                icon: "magnifyingglass.circle.fill",
                                color: .purple,
                                destination: AnyView(DiscoveryView())
                            )
                            MoreMenuCard(
                                title: "Evidence",
                                icon: "photo.stack.fill",
                                color: .teal,
                                destination: AnyView(EvidenceView())
                            )
                            MoreMenuCard(
                                title: "Service of Process",
                                icon: "envelope.badge.fill",
                                color: .orange,
                                destination: AnyView(ServiceOfProcessView())
                            )
                        }
                        .padding(.horizontal)
                    }

                    // Tasks Section
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("TASKS")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)

                        LazyVGrid(columns: columns, spacing: AppSpacing.md) {
                            MoreMenuCard(
                                title: "My Tasks",
                                icon: "checklist",
                                color: .orange,
                                destination: AnyView(TasksView())
                            )
                            MoreMenuCard(
                                title: "Team Tasks",
                                icon: "person.2.badge.gearshape.fill",
                                color: .blue,
                                destination: AnyView(TeamTasksView())
                            )
                            MoreMenuCard(
                                title: "Completed",
                                icon: "checkmark.circle.fill",
                                color: .green,
                                destination: AnyView(CompletedTasksView())
                            )
                            MoreMenuCard(
                                title: "Workflows",
                                icon: "arrow.triangle.branch",
                                color: .purple,
                                destination: AnyView(WorkflowsView())
                            )
                        }
                        .padding(.horizontal)
                    }

                    // Communications Section
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("COMMUNICATIONS")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)

                        LazyVGrid(columns: columns, spacing: AppSpacing.md) {
                            MoreMenuCard(
                                title: "Messages",
                                icon: "message.fill",
                                color: .green,
                                destination: AnyView(MessagesView())
                            )
                            MoreMenuCard(
                                title: "Emails",
                                icon: "envelope.fill",
                                color: .blue,
                                destination: AnyView(EmailsView())
                            )
                            MoreMenuCard(
                                title: "Call Log",
                                icon: "phone.fill",
                                color: .teal,
                                destination: AnyView(CallLogView())
                            )
                            MoreMenuCard(
                                title: "Notes",
                                icon: "note.text",
                                color: .yellow,
                                destination: AnyView(NotesView())
                            )
                        }
                        .padding(.horizontal)
                    }

                    // Reports Section
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("REPORTS & ANALYTICS")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)

                        LazyVGrid(columns: columns, spacing: AppSpacing.md) {
                            MoreMenuCard(
                                title: "Dashboard",
                                icon: "chart.bar.fill",
                                color: .blue,
                                destination: AnyView(ReportsDashboardView())
                            )
                            MoreMenuCard(
                                title: "Financials",
                                icon: "chart.pie.fill",
                                color: .green,
                                destination: AnyView(FinancialReportsView())
                            )
                            MoreMenuCard(
                                title: "Productivity",
                                icon: "chart.line.uptrend.xyaxis",
                                color: .orange,
                                destination: AnyView(ProductivityReportsView())
                            )
                            MoreMenuCard(
                                title: "Case Stats",
                                icon: "chart.xyaxis.line",
                                color: .purple,
                                destination: AnyView(CaseStatsView())
                            )
                        }
                        .padding(.horizontal)
                    }

                    // Settings Section
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("SETTINGS & ACCOUNT")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)

                        LazyVGrid(columns: columns, spacing: AppSpacing.md) {
                            MoreMenuCard(
                                title: "Settings",
                                icon: "gear",
                                color: .gray,
                                destination: AnyView(SettingsView())
                            )
                            MoreMenuCard(
                                title: "Profile",
                                icon: "person.circle.fill",
                                color: .blue,
                                destination: AnyView(ProfileView())
                            )
                            MoreMenuCard(
                                title: "Team",
                                icon: "person.3.fill",
                                color: .indigo,
                                destination: AnyView(TeamView())
                            )
                            MoreMenuCard(
                                title: "Integrations",
                                icon: "link.circle.fill",
                                color: .teal,
                                destination: AnyView(IntegrationsView())
                            )
                            MoreMenuCard(
                                title: "Subscription",
                                icon: "creditcard.circle.fill",
                                color: .green,
                                destination: AnyView(SubscriptionManagementView())
                            )
                        }
                        .padding(.horizontal)
                    }
                }
                .padding(.top)
                .padding(.bottom, AppSpacing.xxl)
            }
            .navigationTitle("More")
            .background(Color(UIColor.systemGroupedBackground))
        }
    }
}

// MARK: - More Menu Card
struct MoreMenuCard<Destination: View>: View {
    let title: String
    let icon: String
    let color: Color
    let destination: Destination

    var body: some View {
        NavigationLink(destination: destination) {
            VStack(spacing: AppSpacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 28))
                    .foregroundColor(color)

                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.primary)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 90)
            .padding()
            .background(Color.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
            .shadow(color: Color.black.opacity(0.05), radius: 5, x: 0, y: 2)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Time Tracking View
struct TimeTrackingView: View {
    @State private var timeEntries: [TimeEntry] = []
    @State private var isLoading = false
    @State private var showAddEntry = false

    var todayMinutes: Int {
        let today = Calendar.current.startOfDay(for: Date())
        return timeEntries.filter { entry in
            guard let date = entry.date else { return false }
            return Calendar.current.isDate(date, inSameDayAs: today)
        }.reduce(0) { $0 + ($1.durationMinutes ?? 0) }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Today's Summary
            VStack(spacing: AppSpacing.sm) {
                Text("Today")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text(formatDuration(todayMinutes))
                    .font(.system(size: 48, weight: .bold, design: .rounded))
                    .foregroundColor(.accentColor)

                Button {
                    showAddEntry = true
                } label: {
                    Label("Log Time", systemImage: "plus.circle.fill")
                        .font(.headline)
                }
                .buttonStyle(.borderedProminent)
            }
            .padding()
            .frame(maxWidth: .infinity)
            .background(Color.cardBackground)

            // Time Entries List
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if timeEntries.isEmpty {
                VStack(spacing: AppSpacing.lg) {
                    Image(systemName: "clock")
                        .font(.system(size: 60))
                        .foregroundColor(.secondary)

                    Text("No Time Entries")
                        .font(.title3)
                        .fontWeight(.semibold)

                    Text("Start tracking your billable hours")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(timeEntries) { entry in
                        TimeEntryRow(entry: entry)
                            .listRowBackground(Color.cardBackground)
                    }
                }
                .listStyle(.plain)
                .refreshable {
                    await loadEntries()
                }
            }
        }
        .navigationTitle("Time Tracking")
        .sheet(isPresented: $showAddEntry) {
            AddTimeEntryView()
        }
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await loadEntries()
        }
    }

    func formatDuration(_ minutes: Int) -> String {
        let h = minutes / 60
        let m = minutes % 60
        return String(format: "%d:%02d", h, m)
    }

    func loadEntries() async {
        isLoading = true
        do {
            let response = try await APIService.shared.getTimeEntries()
            timeEntries = response.timeEntries
        } catch {
            print("Failed to load time entries: \(error)")
        }
        isLoading = false
    }
}

// MARK: - Time Entry Row
struct TimeEntryRow: View {
    let entry: TimeEntry

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                Text(entry.description ?? "No description")
                    .font(.body)
                    .fontWeight(.medium)
                    .lineLimit(2)

                Spacer()

                Text(entry.formattedDuration)
                    .font(.headline)
                    .foregroundColor(.accentColor)
            }

            HStack {
                if let date = entry.date {
                    Text(date.formatted(date: .abbreviated, time: .omitted))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                if entry.isBillable == true {
                    Text("Billable")
                        .font(.caption2)
                        .foregroundColor(.green)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.green.opacity(0.1))
                        .clipShape(Capsule())
                }

                Spacer()

                if let amount = entry.amount {
                    Text("$\(String(format: "%.2f", amount))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

// MARK: - Add Time Entry View
struct AddTimeEntryView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var casesViewModel = CasesViewModel()

    @State private var description = ""
    @State private var hours = 0
    @State private var minutes = 0
    @State private var date = Date()
    @State private var selectedCaseId: String?
    @State private var isBillable = true
    @State private var billingRate = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Time") {
                    HStack {
                        Picker("Hours", selection: $hours) {
                            ForEach(0..<24) { Text("\($0) hr").tag($0) }
                        }
                        .pickerStyle(.wheel)

                        Picker("Minutes", selection: $minutes) {
                            ForEach([0, 6, 12, 15, 18, 24, 30, 36, 42, 45, 48, 54], id: \.self) {
                                Text("\($0) min").tag($0)
                            }
                        }
                        .pickerStyle(.wheel)
                    }
                    .frame(height: 120)

                    DatePicker("Date", selection: $date, displayedComponents: .date)
                }

                Section("Details") {
                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(3...6)

                    Picker("Case", selection: $selectedCaseId) {
                        Text("No Case").tag(nil as String?)
                        ForEach(casesViewModel.cases, id: \.id) { caseItem in
                            Text(caseItem.title ?? "Untitled").tag(caseItem.id as String?)
                        }
                    }
                }

                Section("Billing") {
                    Toggle("Billable", isOn: $isBillable)

                    if isBillable {
                        TextField("Rate ($/hr)", text: $billingRate)
                            .keyboardType(.decimalPad)
                    }
                }
            }
            .navigationTitle("Log Time")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { dismiss() }
                        .disabled(hours == 0 && minutes == 0)
                }
            }
        }
        .task {
            await casesViewModel.loadCases()
        }
    }
}

// MARK: - Legal Research View
struct LegalResearchView: View {
    @State private var searchQuery = ""
    @State private var searchResults: [SearchResult] = []
    @State private var isSearching = false
    @State private var recentSearches: [String] = ["Contract breach", "Negligence standard", "Property rights"]

    struct SearchResult: Identifiable {
        let id = UUID()
        let title: String
        let source: String
        let excerpt: String
        let relevance: Double
    }

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Search Bar
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)
                    TextField("Search legal topics, cases, statutes...", text: $searchQuery)
                        .textFieldStyle(.plain)
                    if !searchQuery.isEmpty {
                        Button { searchQuery = "" } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Search Button
                Button {
                    performSearch()
                } label: {
                    HStack {
                        if isSearching {
                            ProgressView().tint(.white)
                        }
                        Text(isSearching ? "Searching..." : "Search")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(searchQuery.isEmpty || isSearching)
                .padding(.horizontal)

                // Results or Recent Searches
                if !searchResults.isEmpty {
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("SEARCH RESULTS")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)

                        ForEach(searchResults) { result in
                            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                                Text(result.title)
                                    .font(.headline)
                                Text(result.source)
                                    .font(.caption)
                                    .foregroundColor(.accentColor)
                                Text(result.excerpt)
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                                    .lineLimit(3)
                                HStack {
                                    Text("Relevance: \(Int(result.relevance * 100))%")
                                        .font(.caption2)
                                        .foregroundColor(.green)
                                    Spacer()
                                    Button("View") {}
                                        .font(.caption)
                                }
                            }
                            .padding()
                            .background(Color.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                            .padding(.horizontal)
                        }
                    }
                } else {
                    // Recent Searches
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("RECENT SEARCHES")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)

                        ForEach(recentSearches, id: \.self) { search in
                            Button {
                                searchQuery = search
                            } label: {
                                HStack {
                                    Image(systemName: "clock.arrow.circlepath")
                                        .foregroundColor(.secondary)
                                    Text(search)
                                        .foregroundColor(.primary)
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .foregroundColor(.secondary)
                                }
                                .padding()
                                .background(Color.cardBackground)
                                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                            }
                            .padding(.horizontal)
                        }
                    }

                    // Quick Links
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("QUICK LINKS")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)

                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: AppSpacing.md) {
                            QuickLinkCard(title: "Case Law", icon: "building.columns", color: .blue)
                            QuickLinkCard(title: "Statutes", icon: "book.closed", color: .green)
                            QuickLinkCard(title: "Regulations", icon: "doc.text", color: .orange)
                            QuickLinkCard(title: "Secondary", icon: "books.vertical", color: .purple)
                        }
                        .padding(.horizontal)
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Legal Research")
        .background(Color(UIColor.systemGroupedBackground))
    }

    func performSearch() {
        isSearching = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            searchResults = [
                SearchResult(title: "\(searchQuery) - Case Analysis", source: "Supreme Court, 2023", excerpt: "The court held that \(searchQuery.lowercased()) requires consideration of multiple factors including intent, damages, and proximate cause.", relevance: 0.95),
                SearchResult(title: "State v. \(searchQuery.capitalized)", source: "State Appeals Court, 2022", excerpt: "This case established the standard for \(searchQuery.lowercased()) in civil matters.", relevance: 0.87),
                SearchResult(title: "\(searchQuery) Standards Guide", source: "Legal Encyclopedia", excerpt: "A comprehensive overview of \(searchQuery.lowercased()) principles and their application.", relevance: 0.82)
            ]
            if !recentSearches.contains(searchQuery) {
                recentSearches.insert(searchQuery, at: 0)
                if recentSearches.count > 5 { recentSearches.removeLast() }
            }
            isSearching = false
        }
    }
}

struct QuickLinkCard: View {
    let title: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: AppSpacing.sm) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)
            Text(title)
                .font(.caption)
                .fontWeight(.medium)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
    }
}

// MARK: - Templates View
struct TemplatesView: View {
    @State private var selectedCategory: String = "All"
    let categories = ["All", "Contracts", "Litigation", "Corporate", "Real Estate", "Family"]

    struct DocTemplate: Identifiable {
        let id = UUID()
        let name: String
        let category: String
        let description: String
        let lastUsed: Date?
    }

    let templates: [DocTemplate] = [
        DocTemplate(name: "Standard Engagement Letter", category: "Contracts", description: "Client engagement agreement", lastUsed: Date()),
        DocTemplate(name: "Motion to Dismiss", category: "Litigation", description: "12(b)(6) motion template", lastUsed: Date().addingTimeInterval(-86400)),
        DocTemplate(name: "Asset Purchase Agreement", category: "Corporate", description: "M&A transaction template", lastUsed: nil),
        DocTemplate(name: "Residential Lease", category: "Real Estate", description: "Standard residential lease", lastUsed: Date().addingTimeInterval(-172800)),
        DocTemplate(name: "Divorce Petition", category: "Family", description: "Initial divorce filing", lastUsed: nil),
        DocTemplate(name: "NDA - Mutual", category: "Contracts", description: "Two-way confidentiality agreement", lastUsed: Date().addingTimeInterval(-259200)),
    ]

    var filteredTemplates: [DocTemplate] {
        selectedCategory == "All" ? templates : templates.filter { $0.category == selectedCategory }
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: AppSpacing.sm) {
                    ForEach(categories, id: \.self) { category in
                        FilterChip(title: category, isSelected: selectedCategory == category) {
                            selectedCategory = category
                        }
                    }
                }
                .padding()
            }
            .background(Color.cardBackground)

            List {
                ForEach(filteredTemplates) { template in
                    HStack(spacing: AppSpacing.md) {
                        Image(systemName: "doc.text.fill")
                            .foregroundColor(.cyan)
                            .font(.title2)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(template.name)
                                .font(.body)
                                .fontWeight(.medium)
                            Text(template.description)
                                .font(.caption)
                                .foregroundColor(.secondary)
                            if let lastUsed = template.lastUsed {
                                Text("Last used: \(lastUsed.formatted(date: .abbreviated, time: .omitted))")
                                    .font(.caption2)
                                    .foregroundColor(.accentColor)
                            }
                        }
                        Spacer()
                        Button { } label: {
                            Image(systemName: "doc.badge.plus")
                        }
                    }
                    .padding(.vertical, AppSpacing.xs)
                    .listRowBackground(Color.cardBackground)
                }
            }
            .listStyle(.plain)
        }
        .navigationTitle("Templates")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { } label: { Image(systemName: "plus") }
            }
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

// MARK: - E-Signatures View
struct ESignaturesView: View {
    struct SignatureRequest: Identifiable {
        let id = UUID()
        let documentName: String
        let recipient: String
        let status: String
        let sentDate: Date
    }

    @State private var requests: [SignatureRequest] = [
        SignatureRequest(documentName: "Engagement Letter - Smith", recipient: "john.smith@email.com", status: "pending", sentDate: Date()),
        SignatureRequest(documentName: "Settlement Agreement", recipient: "jane.doe@email.com", status: "signed", sentDate: Date().addingTimeInterval(-86400)),
        SignatureRequest(documentName: "Power of Attorney", recipient: "bob@email.com", status: "expired", sentDate: Date().addingTimeInterval(-604800)),
    ]

    var body: some View {
        VStack(spacing: 0) {
            // Stats
            HStack(spacing: AppSpacing.lg) {
                VStack {
                    Text("\(requests.filter { $0.status == "pending" }.count)")
                        .font(.title2).fontWeight(.bold).foregroundColor(.orange)
                    Text("Pending").font(.caption).foregroundColor(.secondary)
                }
                VStack {
                    Text("\(requests.filter { $0.status == "signed" }.count)")
                        .font(.title2).fontWeight(.bold).foregroundColor(.green)
                    Text("Signed").font(.caption).foregroundColor(.secondary)
                }
                VStack {
                    Text("\(requests.count)")
                        .font(.title2).fontWeight(.bold).foregroundColor(.blue)
                    Text("Total").font(.caption).foregroundColor(.secondary)
                }
            }
            .padding()
            .frame(maxWidth: .infinity)
            .background(Color.cardBackground)

            List {
                ForEach(requests) { request in
                    HStack(spacing: AppSpacing.md) {
                        Image(systemName: request.status == "signed" ? "checkmark.seal.fill" : "signature")
                            .foregroundColor(request.status == "signed" ? .green : (request.status == "pending" ? .orange : .red))
                            .font(.title2)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(request.documentName).font(.body).fontWeight(.medium)
                            Text(request.recipient).font(.caption).foregroundColor(.secondary)
                            Text("Sent: \(request.sentDate.formatted(date: .abbreviated, time: .omitted))")
                                .font(.caption2).foregroundColor(.accentColor)
                        }
                        Spacer()
                        Text(request.status.capitalized)
                            .font(.caption)
                            .foregroundColor(request.status == "signed" ? .green : (request.status == "pending" ? .orange : .red))
                    }
                    .padding(.vertical, AppSpacing.xs)
                    .listRowBackground(Color.cardBackground)
                }
            }
            .listStyle(.plain)
        }
        .navigationTitle("E-Signatures")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { } label: { Label("New Request", systemImage: "plus") }
            }
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

// MARK: - OCR Scanner View
struct OCRScannerView: View {
    @State private var scannedDocuments: [(name: String, date: Date, pages: Int)] = [
        ("Contract Scan 001", Date(), 5),
        ("Evidence Photo", Date().addingTimeInterval(-86400), 1),
        ("Medical Records", Date().addingTimeInterval(-172800), 12),
    ]

    var body: some View {
        VStack(spacing: AppSpacing.lg) {
            // Scan Button
            Button { } label: {
                VStack(spacing: AppSpacing.md) {
                    Image(systemName: "doc.viewfinder")
                        .font(.system(size: 60))
                    Text("Scan Document")
                        .font(.headline)
                    Text("Use camera to scan and extract text")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 40)
                .background(Color.accentColor.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
            }
            .buttonStyle(.plain)
            .padding(.horizontal)

            // Recent Scans
            VStack(alignment: .leading, spacing: AppSpacing.md) {
                Text("RECENT SCANS")
                    .font(.caption).fontWeight(.semibold).foregroundColor(.secondary)
                    .padding(.horizontal)

                ForEach(scannedDocuments, id: \.name) { doc in
                    HStack(spacing: AppSpacing.md) {
                        Image(systemName: "doc.text.viewfinder")
                            .foregroundColor(.mint).font(.title2)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(doc.name).font(.body).fontWeight(.medium)
                            Text("\(doc.pages) page(s) - \(doc.date.formatted(date: .abbreviated, time: .omitted))")
                                .font(.caption).foregroundColor(.secondary)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").foregroundColor(.secondary)
                    }
                    .padding()
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                    .padding(.horizontal)
                }
            }

            Spacer()
        }
        .padding(.top)
        .navigationTitle("OCR Scanner")
        .background(Color(UIColor.systemGroupedBackground))
    }
}

// MARK: - Expenses View
struct ExpensesView: View {
    struct Expense: Identifiable {
        let id = UUID()
        let description: String
        let amount: Double
        let category: String
        let date: Date
        let billable: Bool
    }

    @State private var expenses: [Expense] = [
        Expense(description: "Court Filing Fee", amount: 450, category: "Filing Fees", date: Date(), billable: true),
        Expense(description: "Expert Witness", amount: 2500, category: "Experts", date: Date().addingTimeInterval(-86400), billable: true),
        Expense(description: "Travel to Deposition", amount: 125, category: "Travel", date: Date().addingTimeInterval(-172800), billable: true),
        Expense(description: "Office Supplies", amount: 45, category: "Office", date: Date().addingTimeInterval(-259200), billable: false),
    ]
    @State private var showAddExpense = false

    var totalExpenses: Double { expenses.reduce(0) { $0 + $1.amount } }
    var billableExpenses: Double { expenses.filter { $0.billable }.reduce(0) { $0 + $1.amount } }

    var body: some View {
        VStack(spacing: 0) {
            // Summary
            HStack(spacing: AppSpacing.xl) {
                VStack {
                    Text("$\(totalExpenses, specifier: "%.0f")")
                        .font(.title2).fontWeight(.bold).foregroundColor(.red)
                    Text("Total").font(.caption).foregroundColor(.secondary)
                }
                VStack {
                    Text("$\(billableExpenses, specifier: "%.0f")")
                        .font(.title2).fontWeight(.bold).foregroundColor(.green)
                    Text("Billable").font(.caption).foregroundColor(.secondary)
                }
                VStack {
                    Text("\(expenses.count)")
                        .font(.title2).fontWeight(.bold).foregroundColor(.blue)
                    Text("Entries").font(.caption).foregroundColor(.secondary)
                }
            }
            .padding()
            .frame(maxWidth: .infinity)
            .background(Color.cardBackground)

            List {
                ForEach(expenses) { expense in
                    HStack(spacing: AppSpacing.md) {
                        Image(systemName: "dollarsign.circle.fill")
                            .foregroundColor(expense.billable ? .green : .secondary).font(.title2)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(expense.description).font(.body).fontWeight(.medium)
                            HStack {
                                Text(expense.category).font(.caption).foregroundColor(.accentColor)
                                if expense.billable {
                                    Text("Billable").font(.caption2).foregroundColor(.green)
                                        .padding(.horizontal, 6).padding(.vertical, 2)
                                        .background(Color.green.opacity(0.1)).clipShape(Capsule())
                                }
                            }
                            Text(expense.date.formatted(date: .abbreviated, time: .omitted))
                                .font(.caption2).foregroundColor(.secondary)
                        }
                        Spacer()
                        Text("$\(expense.amount, specifier: "%.2f")")
                            .font(.headline)
                    }
                    .padding(.vertical, AppSpacing.xs)
                    .listRowBackground(Color.cardBackground)
                }
            }
            .listStyle(.plain)
        }
        .navigationTitle("Expenses")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showAddExpense = true } label: { Image(systemName: "plus") }
            }
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

// MARK: - Court Dates View
struct CourtDatesView: View {
    struct CourtDate: Identifiable {
        let id = UUID()
        let caseName: String
        let courtName: String
        let dateTime: Date
        let type: String
        let judge: String?
    }

    @State private var courtDates: [CourtDate] = [
        CourtDate(caseName: "Smith v. Jones", courtName: "Superior Court, Dept. 12", dateTime: Date().addingTimeInterval(172800), type: "Hearing", judge: "Hon. Williams"),
        CourtDate(caseName: "Estate of Johnson", courtName: "Probate Court", dateTime: Date().addingTimeInterval(604800), type: "Trial", judge: "Hon. Davis"),
        CourtDate(caseName: "ABC Corp v. XYZ Inc", courtName: "Federal Court", dateTime: Date().addingTimeInterval(1209600), type: "Motion", judge: nil),
    ]

    var body: some View {
        VStack(spacing: 0) {
            // Upcoming Count
            HStack {
                Image(systemName: "building.columns.fill").foregroundColor(.blue)
                Text("\(courtDates.count) upcoming court dates")
                    .font(.subheadline).fontWeight(.medium)
                Spacer()
            }
            .padding()
            .background(Color.cardBackground)

            List {
                ForEach(courtDates) { date in
                    VStack(alignment: .leading, spacing: AppSpacing.sm) {
                        HStack {
                            Text(date.caseName).font(.headline)
                            Spacer()
                            Text(date.type)
                                .font(.caption).foregroundColor(.white)
                                .padding(.horizontal, 8).padding(.vertical, 4)
                                .background(Color.blue).clipShape(Capsule())
                        }
                        Text(date.courtName).font(.subheadline).foregroundColor(.secondary)
                        HStack {
                            Image(systemName: "calendar")
                            Text(date.dateTime.formatted(date: .abbreviated, time: .shortened))
                            if let judge = date.judge {
                                Spacer()
                                Text(judge).font(.caption).foregroundColor(.accentColor)
                            }
                        }
                        .font(.caption).foregroundColor(.secondary)
                    }
                    .padding(.vertical, AppSpacing.sm)
                    .listRowBackground(Color.cardBackground)
                }
            }
            .listStyle(.plain)
        }
        .navigationTitle("Court Dates")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { } label: { Image(systemName: "plus") }
            }
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

// MARK: - Filings View
struct FilingsView: View {
    struct Filing: Identifiable {
        let id = UUID()
        let documentName: String
        let caseName: String
        let filedDate: Date
        let court: String
        let status: String
    }

    @State private var filings: [Filing] = [
        Filing(documentName: "Complaint", caseName: "Smith v. Jones", filedDate: Date(), court: "Superior Court", status: "accepted"),
        Filing(documentName: "Answer", caseName: "ABC v. XYZ", filedDate: Date().addingTimeInterval(-86400), court: "Federal Court", status: "pending"),
        Filing(documentName: "Motion for Summary Judgment", caseName: "Estate of Johnson", filedDate: Date().addingTimeInterval(-172800), court: "Probate Court", status: "accepted"),
    ]

    var body: some View {
        List {
            ForEach(filings) { filing in
                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                    HStack {
                        Text(filing.documentName).font(.headline)
                        Spacer()
                        Text(filing.status.capitalized)
                            .font(.caption)
                            .foregroundColor(filing.status == "accepted" ? .green : .orange)
                    }
                    Text(filing.caseName).font(.subheadline).foregroundColor(.accentColor)
                    HStack {
                        Text(filing.court)
                        Spacer()
                        Text("Filed: \(filing.filedDate.formatted(date: .abbreviated, time: .omitted))")
                    }
                    .font(.caption).foregroundColor(.secondary)
                }
                .padding(.vertical, AppSpacing.sm)
                .listRowBackground(Color.cardBackground)
            }
        }
        .listStyle(.plain)
        .navigationTitle("Filings")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { } label: { Image(systemName: "plus") }
            }
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

// MARK: - Discovery View
struct DiscoveryView: View {
    struct DiscoveryItem: Identifiable {
        let id = UUID()
        let type: String
        let caseName: String
        let dueDate: Date
        let status: String
    }

    @State private var items: [DiscoveryItem] = [
        DiscoveryItem(type: "Interrogatories", caseName: "Smith v. Jones", dueDate: Date().addingTimeInterval(604800), status: "pending"),
        DiscoveryItem(type: "Document Request", caseName: "ABC v. XYZ", dueDate: Date().addingTimeInterval(1209600), status: "in_progress"),
        DiscoveryItem(type: "Deposition Notice", caseName: "Smith v. Jones", dueDate: Date().addingTimeInterval(432000), status: "completed"),
    ]

    var body: some View {
        List {
            ForEach(items) { item in
                HStack(spacing: AppSpacing.md) {
                    Image(systemName: "magnifyingglass.circle.fill")
                        .foregroundColor(item.status == "completed" ? .green : .purple).font(.title2)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.type).font(.body).fontWeight(.medium)
                        Text(item.caseName).font(.caption).foregroundColor(.accentColor)
                        Text("Due: \(item.dueDate.formatted(date: .abbreviated, time: .omitted))")
                            .font(.caption2).foregroundColor(item.dueDate < Date() ? .red : .secondary)
                    }
                    Spacer()
                    Text(item.status.replacingOccurrences(of: "_", with: " ").capitalized)
                        .font(.caption)
                        .foregroundColor(item.status == "completed" ? .green : .orange)
                }
                .padding(.vertical, AppSpacing.xs)
                .listRowBackground(Color.cardBackground)
            }
        }
        .listStyle(.plain)
        .navigationTitle("Discovery")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { } label: { Image(systemName: "plus") }
            }
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

// MARK: - Service of Process View
struct ServiceOfProcessView: View {
    struct ServiceRecord: Identifiable {
        let id = UUID()
        let documentName: String
        let recipient: String
        let address: String
        let status: String
        let attemptDate: Date
        let servedDate: Date?
    }

    @State private var records: [ServiceRecord] = [
        ServiceRecord(documentName: "Summons & Complaint", recipient: "John Smith", address: "123 Main St, Los Angeles, CA 90001", status: "served", attemptDate: Date().addingTimeInterval(-86400), servedDate: Date()),
        ServiceRecord(documentName: "Subpoena", recipient: "Jane Doe", address: "456 Oak Ave, San Diego, CA 92101", status: "attempted", attemptDate: Date(), servedDate: nil),
        ServiceRecord(documentName: "Motion Notice", recipient: "ABC Corp", address: "789 Corp Blvd, San Francisco, CA 94102", status: "pending", attemptDate: Date().addingTimeInterval(86400), servedDate: nil),
    ]

    var body: some View {
        List {
            ForEach(records) { record in
                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                    HStack {
                        Text(record.documentName).font(.headline)
                        Spacer()
                        Text(record.status.capitalized)
                            .font(.caption)
                            .foregroundColor(record.status == "served" ? .green : (record.status == "attempted" ? .orange : .blue))
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .background((record.status == "served" ? Color.green : (record.status == "attempted" ? .orange : .blue)).opacity(0.1))
                            .clipShape(Capsule())
                    }
                    Text("To: \(record.recipient)").font(.subheadline).fontWeight(.medium)
                    Text(record.address).font(.caption).foregroundColor(.secondary)
                    HStack {
                        if let served = record.servedDate {
                            Text("Served: \(served.formatted(date: .abbreviated, time: .omitted))")
                                .foregroundColor(.green)
                        } else {
                            Text("Attempt: \(record.attemptDate.formatted(date: .abbreviated, time: .omitted))")
                        }
                    }
                    .font(.caption2).foregroundColor(.secondary)
                }
                .padding(.vertical, AppSpacing.sm)
                .listRowBackground(Color.cardBackground)
            }
        }
        .listStyle(.plain)
        .navigationTitle("Service of Process")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { } label: { Image(systemName: "plus") }
            }
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

// MARK: - Evidence View
struct EvidenceView: View {
    struct Evidence: Identifiable {
        let id = UUID()
        let name: String
        let type: String
        let caseName: String
        let addedDate: Date
    }

    @State private var evidence: [Evidence] = [
        Evidence(name: "Contract Document", type: "Document", caseName: "Smith v. Jones", addedDate: Date()),
        Evidence(name: "Scene Photos", type: "Photo", caseName: "ABC v. XYZ", addedDate: Date().addingTimeInterval(-86400)),
        Evidence(name: "Witness Statement", type: "Statement", caseName: "Smith v. Jones", addedDate: Date().addingTimeInterval(-172800)),
    ]

    var body: some View {
        List {
            ForEach(evidence) { item in
                HStack(spacing: AppSpacing.md) {
                    Image(systemName: item.type == "Photo" ? "photo.fill" : (item.type == "Document" ? "doc.fill" : "text.quote"))
                        .foregroundColor(.teal).font(.title2)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.name).font(.body).fontWeight(.medium)
                        Text(item.caseName).font(.caption).foregroundColor(.accentColor)
                        Text("Added: \(item.addedDate.formatted(date: .abbreviated, time: .omitted))")
                            .font(.caption2).foregroundColor(.secondary)
                    }
                    Spacer()
                    Text(item.type).font(.caption).foregroundColor(.secondary)
                }
                .padding(.vertical, AppSpacing.xs)
                .listRowBackground(Color.cardBackground)
            }
        }
        .listStyle(.plain)
        .navigationTitle("Evidence")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { } label: { Image(systemName: "plus") }
            }
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

// MARK: - Reminders View
struct RemindersView: View {
    struct Reminder: Identifiable {
        let id = UUID()
        let title: String
        let dueDate: Date
        let priority: String
        let completed: Bool
    }

    @State private var reminders: [Reminder] = [
        Reminder(title: "Call client about settlement", dueDate: Date().addingTimeInterval(3600), priority: "high", completed: false),
        Reminder(title: "Review contract draft", dueDate: Date().addingTimeInterval(86400), priority: "medium", completed: false),
        Reminder(title: "File motion response", dueDate: Date().addingTimeInterval(172800), priority: "high", completed: false),
        Reminder(title: "Send billing statement", dueDate: Date().addingTimeInterval(-86400), priority: "low", completed: true),
    ]

    var body: some View {
        List {
            Section("Active") {
                ForEach(reminders.filter { !$0.completed }) { reminder in
                    HStack(spacing: AppSpacing.md) {
                        Button { } label: {
                            Image(systemName: "circle").foregroundColor(.secondary).font(.title2)
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text(reminder.title).font(.body).fontWeight(.medium)
                            Text(reminder.dueDate.formatted(date: .abbreviated, time: .shortened))
                                .font(.caption)
                                .foregroundColor(reminder.dueDate < Date() ? .red : .secondary)
                        }
                        Spacer()
                        Circle()
                            .fill(reminder.priority == "high" ? Color.red : (reminder.priority == "medium" ? .orange : .green))
                            .frame(width: 8, height: 8)
                    }
                    .listRowBackground(Color.cardBackground)
                }
            }
            Section("Completed") {
                ForEach(reminders.filter { $0.completed }) { reminder in
                    HStack(spacing: AppSpacing.md) {
                        Image(systemName: "checkmark.circle.fill").foregroundColor(.green).font(.title2)
                        Text(reminder.title).font(.body).strikethrough().foregroundColor(.secondary)
                    }
                    .listRowBackground(Color.cardBackground)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Reminders")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { } label: { Image(systemName: "plus") }
            }
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

// MARK: - Messages View
struct MessagesView: View {
    struct Message: Identifiable {
        let id = UUID()
        let from: String
        let subject: String
        let preview: String
        let date: Date
        let unread: Bool
    }

    @State private var messages: [Message] = [
        Message(from: "John Smith", subject: "Case Update", preview: "I wanted to follow up on our discussion about the settlement...", date: Date(), unread: true),
        Message(from: "Jane Doe", subject: "Document Review", preview: "Please review the attached contract amendments...", date: Date().addingTimeInterval(-3600), unread: true),
        Message(from: "Bob Johnson", subject: "Meeting Confirmation", preview: "Confirming our meeting for Thursday at 2pm...", date: Date().addingTimeInterval(-86400), unread: false),
    ]

    var body: some View {
        List {
            ForEach(messages) { message in
                HStack(spacing: AppSpacing.md) {
                    Circle()
                        .fill(message.unread ? Color.accentColor : Color.secondary.opacity(0.3))
                        .frame(width: 10, height: 10)
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text(message.from)
                                .font(.body)
                                .fontWeight(message.unread ? .bold : .regular)
                            Spacer()
                            Text(message.date.formatted(date: .abbreviated, time: .shortened))
                                .font(.caption2).foregroundColor(.secondary)
                        }
                        Text(message.subject)
                            .font(.subheadline)
                            .fontWeight(message.unread ? .semibold : .regular)
                        Text(message.preview)
                            .font(.caption).foregroundColor(.secondary).lineLimit(1)
                    }
                }
                .padding(.vertical, AppSpacing.xs)
                .listRowBackground(Color.cardBackground)
            }
        }
        .listStyle(.plain)
        .navigationTitle("Messages")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { } label: { Image(systemName: "square.and.pencil") }
            }
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

// MARK: - Emails View
struct EmailsView: View {
    struct Email: Identifiable {
        let id = UUID()
        let from: String
        let subject: String
        let date: Date
        let hasAttachment: Bool
    }

    @State private var emails: [Email] = [
        Email(from: "client@company.com", subject: "RE: Contract Review", date: Date(), hasAttachment: true),
        Email(from: "court@courts.gov", subject: "Filing Confirmation", date: Date().addingTimeInterval(-7200), hasAttachment: true),
        Email(from: "opposing@lawfirm.com", subject: "Discovery Response", date: Date().addingTimeInterval(-86400), hasAttachment: false),
    ]

    var body: some View {
        List {
            ForEach(emails) { email in
                HStack(spacing: AppSpacing.md) {
                    Image(systemName: "envelope.fill").foregroundColor(.blue).font(.title2)
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text(email.from).font(.body).fontWeight(.medium)
                            Spacer()
                            if email.hasAttachment {
                                Image(systemName: "paperclip").foregroundColor(.secondary)
                            }
                        }
                        Text(email.subject).font(.subheadline).foregroundColor(.secondary)
                        Text(email.date.formatted(date: .abbreviated, time: .shortened))
                            .font(.caption2).foregroundColor(.secondary)
                    }
                }
                .padding(.vertical, AppSpacing.xs)
                .listRowBackground(Color.cardBackground)
            }
        }
        .listStyle(.plain)
        .navigationTitle("Emails")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { } label: { Image(systemName: "square.and.pencil") }
            }
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

// MARK: - Call Log View
struct CallLogView: View {
    struct CallRecord: Identifiable {
        let id = UUID()
        let contact: String
        let phone: String
        let date: Date
        let duration: Int
        let direction: String
    }

    @State private var calls: [CallRecord] = [
        CallRecord(contact: "John Smith", phone: "(555) 123-4567", date: Date(), duration: 15, direction: "outgoing"),
        CallRecord(contact: "Jane Doe", phone: "(555) 987-6543", date: Date().addingTimeInterval(-3600), duration: 8, direction: "incoming"),
        CallRecord(contact: "Court Clerk", phone: "(555) 456-7890", date: Date().addingTimeInterval(-86400), duration: 5, direction: "outgoing"),
    ]

    var body: some View {
        List {
            ForEach(calls) { call in
                HStack(spacing: AppSpacing.md) {
                    Image(systemName: call.direction == "incoming" ? "phone.arrow.down.left" : "phone.arrow.up.right")
                        .foregroundColor(call.direction == "incoming" ? .green : .blue).font(.title2)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(call.contact).font(.body).fontWeight(.medium)
                        Text(call.phone).font(.caption).foregroundColor(.secondary)
                        HStack {
                            Text(call.date.formatted(date: .abbreviated, time: .shortened))
                            Text("\(call.duration) min")
                        }
                        .font(.caption2).foregroundColor(.secondary)
                    }
                    Spacer()
                    Button { } label: {
                        Image(systemName: "phone.fill").foregroundColor(.green)
                    }
                }
                .padding(.vertical, AppSpacing.xs)
                .listRowBackground(Color.cardBackground)
            }
        }
        .listStyle(.plain)
        .navigationTitle("Call Log")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { } label: { Image(systemName: "phone.badge.plus") }
            }
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

// MARK: - Notes View
struct NotesView: View {
    struct Note: Identifiable {
        let id = UUID()
        let title: String
        let content: String
        let caseName: String?
        let date: Date
    }

    @State private var notes: [Note] = [
        Note(title: "Client Meeting Notes", content: "Discussed settlement options, client prefers mediation...", caseName: "Smith v. Jones", date: Date()),
        Note(title: "Research Notes", content: "Found relevant precedent in Johnson v. State...", caseName: nil, date: Date().addingTimeInterval(-86400)),
        Note(title: "Deposition Prep", content: "Key questions to ask witness...", caseName: "ABC v. XYZ", date: Date().addingTimeInterval(-172800)),
    ]

    var body: some View {
        List {
            ForEach(notes) { note in
                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                    HStack {
                        Text(note.title).font(.headline)
                        Spacer()
                        Text(note.date.formatted(date: .abbreviated, time: .omitted))
                            .font(.caption2).foregroundColor(.secondary)
                    }
                    if let caseName = note.caseName {
                        Text(caseName).font(.caption).foregroundColor(.accentColor)
                    }
                    Text(note.content).font(.subheadline).foregroundColor(.secondary).lineLimit(2)
                }
                .padding(.vertical, AppSpacing.sm)
                .listRowBackground(Color.cardBackground)
            }
        }
        .listStyle(.plain)
        .navigationTitle("Notes")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { } label: { Image(systemName: "plus") }
            }
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

// MARK: - Reports Dashboard View
struct ReportsDashboardView: View {
    @State private var summary: ReportsSummaryResponse?
    @State private var isLoading = true

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                if isLoading {
                    ProgressView("Loading reports...")
                        .frame(maxWidth: .infinity, minHeight: 200)
                } else {
                    // Key Metrics (matching web dashboard)
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: AppSpacing.md) {
                        MetricCard(title: "Revenue (YTD)", value: "$\(formatNumber(summary?.totalRevenue ?? 0))", color: .blue, icon: "dollarsign.circle.fill")
                        MetricCard(title: "Hours (YTD)", value: String(format: "%.0f", summary?.totalHours ?? 0), color: .green, icon: "clock.fill")
                        MetricCard(title: "Active Cases", value: "\(summary?.activeCases ?? 0)", color: .cyan, icon: "briefcase.fill")
                        MetricCard(title: "Outstanding A/R", value: "$\(formatNumber(summary?.outstandingAr ?? 0))", color: .orange, icon: "doc.text.fill")
                    }
                    .padding(.horizontal)

                    // Financial Reports Section
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("FINANCIAL REPORTS").font(.caption).fontWeight(.semibold).foregroundColor(.secondary).padding(.horizontal)

                        NavigationLink(destination: FinancialReportsView()) {
                            QuickReportRow(title: "Revenue Report", icon: "dollarsign.circle")
                        }
                        NavigationLink(destination: ARAgingReportView()) {
                            QuickReportRow(title: "A/R Aging Report", icon: "doc.text")
                        }
                    }

                    // Productivity Reports Section
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("PRODUCTIVITY REPORTS").font(.caption).fontWeight(.semibold).foregroundColor(.secondary).padding(.horizontal)

                        NavigationLink(destination: ProductivityReportsView()) {
                            QuickReportRow(title: "Time by Activity", icon: "clock")
                        }
                    }

                    // Case Reports Section
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("CASE REPORTS").font(.caption).fontWeight(.semibold).foregroundColor(.secondary).padding(.horizontal)

                        NavigationLink(destination: CaseStatsView()) {
                            QuickReportRow(title: "Case Status Summary", icon: "folder")
                        }
                    }

                    // Client Reports Section
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("CLIENT REPORTS").font(.caption).fontWeight(.semibold).foregroundColor(.secondary).padding(.horizontal)

                        NavigationLink(destination: ClientReportsView()) {
                            QuickReportRow(title: "Client Summary", icon: "person.2")
                        }
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Reports Dashboard")
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await loadSummary()
        }
        .refreshable {
            await loadSummary()
        }
    }

    func loadSummary() async {
        isLoading = true
        do {
            summary = try await APIService.shared.getReportsSummary()
        } catch {
            print("Failed to load summary: \(error)")
        }
        isLoading = false
    }

    func formatNumber(_ value: Double) -> String {
        if value >= 1000000 {
            return String(format: "%.1fM", value / 1000000)
        } else if value >= 1000 {
            return String(format: "%.0fK", value / 1000)
        }
        return String(format: "%.0f", value)
    }
}

// MARK: - A/R Aging Report View
struct ARAgingReportView: View {
    @State private var isLoading = true
    @State private var agingData: ARAgingResponse?

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                if isLoading {
                    ProgressView("Loading A/R aging...")
                        .frame(maxWidth: .infinity, minHeight: 200)
                } else if let data = agingData {
                    // Summary by bucket
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("AGING SUMMARY").font(.caption).fontWeight(.semibold).foregroundColor(.secondary).padding(.horizontal)

                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: AppSpacing.md) {
                            ForEach(data.summary, id: \.bucket) { bucket in
                                AgingBucketCard(bucket: bucket)
                            }
                        }
                        .padding(.horizontal)
                    }

                    // Outstanding invoices
                    if !data.invoices.isEmpty {
                        VStack(alignment: .leading, spacing: AppSpacing.md) {
                            Text("OUTSTANDING INVOICES").font(.caption).fontWeight(.semibold).foregroundColor(.secondary).padding(.horizontal)

                            ForEach(data.invoices) { invoice in
                                AgingInvoiceRow(invoice: invoice)
                                    .padding(.horizontal)
                            }
                        }
                    }
                } else {
                    Text("No outstanding invoices")
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, minHeight: 200)
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("A/R Aging Report")
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await loadData()
        }
        .refreshable {
            await loadData()
        }
    }

    func loadData() async {
        isLoading = true
        do {
            agingData = try await APIService.shared.getARAgingReport()
        } catch {
            print("Failed to load aging: \(error)")
        }
        isLoading = false
    }
}

struct AgingBucketCard: View {
    let bucket: AgingBucket

    var bucketColor: Color {
        switch bucket.bucket {
        case "current": return .green
        case "1-30": return .blue
        case "31-60": return .orange
        case "61-90": return .red
        default: return .purple
        }
    }

    var body: some View {
        VStack(spacing: 4) {
            Text(bucket.bucket ?? "Unknown")
                .font(.caption)
                .foregroundColor(.secondary)
            Text("$\(Int(bucket.totalBalance ?? 0))")
                .font(.headline)
                .foregroundColor(bucketColor)
            Text("\(bucket.invoiceCount ?? 0) invoices")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
    }
}

struct AgingInvoiceRow: View {
    let invoice: AgingInvoice

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(invoice.invoiceNumber ?? "N/A")
                    .font(.body)
                    .fontWeight(.medium)
                Text(invoice.clientName ?? "Unknown Client")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text("$\(Int(invoice.balance ?? 0))")
                    .font(.body)
                    .fontWeight(.medium)
                    .foregroundColor(.red)
                Text("\(invoice.daysOverdue ?? 0) days")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
    }
}

struct QuickReportRow: View {
    let title: String
    let icon: String

    var body: some View {
        HStack {
            Image(systemName: icon).foregroundColor(.accentColor)
            Text(title).font(.body).foregroundColor(.primary)
            Spacer()
            Image(systemName: "chevron.right").foregroundColor(.secondary)
        }
        .padding()
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
        .padding(.horizontal)
    }
}

// MARK: - Financial Reports View
struct FinancialReportsView: View {
    @State private var revenueData: RevenueReportResponse?
    @State private var isLoading = true
    @State private var selectedPeriod = "month"

    var totalRevenue: Double {
        revenueData?.totals.totalRevenue ?? 0
    }

    var totalHours: Double {
        Double(revenueData?.totals.totalMinutes ?? 0) / 60.0
    }

    var totalEntries: Int {
        revenueData?.totals.totalEntries ?? 0
    }

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Period Picker
                Picker("Period", selection: $selectedPeriod) {
                    Text("Week").tag("week")
                    Text("Month").tag("month")
                    Text("Quarter").tag("quarter")
                    Text("Year").tag("year")
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .onChange(of: selectedPeriod) { _, _ in
                    Task { await loadData() }
                }

                if isLoading {
                    ProgressView("Loading financial data...")
                        .frame(maxWidth: .infinity, minHeight: 200)
                } else {
                    financialSummaryCards
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Financial Reports")
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await loadData()
        }
        .refreshable {
            await loadData()
        }
    }

    var financialSummaryCards: some View {
        VStack(spacing: AppSpacing.lg) {
            // Summary Cards
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: AppSpacing.md) {
                ReportCard(title: "Revenue", value: "$\(formatCurrency(totalRevenue))", color: .green)
                ReportCard(title: "Hours", value: String(format: "%.1f", totalHours), color: .blue)
                ReportCard(title: "Entries", value: "\(totalEntries)", color: .orange)
                ReportCard(title: "Avg/Entry", value: "$\(formatCurrency(avgPerEntry))", color: .purple)
            }
            .padding(.horizontal)

            // Revenue by Client
            VStack(alignment: .leading, spacing: AppSpacing.md) {
                Text("REVENUE BY CLIENT").font(.caption).fontWeight(.semibold).foregroundColor(.secondary).padding(.horizontal)

                if let data = revenueData?.data, !data.isEmpty {
                    VStack(spacing: AppSpacing.sm) {
                        ForEach(data.prefix(10)) { item in
                            BillingCategoryRow(
                                category: item.name ?? "Unknown",
                                amount: item.totalAmount ?? 0,
                                total: totalRevenue
                            )
                        }
                    }
                    .padding()
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                    .padding(.horizontal)
                } else {
                    Text("No revenue data for this period")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity)
                        .padding()
                }
            }
        }
    }

    var avgPerEntry: Double {
        guard let entries = revenueData?.totals.totalEntries, entries > 0 else { return 0 }
        return totalRevenue / Double(entries)
    }

    func loadData() async {
        isLoading = true
        do {
            revenueData = try await APIService.shared.getRevenueReport(period: selectedPeriod, groupBy: "client")
        } catch {
            print("Failed to load revenue: \(error)")
        }
        isLoading = false
    }

    func formatCurrency(_ value: Double) -> String {
        if value >= 1000000 {
            return String(format: "%.1fM", value / 1000000)
        } else if value >= 1000 {
            return String(format: "%.1fK", value / 1000)
        }
        return String(format: "%.0f", value)
    }
}

// MARK: - Productivity Reports View
struct ProductivityReportsView: View {
    @State private var productivityData: ProductivityReportResponse?
    @State private var isLoading = true
    @State private var selectedPeriod = "month"

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Period Picker
                Picker("Period", selection: $selectedPeriod) {
                    Text("Week").tag("week")
                    Text("Month").tag("month")
                    Text("Quarter").tag("quarter")
                    Text("Year").tag("year")
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .onChange(of: selectedPeriod) { _, _ in
                    Task { await loadData() }
                }

                if isLoading {
                    ProgressView("Loading productivity data...")
                        .frame(maxWidth: .infinity, minHeight: 200)
                } else if let summary = productivityData?.summary {
                    // Summary
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: AppSpacing.md) {
                        ReportCard(title: "Total Hours", value: String(format: "%.1f", summary.totalHours), color: .blue)
                        ReportCard(title: "Billable", value: String(format: "%.1f", summary.billableHours), color: .green)
                        ReportCard(title: "Non-Billable", value: String(format: "%.1f", summary.totalHours - summary.billableHours), color: .orange)
                        ReportCard(title: "Utilization", value: String(format: "%.0f%%", summary.utilizationRate), color: .purple)
                    }
                    .padding(.horizontal)

                    // By Activity Type
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("HOURS BY ACTIVITY").font(.caption).fontWeight(.semibold).foregroundColor(.secondary).padding(.horizontal)

                        if let activities = productivityData?.byActivity, !activities.isEmpty {
                            VStack(spacing: 0) {
                                ForEach(Array(activities.prefix(10).enumerated()), id: \.element.id) { index, activity in
                                    if index > 0 {
                                        Divider().padding(.leading, 50)
                                    }
                                    TopClientRow(
                                        rank: index + 1,
                                        name: activity.activityType.capitalized,
                                        amount: Double(activity.totalMinutes ?? 0) / 60.0
                                    )
                                }
                            }
                            .background(Color.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                            .padding(.horizontal)
                        } else {
                            Text("No activity data for this period")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .frame(maxWidth: .infinity)
                                .padding()
                        }
                    }
                } else {
                    Text("No productivity data available")
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, minHeight: 200)
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Productivity Reports")
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await loadData()
        }
        .refreshable {
            await loadData()
        }
    }

    func loadData() async {
        isLoading = true
        do {
            productivityData = try await APIService.shared.getProductivityReport(period: selectedPeriod)
        } catch {
            print("Failed to load productivity: \(error)")
        }
        isLoading = false
    }
}

// MARK: - Case Stats View
struct CaseStatsView: View {
    @State private var casesData: CasesReportResponse?
    @State private var isLoading = true

    var totalCases: Int {
        casesData?.byStatus.reduce(0) { $0 + $1.count } ?? 0
    }

    var openCases: Int {
        casesData?.byStatus.first { $0.status == "open" }?.count ?? 0
    }

    var closedCases: Int {
        casesData?.byStatus.first { $0.status == "closed" }?.count ?? 0
    }

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                if isLoading {
                    ProgressView("Loading case data...")
                        .frame(maxWidth: .infinity, minHeight: 200)
                } else {
                    // Summary
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: AppSpacing.md) {
                        ReportCard(title: "Total Cases", value: "\(totalCases)", color: .blue)
                        ReportCard(title: "Open", value: "\(openCases)", color: .green)
                        ReportCard(title: "Closed", value: "\(closedCases)", color: .gray)
                        ReportCard(title: "Pending", value: "\(casesData?.byStatus.first { $0.status == "pending" }?.count ?? 0)", color: .orange)
                    }
                    .padding(.horizontal)

                    // By Status
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("CASES BY STATUS").font(.caption).fontWeight(.semibold).foregroundColor(.secondary).padding(.horizontal)

                        if let statuses = casesData?.byStatus, !statuses.isEmpty {
                            VStack(spacing: AppSpacing.sm) {
                                ForEach(statuses) { status in
                                    BillingCategoryRow(
                                        category: status.displayName,
                                        amount: Double(status.count),
                                        total: Double(totalCases)
                                    )
                                }
                            }
                            .padding()
                            .background(Color.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                            .padding(.horizontal)
                        }
                    }

                    // By Type
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("CASES BY TYPE").font(.caption).fontWeight(.semibold).foregroundColor(.secondary).padding(.horizontal)

                        if let types = casesData?.byType, !types.isEmpty {
                            VStack(spacing: AppSpacing.sm) {
                                ForEach(types) { type in
                                    BillingCategoryRow(
                                        category: type.displayName,
                                        amount: Double(type.count),
                                        total: Double(totalCases)
                                    )
                                }
                            }
                            .padding()
                            .background(Color.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                            .padding(.horizontal)
                        }
                    }

                    // Top Cases by Revenue
                    if let topCases = casesData?.topCasesByRevenue, !topCases.isEmpty {
                        VStack(alignment: .leading, spacing: AppSpacing.md) {
                            Text("TOP CASES BY REVENUE").font(.caption).fontWeight(.semibold).foregroundColor(.secondary).padding(.horizontal)

                            VStack(spacing: 0) {
                                ForEach(Array(topCases.prefix(5).enumerated()), id: \.element.id) { index, caseItem in
                                    if index > 0 {
                                        Divider().padding(.leading, 50)
                                    }
                                    TopClientRow(
                                        rank: index + 1,
                                        name: caseItem.title ?? "Untitled",
                                        amount: caseItem.totalRevenue ?? 0
                                    )
                                }
                            }
                            .background(Color.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                            .padding(.horizontal)
                        }
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Case Statistics")
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await loadData()
        }
        .refreshable {
            await loadData()
        }
    }

    func loadData() async {
        isLoading = true
        do {
            casesData = try await APIService.shared.getCasesReport()
        } catch {
            print("Failed to load cases: \(error)")
        }
        isLoading = false
    }
}

// MARK: - Client Reports View
struct ClientReportsView: View {
    @State private var clientsData: ClientsReportResponse?
    @State private var isLoading = true

    var totalClients: Int {
        clientsData?.byStatus.reduce(0) { $0 + $1.count } ?? 0
    }

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                if isLoading {
                    ProgressView("Loading client data...")
                        .frame(maxWidth: .infinity, minHeight: 200)
                } else {
                    // Summary
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: AppSpacing.md) {
                        ReportCard(title: "Total Clients", value: "\(totalClients)", color: .blue)
                        ReportCard(title: "Active", value: "\(clientsData?.byStatus.first { $0.status == "active" }?.count ?? 0)", color: .green)
                        ReportCard(title: "Inactive", value: "\(clientsData?.byStatus.first { $0.status == "inactive" }?.count ?? 0)", color: .gray)
                        ReportCard(title: "Active (6mo)", value: "\(clientsData?.retention?.activeClients ?? 0)", color: .purple)
                    }
                    .padding(.horizontal)

                    // By Type
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("CLIENTS BY TYPE").font(.caption).fontWeight(.semibold).foregroundColor(.secondary).padding(.horizontal)

                        if let types = clientsData?.byType, !types.isEmpty {
                            VStack(spacing: AppSpacing.sm) {
                                ForEach(types) { type in
                                    BillingCategoryRow(
                                        category: (type.clientType ?? "Other").capitalized,
                                        amount: Double(type.count),
                                        total: Double(totalClients)
                                    )
                                }
                            }
                            .padding()
                            .background(Color.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                            .padding(.horizontal)
                        }
                    }

                    // Top Clients by Revenue
                    if let topClients = clientsData?.topClients, !topClients.isEmpty {
                        VStack(alignment: .leading, spacing: AppSpacing.md) {
                            Text("TOP CLIENTS BY REVENUE").font(.caption).fontWeight(.semibold).foregroundColor(.secondary).padding(.horizontal)

                            VStack(spacing: 0) {
                                ForEach(Array(topClients.prefix(10).enumerated()), id: \.element.id) { index, client in
                                    if index > 0 {
                                        Divider().padding(.leading, 50)
                                    }
                                    TopClientRow(
                                        rank: index + 1,
                                        name: client.name ?? "Unknown",
                                        amount: client.totalRevenue ?? 0
                                    )
                                }
                            }
                            .background(Color.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                            .padding(.horizontal)
                        }
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Client Analytics")
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await loadData()
        }
        .refreshable {
            await loadData()
        }
    }

    func loadData() async {
        isLoading = true
        do {
            clientsData = try await APIService.shared.getClientsReport()
        } catch {
            print("Failed to load clients: \(error)")
        }
        isLoading = false
    }
}

// MARK: - Team View
struct TeamView: View {
    struct TeamMember: Identifiable {
        let id = UUID()
        let name: String
        let role: String
        let email: String
        let activeCases: Int
    }

    let members: [TeamMember] = [
        TeamMember(name: "John Attorney", role: "Partner", email: "john@firm.com", activeCases: 12),
        TeamMember(name: "Jane Lawyer", role: "Associate", email: "jane@firm.com", activeCases: 8),
        TeamMember(name: "Bob Paralegal", role: "Paralegal", email: "bob@firm.com", activeCases: 15),
        TeamMember(name: "Alice Admin", role: "Legal Assistant", email: "alice@firm.com", activeCases: 0),
    ]

    var body: some View {
        List {
            ForEach(members) { member in
                HStack(spacing: AppSpacing.md) {
                    Text(String(member.name.prefix(1)))
                        .font(.headline).foregroundColor(.white)
                        .frame(width: 44, height: 44)
                        .background(Color.accentColor)
                        .clipShape(Circle())
                    VStack(alignment: .leading, spacing: 2) {
                        Text(member.name).font(.body).fontWeight(.medium)
                        Text(member.role).font(.caption).foregroundColor(.accentColor)
                        Text(member.email).font(.caption2).foregroundColor(.secondary)
                    }
                    Spacer()
                    if member.activeCases > 0 {
                        Text("\(member.activeCases) cases")
                            .font(.caption).foregroundColor(.secondary)
                    }
                }
                .padding(.vertical, AppSpacing.xs)
                .listRowBackground(Color.cardBackground)
            }
        }
        .listStyle(.plain)
        .navigationTitle("Team")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { } label: { Image(systemName: "person.badge.plus") }
            }
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

// MARK: - Integration Model
struct AppIntegration: Identifiable {
    let id = UUID()
    let name: String
    let icon: String
    let connected: Bool
    let description: String
}

// MARK: - Integrations View
struct IntegrationsView: View {
    let integrations: [AppIntegration] = [
        AppIntegration(name: "Google Calendar", icon: "calendar", connected: true, description: "Sync court dates and deadlines"),
        AppIntegration(name: "Microsoft 365", icon: "envelope.fill", connected: false, description: "Email and document sync"),
        AppIntegration(name: "Dropbox", icon: "externaldrive.fill", connected: true, description: "Cloud document storage"),
        AppIntegration(name: "QuickBooks", icon: "dollarsign.circle.fill", connected: false, description: "Accounting integration"),
        AppIntegration(name: "Slack", icon: "message.fill", connected: false, description: "Team communications"),
    ]

    var body: some View {
        List {
            Section("Connected") {
                ForEach(integrations.filter { $0.connected }) { integration in
                    IntegrationRow(integration: integration)
                }
            }
            Section("Available") {
                ForEach(integrations.filter { !$0.connected }) { integration in
                    IntegrationRow(integration: integration)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Integrations")
        .background(Color(UIColor.systemGroupedBackground))
    }
}

struct IntegrationRow: View {
    let integration: AppIntegration

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: integration.icon)
                .foregroundColor(.accentColor).font(.title2)
            VStack(alignment: .leading, spacing: 2) {
                Text(integration.name).font(.body).fontWeight(.medium)
                Text(integration.description).font(.caption).foregroundColor(.secondary)
            }
            Spacer()
            if integration.connected {
                Text("Connected").font(.caption).foregroundColor(.green)
            } else {
                Button("Connect") {}.font(.caption).buttonStyle(.bordered)
            }
        }
        .listRowBackground(Color.cardBackground)
    }
}

// MARK: - AI Communications View
struct AICommunicationsView: View {
    @State private var emailSubject = ""
    @State private var emailRecipient = ""
    @State private var emailContext = ""
    @State private var generatedDraft = ""
    @State private var isGenerating = false
    @State private var selectedTone = "professional"
    @State private var error: String?
    @State private var drafts: [EmailDraft] = []

    private let api = APIService.shared
    let tones = [("professional", "Professional"), ("formal", "Formal"), ("friendly", "Friendly"), ("urgent", "Urgent"), ("concise", "Concise")]

    struct EmailDraft: Identifiable, Codable {
        let id: String
        let subject: String
        let recipient: String
        let content: String
        let status: String
        let date: Date

        init(id: String = UUID().uuidString, subject: String, recipient: String, content: String = "", status: String = "draft", date: Date = Date()) {
            self.id = id
            self.subject = subject
            self.recipient = recipient
            self.content = content
            self.status = status
            self.date = date
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Draft New Email
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("AI EMAIL DRAFTING")
                        .font(.caption).fontWeight(.semibold).foregroundColor(.secondary)

                    TextField("Recipient Email", text: $emailRecipient)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)

                    TextField("Subject", text: $emailSubject)
                        .textFieldStyle(.roundedBorder)

                    Picker("Tone", selection: $selectedTone) {
                        ForEach(tones, id: \.0) { tone in
                            Text(tone.1).tag(tone.0)
                        }
                    }
                    .pickerStyle(.segmented)

                    TextField("Context/Instructions for AI...", text: $emailContext, axis: .vertical)
                        .lineLimit(3...6)
                        .textFieldStyle(.roundedBorder)

                    if let error = error {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                            .padding(.horizontal)
                    }

                    Button {
                        Task { await generateDraft() }
                    } label: {
                        HStack {
                            if isGenerating { ProgressView().tint(.white) }
                            Text(isGenerating ? "Generating with AI..." : "Generate Draft")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(emailSubject.isEmpty || emailContext.isEmpty || isGenerating)

                    if !generatedDraft.isEmpty {
                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            HStack {
                                Text("Generated Draft").font(.headline)
                                Spacer()
                                Image(systemName: "sparkles")
                                    .foregroundColor(.purple)
                            }
                            Text(generatedDraft)
                                .font(.body)
                                .padding()
                                .background(Color.green.opacity(0.1))
                                .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))

                            HStack {
                                Button("Copy") {
                                    UIPasteboard.general.string = generatedDraft
                                }.buttonStyle(.bordered)
                                Button("Save Draft") {
                                    saveDraft()
                                }.buttonStyle(.bordered)
                                Button("Send") {}.buttonStyle(.borderedProminent)
                            }
                        }
                    }
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Recent Drafts
                if !drafts.isEmpty {
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("RECENT DRAFTS")
                            .font(.caption).fontWeight(.semibold).foregroundColor(.secondary)
                            .padding(.horizontal)

                        ForEach(drafts) { draft in
                            HStack(spacing: AppSpacing.md) {
                                Image(systemName: draft.status == "sent" ? "paperplane.fill" : "doc.text")
                                    .foregroundColor(draft.status == "sent" ? .green : .blue)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(draft.subject).font(.body).fontWeight(.medium)
                                    Text(draft.recipient).font(.caption).foregroundColor(.secondary)
                                    Text(draft.date.formatted(date: .abbreviated, time: .shortened))
                                        .font(.caption2).foregroundColor(.secondary)
                                }
                                Spacer()
                                Text(draft.status.capitalized)
                                    .font(.caption)
                                    .foregroundColor(draft.status == "sent" ? .green : .orange)
                            }
                            .padding()
                            .background(Color.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                            .padding(.horizontal)
                        }
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("AI Communications")
        .background(Color(UIColor.systemGroupedBackground))
        .onAppear { loadDrafts() }
    }

    func generateDraft() async {
        isGenerating = true
        error = nil

        do {
            let response = try await api.aiDraftEmail(
                recipient: emailRecipient,
                subject: emailSubject,
                context: emailContext,
                tone: selectedTone
            )

            if response.success, let draft = response.draft {
                generatedDraft = draft
            } else {
                error = response.error ?? "Failed to generate draft"
            }
        } catch {
            self.error = "Failed to connect to AI service: \(error.localizedDescription)"
        }

        isGenerating = false
    }

    func saveDraft() {
        let draft = EmailDraft(subject: emailSubject, recipient: emailRecipient, content: generatedDraft)
        drafts.insert(draft, at: 0)
        saveDraftsToStorage()
        // Clear form
        emailSubject = ""
        emailRecipient = ""
        emailContext = ""
        generatedDraft = ""
    }

    func loadDrafts() {
        if let data = UserDefaults.standard.data(forKey: "email_drafts"),
           let decoded = try? JSONDecoder().decode([EmailDraft].self, from: data) {
            drafts = decoded
        }
    }

    func saveDraftsToStorage() {
        if let encoded = try? JSONEncoder().encode(drafts) {
            UserDefaults.standard.set(encoded, forKey: "email_drafts")
        }
    }
}

// MARK: - AI Predictions View
struct AIPredictionsView: View {
    @State private var caseName: String = ""
    @State private var caseType: String = ""
    @State private var caseFacts: String = ""
    @State private var jurisdiction: String = "California"
    @State private var isAnalyzing = false
    @State private var prediction: CasePrediction?
    @State private var error: String?

    private let api = APIService.shared

    struct CasePrediction {
        let winProbability: Double
        let settlementRange: (low: Double, high: Double)
        let timeToResolution: String
        let keyFactors: [String]
        let risks: [String]
        let recommendations: [String]
    }

    let caseTypes = ["Personal Injury", "Contract Dispute", "Employment", "Medical Malpractice", "Family Law", "Real Estate", "Criminal Defense", "Other"]
    let jurisdictions = ["California", "New York", "Texas", "Florida", "Illinois", "Federal", "Other"]

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Case Information
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("AI CASE PREDICTION")
                        .font(.caption).fontWeight(.semibold).foregroundColor(.secondary)

                    TextField("Case Name", text: $caseName)
                        .textFieldStyle(.roundedBorder)

                    Picker("Case Type", selection: $caseType) {
                        Text("Select type...").tag("")
                        ForEach(caseTypes, id: \.self) { type in
                            Text(type).tag(type)
                        }
                    }
                    .pickerStyle(.menu)

                    Picker("Jurisdiction", selection: $jurisdiction) {
                        ForEach(jurisdictions, id: \.self) { j in
                            Text(j).tag(j)
                        }
                    }
                    .pickerStyle(.menu)

                    TextField("Describe the key facts of the case...", text: $caseFacts, axis: .vertical)
                        .lineLimit(4...8)
                        .textFieldStyle(.roundedBorder)

                    if let error = error {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                    }

                    Button {
                        Task { await analyzeCase() }
                    } label: {
                        HStack {
                            if isAnalyzing { ProgressView().tint(.white) }
                            Image(systemName: "sparkles")
                            Text(isAnalyzing ? "Analyzing with AI..." : "Generate AI Prediction")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(caseName.isEmpty || caseType.isEmpty || caseFacts.isEmpty || isAnalyzing)
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                if let pred = prediction {
                    // Win Probability
                    VStack(spacing: AppSpacing.md) {
                        HStack {
                            Text("WIN PROBABILITY")
                                .font(.caption).fontWeight(.semibold).foregroundColor(.secondary)
                            Spacer()
                            Image(systemName: "sparkles").foregroundColor(.purple)
                        }

                        ZStack {
                            Circle()
                                .stroke(Color.secondary.opacity(0.2), lineWidth: 20)
                            Circle()
                                .trim(from: 0, to: pred.winProbability / 100)
                                .stroke(pred.winProbability >= 60 ? Color.green : (pred.winProbability >= 40 ? .orange : .red), lineWidth: 20)
                                .rotationEffect(.degrees(-90))
                            VStack {
                                Text("\(Int(pred.winProbability))%")
                                    .font(.system(size: 36, weight: .bold))
                                Text("Favorable")
                                    .font(.caption).foregroundColor(.secondary)
                            }
                        }
                        .frame(width: 150, height: 150)
                    }
                    .padding()
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                    .padding(.horizontal)

                    // Settlement Range
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("SETTLEMENT RANGE")
                            .font(.caption).fontWeight(.semibold).foregroundColor(.secondary)

                        HStack {
                            VStack {
                                Text("$\(Int(pred.settlementRange.low / 1000))K")
                                    .font(.title2).fontWeight(.bold).foregroundColor(.orange)
                                Text("Low").font(.caption).foregroundColor(.secondary)
                            }
                            Spacer()
                            Text("—").foregroundColor(.secondary)
                            Spacer()
                            VStack {
                                Text("$\(Int(pred.settlementRange.high / 1000))K")
                                    .font(.title2).fontWeight(.bold).foregroundColor(.green)
                                Text("High").font(.caption).foregroundColor(.secondary)
                            }
                        }

                        Text("Est. Resolution: \(pred.timeToResolution)")
                            .font(.subheadline).foregroundColor(.accentColor)
                    }
                    .padding()
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                    .padding(.horizontal)

                    // Key Factors
                    if !pred.keyFactors.isEmpty {
                        VStack(alignment: .leading, spacing: AppSpacing.md) {
                            Text("KEY FACTORS")
                                .font(.caption).fontWeight(.semibold).foregroundColor(.secondary)

                            ForEach(pred.keyFactors, id: \.self) { factor in
                                HStack(alignment: .top) {
                                    Image(systemName: "checkmark.circle.fill").foregroundColor(.green)
                                    Text(factor).font(.subheadline)
                                }
                            }
                        }
                        .padding()
                        .background(Color.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                        .padding(.horizontal)
                    }

                    // Risks
                    if !pred.risks.isEmpty {
                        VStack(alignment: .leading, spacing: AppSpacing.md) {
                            Text("IDENTIFIED RISKS")
                                .font(.caption).fontWeight(.semibold).foregroundColor(.secondary)

                            ForEach(pred.risks, id: \.self) { risk in
                                HStack(alignment: .top) {
                                    Image(systemName: "exclamationmark.triangle.fill").foregroundColor(.orange)
                                    Text(risk).font(.subheadline)
                                }
                            }
                        }
                        .padding()
                        .background(Color.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                        .padding(.horizontal)
                    }

                    // Recommendations
                    if !pred.recommendations.isEmpty {
                        VStack(alignment: .leading, spacing: AppSpacing.md) {
                            Text("RECOMMENDATIONS")
                                .font(.caption).fontWeight(.semibold).foregroundColor(.secondary)

                            ForEach(pred.recommendations, id: \.self) { rec in
                                HStack(alignment: .top) {
                                    Image(systemName: "lightbulb.fill").foregroundColor(.yellow)
                                    Text(rec).font(.subheadline)
                                }
                            }
                        }
                        .padding()
                        .background(Color.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                        .padding(.horizontal)
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("AI Predictions")
        .background(Color(UIColor.systemGroupedBackground))
    }

    func analyzeCase() async {
        isAnalyzing = true
        error = nil

        do {
            let response = try await api.aiPredictCase(
                caseName: caseName,
                caseType: caseType,
                facts: caseFacts,
                jurisdiction: jurisdiction
            )

            if response.success, let predData = response.prediction {
                prediction = CasePrediction(
                    winProbability: predData.winProbability ?? 50.0,
                    settlementRange: (low: predData.settlementRangeLow ?? 50000, high: predData.settlementRangeHigh ?? 150000),
                    timeToResolution: predData.timeToResolution ?? "6-12 months",
                    keyFactors: predData.keyFactors ?? [],
                    risks: predData.risks ?? [],
                    recommendations: predData.recommendations ?? []
                )
            } else {
                self.error = response.error ?? "Failed to analyze case"
            }
        } catch {
            self.error = "Failed to connect to AI service: \(error.localizedDescription)"
        }

        isAnalyzing = false
    }
}

// MARK: - Citation Finder View
struct CitationFinderView: View {
    @State private var searchQuery = ""
    @State private var isSearching = false
    @State private var citations: [Citation] = []
    @State private var selectedJurisdiction = "Federal"
    @State private var error: String?

    private let api = APIService.shared
    let jurisdictions = ["Federal", "California", "New York", "Texas", "Florida", "All States"]

    struct Citation: Identifiable {
        let id = UUID()
        let caseName: String
        let citation: String
        let year: Int
        let court: String
        let relevance: Double
        let keyHolding: String
    }

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Search Section
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    HStack {
                        Text("AI CITATION FINDER")
                            .font(.caption).fontWeight(.semibold).foregroundColor(.secondary)
                        Spacer()
                        Image(systemName: "sparkles").foregroundColor(.purple)
                    }

                    TextField("Enter legal issue, topic, or question...", text: $searchQuery, axis: .vertical)
                        .lineLimit(2...4)
                        .textFieldStyle(.roundedBorder)

                    Picker("Jurisdiction", selection: $selectedJurisdiction) {
                        ForEach(jurisdictions, id: \.self) { j in Text(j).tag(j) }
                    }
                    .pickerStyle(.segmented)

                    if let error = error {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                    }

                    Button {
                        Task { await searchCitations() }
                    } label: {
                        HStack {
                            if isSearching { ProgressView().tint(.white) }
                            Image(systemName: "sparkles")
                            Text(isSearching ? "Searching with AI..." : "Find Citations")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(searchQuery.isEmpty || isSearching)
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Results
                if !citations.isEmpty {
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        HStack {
                            Text("CITATIONS FOUND (\(citations.count))")
                                .font(.caption).fontWeight(.semibold).foregroundColor(.secondary)
                            Spacer()
                            Image(systemName: "sparkles").foregroundColor(.purple).font(.caption)
                        }
                        .padding(.horizontal)

                        ForEach(citations) { citation in
                            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                                HStack {
                                    Text(citation.caseName)
                                        .font(.headline)
                                        .foregroundColor(.accentColor)
                                    Spacer()
                                    Text("\(Int(citation.relevance * 100))%")
                                        .font(.caption)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 2)
                                        .background(Color.green.opacity(0.2))
                                        .foregroundColor(.green)
                                        .clipShape(Capsule())
                                }

                                Text(citation.citation)
                                    .font(.subheadline)
                                    .fontWeight(.medium)

                                Text("\(citation.court) • \(citation.year)")
                                    .font(.caption)
                                    .foregroundColor(.secondary)

                                Text(citation.keyHolding)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .lineLimit(4)

                                HStack {
                                    Button("Copy Citation") {
                                        UIPasteboard.general.string = "\(citation.caseName), \(citation.citation) (\(citation.year))"
                                    }.font(.caption).buttonStyle(.bordered)
                                    Button("Copy Holding") {
                                        UIPasteboard.general.string = citation.keyHolding
                                    }.font(.caption).buttonStyle(.bordered)
                                    Spacer()
                                }
                            }
                            .padding()
                            .background(Color.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                            .padding(.horizontal)
                        }
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Citation Finder")
        .background(Color(UIColor.systemGroupedBackground))
    }

    func searchCitations() async {
        isSearching = true
        error = nil

        do {
            let response = try await api.aiFindCitations(query: searchQuery, jurisdiction: selectedJurisdiction)

            if response.success, let citationData = response.citations {
                citations = citationData.compactMap { data in
                    guard let caseName = data.caseName, let citationStr = data.citation else { return nil }
                    return Citation(
                        caseName: caseName,
                        citation: citationStr,
                        year: data.year ?? 2020,
                        court: data.court ?? "Unknown Court",
                        relevance: data.relevance ?? 0.8,
                        keyHolding: data.keyHolding ?? ""
                    )
                }
            } else {
                self.error = response.error ?? "Failed to find citations"
            }
        } catch {
            self.error = "Failed to connect to AI service: \(error.localizedDescription)"
        }

        isSearching = false
    }
}

// MARK: - AI Intake Forms View
struct AIIntakeFormsView: View {
    @State private var forms: [IntakeForm] = [
        IntakeForm(name: "Personal Injury Intake", category: "Litigation", responses: 24, lastUsed: Date()),
        IntakeForm(name: "Family Law Consultation", category: "Family", responses: 18, lastUsed: Date().addingTimeInterval(-86400)),
        IntakeForm(name: "Estate Planning Questionnaire", category: "Estate", responses: 12, lastUsed: Date().addingTimeInterval(-172800)),
        IntakeForm(name: "Business Formation", category: "Corporate", responses: 8, lastUsed: nil),
    ]
    @State private var showCreateForm = false

    struct IntakeForm: Identifiable {
        let id = UUID()
        let name: String
        let category: String
        let responses: Int
        let lastUsed: Date?
    }

    var body: some View {
        VStack(spacing: 0) {
            // Stats Header
            HStack(spacing: AppSpacing.xl) {
                VStack {
                    Text("\(forms.count)")
                        .font(.title2).fontWeight(.bold).foregroundColor(.blue)
                    Text("Forms").font(.caption).foregroundColor(.secondary)
                }
                VStack {
                    Text("\(forms.reduce(0) { $0 + $1.responses })")
                        .font(.title2).fontWeight(.bold).foregroundColor(.green)
                    Text("Responses").font(.caption).foregroundColor(.secondary)
                }
                VStack {
                    Text("AI")
                        .font(.title2).fontWeight(.bold).foregroundColor(.purple)
                    Text("Powered").font(.caption).foregroundColor(.secondary)
                }
            }
            .padding()
            .frame(maxWidth: .infinity)
            .background(Color.cardBackground)

            List {
                ForEach(forms) { form in
                    HStack(spacing: AppSpacing.md) {
                        Image(systemName: "doc.text.fill")
                            .foregroundColor(.purple).font(.title2)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(form.name).font(.body).fontWeight(.medium)
                            Text(form.category).font(.caption).foregroundColor(.accentColor)
                            HStack {
                                Text("\(form.responses) responses")
                                if let lastUsed = form.lastUsed {
                                    Text("• Last: \(lastUsed.formatted(date: .abbreviated, time: .omitted))")
                                }
                            }
                            .font(.caption2).foregroundColor(.secondary)
                        }
                        Spacer()
                        Button { } label: {
                            Image(systemName: "square.and.arrow.up")
                        }
                    }
                    .padding(.vertical, AppSpacing.xs)
                    .listRowBackground(Color.cardBackground)
                }
            }
            .listStyle(.plain)
        }
        .navigationTitle("AI Intake Forms")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showCreateForm = true } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showCreateForm) {
            CreateIntakeFormView()
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

struct CreateIntakeFormView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var formName = ""
    @State private var category = "Litigation"
    @State private var description = ""
    @State private var useAI = true

    let categories = ["Litigation", "Family", "Estate", "Corporate", "Real Estate", "Immigration"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Form Details") {
                    TextField("Form Name", text: $formName)
                    Picker("Category", selection: $category) {
                        ForEach(categories, id: \.self) { c in Text(c).tag(c) }
                    }
                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                }

                Section("AI Features") {
                    Toggle("AI-Powered Questions", isOn: $useAI)
                    if useAI {
                        Text("AI will generate relevant follow-up questions based on responses")
                            .font(.caption).foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle("Create Intake Form")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { dismiss() }
                        .disabled(formName.isEmpty)
                }
            }
        }
    }
}

// MARK: - Leads Analytics View
struct LeadsAnalyticsView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Summary Cards
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: AppSpacing.md) {
                    AnalyticsCard(title: "Total Leads", value: "156", change: "+12%", color: .blue, icon: "person.badge.plus")
                    AnalyticsCard(title: "Converted", value: "47", change: "+8%", color: .green, icon: "checkmark.circle.fill")
                    AnalyticsCard(title: "Conversion Rate", value: "30%", change: "+2%", color: .purple, icon: "chart.line.uptrend.xyaxis")
                    AnalyticsCard(title: "Avg Response", value: "2.4h", change: "-15%", color: .orange, icon: "clock.fill")
                }
                .padding(.horizontal)

                // Lead Sources Chart
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("LEAD SOURCES")
                        .font(.caption).fontWeight(.semibold).foregroundColor(.secondary)

                    VStack(spacing: AppSpacing.sm) {
                        LeadSourceRow(source: "Website", count: 68, total: 156, color: .blue)
                        LeadSourceRow(source: "Referrals", count: 42, total: 156, color: .green)
                        LeadSourceRow(source: "Google Ads", count: 28, total: 156, color: .orange)
                        LeadSourceRow(source: "Social Media", count: 12, total: 156, color: .purple)
                        LeadSourceRow(source: "Other", count: 6, total: 156, color: .gray)
                    }
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Monthly Trend
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("MONTHLY TREND")
                        .font(.caption).fontWeight(.semibold).foregroundColor(.secondary)

                    HStack(alignment: .bottom, spacing: AppSpacing.sm) {
                        ForEach(["Jan", "Feb", "Mar", "Apr", "May", "Jun"], id: \.self) { month in
                            VStack {
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(Color.accentColor)
                                    .frame(width: 30, height: CGFloat.random(in: 40...120))
                                Text(month)
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Top Performing
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("TOP CONVERTING SOURCES")
                        .font(.caption).fontWeight(.semibold).foregroundColor(.secondary)

                    VStack(spacing: 0) {
                        TopSourceRow(rank: 1, source: "Attorney Referrals", rate: 45)
                        Divider().padding(.leading, 50)
                        TopSourceRow(rank: 2, source: "Website Contact Form", rate: 32)
                        Divider().padding(.leading, 50)
                        TopSourceRow(rank: 3, source: "Google Ads", rate: 28)
                    }
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)
            }
            .padding(.vertical)
        }
        .navigationTitle("Leads Analytics")
        .background(Color(UIColor.systemGroupedBackground))
    }
}

struct AnalyticsCard: View {
    let title: String
    let value: String
    let change: String
    let color: Color
    let icon: String

    var body: some View {
        VStack(spacing: AppSpacing.sm) {
            HStack {
                Image(systemName: icon).foregroundColor(color)
                Spacer()
                Text(change)
                    .font(.caption)
                    .foregroundColor(change.hasPrefix("+") ? .green : (change.hasPrefix("-") ? .red : .secondary))
            }
            Text(value)
                .font(.title2).fontWeight(.bold)
            Text(title)
                .font(.caption).foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
    }
}

struct LeadSourceRow: View {
    let source: String
    let count: Int
    let total: Int
    let color: Color

    var percentage: Double {
        Double(count) / Double(total) * 100
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(source).font(.subheadline)
                Spacer()
                Text("\(count)").font(.subheadline).fontWeight(.medium)
            }
            ProgressView(value: percentage, total: 100)
                .tint(color)
        }
    }
}

struct TopSourceRow: View {
    let rank: Int
    let source: String
    let rate: Int

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Text("\(rank)")
                .font(.headline).foregroundColor(.secondary)
                .frame(width: 30)
            Text(source).font(.subheadline)
            Spacer()
            Text("\(rate)%")
                .font(.subheadline).fontWeight(.semibold).foregroundColor(.green)
        }
        .padding(.vertical, AppSpacing.sm)
    }
}

// MARK: - Lead Form Builder View
struct LeadFormBuilderView: View {
    @State private var forms: [CustomForm] = [
        CustomForm(name: "Personal Injury Intake", fields: 12, active: true, submissions: 45),
        CustomForm(name: "Family Law Questionnaire", fields: 18, active: true, submissions: 28),
        CustomForm(name: "Business Consultation", fields: 8, active: false, submissions: 12),
    ]
    @State private var showCreateForm = false

    struct CustomForm: Identifiable {
        let id = UUID()
        let name: String
        let fields: Int
        let active: Bool
        let submissions: Int
    }

    var body: some View {
        VStack(spacing: 0) {
            // Stats
            HStack(spacing: AppSpacing.xl) {
                VStack {
                    Text("\(forms.count)")
                        .font(.title2).fontWeight(.bold).foregroundColor(.blue)
                    Text("Forms").font(.caption).foregroundColor(.secondary)
                }
                VStack {
                    Text("\(forms.filter { $0.active }.count)")
                        .font(.title2).fontWeight(.bold).foregroundColor(.green)
                    Text("Active").font(.caption).foregroundColor(.secondary)
                }
                VStack {
                    Text("\(forms.reduce(0) { $0 + $1.submissions })")
                        .font(.title2).fontWeight(.bold).foregroundColor(.purple)
                    Text("Submissions").font(.caption).foregroundColor(.secondary)
                }
            }
            .padding()
            .frame(maxWidth: .infinity)
            .background(Color.cardBackground)

            List {
                ForEach(forms) { form in
                    HStack(spacing: AppSpacing.md) {
                        Image(systemName: "doc.badge.gearshape.fill")
                            .foregroundColor(form.active ? .green : .secondary)
                            .font(.title2)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(form.name).font(.body).fontWeight(.medium)
                            Text("\(form.fields) fields • \(form.submissions) submissions")
                                .font(.caption).foregroundColor(.secondary)
                        }
                        Spacer()
                        Toggle("", isOn: .constant(form.active))
                            .labelsHidden()
                    }
                    .padding(.vertical, AppSpacing.xs)
                    .listRowBackground(Color.cardBackground)
                }
            }
            .listStyle(.plain)
        }
        .navigationTitle("Form Builder")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showCreateForm = true } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

// MARK: - Subscription Management View
struct SubscriptionManagementView: View {
    @State private var currentPlan = "Professional"
    @State private var billingCycle = "Monthly"

    let plans = [
        ("Basic", "$49/mo", ["5 Users", "Basic Features", "Email Support"]),
        ("Professional", "$99/mo", ["15 Users", "All Features", "Priority Support", "API Access"]),
        ("Enterprise", "$249/mo", ["Unlimited Users", "All Features", "24/7 Support", "Custom Integrations", "Dedicated Manager"])
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Current Plan
                VStack(spacing: AppSpacing.md) {
                    Text("CURRENT PLAN")
                        .font(.caption).fontWeight(.semibold).foregroundColor(.secondary)

                    Text(currentPlan)
                        .font(.title).fontWeight(.bold).foregroundColor(.accentColor)

                    Text("$99/month • Renews Jan 15, 2025")
                        .font(.subheadline).foregroundColor(.secondary)

                    HStack(spacing: AppSpacing.md) {
                        Button("Manage Billing") {}.buttonStyle(.bordered)
                        Button("View Invoices") {}.buttonStyle(.bordered)
                    }
                }
                .padding()
                .frame(maxWidth: .infinity)
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Usage
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("USAGE THIS MONTH")
                        .font(.caption).fontWeight(.semibold).foregroundColor(.secondary)

                    UsageRow(title: "Users", used: 8, total: 15)
                    UsageRow(title: "Documents Generated", used: 145, total: 500)
                    UsageRow(title: "AI Credits", used: 2400, total: 5000)
                    UsageRow(title: "Storage", used: 12, total: 50, unit: "GB")
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Available Plans
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("AVAILABLE PLANS")
                        .font(.caption).fontWeight(.semibold).foregroundColor(.secondary)
                        .padding(.horizontal)

                    ForEach(plans, id: \.0) { plan in
                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            HStack {
                                Text(plan.0).font(.headline)
                                Spacer()
                                Text(plan.1).font(.headline).foregroundColor(.accentColor)
                            }

                            ForEach(plan.2, id: \.self) { feature in
                                HStack {
                                    Image(systemName: "checkmark").foregroundColor(.green).font(.caption)
                                    Text(feature).font(.caption).foregroundColor(.secondary)
                                }
                            }

                            if plan.0 != currentPlan {
                                Button(plan.0 == "Enterprise" ? "Contact Sales" : "Upgrade") {}
                                    .buttonStyle(.borderedProminent)
                                    .frame(maxWidth: .infinity)
                            } else {
                                Text("Current Plan")
                                    .font(.caption).foregroundColor(.green)
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .padding()
                        .background(Color.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                        .overlay(
                            RoundedRectangle(cornerRadius: AppRadius.lg)
                                .stroke(plan.0 == currentPlan ? Color.accentColor : Color.clear, lineWidth: 2)
                        )
                        .padding(.horizontal)
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Subscription")
        .background(Color(UIColor.systemGroupedBackground))
    }
}

struct UsageRow: View {
    let title: String
    let used: Int
    let total: Int
    var unit: String = ""

    var percentage: Double {
        Double(used) / Double(total) * 100
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title).font(.subheadline)
                Spacer()
                Text("\(used)/\(total)\(unit.isEmpty ? "" : " \(unit)")")
                    .font(.caption).foregroundColor(.secondary)
            }
            ProgressView(value: percentage, total: 100)
                .tint(percentage > 80 ? .red : (percentage > 60 ? .orange : .green))
        }
    }
}

// MARK: - Preview
#Preview {
    MainTabView()
        .environmentObject(AuthViewModel())
        .environmentObject(ThemeManager())
}
