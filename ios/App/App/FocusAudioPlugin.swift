import Capacitor
import AVFoundation
import MediaPlayer

// All player state belongs to native code so queue advancement survives WebView suspension.
@objc(FocusAudioPlugin)
public class FocusAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FocusAudioPlugin"
    public let jsName = "FocusAudio"
    public let pluginMethods: [CAPPluginMethod] = ["play", "playLocal", "pause", "resume", "stop", "seek", "volume", "skip", "editQueue", "playbackOptions", "reorderQueue", "state"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private struct Track { let id: String; let title: String; let artist: String; let url: URL; let local: Bool }
    private let player = AVPlayer()
    private var tracks: [Track] = []
    private var index = 0
    private var repeatMode = "off"
    private var sleepTask: DispatchWorkItem?
    private var timer: Any?
    private var observers: [NSObjectProtocol] = []
    private var statusObserver: NSKeyValueObservation?
    private var rateObserver: NSKeyValueObservation?
    private var wasPlaying = false
    private var lastError: String?
    private var targets: [(MPRemoteCommand, Any)] = []

    public override func load() {
        DispatchQueue.main.async { [weak self] in self?.configure() }
    }
    private func configure() {
        timer = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.5, preferredTimescale: 600), queue: .main) { [weak self] _ in self?.emit() }
        rateObserver = player.observe(\.timeControlStatus, options: [.new]) { [weak self] _, _ in DispatchQueue.main.async { self?.emit() } }
        observers.append(NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: nil, queue: .main) { [weak self] note in
            guard let self = self, let item = note.object as? AVPlayerItem, item === self.player.currentItem else { return }
            if self.repeatMode == "one" { self.start() } else if self.index + 1 < self.tracks.count { self.index += 1; self.start() } else if self.repeatMode == "all" && !self.tracks.isEmpty { self.index = 0; self.start() } else { self.player.pause(); self.emit() }
        })
        observers.append(NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            guard let self = self, let value = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt, let type = AVAudioSession.InterruptionType(rawValue: value) else { return }
            if type == .began { self.wasPlaying = self.player.rate > 0; self.player.pause() }
            else { let options = AVAudioSession.InterruptionOptions(rawValue: note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0); if self.wasPlaying && options.contains(.shouldResume) { self.resumePlayer() }; self.wasPlaying = false }
            self.emit()
        })
        observers.append(NotificationCenter.default.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] note in
            if (note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt) == AVAudioSession.RouteChangeReason.oldDeviceUnavailable.rawValue { self?.player.pause(); self?.emit() }
        })
        let commands = MPRemoteCommandCenter.shared()
        bind(commands.playCommand) { [weak self] _ in self?.resumePlayer(); return .success }
        bind(commands.pauseCommand) { [weak self] _ in self?.player.pause(); self?.emit(); return .success }
        bind(commands.togglePlayPauseCommand) { [weak self] _ in guard let self = self else { return .commandFailed }; if self.player.rate > 0 { self.player.pause() } else { self.resumePlayer() }; self.emit(); return .success }
        bind(commands.nextTrackCommand) { [weak self] _ in self?.advance(1); return .success }
        bind(commands.previousTrackCommand) { [weak self] _ in self?.advance(-1); return .success }
        bind(commands.changePlaybackPositionCommand) { [weak self] event in guard let e = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }; self?.seekPlayer(e.positionTime); return .success }
    }
    private func bind(_ command: MPRemoteCommand, action: @escaping (MPRemoteCommandEvent) -> MPRemoteCommandHandlerStatus) { command.isEnabled = true; targets.append((command, command.addTarget(handler: action))) }
    private func activate() throws { let session = AVAudioSession.sharedInstance(); try session.setCategory(.playback, mode: .default); try session.setActive(true) }
    private func resumePlayer() { do { try activate(); if player.currentItem != nil { lastError = nil; player.play() } } catch { lastError = "Audio session could not start." }; emit() }
    private func start() {
        guard tracks.indices.contains(index) else { return }
        do {
            try activate(); lastError = nil
            let item = AVPlayerItem(url: tracks[index].url); player.replaceCurrentItem(with: item)
            statusObserver = item.observe(\.status, options: [.new]) { [weak self] item, _ in DispatchQueue.main.async { if item === self?.player.currentItem && item.status == .failed { self?.lastError = "This song could not play. Try another track."; self?.player.pause() }; self?.emit() } }
            player.play(); emit()
        } catch { lastError = "Audio session could not start."; player.pause(); emit() }
    }
    private func advance(_ delta: Int) { guard !tracks.isEmpty else { return }; index = (index + delta + tracks.count) % tracks.count; start() }
    private func finite(_ value: Double) -> Double { value.isFinite ? max(0, value) : 0 }
    private func seekPlayer(_ time: Double) { guard time.isFinite && time >= 0 else { return }; let duration = finite(player.currentItem?.duration.seconds ?? 0); guard duration > 0 else { return }; player.seek(to: CMTime(seconds: min(time, duration), preferredTimescale: 600)); emit() }
    private func snapshot() -> [String: Any] {
        let track = tracks.indices.contains(index) ? tracks[index] : nil
        var value: [String: Any] = ["sleepActive": sleepTask != nil, "id": track?.id ?? "", "local": track?.local ?? false, "playing": player.timeControlStatus == .playing, "time": finite(player.currentTime().seconds), "duration": finite(player.currentItem?.duration.seconds ?? 0)]
        if let error = lastError { value["error"] = error }; return value
    }
    private func emit() {
        let state = snapshot(); notifyListeners("playback", data: state)
        guard tracks.indices.contains(index) else { MPNowPlayingInfoCenter.default().nowPlayingInfo = nil; return }
        let track = tracks[index]
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [MPMediaItemPropertyTitle: track.title, MPMediaItemPropertyArtist: track.artist, MPMediaItemPropertyPlaybackDuration: state["duration"] ?? 0, MPNowPlayingInfoPropertyElapsedPlaybackTime: state["time"] ?? 0, MPNowPlayingInfoPropertyPlaybackRate: player.rate]
    }
    private func main(_ call: CAPPluginCall, action: @escaping () throws -> Void) { DispatchQueue.main.async { do { try action(); call.resolve() } catch { call.reject("Audio command failed.", nil, error) } } }
    @objc func play(_ call: CAPPluginCall) {
        guard let values = call.getArray("tracks", [String: Any].self), !values.isEmpty, values.count <= 50, let selected = call.getInt("index"), values.indices.contains(selected) else { call.reject("Invalid music queue."); return }
        var queue: [Track] = []
        for value in values {
            guard let id = value["id"] as? String, let text = value["title"] as? String, text.count <= 500, let artist = value["artist"] as? String, artist.count <= 500, let raw = value["url"] as? String, let url = URL(string: raw), url.scheme == "https", url.user == nil, url.password == nil, url.port == nil, url.fragment == nil else { call.reject("Invalid stream source."); return }
            let audius = id.range(of: "^[A-Za-z0-9]{1,32}$", options: .regularExpression) != nil && url.host == "api.audius.co" && url.path == "/v1/tracks/\(id)/stream"
            let parts = id.split(separator: ":")
            let archive = id.range(of: "^ia:[A-Za-z0-9_.-]{1,200}:[0-9]{1,2}$", options: .regularExpression) != nil && parts.count == 3 && url.host == "archive.org" && url.path.hasPrefix("/download/\(parts[1])/") && url.path.lowercased().hasSuffix(".mp3") && !url.path.contains("/../") && !url.path.contains("/./")
            let mixter = id.range(of: "^cc[0-9]{1,15}$", options: .regularExpression) != nil && url.host == "ccmixter.org" && url.path.hasPrefix("/content/") && url.path.lowercased().hasSuffix(".mp3") && !url.path.contains("/../") && !url.path.contains("/./")
            let queryItems = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
            let jamendo = ((id.hasPrefix("ov:") && UUID(uuidString: String(id.dropFirst(3))) != nil) || (id.range(of: "^jm:[0-9]{1,15}$", options: .regularExpression) != nil && String(id.dropFirst(3)) == queryItems.first(where: { $0.name == "trackid" })?.value)) && url.host == "prod-1.storage.jamendo.com" && url.path == "/" && queryItems.first(where: { $0.name == "trackid" })?.value?.range(of: "^[0-9]{1,15}$", options: .regularExpression) != nil && ["mp31", "mp32"].contains(queryItems.first(where: { $0.name == "format" })?.value ?? "") && queryItems.allSatisfy { ["trackid", "format"].contains($0.name) }
            guard audius || archive || mixter || jamendo else { call.reject("Invalid stream source."); return }
            queue.append(Track(id: id, title: text, artist: artist, url: url, local: false))
        }
        main(call) { self.tracks = queue; self.index = selected; self.player.volume = Float(max(0, min(1, call.getDouble("volume") ?? 0.65))); self.start() }
    }
    @objc func playLocal(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), UUID(uuidString: id) != nil, let title = call.getString("title"), title.count <= 500, let encoded = call.getString("data"), encoded.count <= 70 * 1024 * 1024, let data = Data(base64Encoded: encoded), !data.isEmpty, data.count <= 50 * 1024 * 1024, let ext = call.getString("extension"), ["mp3", "wav", "m4a", "ogg", "flac"].contains(ext) else { call.reject("Invalid local audio file."); return }
        main(call) {
            let folder = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("FocusAudio", isDirectory: true)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let url = folder.appendingPathComponent("\(id).\(ext)")
            try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            self.tracks = [Track(id: id, title: title, artist: "Your music", url: url, local: true)]; self.index = 0; self.player.volume = Float(max(0, min(1, call.getDouble("volume") ?? 0.65))); self.start()
        }
    }
    @objc func pause(_ call: CAPPluginCall) { main(call) { self.player.pause(); self.emit() } }
    @objc func resume(_ call: CAPPluginCall) { main(call) { self.resumePlayer() } }
    @objc func stop(_ call: CAPPluginCall) { main(call) { self.player.pause(); self.player.replaceCurrentItem(with: nil); self.tracks = []; self.statusObserver = nil; self.emit(); try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation) } }
    @objc func seek(_ call: CAPPluginCall) { main(call) { self.seekPlayer(call.getDouble("time") ?? 0) } }
    @objc func volume(_ call: CAPPluginCall) { main(call) { self.player.volume = Float(max(0, min(1, call.getDouble("volume") ?? 0.65))) } }
    @objc func skip(_ call: CAPPluginCall) { let delta = call.getInt("delta") ?? 1; guard [-1, 1].contains(delta) else { call.reject("Invalid direction."); return }; main(call) { self.advance(delta) } }
    @objc func playbackOptions(_ call: CAPPluginCall) {
        let repeatMode = call.getString("repeat"), minutes = call.getInt("sleepMinutes")
        if let value = repeatMode, !["off","all","one"].contains(value) { call.reject("Invalid repeat mode."); return }
        if let value = minutes, ![0,15,30,60].contains(value) { call.reject("Invalid sleep timer."); return }
        main(call) {
            if let value = repeatMode { self.repeatMode = value }
            if let value = minutes { self.sleepTask?.cancel(); self.sleepTask = nil; if value > 0 { let task = DispatchWorkItem { [weak self] in self?.player.pause(); self?.sleepTask = nil; self?.emit() }; self.sleepTask = task; DispatchQueue.main.asyncAfter(deadline: .now() + Double(value * 60), execute: task) } }
        }
    }
    @objc func reorderQueue(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let order = call.getArray("order", Int.self), order.count == self.tracks.count, order.count <= 50, Set(order).count == order.count, order.allSatisfy({ self.tracks.indices.contains($0) }), order.enumerated().allSatisfy({ $0.offset > self.index || $0.element == $0.offset }) else { call.reject("Invalid queue order."); return }
            self.tracks = order.map { self.tracks[$0] }; self.emit(); call.resolve()
        }
    }
    @objc func editQueue(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let from = call.getInt("from"), from > self.index, self.tracks.indices.contains(from) else { call.reject("Only upcoming songs can change."); return }
            let to = call.getInt("to")
            if let to = to, to <= self.index || !self.tracks.indices.contains(to) { call.reject("Invalid queue position."); return }
            let track = self.tracks.remove(at: from)
            if let to = to { self.tracks.insert(track, at: to) }
            self.emit(); call.resolve()
        }
    }
    @objc func state(_ call: CAPPluginCall) { DispatchQueue.main.async { call.resolve(self.snapshot()) } }
    deinit { sleepTask?.cancel(); if let timer = timer { player.removeTimeObserver(timer) }; observers.forEach { NotificationCenter.default.removeObserver($0) }; targets.forEach { $0.0.removeTarget($0.1) } }
}
