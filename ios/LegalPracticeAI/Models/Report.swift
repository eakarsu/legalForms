//
//  Report.swift
//  LegalPracticeAI
//
//  Report and analytics models
//

import Foundation

// Note: ReportsSummaryResponse is defined in APIService.swift

// MARK: - A/R Aging Report Response
struct ARAgingResponse: Codable {
    let success: Bool
    let summary: [AgingBucket]
    let invoices: [AgingInvoice]
}

struct AgingBucket: Codable {
    let bucket: String?
    let invoiceCount: Int?
    let totalBalance: Double?

    enum CodingKeys: String, CodingKey {
        case bucket
        case invoiceCount = "invoice_count"
        case totalBalance = "total_balance"
    }
}

struct AgingInvoice: Codable, Identifiable {
    let id: String
    let invoiceNumber: String?
    let clientName: String?
    let balance: Double?
    let daysOverdue: Int?
    let dueDate: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case invoiceNumber = "invoice_number"
        case clientName = "client_name"
        case balance
        case daysOverdue = "days_overdue"
        case dueDate = "due_date"
    }
}

// MARK: - Revenue Report Response
struct RevenueReportResponse: Codable {
    let success: Bool
    let data: [RevenueDataItem]
    let totals: RevenueTotals
    let period: String?
    let groupBy: String?

    enum CodingKeys: String, CodingKey {
        case success, data, totals, period
        case groupBy = "group_by"
    }
}

struct RevenueDataItem: Codable, Identifiable {
    var id: String { name ?? UUID().uuidString }
    let name: String?
    let totalAmount: Double?
    let totalMinutes: Int?
    let entryCount: Int?

    enum CodingKeys: String, CodingKey {
        case name
        case totalAmount = "total_amount"
        case totalMinutes = "total_minutes"
        case entryCount = "entry_count"
    }
}

struct RevenueTotals: Codable {
    let totalRevenue: Double?
    let totalMinutes: Int?
    let totalEntries: Int?

    enum CodingKeys: String, CodingKey {
        case totalRevenue = "total_revenue"
        case totalMinutes = "total_minutes"
        case totalEntries = "total_entries"
    }
}

// MARK: - Productivity Report Response
struct ProductivityReportResponse: Codable {
    let success: Bool
    let byActivity: [ActivityData]
    let byDay: [DayData]
    let summary: ProductivitySummary
    let period: String?

    enum CodingKeys: String, CodingKey {
        case success, period, summary
        case byActivity = "byActivity"
        case byDay = "byDay"
    }
}

struct ActivityData: Codable, Identifiable {
    var id: String { activityType }
    let activityType: String
    let totalMinutes: Int?
    let entryCount: Int?

    enum CodingKeys: String, CodingKey {
        case activityType = "activity_type"
        case totalMinutes = "total_minutes"
        case entryCount = "entry_count"
    }
}

struct DayData: Codable, Identifiable {
    var id: String { date ?? UUID().uuidString }
    let date: String?
    let totalMinutes: Int?
    let billableMinutes: Int?
    let entryCount: Int?

    enum CodingKeys: String, CodingKey {
        case date
        case totalMinutes = "total_minutes"
        case billableMinutes = "billable_minutes"
        case entryCount = "entry_count"
    }
}

struct ProductivitySummary: Codable {
    let totalMinutes: Int?
    let billableMinutes: Int?
    let totalAmount: Double?
    let avgRate: Double?
    let daysWorked: Int?

    enum CodingKeys: String, CodingKey {
        case totalMinutes = "total_minutes"
        case billableMinutes = "billable_minutes"
        case totalAmount = "total_amount"
        case avgRate = "avg_rate"
        case daysWorked = "days_worked"
    }

    var totalHours: Double {
        Double(totalMinutes ?? 0) / 60.0
    }

    var billableHours: Double {
        Double(billableMinutes ?? 0) / 60.0
    }

    var utilizationRate: Double {
        guard let total = totalMinutes, total > 0, let billable = billableMinutes else { return 0 }
        return Double(billable) / Double(total) * 100
    }
}

// MARK: - Cases Report Response
struct CasesReportResponse: Codable {
    let success: Bool
    let byStatus: [StatusCount]
    let byType: [TypeCount]
    let byPriority: [PriorityCount]?
    let openedOverTime: [MonthCount]?
    let closedOverTime: [MonthCount]?
    let topCasesByRevenue: [ReportCaseRevenue]?

    enum CodingKeys: String, CodingKey {
        case success
        case byStatus = "byStatus"
        case byType = "byType"
        case byPriority = "byPriority"
        case openedOverTime = "openedOverTime"
        case closedOverTime = "closedOverTime"
        case topCasesByRevenue = "topCasesByRevenue"
    }
}

struct StatusCount: Codable, Identifiable {
    var id: String { status ?? "unknown" }
    let status: String?
    let count: Int

    var displayName: String {
        (status ?? "Unknown").capitalized
    }
}

struct TypeCount: Codable, Identifiable {
    var id: String { caseType ?? "unknown" }
    let caseType: String?
    let count: Int

    enum CodingKeys: String, CodingKey {
        case caseType = "case_type"
        case count
    }

    var displayName: String {
        (caseType ?? "Other").capitalized
    }
}

struct PriorityCount: Codable, Identifiable {
    var id: String { priority ?? "unknown" }
    let priority: String?
    let count: Int
}

struct MonthCount: Codable {
    let month: String?
    let openedCount: Int?
    let closedCount: Int?

    enum CodingKeys: String, CodingKey {
        case month
        case openedCount = "opened_count"
        case closedCount = "closed_count"
    }
}

struct ReportCaseRevenue: Codable, Identifiable {
    let id: String
    let title: String?
    let caseNumber: String?
    let status: String?
    let totalRevenue: Double?
    let totalMinutes: Int?

    enum CodingKeys: String, CodingKey {
        case id, title, status
        case caseNumber = "case_number"
        case totalRevenue = "total_revenue"
        case totalMinutes = "total_minutes"
    }
}

// MARK: - Clients Report Response
struct ClientsReportResponse: Codable {
    let success: Bool
    let byType: [ClientTypeCount]
    let byStatus: [ClientStatusCount]
    let acquisition: [AcquisitionData]?
    let topClients: [TopClient]
    let retention: RetentionData?

    enum CodingKeys: String, CodingKey {
        case success, acquisition, retention
        case byType = "byType"
        case byStatus = "byStatus"
        case topClients = "topClients"
    }
}

struct ClientTypeCount: Codable, Identifiable {
    var id: String { clientType ?? "unknown" }
    let clientType: String?
    let count: Int

    enum CodingKeys: String, CodingKey {
        case clientType = "client_type"
        case count
    }
}

struct ClientStatusCount: Codable, Identifiable {
    var id: String { status ?? "unknown" }
    let status: String?
    let count: Int
}

struct AcquisitionData: Codable {
    let month: String?
    let newClients: Int?

    enum CodingKeys: String, CodingKey {
        case month
        case newClients = "new_clients"
    }
}

struct TopClient: Codable, Identifiable {
    let id: String
    let name: String?
    let clientType: String?
    let totalRevenue: Double?
    let caseCount: Int?

    enum CodingKeys: String, CodingKey {
        case id, name
        case clientType = "client_type"
        case totalRevenue = "total_revenue"
        case caseCount = "case_count"
    }
}

struct RetentionData: Codable {
    let activeClients: Int?

    enum CodingKeys: String, CodingKey {
        case activeClients = "active_clients"
    }
}
