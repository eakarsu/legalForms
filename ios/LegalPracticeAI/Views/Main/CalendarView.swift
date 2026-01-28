//
//  CalendarView.swift
//  LegalPracticeAI
//
//  Calendar and deadlines management screen
//

import SwiftUI

struct CalendarView: View {
    @State private var selectedDate = Date()
    @State private var events: [CalendarEvent] = []
    @State private var deadlines: [Deadline] = []
    @State private var selectedTab = 0
    @State private var isLoading = false
    @State private var showAddEvent = false
    @State private var showAddDeadline = false

    var upcomingDeadlines: [Deadline] {
        deadlines.filter { $0.status != "completed" }
            .sorted { ($0.dueDate ?? Date.distantFuture) < ($1.dueDate ?? Date.distantFuture) }
    }

    var overdueCount: Int {
        deadlines.filter { $0.isOverdue }.count
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Tab Picker
                Picker("View", selection: $selectedTab) {
                    Text("Calendar").tag(0)
                    Text("Deadlines").tag(1)
                }
                .pickerStyle(.segmented)
                .padding()

                if selectedTab == 0 {
                    calendarContent
                } else {
                    deadlinesContent
                }
            }
            .navigationTitle("Calendar")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button {
                            showAddEvent = true
                        } label: {
                            Label("New Event", systemImage: "calendar.badge.plus")
                        }

                        Button {
                            showAddDeadline = true
                        } label: {
                            Label("New Deadline", systemImage: "exclamationmark.circle")
                        }
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showAddEvent) {
                AddEventView()
            }
            .sheet(isPresented: $showAddDeadline) {
                AddDeadlineView()
            }
            .background(Color(UIColor.systemGroupedBackground))
        }
        .task {
            await loadData()
        }
    }

    var calendarContent: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Custom Calendar with Event Indicators
                CustomCalendarView(
                    selectedDate: $selectedDate,
                    events: events
                )
                .padding(.horizontal)

                // Event Summary for Month
                if !events.isEmpty {
                    eventSummarySection
                }

                // Events for Selected Date
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    HStack {
                        Text("EVENTS FOR \(selectedDate.formatted(date: .abbreviated, time: .omitted).uppercased())")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                        Spacer()
                        Text("\(eventsForSelectedDate.count) event\(eventsForSelectedDate.count == 1 ? "" : "s")")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.horizontal)

                    if eventsForSelectedDate.isEmpty {
                        Text("No events for this date")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                            .padding(.horizontal)
                    } else {
                        ForEach(eventsForSelectedDate) { event in
                            EventRow(event: event)
                                .padding(.horizontal)
                        }
                    }
                }
            }
            .padding(.bottom, AppSpacing.xxl)
        }
    }

    var eventSummarySection: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            Text("EVENT TYPES")
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.secondary)
                .padding(.horizontal)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: AppSpacing.sm) {
                    ForEach(eventTypeCounts.sorted(by: { $0.value > $1.value }), id: \.key) { type, count in
                        HStack(spacing: 4) {
                            Circle()
                                .fill(colorForEventType(type))
                                .frame(width: 8, height: 8)
                            Text("\(type.capitalized): \(count)")
                                .font(.caption)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(colorForEventType(type).opacity(0.15))
                        .clipShape(Capsule())
                    }
                }
                .padding(.horizontal)
            }
        }
    }

    var eventTypeCounts: [String: Int] {
        var counts: [String: Int] = [:]
        for event in events {
            let type = event.eventType ?? "other"
            counts[type, default: 0] += 1
        }
        return counts
    }

    func colorForEventType(_ type: String) -> Color {
        switch type.lowercased() {
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

    var eventsForSelectedDate: [CalendarEvent] {
        let calendar = Calendar.current
        return events.filter { event in
            guard let eventDate = event.startTime else { return false }
            return calendar.isDate(eventDate, inSameDayAs: selectedDate)
        }
    }

    var deadlinesContent: some View {
        VStack(spacing: 0) {
            // Summary
            if overdueCount > 0 {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.red)
                    Text("\(overdueCount) overdue deadline\(overdueCount > 1 ? "s" : "")")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    Spacer()
                }
                .padding()
                .background(Color.red.opacity(0.1))
            }

            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if upcomingDeadlines.isEmpty {
                VStack(spacing: AppSpacing.lg) {
                    Image(systemName: "checkmark.circle")
                        .font(.system(size: 60))
                        .foregroundColor(.green)

                    Text("All Caught Up!")
                        .font(.title3)
                        .fontWeight(.semibold)

                    Text("No pending deadlines")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(upcomingDeadlines) { deadline in
                        DeadlineRow(deadline: deadline)
                            .listRowBackground(Color.cardBackground)
                    }
                }
                .listStyle(.plain)
                .refreshable {
                    await loadData()
                }
            }
        }
    }

    func loadData() async {
        isLoading = true
        do {
            async let eventsResponse = APIService.shared.getCalendarEvents()
            async let deadlinesResponse = APIService.shared.getDeadlines()

            // CalendarEventsResponse is now an array directly (FullCalendar format)
            events = try await eventsResponse
            deadlines = try await deadlinesResponse.deadlines
        } catch {
            print("Failed to load calendar data: \(error)")
        }
        isLoading = false
    }
}

