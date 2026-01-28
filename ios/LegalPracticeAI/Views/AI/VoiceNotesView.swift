//
//  VoiceNotesView.swift
//  LegalPracticeAI
//
//  Voice transcription and note-taking screen
//

import SwiftUI
import AVFoundation

struct VoiceNotesView: View {
    @State private var transcriptions: [VoiceTranscription] = []
    @State private var isLoading = false
    @State private var showRecording = false
    @State private var searchText = ""

    var filteredTranscriptions: [VoiceTranscription] {
        if searchText.isEmpty {
            return transcriptions
        }
        return transcriptions.filter {
            ($0.title?.localizedCaseInsensitiveContains(searchText) ?? false) ||
            ($0.originalText?.localizedCaseInsensitiveContains(searchText) ?? false) ||
            ($0.summary?.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Quick Record Button
                Button {
                    showRecording = true
                } label: {
                    HStack {
                        Image(systemName: "mic.fill")
                            .font(.title2)
                        Text("Start Recording")
                            .font(.headline)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 60)
                    .background(Color.red)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                }
                .padding()

                // Transcriptions List
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if filteredTranscriptions.isEmpty {
                    VStack(spacing: AppSpacing.lg) {
                        Image(systemName: "waveform")
                            .font(.system(size: 60))
                            .foregroundColor(.secondary)

                        Text("No Voice Notes")
                            .font(.title3)
                            .fontWeight(.semibold)

                        Text("Record voice memos and have them\nautomatically transcribed")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(filteredTranscriptions) { transcription in
                            NavigationLink(destination: TranscriptionDetailView(transcription: transcription)) {
                                TranscriptionRow(transcription: transcription)
                            }
                            .listRowBackground(Color.cardBackground)
                        }
                        .onDelete(perform: deleteTranscriptions)
                    }
                    .listStyle(.plain)
                    .refreshable {
                        await loadTranscriptions()
                    }
                }
            }
            .navigationTitle("Voice Notes")
            .searchable(text: $searchText, prompt: "Search transcriptions")
            .sheet(isPresented: $showRecording) {
                RecordingView { newTranscription in
                    if let t = newTranscription {
                        transcriptions.insert(t, at: 0)
                    }
                }
            }
            .background(Color(UIColor.systemGroupedBackground))
        }
        .task {
            await loadTranscriptions()
        }
    }

    func loadTranscriptions() async {
        isLoading = true
        do {
            let response = try await APIService.shared.getVoiceTranscriptions()
            transcriptions = response.transcriptions
        } catch {
            print("Failed to load transcriptions: \(error)")
        }
        isLoading = false
    }

    func deleteTranscriptions(at offsets: IndexSet) {
        transcriptions.remove(atOffsets: offsets)
    }
}

// MARK: - Transcription Row
struct TranscriptionRow: View {
    let transcription: VoiceTranscription

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                Text(transcription.title ?? "Untitled Recording")
                    .font(.body)
                    .fontWeight(.medium)

                Spacer()

                Text(transcription.displayDuration)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            if let summary = transcription.summary, !summary.isEmpty {
                Text(summary)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }

            HStack {
                if let date = transcription.createdAt {
                    Text(date.formatted(date: .abbreviated, time: .shortened))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                Spacer()

                // Tags
                if let tags = transcription.tags, !tags.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(tags.prefix(3), id: \.self) { tag in
                            Text(tag)
                                .font(.caption2)
                                .foregroundColor(.accentColor)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.accentColor.opacity(0.1))
                                .clipShape(Capsule())
                        }
                    }
                }
            }
        }
        .padding(.vertical, AppSpacing.xs)
    }
}

