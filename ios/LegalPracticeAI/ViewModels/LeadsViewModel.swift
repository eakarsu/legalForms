//
//  LeadsViewModel.swift
//  LegalPracticeAI
//
//  Leads state management with API integration
//

import Foundation
import SwiftUI

@MainActor
final class LeadsViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published var leads: [Lead] = []
    @Published var followUps: [FollowUp] = []
    @Published var activities: [LeadActivity] = []
    @Published var searchText = ""
    @Published var isLoading = false
    @Published var error: String?

    // MARK: - API Service
    private let api = APIService.shared

    // MARK: - Local Storage Keys (for follow-ups which may not have backend)
    private let followUpsKey = "stored_followups"

    // MARK: - Computed Properties
    var newLeads: [Lead] {
        leads.filter { $0.status == .new }
    }

    var activeLeads: [Lead] {
        leads.filter { $0.status != .converted && $0.status != .lost }
    }

    var convertedLeads: [Lead] {
        leads.filter { $0.status == .converted }
    }

    var lostLeads: [Lead] {
        leads.filter { $0.status == .lost }
    }

    var pendingFollowUps: [FollowUp] {
        followUps.filter { !$0.isCompleted }.sorted { $0.dueDate < $1.dueDate }
    }

    var overdueFollowUps: [FollowUp] {
        pendingFollowUps.filter { $0.dueDate < Date() }
    }

    var leadsBySource: [LeadSource: Int] {
        Dictionary(grouping: leads, by: { $0.source }).mapValues { $0.count }
    }

    var filteredLeads: [Lead] {
        guard !searchText.isEmpty else { return leads }
        return leads.filter {
            $0.displayName.localizedCaseInsensitiveContains(searchText) ||
            ($0.email ?? "").localizedCaseInsensitiveContains(searchText) ||
            ($0.companyName ?? "").localizedCaseInsensitiveContains(searchText)
        }
    }

    // MARK: - Init
    init() {
        loadFollowUpsFromStorage()
    }

    // MARK: - Load Leads from API
    func loadLeads(status: String? = nil) async {
        isLoading = true
        error = nil

        print("DEBUG: ====== LOADING LEADS FROM API ======")

        do {
            let response = try await api.getLeads(status: status)
            print("DEBUG: Loaded \(response.leads.count) leads from API")
            for (index, lead) in response.leads.prefix(3).enumerated() {
                print("DEBUG: Lead \(index): firstName='\(lead.firstName ?? "nil")' lastName='\(lead.lastName ?? "nil")' displayName='\(lead.displayName)'")
            }
            leads = response.leads
        } catch {
            self.error = "Failed to load leads: \(error.localizedDescription)"
            print("DEBUG: ====== FAILED TO LOAD LEADS ======")
            print("DEBUG: Error: \(error)")
        }

        isLoading = false
    }

    // MARK: - Load Lead Activities from API
    func loadActivities(for leadId: String) async {
        do {
            let response = try await api.getLeadActivities(leadId: leadId)
            activities = response.activities
        } catch {
            print("DEBUG: Failed to load lead activities: \(error)")
        }
    }

    // MARK: - Lead CRUD via API
    func addLead(firstName: String?, lastName: String?, email: String?, phone: String?,
                 companyName: String?, source: LeadSource, caseType: String?,
                 notes: String?, estimatedValue: Double?, followUpDate: Date?) async -> Bool {
        isLoading = true
        error = nil

        do {
            let request = CreateLeadRequest(
                firstName: firstName,
                lastName: lastName,
                email: email,
                phone: phone,
                companyName: companyName,
                source: source.rawValue,
                caseType: caseType,
                notes: notes,
                estimatedValue: estimatedValue,
                followUpDate: followUpDate
            )
            let newLead = try await api.createLead(request: request)
            leads.insert(newLead, at: 0)
            isLoading = false
            return true
        } catch {
            self.error = "Failed to create lead: \(error.localizedDescription)"
            isLoading = false
            return false
        }
    }

    func updateLead(_ lead: Lead, firstName: String?, lastName: String?, email: String?,
                    phone: String?, companyName: String?, source: LeadSource?,
                    caseType: String?, notes: String?, estimatedValue: Double?,
                    followUpDate: Date?) async -> Bool {
        isLoading = true
        error = nil

        do {
            let request = CreateLeadRequest(
                firstName: firstName,
                lastName: lastName,
                email: email,
                phone: phone,
                companyName: companyName,
                source: source?.rawValue,
                caseType: caseType,
                notes: notes,
                estimatedValue: estimatedValue,
                followUpDate: followUpDate
            )
            let updated = try await api.updateLead(id: lead.id, request: request)
            if let index = leads.firstIndex(where: { $0.id == lead.id }) {
                leads[index] = updated
            }
            isLoading = false
            return true
        } catch {
            self.error = "Failed to update lead: \(error.localizedDescription)"
            isLoading = false
            return false
        }
    }

    func deleteLead(_ lead: Lead) async -> Bool {
        isLoading = true
        error = nil

        do {
            try await api.deleteLead(id: lead.id)
            leads.removeAll { $0.id == lead.id }
            followUps.removeAll { $0.leadId == lead.id }
            saveFollowUpsToStorage()
            isLoading = false
            return true
        } catch {
            self.error = "Failed to delete lead: \(error.localizedDescription)"
            isLoading = false
            return false
        }
    }

    func updateLeadStatus(_ lead: Lead, status: LeadStatus) async -> Bool {
        isLoading = true
        error = nil

        do {
            let updated = try await api.updateLeadStatus(id: lead.id, status: status.rawValue)
            if let index = leads.firstIndex(where: { $0.id == lead.id }) {
                leads[index] = updated
            }
            isLoading = false
            return true
        } catch {
            self.error = "Failed to update lead status: \(error.localizedDescription)"
            isLoading = false
            return false
        }
    }

    // MARK: - Add Activity via API
    func addActivity(leadId: String, type: String, description: String, notes: String?) async -> Bool {
        do {
            let activity = try await api.addLeadActivity(leadId: leadId, type: type, description: description, notes: notes)
            activities.insert(activity, at: 0)
            return true
        } catch {
            self.error = "Failed to add activity: \(error.localizedDescription)"
            return false
        }
    }

    // MARK: - Convert Lead to Client via API
    func convertToClient(_ lead: Lead) async -> Bool {
        isLoading = true
        error = nil

        do {
            let client = try await api.convertLeadToClient(leadId: lead.id)
            // Update local lead status
            if let index = leads.firstIndex(where: { $0.id == lead.id }) {
                var updated = leads[index]
                updated.status = .converted
                updated.convertedClientId = client.id
                leads[index] = updated
            }
            isLoading = false
            return true
        } catch {
            self.error = "Failed to convert lead: \(error.localizedDescription)"
            isLoading = false
            return false
        }
    }

    // MARK: - Local Add Lead (for backwards compatibility)
    func addLead(_ lead: Lead) {
        leads.insert(lead, at: 0)
        // Also try to sync with API in background
        Task {
            await addLead(
                firstName: lead.firstName,
                lastName: lead.lastName,
                email: lead.email,
                phone: lead.phone,
                companyName: lead.companyName,
                source: lead.source,
                caseType: lead.caseType,
                notes: lead.notes,
                estimatedValue: lead.estimatedValue,
                followUpDate: lead.followUpDate
            )
        }
    }

    // MARK: - Local Update Lead (for backwards compatibility)
    func updateLead(_ lead: Lead) {
        if let index = leads.firstIndex(where: { $0.id == lead.id }) {
            leads[index] = lead
        }
    }

    // MARK: - Follow-up Local Storage (may not have backend API)
    private func loadFollowUpsFromStorage() {
        if let data = UserDefaults.standard.data(forKey: followUpsKey),
           let decoded = try? JSONDecoder().decode([FollowUp].self, from: data) {
            followUps = decoded
        }
    }

    private func saveFollowUpsToStorage() {
        if let encoded = try? JSONEncoder().encode(followUps) {
            UserDefaults.standard.set(encoded, forKey: followUpsKey)
        }
    }

    // MARK: - Follow-up CRUD (Local)
    func addFollowUp(_ followUp: FollowUp) {
        followUps.insert(followUp, at: 0)
        saveFollowUpsToStorage()
    }

    func completeFollowUp(_ followUp: FollowUp) {
        if let index = followUps.firstIndex(where: { $0.id == followUp.id }) {
            followUps[index].isCompleted = true
            followUps[index].completedAt = Date()
            saveFollowUpsToStorage()
        }
    }

    func deleteFollowUp(_ followUp: FollowUp) {
        followUps.removeAll { $0.id == followUp.id }
        saveFollowUpsToStorage()
    }
}