// MARK: - Event Row
struct EventRow: View {
    let event: CalendarEvent

    var eventColor: Color {
        switch event.eventType?.lowercased() {
        case "court": return .red
        case "meeting": return .blue
        case "deadline": return .orange
        case "deposition": return .purple
        case "filing": return .green
        default: return .gray
        }
    }

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            RoundedRectangle(cornerRadius: 3)
                .fill(eventColor)
                .frame(width: 4)

            VStack(alignment: .leading, spacing: 4) {
                Text(event.title)
                    .font(.body)
                    .fontWeight(.medium)

                HStack(spacing: AppSpacing.sm) {
                    if let startTime = event.startTime {
                        Label(startTime.formatted(date: .omitted, time: .shortened), systemImage: "clock")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    if let eventType = event.eventType {
                        Text(eventType.capitalized)
                            .font(.caption)
                            .foregroundColor(eventColor)
                    }
                }

                if let location = event.location, !location.isEmpty {
                    Label(location, systemImage: "mappin")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            Image(systemName: event.eventTypeIcon)
                .foregroundColor(eventColor)
        }
        .padding()
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
    }
}

// MARK: - Deadline Row
struct DeadlineRow: View {
    let deadline: Deadline

    var urgencyColor: Color {
        if deadline.isOverdue { return .red }
        if deadline.isUrgent { return .orange }
        return .green
    }

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Button {
                // Toggle complete
            } label: {
                Image(systemName: deadline.status == "completed" ? "checkmark.circle.fill" : "circle")
                    .font(.title2)
                    .foregroundColor(deadline.status == "completed" ? .green : urgencyColor)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(deadline.title ?? "Untitled Deadline")
                    .font(.body)
                    .fontWeight(.medium)
                    .strikethrough(deadline.status == "completed")

                HStack(spacing: AppSpacing.sm) {
                    if let dueDate = deadline.dueDate {
                        Label(dueDate.formatted(date: .abbreviated, time: .omitted), systemImage: "calendar")
                            .font(.caption)
                            .foregroundColor(deadline.isOverdue ? .red : .secondary)
                    }

                    if let caseTitle = deadline.caseTitle {
                        Text(caseTitle)
                            .font(.caption)
                            .foregroundColor(.accentColor)
                            .lineLimit(1)
                    }
                }

                if deadline.isOverdue {
                    Text("OVERDUE")
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.red)
                        .clipShape(Capsule())
                } else if deadline.isUrgent {
                    Text("URGENT")
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.orange)
                        .clipShape(Capsule())
                }
            }

            Spacer()
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

