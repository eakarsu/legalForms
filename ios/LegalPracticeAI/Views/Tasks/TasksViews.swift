//
//  TasksViews.swift
//  LegalPracticeAI
//
//  Task management views
//

import SwiftUI

// MARK: - Task Model
struct LegalTask: Identifiable, Codable {
    let id: String
    var title: String
    var description: String?
    var dueDate: Date?
    var priority: Priority
    var status: Status
    var assignedTo: String?
    var caseId: String?
    var caseName: String?
    var clientName: String?
    var createdAt: Date?
    var completedAt: Date?

    enum Priority: String, CaseIterable, Codable {
        case low = "low"
        case medium = "medium"
        case high = "high"
        case urgent = "urgent"

        var displayName: String { rawValue.capitalized }

        var color: Color {
            switch self {
            case .low: return .green
            case .medium: return .blue
            case .high: return .orange
            case .urgent: return .red
            }
        }

        var icon: String {
            switch self {
            case .low: return "arrow.down.circle"
            case .medium: return "minus.circle"
            case .high: return "arrow.up.circle"
            case .urgent: return "exclamationmark.circle.fill"
            }
        }
    }

    enum Status: String, CaseIterable, Codable {
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
    }

    init(id: String = UUID().uuidString,
         title: String,
         description: String? = nil,
         dueDate: Date? = nil,
         priority: Priority = .medium,
         status: Status = .pending,
         assignedTo: String? = nil,
         caseId: String? = nil,
         caseName: String? = nil,
         clientName: String? = nil,
         createdAt: Date? = Date(),
         completedAt: Date? = nil) {
        self.id = id
        self.title = title
        self.description = description
        self.dueDate = dueDate
        self.priority = priority
        self.status = status
        self.assignedTo = assignedTo
        self.caseId = caseId
        self.caseName = caseName
        self.clientName = clientName
        self.createdAt = createdAt
        self.completedAt = completedAt
    }

    var isOverdue: Bool {
        guard let dueDate = dueDate else { return false }
        return dueDate < Date() && status != .completed
    }
}

// MARK: - Workflow Model
struct Workflow: Identifiable, Codable {
    let id: String
    var name: String
    var description: String?
    var steps: [WorkflowStep]
    var triggerType: String // "case_opened", "deadline", "manual"
    var isActive: Bool
    var createdAt: Date?

    init(id: String = UUID().uuidString,
         name: String,
         description: String? = nil,
         steps: [WorkflowStep] = [],
         triggerType: String = "manual",
         isActive: Bool = true,
         createdAt: Date? = Date()) {
        self.id = id
        self.name = name
        self.description = description
        self.steps = steps
        self.triggerType = triggerType
        self.isActive = isActive
        self.createdAt = createdAt
    }
}

struct WorkflowStep: Identifiable, Codable {
    let id: String
    var order: Int
    var title: String
    var description: String?
    var daysOffset: Int // Days from trigger
    var assignTo: String?

    init(id: String = UUID().uuidString,
         order: Int,
         title: String,
         description: String? = nil,
         daysOffset: Int = 0,
         assignTo: String? = nil) {
        self.id = id
        self.order = order
        self.title = title
        self.description = description
        self.daysOffset = daysOffset
        self.assignTo = assignTo
    }
}

// MARK: - Tasks ViewModel
@MainActor
final class TasksViewModel: ObservableObject {
    @Published var tasks: [LegalTask] = []
    @Published var apiTasks: [TaskItem] = []
    @Published var workflows: [Workflow] = []
    @Published var isLoading = false
    @Published var error: String?
    @Published var searchText = ""

    private let api = APIService.shared

    // Local storage for tasks and workflows (fallback)
    private let tasksKey = "stored_legal_tasks"
    private let workflowsKey = "stored_workflows"

    init() {
        loadFromStorage()
    }

