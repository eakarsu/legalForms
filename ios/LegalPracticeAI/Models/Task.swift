//
//  Task.swift
//  LegalPracticeAI
//
//  Task data model for case and general tasks
//

import Foundation

// MARK: - Task Status
enum TaskStatus: String, CaseIterable, Codable {
    case pending = "pending"
    case inProgress = "in_progress"
    case completed = "completed"
    case cancelled = "cancelled"

    var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .inProgress: return "In Progress"
        case .completed: return "Completed"
        case .cancelled: return "Cancelled"
        }
    }

    var color: String {
        switch self {
        case .pending: return "orange"
        case .inProgress: return "blue"
        case .completed: return "green"
        case .cancelled: return "gray"
        }
    }
}

// MARK: - Task Priority
enum TaskPriority: String, CaseIterable, Codable {
    case low = "low"
    case medium = "medium"
    case high = "high"
    case urgent = "urgent"

    var displayName: String {
        rawValue.capitalized
    }

    var color: String {
        switch self {
        case .low: return "gray"
        case .medium: return "blue"
        case .high: return "orange"
        case .urgent: return "red"
        }
    }

    var icon: String {
        switch self {
        case .low: return "chevron.down"
        case .medium: return "minus"
        case .high: return "chevron.up"
        case .urgent: return "exclamationmark.2"
        }
    }
}

// MARK: - Task Item Model
struct TaskItem: Identifiable, Codable {
    let id: String
    var title: String
    var description: String?
    var status: TaskStatus
    var priority: TaskPriority
    var dueDate: Date?
    var caseId: String?
    var caseName: String?
    var clientId: String?
    var clientName: String?
    var assignedTo: String?
    var assignedToName: String?
    var category: String?
    var completedAt: Date?
    var createdAt: Date?
    var updatedAt: Date?

    // CodingKeys - standard snake_case is handled automatically by APIService decoder
    enum CodingKeys: String, CodingKey {
        case id, title, description, status, priority, category
        case dueDate             // auto: due_date → dueDate
        case caseId              // auto: case_id → caseId
        case caseName            // auto: case_name → caseName
        case clientId            // auto: client_id → clientId
        case clientName          // auto: client_name → clientName
        case assignedTo          // auto: assigned_to → assignedTo
        case assignedToName      // auto: assigned_to_name → assignedToName
        case completedAt         // auto: completed_at → completedAt
        case createdAt           // auto: created_at → createdAt
        case updatedAt           // auto: updated_at → updatedAt
    }

    init(id: String = UUID().uuidString,
         title: String,
         description: String? = nil,
         status: TaskStatus = .pending,
         priority: TaskPriority = .medium,
         dueDate: Date? = nil,
         caseId: String? = nil,
         caseName: String? = nil,
         clientId: String? = nil,
         clientName: String? = nil,
         assignedTo: String? = nil,
         assignedToName: String? = nil,
         category: String? = nil,
         completedAt: Date? = nil,
         createdAt: Date? = Date(),
         updatedAt: Date? = nil) {
        self.id = id
        self.title = title
        self.description = description
        self.status = status
        self.priority = priority
        self.dueDate = dueDate
        self.caseId = caseId
        self.caseName = caseName
        self.clientId = clientId
        self.clientName = clientName
        self.assignedTo = assignedTo
        self.assignedToName = assignedToName
        self.category = category
        self.completedAt = completedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    var isOverdue: Bool {
        guard let dueDate = dueDate, status != .completed && status != .cancelled else { return false }
        return dueDate < Date()
    }

    var isDueToday: Bool {
        guard let dueDate = dueDate else { return false }
        return Calendar.current.isDateInToday(dueDate)
    }

    var isDueSoon: Bool {
        guard let dueDate = dueDate, status != .completed && status != .cancelled else { return false }
        let twoDaysFromNow = Calendar.current.date(byAdding: .day, value: 2, to: Date()) ?? Date()
        return dueDate <= twoDaysFromNow && dueDate >= Date()
    }
}

// MARK: - Task API Response Types
struct TasksResponse: Codable {
    let success: Bool
    let tasks: [TaskItem]
    let count: Int?
}

struct SingleTaskResponse: Codable {
    let success: Bool
    let task: TaskItem
}

struct CreateTaskRequest: Codable {
    let title: String
    let description: String?
    let priority: String?
    let dueDate: Date?
    let caseId: String?
    let clientId: String?
    let assignedTo: String?
    let category: String?
}

struct UpdateTaskRequest: Codable {
    let title: String?
    let description: String?
    let status: String?
    let priority: String?
    let dueDate: Date?
    let caseId: String?
    let clientId: String?
    let assignedTo: String?
    let category: String?
}