// MARK: - Add Event View
struct AddEventView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var casesViewModel = CasesViewModel()

    @State private var title = ""
    @State private var eventType = "meeting"
    @State private var startTime = Date()
    @State private var endTime = Date().addingTimeInterval(3600)
    @State private var location = ""
    @State private var selectedCaseId: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Event Details") {
                    TextField("Title", text: $title)

                    Picker("Type", selection: $eventType) {
                        ForEach(EventType.allCases, id: \.rawValue) { type in
                            Label(type.displayName, systemImage: type.icon).tag(type.rawValue)
                        }
                    }

                    DatePicker("Start", selection: $startTime)
                    DatePicker("End", selection: $endTime)

                    TextField("Location (optional)", text: $location)
                }

                Section("Link to Case") {
                    Picker("Case", selection: $selectedCaseId) {
                        Text("None").tag(nil as String?)
                        ForEach(casesViewModel.cases, id: \.id) { caseItem in
                            Text(caseItem.title ?? "Untitled").tag(caseItem.id as String?)
                        }
                    }
                }
            }
            .navigationTitle("New Event")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { dismiss() }
                        .disabled(title.isEmpty)
                }
            }
        }
        .task {
            await casesViewModel.loadCases()
        }
    }
}

// MARK: - Add Deadline View
struct AddDeadlineView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var casesViewModel = CasesViewModel()

    @State private var title = ""
    @State private var dueDate = Date().addingTimeInterval(7 * 24 * 60 * 60)
    @State private var warningDays = 7
    @State private var priority = "medium"
    @State private var selectedCaseId: String?
    @State private var description = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Deadline Details") {
                    TextField("Title", text: $title)

                    DatePicker("Due Date", selection: $dueDate, displayedComponents: .date)

                    Stepper("Warn \(warningDays) days before", value: $warningDays, in: 1...30)

                    Picker("Priority", selection: $priority) {
                        Text("High").tag("high")
                        Text("Medium").tag("medium")
                        Text("Low").tag("low")
                    }
                }

                Section("Link to Case") {
                    Picker("Case", selection: $selectedCaseId) {
                        Text("None").tag(nil as String?)
                        ForEach(casesViewModel.cases, id: \.id) { caseItem in
                            Text(caseItem.title ?? "Untitled").tag(caseItem.id as String?)
                        }
                    }
                }

                Section("Notes") {
                    TextEditor(text: $description)
                        .frame(minHeight: 80)
                }
            }
            .navigationTitle("New Deadline")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { dismiss() }
                        .disabled(title.isEmpty)
                }
            }
        }
        .task {
            await casesViewModel.loadCases()
        }
    }
}

// MARK: - Custom Calendar View with Event Indicators
struct CustomCalendarView: View {
    @Binding var selectedDate: Date
    let events: [CalendarEvent]

    @State private var currentMonth = Date()

    private let calendar = Calendar.current
    private let daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    var body: some View {
        VStack(spacing: AppSpacing.md) {
            // Month Navigation
            HStack {
                Button {
                    withAnimation {
                        currentMonth = calendar.date(byAdding: .month, value: -1, to: currentMonth) ?? currentMonth
                    }
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.title3)
                        .foregroundColor(.accentColor)
                }

                Spacer()

                VStack(spacing: 2) {
                    Text(currentMonth.formatted(.dateTime.month(.wide).year()))
                        .font(.headline)

                    if !calendar.isDate(currentMonth, equalTo: Date(), toGranularity: .month) {
                        Button("Today") {
                            withAnimation {
                                currentMonth = Date()
                                selectedDate = Date()
                            }
                        }
                        .font(.caption)
                        .foregroundColor(.accentColor)
                    }
                }

                Spacer()

                Button {
                    withAnimation {
                        currentMonth = calendar.date(byAdding: .month, value: 1, to: currentMonth) ?? currentMonth
                    }
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.title3)
                        .foregroundColor(.accentColor)
                }
            }
            .padding(.horizontal)