    // MARK: - Load Tasks from API
    func loadTasks(status: String? = nil, caseId: String? = nil, assignedTo: String? = nil) async {
        isLoading = true
        error = nil

        do {
            let response = try await api.getTasks(status: status, caseId: caseId, assignedTo: assignedTo)
            apiTasks = response.tasks
            // Convert API tasks to LegalTask for display
            tasks = response.tasks.map { apiTask in
                LegalTask(
                    id: apiTask.id,
                    title: apiTask.title,
                    description: apiTask.description,
                    dueDate: apiTask.dueDate,
                    priority: LegalTask.Priority(rawValue: apiTask.priority.rawValue) ?? .medium,
                    status: LegalTask.Status(rawValue: apiTask.status.rawValue) ?? .pending,
                    assignedTo: apiTask.assignedTo,
                    caseId: apiTask.caseId,
                    caseName: apiTask.caseName,
                    clientName: apiTask.clientName,
                    createdAt: apiTask.createdAt,
                    completedAt: apiTask.completedAt
                )
            }
            print("DEBUG: Loaded \(tasks.count) tasks from API")
        } catch {
            self.error = "Failed to load tasks: \(error.localizedDescription)"
            print("DEBUG: Failed to load tasks: \(error)")
        }

        isLoading = false
    }

    // MARK: - Create Task via API
    func createTask(title: String, description: String?, priority: String?, dueDate: Date?, caseId: String?, clientId: String?, assignedTo: String?, category: String?) async -> Bool {
        isLoading = true
        error = nil

        do {
            let request = CreateTaskRequest(
                title: title,
                description: description,
                priority: priority,
                dueDate: dueDate,
                caseId: caseId,
                clientId: clientId,
                assignedTo: assignedTo,
                category: category
            )
            let task = try await api.createTask(request: request)
            apiTasks.insert(task, at: 0)
            isLoading = false
            return true
        } catch {
            self.error = "Failed to create task: \(error.localizedDescription)"
            isLoading = false
            return false
        }
    }

    // MARK: - Update Task via API
    func updateApiTask(id: String, title: String?, description: String?, status: String?, priority: String?, dueDate: Date?, caseId: String?, clientId: String?, assignedTo: String?, category: String?) async -> Bool {
        isLoading = true
        error = nil

        do {
            let request = UpdateTaskRequest(
                title: title,
                description: description,
                status: status,
                priority: priority,
                dueDate: dueDate,
                caseId: caseId,
                clientId: clientId,
                assignedTo: assignedTo,
                category: category
            )
            let updated = try await api.updateTask(id: id, request: request)
            if let index = apiTasks.firstIndex(where: { $0.id == id }) {
                apiTasks[index] = updated
            }
            isLoading = false
            return true
        } catch {
            self.error = "Failed to update task: \(error.localizedDescription)"
            isLoading = false
            return false
        }
    }

    // MARK: - Delete Task via API
    func deleteApiTask(id: String) async -> Bool {
        isLoading = true
        error = nil

        do {
            try await api.deleteTask(id: id)
            apiTasks.removeAll { $0.id == id }
            isLoading = false
            return true
        } catch {
            self.error = "Failed to delete task: \(error.localizedDescription)"
            isLoading = false
            return false
        }
    }

    // MARK: - Complete Task via API
    func completeApiTask(id: String) async -> Bool {
        isLoading = true
        error = nil

        do {
            let updated = try await api.completeTask(id: id)
            if let index = apiTasks.firstIndex(where: { $0.id == id }) {
                apiTasks[index] = updated
            }
            isLoading = false
            return true
        } catch {
            self.error = "Failed to complete task: \(error.localizedDescription)"
            isLoading = false
            return false
        }
    }

    // MARK: - Local Storage
    private func loadFromStorage() {
        if let data = UserDefaults.standard.data(forKey: tasksKey),
           let decoded = try? JSONDecoder().decode([LegalTask].self, from: data) {
            tasks = decoded
        }
        if let data = UserDefaults.standard.data(forKey: workflowsKey),
           let decoded = try? JSONDecoder().decode([Workflow].self, from: data) {
            workflows = decoded
        }
    }

