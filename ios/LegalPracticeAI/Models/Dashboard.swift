//
//  Dashboard.swift
//  LegalPracticeAI
//
//  Dashboard statistics and analytics models
//

import Foundation

// MARK: - Dashboard Stats
struct DashboardStats: Codable {
    // Cases
    var totalCases: Int?
    var openCases: Int?
    var pendingCases: Int?
    var closedCases: Int?

    // Clients
    var totalClients: Int?
    var activeClients: Int?
    var newClientsThisMonth: Int?

    // Billing
    var totalBilled: Double?
    var totalCollected: Double?
    var outstanding: Double?
    var unbilledAmount: Double?

    // Time
    var totalHoursThisMonth: Double?
    var billableHoursThisMonth: Double?

    // Deadlines
    var upcomingDeadlines: Int?
    var overdueDeadlines: Int?

    // Documents
    var totalDocuments: Int?
    var documentsThisMonth: Int?
}

// MARK: - Dashboard Response
struct DashboardResponse: Codable {
    let success: Bool
    let stats: DashboardStats
    let recentCases: [Case]?
    let recentClients: [Client]?
    let upcomingDeadlines: [Deadline]?
    let upcomingEvents: [CalendarEvent]?
    let recentInvoices: [Invoice]?
}

// MARK: - Quick Action
struct QuickAction: Identifiable {
    let id = UUID()
    let title: String
    let icon: String
    let color: String
    let action: QuickActionType
}

enum QuickActionType {
    case newCase
    case newClient
    case newDocument
    case newInvoice
    case newTimeEntry
    case newEvent
}

// MARK: - Activity Item
struct ActivityItem: Identifiable {
    let id = UUID()
    let title: String
    let subtitle: String
    let icon: String
    let color: String
    let timestamp: Date
    let type: ActivityType
}

enum ActivityType {
    case caseCreated
    case caseUpdated
    case clientAdded
    case documentGenerated
    case invoiceSent
    case paymentReceived
    case deadlineApproaching
    case noteAdded
}

// MARK: - Chart Data
struct ChartDataPoint: Identifiable {
    let id = UUID()
    let label: String
    let value: Double
    let color: String?
}

// MARK: - Revenue Report
struct RevenueReport: Codable {
    var period: String?
    var totalRevenue: Double?
    var totalBilled: Double?
    var totalCollected: Double?
    var outstanding: Double?
    var byClient: [ClientRevenue]?
    var byCase: [CaseRevenue]?
    var byMonth: [MonthlyRevenue]?
}

struct ClientRevenue: Codable, Identifiable {
    var id: String { clientId }
    var clientId: String
    var clientName: String?
    var revenue: Double?
    var outstanding: Double?
}

struct CaseRevenue: Codable, Identifiable {
    var id: String { caseId }
    var caseId: String
    var caseTitle: String?
    var revenue: Double?
    var hours: Double?
}

struct MonthlyRevenue: Codable, Identifiable {
    var id: String { month }
    var month: String
    var revenue: Double?
    var collected: Double?
}
