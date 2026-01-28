//
//  CalendarViews.swift
//  LegalPracticeAI
//
//  Calendar-related views (Deadlines, Appointments, Statute Limits)
//

import SwiftUI

// MARK: - Calendar ViewModel
@MainActor
final class CalendarViewModel: ObservableObject {
    @Published var calendarEvents: [CalendarEvent] = []
    @Published var deadlines: [Deadline] = []
    @Published var statuteLimits: [StatuteLimit] = []
    @Published var isLoading = false
    @Published var error: String?

    private let api = APIService.shared
    private let statutesKey = "stored_statutes"

    init() {
        loadStatutesFromStorage()
    }

    // MARK: - Load from API
    func loadDeadlines() async {
        isLoading = true
        error = nil
        do {
            let response = try await api.getDeadlines()
            deadlines = response.deadlines
        } catch {
            self.error = "Failed to load deadlines: \(error.localizedDescription)"
        }
        isLoading = false
    }

    func loadCalendarEvents() async {
        isLoading = true
        error = nil
        do {
            calendarEvents = try await api.getCalendarEvents()
        } catch {
            self.error = "Failed to load events: \(error.localizedDescription)"
        }
        isLoading = false
    }

    // Statute limits stored locally (no API endpoint)
    private func loadStatutesFromStorage() {
        if let data = UserDefaults.standard.data(forKey: statutesKey),
           let decoded = try? JSONDecoder().decode([StatuteLimit].self, from: data) {
            statuteLimits = decoded
        }
    }

    private func saveStatutesToStorage() {
        if let encoded = try? JSONEncoder().encode(statuteLimits) {
            UserDefaults.standard.set(encoded, forKey: statutesKey)
        }
    }

    // MARK: - Computed Properties
    var todayEvents: [CalendarEvent] {
        calendarEvents.filter {
            guard let start = $0.startTime else { return false }
            return Calendar.current.isDateInToday(start)
        }.sorted { ($0.startTime ?? Date()) < ($1.startTime ?? Date()) }
    }

    var upcomingEvents: [CalendarEvent] {
        calendarEvents.filter {
            guard let start = $0.startTime else { return false }
            return start >= Date()
        }.sorted { ($0.startTime ?? Date()) < ($1.startTime ?? Date()) }
    }

    var urgentStatutes: [StatuteLimit] {
        statuteLimits.filter { $0.isUrgent && $0.status == "active" }
            .sorted { $0.limitDate < $1.limitDate }
    }

    var pendingDeadlines: [Deadline] {
        deadlines.filter { ($0.status ?? "pending") != "completed" }
            .sorted { ($0.dueDate ?? Date()) < ($1.dueDate ?? Date()) }
    }

    var overdueDeadlines: [Deadline] {
        pendingDeadlines.filter { ($0.dueDate ?? Date()) < Date() }
    }

    var upcomingDeadlines: [Deadline] {
        pendingDeadlines.filter { ($0.dueDate ?? Date()) >= Date() }
    }

    // MARK: - Statute Limits (local storage - no API)
    func addStatuteLimit(_ statute: StatuteLimit) {
        statuteLimits.insert(statute, at: 0)
        saveStatutesToStorage()
    }

    func updateStatuteLimit(_ statute: StatuteLimit) {
        if let index = statuteLimits.firstIndex(where: { $0.id == statute.id }) {
            statuteLimits[index] = statute
            saveStatutesToStorage()
        }
    }

    func deleteStatuteLimit(_ statute: StatuteLimit) {
        statuteLimits.removeAll { $0.id == statute.id }
        saveStatutesToStorage()
    }
}