// MARK: - Transcription Detail View
struct TranscriptionDetailView: View {
    let transcription: VoiceTranscription
    @State private var selectedTab = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.lg) {
                // Header
                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                    Text(transcription.title ?? "Untitled")
                        .font(.title2)
                        .fontWeight(.bold)

                    HStack {
                        Label(transcription.displayDuration, systemImage: "clock")
                        if let date = transcription.createdAt {
                            Label(date.formatted(date: .abbreviated, time: .shortened), systemImage: "calendar")
                        }
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Tab Picker
                Picker("View", selection: $selectedTab) {
                    Text("Summary").tag(0)
                    Text("Full Text").tag(1)
                    Text("Extracted").tag(2)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                // Content
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    if selectedTab == 0 {
                        // Summary
                        if let summary = transcription.summary, !summary.isEmpty {
                            Text(summary)
                                .font(.body)
                        } else {
                            Text("No summary available")
                                .font(.body)
                                .foregroundColor(.secondary)
                                .italic()
                        }
                    } else if selectedTab == 1 {
                        // Full Transcription
                        if let text = transcription.cleanedText ?? transcription.originalText, !text.isEmpty {
                            Text(text)
                                .font(.body)
                        } else {
                            Text("No transcription available")
                                .font(.body)
                                .foregroundColor(.secondary)
                                .italic()
                        }
                    } else {
                        // Extracted Entities
                        VStack(alignment: .leading, spacing: AppSpacing.md) {
                            if let names = transcription.extractedNames, !names.isEmpty {
                                ExtractedSection(title: "Names", items: names, icon: "person", color: .blue)
                            }

                            if let dates = transcription.extractedDates, !dates.isEmpty {
                                ExtractedSection(title: "Dates", items: dates, icon: "calendar", color: .orange)
                            }

                            if let amounts = transcription.extractedAmounts, !amounts.isEmpty {
                                ExtractedSection(title: "Amounts", items: amounts, icon: "dollarsign.circle", color: .green)
                            }

                            if transcription.extractedNames?.isEmpty ?? true &&
                               transcription.extractedDates?.isEmpty ?? true &&
                               transcription.extractedAmounts?.isEmpty ?? true {
                                Text("No entities extracted")
                                    .font(.body)
                                    .foregroundColor(.secondary)
                                    .italic()
                            }
                        }
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Tags
                if let tags = transcription.tags, !tags.isEmpty {
                    VStack(alignment: .leading, spacing: AppSpacing.sm) {
                        Text("TAGS")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)

                        FlowLayout(spacing: 8) {
                            ForEach(tags, id: \.self) { tag in
                                Text(tag)
                                    .font(.caption)
                                    .foregroundColor(.accentColor)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(Color.accentColor.opacity(0.1))
                                    .clipShape(Capsule())
                            }
                        }
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                    .padding(.horizontal)
                }
            }
            .padding(.top)
            .padding(.bottom, AppSpacing.xxl)
        }
        .background(Color(UIColor.systemGroupedBackground))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button {
                        // Copy to clipboard
                    } label: {
                        Label("Copy Text", systemImage: "doc.on.doc")
                    }

                    Button {
                        // Share
                    } label: {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }

                    Button(role: .destructive) {
                        // Delete
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
    }
}

// MARK: - Extracted Section
struct ExtractedSection: View {
    let title: String
    let items: [String]
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
            }

            ForEach(items, id: \.self) { item in
                Text("• \(item)")
                    .font(.body)
            }
        }
    }
}

