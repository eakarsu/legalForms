//
//  Communication.swift
//  LegalPracticeAI
//
//  Communication models for messages, notes, and notifications
//

import Foundation

// MARK: - Message
struct Message: Codable, Identifiable {
    let id: String
    var subject: String?
    var content: String?
    var messageType: String?
    var clientId: String?
    var caseId: String?
    var recipientId: String?
    var isRead: Bool?
    var parentId: String?
    var createdAt: Date?

    // Joined fields
    var clientFirstName: String?
    var clientLastName: String?
    var companyName: String?
    var caseTitle: String?
    var senderFirstName: String?
    var senderLastName: String?

    var displayName: String {
        if let firstName = clientFirstName, let lastName = clientLastName {
            return "\(firstName) \(lastName)"
        } else if let company = companyName {
            return company
        } else if let firstName = senderFirstName, let lastName = senderLastName {
            return "\(firstName) \(lastName)"
        }
        return "Unknown"
    }

    var preview: String {
        let text = content ?? ""
        if text.count > 100 {
            return String(text.prefix(100)) + "..."
        }
        return text
    }
}

// MARK: - Note
struct Note: Codable, Identifiable {
    let id: String
    var caseId: String?
    var userId: String?
    var noteType: String?
    var content: String
    var isBillable: Bool?
    var createdAt: Date?

    // Joined fields
    var caseTitle: String?
    var caseNumber: String?
    var userFirstName: String?
    var userLastName: String?

    var title: String {
        let lines = content.components(separatedBy: .newlines)
        return lines.first ?? "Untitled Note"
    }

    var preview: String {
        if content.count > 150 {
            return String(content.prefix(150)) + "..."
        }
        return content
    }

    var authorName: String {
        if let firstName = userFirstName, let lastName = userLastName {
            return "\(firstName) \(lastName)"
        }
        return "Unknown"
    }
}

// MARK: - Notification
struct AppNotification: Codable, Identifiable {
    let id: String
    var userId: String?
    var title: String
    var message: String?
    var notificationType: String?
    var referenceType: String?
    var referenceId: String?
    var isRead: Bool?
    var createdAt: Date?

    var icon: String {
        switch notificationType?.lowercased() {
        case "deadline": return "exclamationmark.circle.fill"
        case "payment": return "dollarsign.circle.fill"
        case "document": return "doc.fill"
        case "message": return "envelope.fill"
        case "case_update": return "folder.fill"
        default: return "bell.fill"
        }
    }

    var color: String {
        switch notificationType?.lowercased() {
        case "deadline": return "red"
        case "payment": return "green"
        case "document": return "blue"
        case "message": return "purple"
        case "case_update": return "orange"
        default: return "gray"
        }
    }
}

// MARK: - API Responses
struct MessagesResponse: Codable {
    let success: Bool
    let messages: [Message]
}

struct NotesResponse: Codable {
    let success: Bool
    let notes: [Note]
}

struct NotificationsResponse: Codable {
    let success: Bool
    let notifications: [AppNotification]
    let unreadCount: Int?
}
