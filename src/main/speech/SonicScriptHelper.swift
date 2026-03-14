/**
 * SonicScriptHelper.swift — Swift CLI: microphone capture + streaming speech recognition.
 *
 * Main exports:
 *   - SpeechHelper (class)
 *       start(languageCode): starts AVAudioEngine + SFSpeechRecognizer session
 *       stop(): signals endAudio(); waits for final recognition callback
 *       cancel(): force-stops without emitting final result
 *   - Main entry: outputs {"type":"ready"}, then processes stdin commands
 *
 * I/O data types (JSON lines on stdout):
 *   - {"type":"ready"}                         — helper started
 *   - {"type":"partial","text":"..."}          — live transcript update
 *   - {"type":"final","text":"..."}            — session complete
 *   - {"type":"error","message":"..."}         — recognition error
 *   Commands received on stdin:
 *   - {"action":"start","language":"zh-CN"}    — begin session
 *   - {"action":"stop"}                        — graceful stop
 *   - {"action":"cancel"}                      — force cancel
 *
 * Execution flow:
 *   1. Install AVAudioEngine tap → feed buffers to SFSpeechAudioBufferRecognitionRequest
 *   2. startTask(): try on-device recognition (macOS 13+); fall back to network on error
 *   3. On non-final result: detect segment resets via isSegmentReset(); merge partials
 *   4. On isFinal (natural timeout): commit segment, start new request (segment chaining)
 *   5. On stop(): set stoppingByRequest=true → next isFinal emits full accumulated text
 *
 * Design notes:
 *   - SFSpeechRecognizer.requestAuthorization() is NOT called — it crashes in ad-hoc
 *     signed apps. Auth errors surface as error code 203 when the first task starts.
 *   - Segment chaining (restart task on natural final) overcomes the ~60s recognition limit
 *   - mergeTranscript() deduplicates overlapping text at segment boundaries
 *   - Orphan guard: polls getppid() every 3s; exits if parent (Electron) dies
 *   - RunLoop.main.run() is required to keep AVAudioEngine callbacks alive
 */
import Foundation
import Speech
import AVFoundation

class SpeechHelper {
    private var recognizer: SFSpeechRecognizer?
    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var isRecording = false
    private var stoppingByRequest = false
    private var accumulatedText = ""
    private var lastRawPartial = ""
    private var activeTaskGeneration = 0

    func start(languageCode: String) {
        // Clean up any lingering session
        if isRecording {
            stopInternal()
            cleanupTask(cancel: true)
        }
        accumulatedText = ""
        lastRawPartial = ""
        stoppingByRequest = false

        let locale = Locale(identifier: languageCode)
        guard let rec = SFSpeechRecognizer(locale: locale), rec.isAvailable else {
            output(["type": "error", "message": "Recognizer not available for \(languageCode)"])
            return
        }
        recognizer = rec

        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        self.request = req

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.request?.append(buffer)
        }

        do {
            try audioEngine.start()
        } catch {
            output(["type": "error", "message": "Audio engine failed: \(error.localizedDescription)"])
            cleanupAudio()
            return
        }

        isRecording = true

