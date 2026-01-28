//
//  CalendarEvent.swift
//  LegalPracticeAI
//
//  Calendar events and deadlines models
//

import Foundation

// MARK: - Calendar Event Extended Props (from FullCalendar format)
struct CalendarEventExtendedProps: Codable {
    var description: String?
    var eventType: String?
    var location: String?
    var caseId: String?
    var caseTitle: String?
    var clientId: String?
    var status: String?

    // CodingKeys - standard snake_case is handled automatically by APIService decoder
    enum CodingKeys: String, CodingKey {
        case description, location, status
        case eventType           // auto: event_type → eventType
        case caseId              // auto: case_id → caseId
        case caseTitle           // auto: case_title → caseTitle
        case clientId            // auto: client_id → clientId
    }
}

// MARK: - Calendar Event (FullCalendar format from backend)
struct CalendarEvent: Codable, Identifiable {
    let id: String
    var title: String
    var start: Date?           // FullCalendar format uses "start" not "start_time"
    var end: Date?             // FullCalendar format uses "end" not "end_time"
    var allDay: Bool?
    var color: String?
    var extendedProps: CalendarEventExtendedProps?

    // CodingKeys - standard snake_case is handled automatically by APIService decoder
    enum CodingKeys: String, CodingKey {
        case id, title, start, end, color
        case allDay              // auto: all_day → allDay
        case extendedProps       // auto: extended_props → extendedProps
    }

    // Convenience accessors to maintain compatibility
    var startTime: Date? { start }
    var endTime: Date? { end }
    var description: String? { extendedProps?.description }
    var eventType: String? { extendedProps?.eventType }
    var location: String? { extendedProps?.location }
    var caseId: String? { extendedProps?.caseId }
    var caseTitle: String? { extendedProps?.caseTitle }
    var clientId: String? { extendedProps?.clientId }

    var clientDisplayName: String? {
        return nil // Not included in FullCalendar format
    }

    var eventTypeIcon: String {
        switch eventType?.lowercased() {
        case "court": return "building.columns"
        case "meeting": return "person.2"
        case "deadline": return "exclamationmark.circle"
        case "deposition": return "text.quote"
        case "filing": return "doc.text"
        case "reminder": return "bell"
        default: return "calendar"
        }
    }

    var eventTypeColor: String {
        switch eventType?.lowercased() {
        case "court": return "red"
        case "meeting": return "blue"
        case "deadline": return "orange"
        case "deposition": return "purple"
        case "filing": return "green"
        case "reminder": return "yellow"
        default: return "gray"
        }
    }
}

// MARK: - Deadline
struct Deadline: Codable, Identifiable {
    let id: String
    var title: String?
    var description: String?
    var dueDate: Date?
    var warningDays: Int?
    var status: String?
    var priority: String?
    var caseId: String?
    var clientId: String?
    let createdAt: Date?

    // Case info from join
    var caseTitle: String?
    var caseNumber: String?

    // CodingKeys - standard snake_case is handled automatically by APIService decoder
    enum CodingKeys: String, CodingKey {
        case id, title, description, status, priority
        case dueDate             // auto: due_date → dueDate
        case warningDays         // auto: warning_days → warningDays
        case caseId              // auto: case_id → caseId
        case clientId            // auto: client_id → clientId
        case createdAt           // auto: created_at → createdAt
        case caseTitle           // auto: case_title → caseTitle
        case caseNumber          // auto: case_number → caseNumber
    }

    var isOverdue: Bool {
        guard let dueDate = dueDate, status != "completed" else { return false }
        return dueDate < Date()
    }

    var isUrgent: Bool {
        guard let dueDate = dueDate, status != "completed" else { return false }
        let daysUntilDue = Calendar.current.dateComponents([.day], from: Date(), to: dueDate).day ?? 0
        return daysUntilDue <= (warningDays ?? 7) && daysUntilDue >= 0
    }

    var urgencyLevel: String {
        if isOverdue { return "overdue" }
        if isUrgent { return "urgent" }
        return "normal"
    }

    var urgencyColor: String {
        switch urgencyLevel {
        case "overdue": return "red"
        case "urgent": return "orange"
        default: return "green"
        }
    }

    var statusIcon: String {
        switch status?.lowercased() {
        case "completed": return "checkmark.circle.fill"
        case "pending": return "clock"
        default: return "circle"
        }
    }
}

// MARK: - Create Calendar Event Request
struct CreateCalendarEventRequest: Codable {
    var title: String
    var description: String?
    var eventType: String?
    var startTime: Date
    var endTime: Date?
    var allDay: Bool?
    var location: String?
    var caseId: String?
    var clientId: String?
    var reminderMinutes: Int?
}

// MARK: - Create Deadline Request
struct CreateDeadlineRequest: Codable {
    var title: String
    var description: String?
    var dueDate: Date
    var warningDays: Int?
    var priority: String?
    var caseId: String?
    var clientId: String?
}

// MARK: - Calendar Events Response
// Note: Backend returns array directly for FullCalendar compatibility
typealias CalendarEventsResponse = [CalendarEvent]

// MARK: - Deadlines Response
struct DeadlinesResponse: Codable {
    let success: Bool
    let deadlines: [Deadline]
}

// MARK: - Event Types
enum EventType: String, CaseIterable {
    case court = "court"
    case meeting = "meeting"
    case deadline = "deadline"
    case deposition = "deposition"
    case filing = "filing"
    case reminder = "reminder"
    case other = "other"

    var displayName: String {
        rawValue.capitalized
    }

    var icon: String {
        switch self {
        case .court: return "building.columns"
        case .meeting: return "person.2"
        case .deadline: return "exclamationmark.circle"
        case .deposition: return "text.quote"
        case .filing: return "doc.text"
        case .reminder: return "bell"
        case .other: return "calendar"
        }
    }
}

// MARK: - Deadline Status
enum DeadlineStatus: String, CaseIterable {
    case pending = "pending"
    case completed = "completed"

    var displayName: String {
        rawValue.capitalized
    }
}