// MARK: - Deadlines View
struct DeadlinesView: View {
    @StateObject private var viewModel = CalendarViewModel()
    @State private var showAddDeadline = false

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.isLoading {
                ProgressView("Loading deadlines...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if viewModel.deadlines.isEmpty {
                EmptyStateView(
                    icon: "exclamationmark.circle.fill",
                    title: "No Deadlines",
                    message: "Add deadlines to track important dates"
                )
            } else {
                List {
                    if !viewModel.overdueDeadlines.isEmpty {
                        Section("Overdue") {
                            ForEach(viewModel.overdueDeadlines) { deadline in
                                CalendarDeadlineRow(deadline: deadline, isOverdue: true)
                            }
                        }
                    }

                    Section("Upcoming") {
                        ForEach(viewModel.upcomingDeadlines) { deadline in
                            CalendarDeadlineRow(deadline: deadline, isOverdue: false)
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .refreshable {
                    await viewModel.loadDeadlines()
                }
            }
        }
        .navigationTitle("Deadlines")
        .task {
            await viewModel.loadDeadlines()
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

struct CalendarDeadlineRow: View {
    let deadline: Deadline
    let isOverdue: Bool

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: isOverdue ? "exclamationmark.triangle.fill" : "calendar.badge.clock")
                .foregroundColor(isOverdue ? .red : .orange)
                .font(.title2)

            VStack(alignment: .leading, spacing: 2) {
                Text(deadline.title ?? "Untitled")
                    .font(.body)
                    .fontWeight(.medium)

                if let dueDate = deadline.dueDate {
                    Text(dueDate.formatted(date: .abbreviated, time: .shortened))
                        .font(.caption)
                        .foregroundColor(isOverdue ? .red : .secondary)
                }

                if let caseTitle = deadline.caseTitle {
                    Text(caseTitle)
                        .font(.caption)
                        .foregroundColor(.accentColor)
                }
            }

            Spacer()
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

// MARK: - Appointments View
struct AppointmentsView: View {
    @StateObject private var viewModel = CalendarViewModel()
    @State private var showAddAppointment = false
    @State private var selectedDate = Date()

    var dayEvents: [CalendarEvent] {
        viewModel.calendarEvents.filter { event in
            guard let startTime = event.startTime else { return false }
            return Calendar.current.isDate(startTime, inSameDayAs: selectedDate)
        }.sorted { ($0.startTime ?? Date()) < ($1.startTime ?? Date()) }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Stats Header
            if !viewModel.calendarEvents.isEmpty {
                HStack(spacing: AppSpacing.lg) {
                    StatBox(title: "Total", value: "\(viewModel.calendarEvents.count)", color: .blue)
                    StatBox(title: "Today", value: "\(viewModel.todayEvents.count)", color: .green)
                    StatBox(title: "This Week", value: "\(eventsThisWeek)", color: .orange)
                }
                .padding()
                .background(Color.cardBackground)
            }

            // Date Picker
            DatePicker("", selection: $selectedDate, displayedComponents: .date)
                .datePickerStyle(.graphical)
                .padding()
                .background(Color.cardBackground)

            // Selected Date Header
            HStack {
                Text(selectedDate.formatted(date: .complete, time: .omitted))
                    .font(.subheadline)
                    .fontWeight(.medium)
                Spacer()
                Text("\(dayEvents.count) event\(dayEvents.count == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(Color(UIColor.secondarySystemGroupedBackground))

            if viewModel.isLoading {
                ProgressView("Loading appointments...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if dayEvents.isEmpty {
                VStack(spacing: AppSpacing.md) {
                    Image(systemName: "calendar.badge.plus")
                        .font(.system(size: 40))
                        .foregroundColor(.secondary)
                    Text("No appointments for this date")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(dayEvents) { event in
                        CalendarEventRow(event: event)
                            .listRowBackground(Color.cardBackground)
                    }
                }
                .listStyle(.plain)
                .refreshable {
                    await viewModel.loadCalendarEvents()
                }
            }
        }
        .navigationTitle("Appointments")
        .task {
            await viewModel.loadCalendarEvents()
        }
        .background(Color(UIColor.systemGroupedBackground))
    }

    private var eventsThisWeek: Int {
        let calendar = Calendar.current
        let startOfWeek = calendar.date(from: calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: Date())) ?? Date()
        let endOfWeek = calendar.date(byAdding: .day, value: 7, to: startOfWeek) ?? Date()

        return viewModel.calendarEvents.filter { event in
            guard let startTime = event.startTime else { return false }
            return startTime >= startOfWeek && startTime < endOfWeek
        }.count
    }
}

// MARK: - Stat Box Helper
struct StatBox: View {
    let title: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(color)
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

struct CalendarEventRow: View {
    let event: CalendarEvent

    var eventColor: Color {
        switch event.eventType?.lowercased() {
        case "court": return .red
        case "meeting": return .blue
        case "deadline": return .orange
        case "deposition": return .purple
        case "filing": return .green
        case "reminder": return .yellow
        case "task": return .cyan
        default: return .gray
        }
    }

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            // Color indicator bar
            RoundedRectangle(cornerRadius: 2)
                .fill(eventColor)
                .frame(width: 4, height: 40)

            VStack(alignment: .leading, spacing: 2) {
                if let startTime = event.startTime {
                    Text(startTime.formatted(date: .omitted, time: .shortened))
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.accentColor)
                }
            }
            .frame(width: 60)

            VStack(alignment: .leading, spacing: 2) {
                Text(event.title)
                    .font(.body)
                    .fontWeight(.medium)

                HStack(spacing: AppSpacing.sm) {
                    if let eventType = event.eventType {
                        Text(eventType.capitalized)
                            .font(.caption2)
                            .foregroundColor(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(eventColor)
                            .clipShape(Capsule())
                    }

                    if let location = event.location, !location.isEmpty {
                        Label(location, systemImage: "mappin")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                if let caseTitle = event.caseTitle {
                    Text(caseTitle)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            Image(systemName: event.eventTypeIcon)
                .foregroundColor(eventColor)
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

// MARK: - Statute of Limitations View
struct StatuteLimitsView: View {
    @StateObject private var viewModel = CalendarViewModel()
    @State private var showAddStatute = false

    var activeStatutes: [StatuteLimit] {
        viewModel.statuteLimits.filter { $0.status == "active" }
            .sorted { $0.limitDate < $1.limitDate }
    }

    var expiredStatutes: [StatuteLimit] {
        viewModel.statuteLimits.filter { $0.status == "expired" || $0.isExpired }
    }

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.statuteLimits.isEmpty {
                EmptyStateView(
                    icon: "hourglass",
                    title: "No Statute Limits",
                    message: "Track statute of limitations deadlines",
                    actionTitle: "Add Statute Limit",
                    action: { showAddStatute = true }
                )
            } else {
                List {
                    // Urgent Section
                    let urgent = activeStatutes.filter { $0.isUrgent }
                    if !urgent.isEmpty {
                        Section {
                            ForEach(urgent) { statute in
                                StatuteLimitRow(statute: statute)
                            }
                        } header: {
                            HStack {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(.red)
                                Text("URGENT (< 30 days)")
                            }
                        }
                    }

                    // Active Section
                    Section("Active") {
                        ForEach(activeStatutes.filter { !$0.isUrgent }) { statute in
                            StatuteLimitRow(statute: statute)
                        }
                        .onDelete { indexSet in
                            for index in indexSet {
                                let filtered = activeStatutes.filter { !$0.isUrgent }
                                viewModel.deleteStatuteLimit(filtered[index])
                            }
                        }
                    }

                    // Expired Section
                    if !expiredStatutes.isEmpty {
                        Section("Expired/Filed") {
                            ForEach(expiredStatutes) { statute in
                                StatuteLimitRow(statute: statute)
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Statute of Limitations")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAddStatute = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddStatute) {
            AddStatuteLimitView(viewModel: viewModel)
        }
        .background(Color(UIColor.systemGroupedBackground))
    }
}

struct StatuteLimitRow: View {
    let statute: StatuteLimit

    var urgencyColor: Color {
        if statute.isExpired { return .gray }
        if statute.daysRemaining <= 7 { return .red }
        if statute.daysRemaining <= 30 { return .orange }
        if statute.daysRemaining <= 90 { return .yellow }
        return .green
    }

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            VStack {
                Text("\(statute.daysRemaining)")
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(urgencyColor)
                Text("days")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            .frame(width: 50)

            VStack(alignment: .leading, spacing: 2) {
                Text(statute.title)
                    .font(.body)
                    .fontWeight(.medium)

                Text(statute.limitDate.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption)
                    .foregroundColor(.secondary)

                HStack(spacing: AppSpacing.sm) {
                    Text(statute.caseType)
                        .font(.caption2)
                        .foregroundColor(.accentColor)

                    Text(statute.jurisdiction)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                if let clientName = statute.clientName {
                    Text(clientName)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            if statute.isExpired {
                Text("EXPIRED")
                    .font(.caption2)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.gray)
                    .clipShape(Capsule())
            }
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

struct AddStatuteLimitView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: CalendarViewModel

    @State private var title = ""
    @State private var caseType = ""
    @State private var jurisdiction = ""
    @State private var limitDate = Date().addingTimeInterval(365 * 24 * 60 * 60)
    @State private var clientName = ""
    @State private var caseName = ""
    @State private var notes = ""

    let caseTypes = ["Personal Injury", "Medical Malpractice", "Contract", "Property", "Employment", "Family Law", "Criminal", "Other"]
    let jurisdictions = ["Federal", "California", "New York", "Texas", "Florida", "Illinois", "Pennsylvania", "Other"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Title", text: $title)

                    Picker("Case Type", selection: $caseType) {
                        Text("Select").tag("")
                        ForEach(caseTypes, id: \.self) { type in
                            Text(type).tag(type)
                        }
                    }

                    Picker("Jurisdiction", selection: $jurisdiction) {
                        Text("Select").tag("")
                        ForEach(jurisdictions, id: \.self) { j in
                            Text(j).tag(j)
                        }
                    }
                }

                Section("Deadline") {
                    DatePicker("Limit Date", selection: $limitDate, displayedComponents: .date)
                }

                Section("Related") {
                    TextField("Client Name", text: $clientName)
                    TextField("Case Name", text: $caseName)
                }

                Section("Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 80)
                }
            }
            .navigationTitle("Add Statute Limit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let statute = StatuteLimit(
                            title: title,
                            caseType: caseType.isEmpty ? "Other" : caseType,
                            jurisdiction: jurisdiction.isEmpty ? "Other" : jurisdiction,
                            limitDate: limitDate,
                            caseName: caseName.isEmpty ? nil : caseName,
                            clientName: clientName.isEmpty ? nil : clientName,
                            notes: notes.isEmpty ? nil : notes
                        )
                        viewModel.addStatuteLimit(statute)
                        dismiss()
                    }
                    .disabled(title.isEmpty)
                }
            }
        }
    }
}
