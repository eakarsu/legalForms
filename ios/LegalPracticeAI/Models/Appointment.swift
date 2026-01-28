//
//  Appointment.swift
//  LegalPracticeAI
//
//  Appointment and scheduling models
//

import Foundation

// MARK: - Appointment Type
enum AppointmentType: String, CaseIterable, Codable {
    case consultation = "consultation"
    case meeting = "meeting"
    case courtDate = "court_date"
    case deposition = "deposition"
    case mediation = "mediation"
    case phoneCall = "phone_call"
    case other = "other"

    var displayName: String {
        switch self {
        case .consultation: return "Consultation"
        case .meeting: return "Meeting"
        case .courtDate: return "Court Date"
        case .deposition: return "Deposition"
        case .mediation: return "Mediation"
        case .phoneCall: return "Phone Call"
        case .other: return "Other"
        }
    }

    var icon: String {
        switch self {
        case .consultation: return "person.fill.questionmark"
        case .meeting: return "person.2.fill"
        case .courtDate: return "building.columns.fill"
        case .deposition: return "text.quote"
        case .mediation: return "hand.raised.fill"
        case .phoneCall: return "phone.fill"
        case .other: return "calendar"
        }
    }
}

// MARK: - Appointment
struct Appointment: Identifiable, Codable {
    let id: String
    var title: String
    var appointmentType: AppointmentType
    var startTime: Date
    var endTime: Date?
    var location: String?
    var clientId: String?
    var clientName: String?
    var caseId: String?
    var caseName: String?
    var notes: String?
    var reminder: Int? // minutes before
    var isAllDay: Bool
    var createdAt: Date?

    init(id: String = UUID().uuidString,
         title: String,
         appointmentType: AppointmentType = .meeting,
         startTime: Date,
         endTime: Date? = nil,
         location: String? = nil,
         clientId: String? = nil,
         clientName: String? = nil,
         caseId: String? = nil,
         caseName: String? = nil,
         notes: String? = nil,
         reminder: Int? = 30,
         isAllDay: Bool = false,
         createdAt: Date? = Date()) {
        self.id = id
        self.title = title
        self.appointmentType = appointmentType
        self.startTime = startTime
        self.endTime = endTime
        self.location = location
        self.clientId = clientId
        self.clientName = clientName
        self.caseId = caseId
        self.caseName = caseName
        self.notes = notes
        self.reminder = reminder
        self.isAllDay = isAllDay
        self.createdAt = createdAt
    }
}

// MARK: - Statute of Limitations
struct StatuteLimit: Identifiable, Codable {
    let id: String
    var title: String
    var caseType: String
    var jurisdiction: String
    var limitDate: Date
    var caseId: String?
    var caseName: String?
    var clientName: String?
    var notes: String?
    var status: String // "active", "filed", "expired"
    var createdAt: Date?

    init(id: String = UUID().uuidString,
         title: String,
         caseType: String,
         jurisdiction: String,
         limitDate: Date,
         caseId: String? = nil,
         caseName: String? = nil,
         clientName: String? = nil,
         notes: String? = nil,
         status: String = "active",
         createdAt: Date? = Date()) {
        self.id = id
        self.title = title
        self.caseType = caseType
        self.jurisdiction = jurisdiction
        self.limitDate = limitDate
        self.caseId = caseId
        self.caseName = caseName
        self.clientName = clientName
        self.notes = notes
        self.status = status
        self.createdAt = createdAt
    }

    var daysRemaining: Int {
        Calendar.current.dateComponents([.day], from: Date(), to: limitDate).day ?? 0
    }

    var isExpired: Bool {
        limitDate < Date()
    }

    var isUrgent: Bool {
        daysRemaining <= 30 && daysRemaining > 0
    }
}