            // Day Headers
            HStack(spacing: 0) {
                ForEach(daysOfWeek, id: \.self) { day in
                    Text(day)
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity)
                }
            }

            // Calendar Grid
            let days = daysInMonth()
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 8) {
                ForEach(days, id: \.self) { date in
                    if let date = date {
                        DayCell(
                            date: date,
                            isSelected: calendar.isDate(date, inSameDayAs: selectedDate),
                            isToday: calendar.isDateInToday(date),
                            events: eventsForDate(date)
                        )
                        .onTapGesture {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                selectedDate = date
                            }
                        }
                    } else {
                        Color.clear
                            .frame(height: 50)
                    }
                }
            }

            // Color Legend
            if !events.isEmpty {
                Divider()
                    .padding(.top, 8)

                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible()),
                    GridItem(.flexible()),
                    GridItem(.flexible())
                ], spacing: 8) {
                    ForEach(eventTypeLegend, id: \.0) { type, color in
                        HStack(spacing: 4) {
                            Circle()
                                .fill(color)
                                .frame(width: 8, height: 8)
                            Text(type)
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
        }
        .padding()
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
    }

    private var eventTypeLegend: [(String, Color)] {
        [
            ("Court", .red),
            ("Meeting", .blue),
            ("Deadline", .orange),
            ("Deposition", .purple),
            ("Filing", .green),
            ("Reminder", .yellow),
            ("Task", .cyan),
            ("Other", .gray)
        ]
    }

    private func daysInMonth() -> [Date?] {
        guard let monthInterval = calendar.dateInterval(of: .month, for: currentMonth) else {
            return []
        }

        var days: [Date?] = []
        let firstDayOfMonth = monthInterval.start
        let firstWeekday = calendar.component(.weekday, from: firstDayOfMonth)

        // Add empty cells for days before the first of the month
        for _ in 1..<firstWeekday {
            days.append(nil)
        }

        // Add days of the month
        var currentDate = firstDayOfMonth
        while currentDate < monthInterval.end {
            days.append(currentDate)
            currentDate = calendar.date(byAdding: .day, value: 1, to: currentDate) ?? currentDate
        }

        return days
    }

    private func eventsForDate(_ date: Date) -> [CalendarEvent] {
        events.filter { event in
            guard let eventDate = event.startTime else { return false }
            return calendar.isDate(eventDate, inSameDayAs: date)
        }
    }
}

// MARK: - Day Cell with Event Indicators
struct DayCell: View {
    let date: Date
    let isSelected: Bool
    let isToday: Bool
    let events: [CalendarEvent]

    private let calendar = Calendar.current

    var eventColors: [Color] {
        let types = Set(events.compactMap { $0.eventType?.lowercased() })
        return types.prefix(4).map { colorForType($0) }
    }

    func colorForType(_ type: String) -> Color {
        switch type {
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
        VStack(spacing: 4) {
            Text("\(calendar.component(.day, from: date))")
                .font(.system(size: 16, weight: isToday ? .bold : .regular))
                .foregroundColor(textColor)
                .frame(width: 32, height: 32)
                .background(backgroundView)

            // Event Indicators (colored dots)
            if !events.isEmpty {
                HStack(spacing: 2) {
                    ForEach(Array(eventColors.prefix(3).enumerated()), id: \.offset) { _, color in
                        Circle()
                            .fill(color)
                            .frame(width: 6, height: 6)
                    }
                    if events.count > 3 {
                        Text("+\(events.count - 3)")
                            .font(.system(size: 7, weight: .bold))
                            .foregroundColor(.secondary)
                    }
                }
                .frame(height: 8)
            } else {
                Color.clear.frame(height: 8)
            }
        }
        .frame(height: 50)
    }

    var textColor: Color {
        if isSelected {
            return .white
        } else if isToday {
            return .accentColor
        } else {
            return .primary
        }
    }

    @ViewBuilder
    var backgroundView: some View {
        if isSelected {
            Circle().fill(Color.accentColor)
        } else if isToday {
            Circle().stroke(Color.accentColor, lineWidth: 2)
        } else {
            Color.clear
        }
    }
}

// MARK: - Preview
#Preview {
    CalendarView()
}