    private func saveToStorage() {
        if let encoded = try? JSONEncoder().encode(tasks) {
            UserDefaults.standard.set(encoded, forKey: tasksKey)
        }
        if let encoded = try? JSONEncoder().encode(workflows) {
            UserDefaults.standard.set(encoded, forKey: workflowsKey)
        }
    }

    var pendingTasks: [LegalTask] {
        tasks.filter { $0.status == .pending || $0.status == .inProgress }
            .sorted { ($0.dueDate ?? .distantFuture) < ($1.dueDate ?? .distantFuture) }
    }

    var completedTasks: [LegalTask] {
        tasks.filter { $0.status == .completed }
            .sorted { ($0.completedAt ?? Date()) > ($1.completedAt ?? Date()) }
    }

    var overdueTasks: [LegalTask] {
        pendingTasks.filter { $0.isOverdue }
    }

    var myTasks: [LegalTask] {
        pendingTasks // In a real app, filter by current user
    }

    var teamTasks: [LegalTask] {
        tasks.filter { $0.assignedTo != nil && $0.status != .completed }
    }

    func addTask(_ task: LegalTask) {
        tasks.insert(task, at: 0)
        saveToStorage()
    }

    func updateTask(_ task: LegalTask) {
        if let index = tasks.firstIndex(where: { $0.id == task.id }) {
            tasks[index] = task
            saveToStorage()
        }
    }

    func deleteTask(_ task: LegalTask) {
        tasks.removeAll { $0.id == task.id }
        saveToStorage()
    }

    func completeTask(_ task: LegalTask) {
        if let index = tasks.firstIndex(where: { $0.id == task.id }) {
            tasks[index].status = .completed
            tasks[index].completedAt = Date()
            saveToStorage()
        }
    }

    func addWorkflow(_ workflow: Workflow) {
        workflows.insert(workflow, at: 0)
        saveToStorage()
    }

    func deleteWorkflow(_ workflow: Workflow) {
        workflows.removeAll { $0.id == workflow.id }
        saveToStorage()
    }
}

// MARK: - My Tasks View
struct TasksView: View {
    @StateObject private var viewModel = TasksViewModel()
    @State private var showAddTask = false

