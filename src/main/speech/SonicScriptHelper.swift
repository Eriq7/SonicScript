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

    func start(languageCode: String) {
        // Clean up any lingering session
        if isRecording { stopInternal() }
        accumulatedText = ""
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

        task = rec.recognitionTask(with: req) { [weak self] result, error in
            guard let self = self else { return }
            if let result = result {
                let text = result.bestTranscription.formattedString
                if result.isFinal {
                    if self.stoppingByRequest {
                        // User explicitly stopped — emit full accumulated text as final
                        let fullText = (self.accumulatedText + text).trimmingCharacters(in: .whitespaces)
                        self.output(["type": "final", "text": fullText])
                        self.accumulatedText = ""
                        self.stoppingByRequest = false
                        self.cleanupTask()
                    } else {
                        // SFSpeechRecognizer internal segment boundary — accumulate and restart task
                        self.accumulatedText += text + " "
                        self.cleanupTask()  // nil out task+request, keep audioEngine running
                        let newReq = SFSpeechAudioBufferRecognitionRequest()
                        newReq.shouldReportPartialResults = true
                        self.request = newReq  // tap closure appends to self.request, now points to new req
                        if let rec = self.recognizer {
                            self.startTask(recognizer: rec, request: newReq, onDeviceAttempt: true)
                        }
                    }
                } else {
                    self.output(["type": "partial", "text": self.accumulatedText + text])
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
                    self.cleanupTask()
                }
            }
        }
    }

    func stop() {
        guard isRecording else { return }
        stoppingByRequest = true  // Distinguish user stop from internal segment boundary
        request?.endAudio()       // Signal end-of-audio → triggers isFinal=true
        stopInternal()
    }

    /// Force-cancel without waiting for final result (used on timeout/error)
    func cancel() {
        task?.cancel()
        stopInternal()
        cleanupTask()
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

    private func cleanupTask() {
        task = nil
        request = nil
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
