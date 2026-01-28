//
//  APIServiceTests.swift
//  LegalPracticeAITests
//
//  Unit tests for API Service
//

import XCTest
@testable import LegalPracticeAI

final class APIServiceTests: XCTestCase {

    var apiService: APIService!

    override func setUpWithError() throws {
        apiService = APIService.shared
    }

    override func tearDownWithError() throws {
        apiService = nil
    }

    // MARK: - Conflict Parties Tests

    func testGetConflictParties() async throws {
        do {
            let response = try await apiService.getConflictParties()
            XCTAssertTrue(response.success, "API should return success")
            XCTAssertGreaterThan(response.parties.count, 0, "Should have conflict parties")

            // Verify party structure
            if let party = response.parties.first {
                XCTAssertFalse(party.id.isEmpty, "Party should have an ID")
                XCTAssertFalse(party.name.isEmpty, "Party should have a name")
                XCTAssertFalse(party.partyType.isEmpty, "Party should have a type")
            }

            print("TEST PASSED: getConflictParties - Found \(response.parties.count) parties")
        } catch {
            XCTFail("getConflictParties failed: \(error)")
        }
    }

    // MARK: - Conflict History Tests

    func testGetConflictHistory() async throws {
        do {
            let response = try await apiService.getConflictHistory()
            XCTAssertTrue(response.success, "API should return success")

            // Verify check structure
            if let check = response.checks.first {
                XCTAssertFalse(check.id.isEmpty, "Check should have an ID")
                XCTAssertFalse(check.searchName.isEmpty, "Check should have a search name")
            }

            print("TEST PASSED: getConflictHistory - Found \(response.checks.count) checks")
        } catch {
            XCTFail("getConflictHistory failed: \(error)")
        }
    }

    // MARK: - Conflict Waivers Tests

    func testGetAllConflictWaivers() async throws {
        do {
            let response = try await apiService.getAllConflictWaivers()
            XCTAssertTrue(response.success, "API should return success")

            // Verify waiver structure
            if let waiver = response.waivers.first {
                XCTAssertFalse(waiver.id.isEmpty, "Waiver should have an ID")
                XCTAssertFalse(waiver.clientName.isEmpty, "Waiver should have a client name")
            }

            print("TEST PASSED: getAllConflictWaivers - Found \(response.waivers.count) waivers")
        } catch {
            XCTFail("getAllConflictWaivers failed: \(error)")
        }
    }

    // MARK: - Trust Accounts Tests

    func testGetTrustAccounts() async throws {
        do {
            let response = try await apiService.getTrustAccounts()
            XCTAssertTrue(response.success, "API should return success")

            // Verify account structure
            if let account = response.accounts.first {
                XCTAssertFalse(account.id.isEmpty, "Account should have an ID")
                XCTAssertFalse(account.accountName.isEmpty, "Account should have a name")
                XCTAssertFalse(account.bankName.isEmpty, "Account should have a bank name")
            }

            print("TEST PASSED: getTrustAccounts - Found \(response.accounts.count) accounts")
        } catch {
            XCTFail("getTrustAccounts failed: \(error)")
        }
    }

    // MARK: - Cases Tests

    func testGetCases() async throws {
        do {
            let response = try await apiService.getCases()
            XCTAssertTrue(response.success, "API should return success")
            XCTAssertGreaterThan(response.cases.count, 0, "Should have cases")

            print("TEST PASSED: getCases - Found \(response.cases.count) cases")
        } catch {
            XCTFail("getCases failed: \(error)")
        }
    }

    // MARK: - Clients Tests

    func testGetClients() async throws {
        do {
            let response = try await apiService.getClients()
            XCTAssertTrue(response.success, "API should return success")
            XCTAssertGreaterThan(response.clients.count, 0, "Should have clients")

            print("TEST PASSED: getClients - Found \(response.clients.count) clients")
        } catch {
            XCTFail("getClients failed: \(error)")
        }
    }

    // MARK: - Invoices Tests

    func testGetInvoices() async throws {
        do {
            let response = try await apiService.getInvoices()
            XCTAssertTrue(response.success, "API should return success")

            print("TEST PASSED: getInvoices - Found \(response.invoices.count) invoices")
        } catch {
            XCTFail("getInvoices failed: \(error)")
        }
    }

    // MARK: - Calendar Events Tests

    func testGetCalendarEvents() async throws {
        do {
            let response = try await apiService.getCalendarEvents()
            XCTAssertTrue(response.success, "API should return success")

            print("TEST PASSED: getCalendarEvents - Found \(response.events.count) events")
        } catch {
            XCTFail("getCalendarEvents failed: \(error)")
        }
    }

    // MARK: - Deadlines Tests

    func testGetDeadlines() async throws {
        do {
            let response = try await apiService.getDeadlines()
            XCTAssertTrue(response.success, "API should return success")

            print("TEST PASSED: getDeadlines - Found \(response.deadlines.count) deadlines")
        } catch {
            XCTFail("getDeadlines failed: \(error)")
        }
    }

    // MARK: - Leads Tests

    func testGetLeads() async throws {
        do {
            let response = try await apiService.getLeads()
            XCTAssertTrue(response.success, "API should return success")

            print("TEST PASSED: getLeads - Found \(response.leads.count) leads")
        } catch {
            XCTFail("getLeads failed: \(error)")
        }
    }
}