// MARK: - Recording View
struct RecordingView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var casesViewModel = CasesViewModel()

    @State private var isRecording = false
    @State private var recordingTime: TimeInterval = 0
    @State private var title = ""
    @State private var selectedCaseId: String?
    @State private var timer: Timer?
    @State private var isProcessing = false

    var onComplete: (VoiceTranscription?) -> Void

    var body: some View {
        NavigationStack {
            VStack(spacing: AppSpacing.xl) {
                Spacer()

                // Recording Indicator
                ZStack {
                    Circle()
                        .fill(Color.red.opacity(isRecording ? 0.2 : 0.1))
                        .frame(width: 200, height: 200)
                        .scaleEffect(isRecording ? 1.1 : 1.0)
                        .animation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true), value: isRecording)

                    Circle()
                        .fill(Color.red.opacity(isRecording ? 0.4 : 0.2))
                        .frame(width: 150, height: 150)

                    Image(systemName: isRecording ? "stop.fill" : "mic.fill")
                        .font(.system(size: 50))
                        .foregroundColor(.white)
                }
                .onTapGesture {
                    if isRecording {
                        stopRecording()
                    } else {
                        startRecording()
                    }
                }

                // Timer
                Text(formatTime(recordingTime))
                    .font(.system(size: 48, weight: .bold, design: .monospaced))
                    .foregroundColor(isRecording ? .red : .primary)

                Text(isRecording ? "Tap to stop" : "Tap to start recording")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                Spacer()

                // Options
                VStack(spacing: AppSpacing.md) {
                    TextField("Title (optional)", text: $title)
                        .textFieldStyle(.roundedBorder)

                    Picker("Link to Case", selection: $selectedCaseId) {
                        Text("No Case").tag(nil as String?)
                        ForEach(casesViewModel.cases, id: \.id) { caseItem in
                            Text(caseItem.title ?? "Untitled").tag(caseItem.id as String?)
                        }
                    }
                }
                .padding()
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.lg))
                .padding(.horizontal)

                // Save Button
                if recordingTime > 0 && !isRecording {
                    Button {
                        Task { await saveRecording() }
                    } label: {
                        HStack {
                            if isProcessing {
                                ProgressView()
                                    .tint(.white)
                            }
                            Text(isProcessing ? "Processing..." : "Save & Transcribe")
                        }
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Color.accentColor)
                        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
                    }
                    .disabled(isProcessing)
                    .padding(.horizontal)
                }
            }
            .padding(.bottom, AppSpacing.xl)
            .navigationTitle("Record Voice Note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        stopRecording()
                        dismiss()
                    }
                }
            }
            .background(Color(UIColor.systemGroupedBackground))
        }
        .task {
            await casesViewModel.loadCases()
        }
    }

    func formatTime(_ time: TimeInterval) -> String {
        let minutes = Int(time) / 60
        let seconds = Int(time) % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }

    func startRecording() {
        isRecording = true
        recordingTime = 0
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            recordingTime += 1
        }
    }

    func stopRecording() {
        isRecording = false
        timer?.invalidate()
        timer = nil
    }

    func saveRecording() async {
        isProcessing = true
        // Simulate API call
        try? await Task.sleep(nanoseconds: 2_000_000_000)

        let transcription = VoiceTranscription(
            id: UUID().uuidString,
            title: title.isEmpty ? "Voice Note" : title,
            originalText: "Sample transcription text...",
            cleanedText: "Sample cleaned text...",
            summary: "A brief summary of the voice note.",
            duration: Int(recordingTime),
            source: "mobile",
            caseId: selectedCaseId,
            clientId: nil,
            tags: ["meeting", "notes"],
            extractedDates: nil,
            extractedNames: nil,
            extractedAmounts: nil,
            createdAt: Date()
        )

        isProcessing = false
        onComplete(transcription)
        dismiss()
    }
}

// MARK: - Flow Layout
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(in: proposal.width ?? 0, subviews: subviews, spacing: spacing)
        return CGSize(width: proposal.width ?? 0, height: result.height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(in: bounds.width, subviews: subviews, spacing: spacing)
        for (index, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: bounds.minX + result.positions[index].x,
                                      y: bounds.minY + result.positions[index].y),
                         proposal: .unspecified)
        }
    }

    struct FlowResult {
        var positions: [CGPoint] = []
        var height: CGFloat = 0

        init(in width: CGFloat, subviews: Subviews, spacing: CGFloat) {
            var x: CGFloat = 0
            var y: CGFloat = 0
            var lineHeight: CGFloat = 0

            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)

                if x + size.width > width && x > 0 {
                    x = 0
                    y += lineHeight + spacing
                    lineHeight = 0
                }

                positions.append(CGPoint(x: x, y: y))
                lineHeight = max(lineHeight, size.height)
                x += size.width + spacing
            }

            height = y + lineHeight
        }
    }
}

// MARK: - Preview
#Preview {
    VoiceNotesView()
}