    var body: some View {
        VStack(spacing: 0) {
            // Stats Header
            HStack(spacing: AppSpacing.xl) {
                VStack {
                    Text("\(viewModel.pendingTasks.count)")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.blue)
                    Text("Pending")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                VStack {
                    Text("\(viewModel.overdueTasks.count)")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.red)
                    Text("Overdue")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                VStack {
                    Text("\(viewModel.completedTasks.count)")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.green)
                    Text("Done")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding()
            .frame(maxWidth: .infinity)
            .background(Color.cardBackground)

            if viewModel.myTasks.isEmpty {
                EmptyStateView(
                    icon: "checklist",
                    title: "No Tasks",
                    message: "Create tasks to track your work",
                    actionTitle: "Add Task",
                    action: { showAddTask = true }
                )
            } else {
                List {
                    // Overdue Section
                    if !viewModel.overdueTasks.isEmpty {
                        Section {
                            ForEach(viewModel.overdueTasks) { task in
                                TaskRow(task: task, viewModel: viewModel)
                            }
                        } header: {
                            HStack {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(.red)
                                Text("OVERDUE")
                            }
                        }
                    }

                    // Today/Upcoming
                    Section("Upcoming") {
                        ForEach(viewModel.pendingTasks.filter { !$0.isOverdue }) { task in
                            TaskRow(task: task, viewModel: viewModel)
                        }
                        .onDelete { indexSet in
                            let filtered = viewModel.pendingTasks.filter { !$0.isOverdue }
                            for index in indexSet {
                                viewModel.deleteTask(filtered[index])
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("My Tasks")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAddTask = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddTask) {
            AddTaskView(viewModel: viewModel)
        }
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadTasks()
        }
        .refreshable {
            await viewModel.loadTasks()
        }
    }
}

struct TaskRow: View {
    let task: LegalTask
    @ObservedObject var viewModel: TasksViewModel

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Button {
                viewModel.completeTask(task)
            } label: {
                Image(systemName: task.status == .completed ? "checkmark.circle.fill" : "circle")
                    .font(.title2)
                    .foregroundColor(task.status == .completed ? .green : .secondary)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(task.title)
                    .font(.body)
                    .fontWeight(.medium)
                    .strikethrough(task.status == .completed)

                if let description = task.description, !description.isEmpty {
                    Text(description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }

                HStack(spacing: AppSpacing.sm) {
                    Image(systemName: task.priority.icon)
                        .font(.caption)
                        .foregroundColor(task.priority.color)

                    if let dueDate = task.dueDate {
                        Text(dueDate.formatted(date: .abbreviated, time: .omitted))
                            .font(.caption)
                            .foregroundColor(task.isOverdue ? .red : .secondary)
                    }

                    if let caseName = task.caseName {
                        Text(caseName)
                            .font(.caption)
                            .foregroundColor(.accentColor)
                    }
                }
            }

            Spacer()
        }
        .padding(.vertical, AppSpacing.xs)
        .opacity(task.status == .completed ? 0.6 : 1)
    }
}

struct AddTaskView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: TasksViewModel

    @State private var title = ""
    @State private var description = ""
    @State private var priority: LegalTask.Priority = .medium
    @State private var hasDueDate = false
    @State private var dueDate = Date()
    @State private var assignedTo = ""
    @State private var caseName = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Task") {
                    TextField("Title", text: $title)
                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                }

                Section("Priority") {
                    Picker("Priority", selection: $priority) {
                        ForEach(LegalTask.Priority.allCases, id: \.self) { p in
                            Label(p.displayName, systemImage: p.icon)
                                .foregroundColor(p.color)
                                .tag(p)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section("Due Date") {
                    Toggle("Set Due Date", isOn: $hasDueDate)
                    if hasDueDate {
                        DatePicker("Due", selection: $dueDate, displayedComponents: [.date, .hourAndMinute])
                    }
                }

                Section("Assignment") {
                    TextField("Assign To", text: $assignedTo)
                    TextField("Related Case", text: $caseName)
                }
            }
            .navigationTitle("Add Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let task = LegalTask(
                            title: title,
                            description: description.isEmpty ? nil : description,
                            dueDate: hasDueDate ? dueDate : nil,
                            priority: priority,
                            assignedTo: assignedTo.isEmpty ? nil : assignedTo,
                            caseName: caseName.isEmpty ? nil : caseName
                        )
                        viewModel.addTask(task)
                        dismiss()
                    }
                    .disabled(title.isEmpty)
                }
            }
        }
    }
}

// MARK: - Team Tasks View
struct TeamTasksView: View {
    @StateObject private var viewModel = TasksViewModel()
    @State private var showAddTask = false