        // Try on-device first (macOS 13+). If it fails, retry with network fallback.
        startTask(recognizer: rec, request: req, onDeviceAttempt: true)
    }

    private func startTask(recognizer rec: SFSpeechRecognizer, request req: SFSpeechAudioBufferRecognitionRequest, onDeviceAttempt: Bool) {
        if #available(macOS 13, *), onDeviceAttempt {
            req.requiresOnDeviceRecognition = true
        }

        activeTaskGeneration += 1
        let generation = activeTaskGeneration
        task = rec.recognitionTask(with: req) { [weak self] result, error in
            guard let self = self else { return }
            guard generation == self.activeTaskGeneration else { return }
            if let result = result {
                let text = result.bestTranscription.formattedString
                if result.isFinal {
                    if self.stoppingByRequest {
                        // User explicitly stopped — emit full accumulated text as final.
                        let finalSegment = text.isEmpty ? self.lastRawPartial : text
                        let fullText = self.mergeTranscript(base: self.accumulatedText, next: finalSegment)
                            .trimmingCharacters(in: .whitespacesAndNewlines)
                        self.output(["type": "final", "text": fullText])
                        self.stopInternal()
                        self.accumulatedText = ""
                        self.lastRawPartial = ""
                        self.stoppingByRequest = false
                        self.cleanupTask()
                    } else {
                        // Commit completed segment and restart recognition without stopping audio.
                        let completedSegment = text.isEmpty ? self.lastRawPartial : text
                        self.accumulatedText = self.mergeTranscript(base: self.accumulatedText, next: completedSegment)
                        self.lastRawPartial = ""
                        self.cleanupTask()
                        let newReq = SFSpeechAudioBufferRecognitionRequest()
                        newReq.shouldReportPartialResults = true
                        if #available(macOS 13, *), onDeviceAttempt {
                            newReq.requiresOnDeviceRecognition = true
                        }
                        self.request = newReq
                        if let rec = self.recognizer {
                            self.startTask(recognizer: rec, request: newReq, onDeviceAttempt: true)
                        }
                    }
                } else {
                    if self.isSegmentReset(previous: self.lastRawPartial, current: text) {
                        self.accumulatedText = self.mergeTranscript(base: self.accumulatedText, next: self.lastRawPartial)
                    }
                    if !text.isEmpty {
                        self.lastRawPartial = text
                    }
                    let displayText = self.mergeTranscript(base: self.accumulatedText, next: text)
                    self.output(["type": "partial", "text": displayText])
                }
            } else if let error = error {
                let nsErr = error as NSError
                // Error 203 = kSFSpeechRecognizerErrorNotAuthorized
                if nsErr.domain == "kSFSpeechErrorDomain" && nsErr.code == 203 {
                    self.output(["type": "error", "message": "Speech recognition not authorized. Go to System Settings > Privacy & Security > Speech Recognition and enable SonicScript."])
                    self.cleanupTask()
                    self.stopInternal()
                    return
                }
                if #available(macOS 13, *), onDeviceAttempt {
                    // On-device model not ready — fall back to network mode
                    self.output(["type": "partial", "text": ""])
                    req.requiresOnDeviceRecognition = false
                    self.startTask(recognizer: rec, request: req, onDeviceAttempt: false)
                } else {
                    self.output(["type": "error", "message": error.localizedDescription])
                    self.stopInternal()
                    self.cleanupTask()
                }
            }
        }
    }

    func stop() {
        guard isRecording else { return }
        stoppingByRequest = true
        request?.endAudio()
    }

    /// Force-cancel without waiting for final result (used on timeout/error)
    func cancel() {
        task?.cancel()
        stopInternal()
        cleanupTask(cancel: true)
        accumulatedText = ""
        lastRawPartial = ""
        stoppingByRequest = false
    }

    private func stopInternal() {
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        isRecording = false
    }

    private func cleanupAudio() {
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        isRecording = false
    }

    private func cleanupTask(cancel: Bool = false) {
        if cancel {
            task?.cancel()
        }
        task = nil
        request = nil
    }

    private func isSegmentReset(previous: String, current: String) -> Bool {
        guard !previous.isEmpty, !current.isEmpty else { return false }
        guard current.count < previous.count / 2 else { return false }
        return !previous.hasPrefix(current)
    }

    private func mergeTranscript(base: String, next: String) -> String {
        let left = base.trimmingCharacters(in: .whitespacesAndNewlines)
        let right = next.trimmingCharacters(in: .whitespacesAndNewlines)

        if left.isEmpty { return right }
        if right.isEmpty { return left }
        if left.hasSuffix(right) { return left }
        if right.hasPrefix(left) { return right }

        let leftChars = Array(left)
        let rightChars = Array(right)
        let maxOverlap = min(leftChars.count, rightChars.count)

        if maxOverlap > 0 {
            for size in stride(from: maxOverlap, through: 1, by: -1) {
                if Array(leftChars.suffix(size)) == Array(rightChars.prefix(size)) {
                    return left + String(rightChars.dropFirst(size))
                }
            }
        }

        let separator = left.last?.isWhitespace == true || right.first?.isWhitespace == true ? "" : " "
        return left + separator + right
    }

    func output(_ dict: [String: String]) {
        if let data = try? JSONSerialization.data(withJSONObject: dict),
           let str = String(data: data, encoding: .utf8) {
            print(str)
            fflush(stdout)  // Critical: flush so Electron receives immediately
        }
    }
}

// ─── Main entry ──────────────────────────────────────────────────────────────

let helper = SpeechHelper()

// Note: We don't call SFSpeechRecognizer.requestAuthorization() here because
// it crashes when running in an ad-hoc signed app (dev environment).
// In production (signed with a developer cert), the system dialog appears automatically
// when the first recognition task starts. In development, users must manually grant
// permission in System Settings > Privacy & Security > Speech Recognition.
//
// Output "ready" immediately - auth errors surface when recording starts.
helper.output(["type": "ready"])

// stdin command loop — processes commands from Electron main process
DispatchQueue.global().async {
    while let line = readLine() {
        guard let data = line.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: String],
              let action = json["action"] else { continue }

        DispatchQueue.main.async {
            switch action {
            case "start":
                let lang = json["language"] ?? "zh-CN"
                helper.start(languageCode: lang)
            case "stop":
                helper.stop()
            case "cancel":
                helper.cancel()
            default:
                break
            }
        }
    }
    // stdin closed = Electron process exited, clean up and exit
    exit(0)
}

// Orphan process guard: poll parent PID every 3s; if parent dies, exit cleanly
Timer.scheduledTimer(withTimeInterval: 3.0, repeats: true) { _ in
    if getppid() == 1 {
        // Parent process (Electron) has been killed or crashed
        helper.cancel()
        exit(0)
    }
}

// Main thread RunLoop — required for AVAudioEngine and SFSpeechRecognizer callbacks
RunLoop.main.run()
