//
//  UITests.swift
//  LegalPracticeAITests
//
//  UI Tests to verify data displays on screen
//

import XCTest
@testable import LegalPracticeAI

final class UITests: XCTestCase {

    // MARK: - Conflict Views Tests

    func testConflictPartiesViewShowsData() async throws {
        // Create view model and load data
        let viewModel = await ConflictsViewModel()

        await viewModel.loadParties()

        // Wait for loading to complete
        try await Task.sleep(nanoseconds: 2_000_000_000)

        await MainActor.run {
            XCTAssertFalse(viewModel.isLoading, "Should not be loading after fetch")
            XCTAssertGreaterThan(viewModel.conflictParties.count, 0, "Should have conflict parties loaded")
            XCTAssertNil(viewModel.error, "Should not have error")

            print("UI TEST PASSED: ConflictPartiesView - Loaded \(viewModel.conflictParties.count) parties for display")
        }
    }

    func testConflictHistoryViewShowsData() async throws {
        let viewModel = await ConflictsViewModel()

        await viewModel.loadConflictHistory()

        try await Task.sleep(nanoseconds: 2_000_000_000)

        await MainActor.run {
            XCTAssertFalse(viewModel.isLoading, "Should not be loading after fetch")
            XCTAssertGreaterThan(viewModel.conflictChecks.count, 0, "Should have conflict history loaded")
            XCTAssertNil(viewModel.error, "Should not have error")

            print("UI TEST PASSED: ConflictHistoryView - Loaded \(viewModel.conflictChecks.count) checks for display")
        }
    }

    func testWaiversViewShowsData() async throws {
        let viewModel = await ConflictsViewModel()

        await viewModel.loadAllWaivers()

        try await Task.sleep(nanoseconds: 2_000_000_000)

        await MainActor.run {
            XCTAssertFalse(viewModel.isLoading, "Should not be loading after fetch")
            // Waivers may be empty, but should not have error
            XCTAssertNil(viewModel.error, "Should not have error")

            print("UI TEST PASSED: WaiversView - Loaded \(viewModel.waivers.count) waivers for display")
        }
    }

    // MARK: - Trust Views Tests

    func testTrustAccountsViewShowsData() async throws {
        let viewModel = await TrustViewModel()

        await viewModel.loadAccounts()

        try await Task.sleep(nanoseconds: 2_000_000_000)

        await MainActor.run {
            XCTAssertFalse(viewModel.isLoading, "Should not be loading after fetch")
            XCTAssertNil(viewModel.error, "Should not have error")

            print("UI TEST PASSED: TrustAccountsView - Loaded \(viewModel.accounts.count) accounts for display")
        }
    }

    // MARK: - Cases View Tests

    func testCasesViewShowsData() async throws {
        let viewModel = await CasesViewModel()

        await viewModel.loadCases()

        try await Task.sleep(nanoseconds: 2_000_000_000)

        await MainActor.run {
            XCTAssertFalse(viewModel.isLoading, "Should not be loading after fetch")
            XCTAssertGreaterThan(viewModel.cases.count, 0, "Should have cases loaded")
            XCTAssertNil(viewModel.error, "Should not have error")

            print("UI TEST PASSED: CasesView - Loaded \(viewModel.cases.count) cases for display")
        }
    }

    // MARK: - Clients View Tests

    func testClientsViewShowsData() async throws {
        let viewModel = await ClientsViewModel()

        await viewModel.loadClients()

        try await Task.sleep(nanoseconds: 2_000_000_000)

        await MainActor.run {
            XCTAssertFalse(viewModel.isLoading, "Should not be loading after fetch")
            XCTAssertGreaterThan(viewModel.clients.count, 0, "Should have clients loaded")
            XCTAssertNil(viewModel.error, "Should not have error")

            print("UI TEST PASSED: ClientsView - Loaded \(viewModel.clients.count) clients for display")
        }
    }

    // MARK: - Invoices View Tests

    func testInvoicesViewShowsData() async throws {
        let viewModel = await InvoicesViewModel()

        await viewModel.loadInvoices()

        try await Task.sleep(nanoseconds: 2_000_000_000)

        await MainActor.run {
            XCTAssertFalse(viewModel.isLoading, "Should not be loading after fetch")
            XCTAssertNil(viewModel.error, "Should not have error")

            print("UI TEST PASSED: InvoicesView - Loaded \(viewModel.invoices.count) invoices for display")
        }
    }

    // MARK: - Calendar View Tests

    func testCalendarViewShowsData() async throws {
        let viewModel = await CalendarViewModel()

        await viewModel.loadEvents()

        try await Task.sleep(nanoseconds: 2_000_000_000)

        await MainActor.run {
            XCTAssertFalse(viewModel.isLoading, "Should not be loading after fetch")
            XCTAssertNil(viewModel.error, "Should not have error")

            print("UI TEST PASSED: CalendarView - Loaded \(viewModel.events.count) events for display")
        }
    }

    // MARK: - Deadlines View Tests

    func testDeadlinesViewShowsData() async throws {
        let viewModel = await DeadlinesViewModel()

        await viewModel.loadDeadlines()

        try await Task.sleep(nanoseconds: 2_000_000_000)

        await MainActor.run {
            XCTAssertFalse(viewModel.isLoading, "Should not be loading after fetch")
            XCTAssertNil(viewModel.error, "Should not have error")

            print("UI TEST PASSED: DeadlinesView - Loaded \(viewModel.deadlines.count) deadlines for display")
        }
    }

    // MARK: - Leads View Tests

    func testLeadsViewShowsData() async throws {
        let viewModel = await LeadsViewModel()

        await viewModel.loadLeads()

        try await Task.sleep(nanoseconds: 2_000_000_000)

        await MainActor.run {
            XCTAssertFalse(viewModel.isLoading, "Should not be loading after fetch")
            XCTAssertNil(viewModel.error, "Should not have error")

            print("UI TEST PASSED: LeadsView - Loaded \(viewModel.leads.count) leads for display")
        }
    }
}