    // Group tasks by assignee
    var tasksByAssignee: [(assignee: String, tasks: [LegalTask])] {
        let grouped = Dictionary(grouping: viewModel.teamTasks) { $0.assignedTo ?? "Unassigned" }
        return grouped.map { ($0.key, $0.value) }.sorted { $0.assignee < $1.assignee }
    }

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.teamTasks.isEmpty {
                EmptyStateView(
                    icon: "person.2.badge.gearshape.fill",
                    title: "No Team Tasks",
                    message: "Assign tasks to team members",
                    actionTitle: "Add Task",
                    action: { showAddTask = true }
                )
            } else {
                List {
                    ForEach(tasksByAssignee, id: \.assignee) { group in
                        Section(group.assignee) {
                            ForEach(group.tasks) { task in
                                TaskRow(task: task, viewModel: viewModel)
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Team Tasks")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAddTask = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddTask) {
            AddTaskView(viewModel: viewModel)
        }
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadTasks()
        }
        .refreshable {
            await viewModel.loadTasks()
        }
    }
}

// MARK: - Completed Tasks View
struct CompletedTasksView: View {
    @StateObject private var viewModel = TasksViewModel()

    var body: some View {
        VStack(spacing: 0) {
            // Stats
            HStack {
                Text("\(viewModel.completedTasks.count) tasks completed")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                Spacer()
            }
            .padding()
            .background(Color.cardBackground)

            if viewModel.completedTasks.isEmpty {
                EmptyStateView(
                    icon: "checkmark.circle.fill",
                    title: "No Completed Tasks",
                    message: "Completed tasks will appear here"
                )
            } else {
                List {
                    ForEach(viewModel.completedTasks) { task in
                        CompletedTaskRow(task: task)
                            .listRowBackground(Color.cardBackground)
                    }
                    .onDelete { indexSet in
                        for index in indexSet {
                            viewModel.deleteTask(viewModel.completedTasks[index])
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Completed Tasks")
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadTasks()
        }
        .refreshable {
            await viewModel.loadTasks()
        }
    }
}

struct CompletedTaskRow: View {
    let task: LegalTask

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: "checkmark.circle.fill")
                .font(.title2)
                .foregroundColor(.green)

            VStack(alignment: .leading, spacing: 2) {
                Text(task.title)
                    .font(.body)
                    .strikethrough()
                    .foregroundColor(.secondary)

                if let completedAt = task.completedAt {
                    Text("Completed \(completedAt.formatted(date: .abbreviated, time: .shortened))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

// MARK: - Workflows View
struct WorkflowsView: View {
    @StateObject private var viewModel = TasksViewModel()
    @State private var showAddWorkflow = false

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.workflows.isEmpty {
                EmptyStateView(
                    icon: "arrow.triangle.branch",
                    title: "No Workflows",
                    message: "Create workflows to automate task creation",
                    actionTitle: "Create Workflow",
                    action: { showAddWorkflow = true }
                )
            } else {
                List {
                    ForEach(viewModel.workflows) { workflow in
                        NavigationLink(destination: WorkflowDetailView(workflow: workflow, viewModel: viewModel)) {
                            WorkflowRow(workflow: workflow)
                        }
                        .listRowBackground(Color.cardBackground)
                    }
                    .onDelete { indexSet in
                        for index in indexSet {
                            viewModel.deleteWorkflow(viewModel.workflows[index])
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Workflows")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAddWorkflow = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddWorkflow) {
            AddWorkflowView(viewModel: viewModel)
        }
        .background(Color(UIColor.systemGroupedBackground))
        .task {
            await viewModel.loadTasks()
        }
        .refreshable {
            await viewModel.loadTasks()
        }
    }
}

struct WorkflowRow: View {
    let workflow: Workflow

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: workflow.isActive ? "bolt.circle.fill" : "bolt.slash.circle")
                .foregroundColor(workflow.isActive ? .green : .secondary)
                .font(.title2)

            VStack(alignment: .leading, spacing: 2) {
                Text(workflow.name)
                    .font(.body)
                    .fontWeight(.medium)

                if let description = workflow.description {
                    Text(description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }

                Text("\(workflow.steps.count) steps")
                    .font(.caption)
                    .foregroundColor(.accentColor)
            }

            Spacer()

            Text(workflow.isActive ? "Active" : "Inactive")
                .font(.caption)
                .foregroundColor(workflow.isActive ? .green : .secondary)
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

struct WorkflowDetailView: View {
    let workflow: Workflow
    @ObservedObject var viewModel: TasksViewModel

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Header
                VStack(spacing: AppSpacing.md) {
                    Text(workflow.name)
                        .font(.title2)
                        .fontWeight(.bold)

                    if let description = workflow.description {
                        Text(description)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }

                    HStack(spacing: AppSpacing.lg) {
                        Label(workflow.isActive ? "Active" : "Inactive", systemImage: "bolt.circle")
                            .foregroundColor(workflow.isActive ? .green : .secondary)

                        Label("Trigger: \(workflow.triggerType.replacingOccurrences(of: "_", with: " ").capitalized)", systemImage: "play.circle")
                            .foregroundColor(.accentColor)
                    }
                    .font(.caption)
                }
                .padding()
                .frame(maxWidth: .infinity)
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Steps
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Workflow Steps")
                        .font(.headline)
                        .padding(.horizontal)

                    ForEach(workflow.steps.sorted { $0.order < $1.order }) { step in
                        HStack(alignment: .top, spacing: AppSpacing.md) {
                            VStack {
                                Circle()
                                    .fill(Color.accentColor)
                                    .frame(width: 30, height: 30)
                                    .overlay(
                                        Text("\(step.order)")
                                            .font(.caption)
                                            .fontWeight(.bold)
                                            .foregroundColor(.white)
                                    )

                                if step.order < workflow.steps.count {
                                    Rectangle()
                                        .fill(Color.accentColor.opacity(0.3))
                                        .frame(width: 2, height: 40)
                                }
                            }

                            VStack(alignment: .leading, spacing: 4) {
                                Text(step.title)
                                    .font(.subheadline)
                                    .fontWeight(.medium)

                                if let description = step.description {
                                    Text(description)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }

                                if step.daysOffset > 0 {
                                    Text("Due: +\(step.daysOffset) days")
                                        .font(.caption)
                                        .foregroundColor(.accentColor)
                                }
                            }
                            .padding(.bottom, 20)

                            Spacer()
                        }
                        .padding(.horizontal)
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Workflow Details")
        .navigationBarTitleDisplayMode(.inline)
        .background(Color(UIColor.systemGroupedBackground))
    }
}

struct AddWorkflowView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: TasksViewModel

    @State private var name = ""
    @State private var description = ""
    @State private var triggerType = "manual"
    @State private var steps: [WorkflowStep] = []
    @State private var newStepTitle = ""

    let triggers = ["manual", "case_opened", "deadline"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Workflow Info") {
                    TextField("Name", text: $name)
                    TextField("Description", text: $description)

                    Picker("Trigger", selection: $triggerType) {
                        Text("Manual").tag("manual")
                        Text("Case Opened").tag("case_opened")
                        Text("Deadline").tag("deadline")
                    }
                }

                Section("Steps") {
                    ForEach(steps) { step in
                        HStack {
                            Text("\(step.order). \(step.title)")
                            Spacer()
                        }
                    }
                    .onDelete { indexSet in
                        steps.remove(atOffsets: indexSet)
                        // Reorder
                        for i in 0..<steps.count {
                            steps[i] = WorkflowStep(
                                id: steps[i].id,
                                order: i + 1,
                                title: steps[i].title,
                                description: steps[i].description,
                                daysOffset: steps[i].daysOffset
                            )
                        }
                    }

                    HStack {
                        TextField("New step", text: $newStepTitle)
                        Button {
                            let step = WorkflowStep(
                                order: steps.count + 1,
                                title: newStepTitle
                            )
                            steps.append(step)
                            newStepTitle = ""
                        } label: {
                            Image(systemName: "plus.circle.fill")
                        }
                        .disabled(newStepTitle.isEmpty)
                    }
                }
            }
            .navigationTitle("Create Workflow")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let workflow = Workflow(
                            name: name,
                            description: description.isEmpty ? nil : description,
                            steps: steps,
                            triggerType: triggerType
                        )
                        viewModel.addWorkflow(workflow)
                        dismiss()
                    }
                    .disabled(name.isEmpty || steps.isEmpty)
                }
            }
        }
    }
}
