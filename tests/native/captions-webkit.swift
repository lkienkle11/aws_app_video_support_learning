// macOS integration: production subtitle DOM/CSS/modules with real MP4 metadata.
// swift tests/native/captions-webkit.swift <repo> <video.mp4>
import AppKit
import WebKit

let root = URL(fileURLWithPath: CommandLine.arguments[1])
let tone = URL(fileURLWithPath: CommandLine.arguments[2])
let driver = CommandLine.arguments.count > 3 ? CommandLine.arguments[3] : "tests/native/captions-webkit.mjs"
let benchmarking = driver.hasSuffix("zoom-performance.mjs")
final class Harness: NSObject, WKURLSchemeHandler, WKScriptMessageHandler {
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        print(message.body)
        fflush(stdout)
        let body = (message.body as? String) ?? ""
        if benchmarking {
            if body.contains("\"passed\":") { exit(body.contains("\"passed\":true") ? 0 : 1) }
            if let data = body.data(using: .utf8), let object = try? JSONSerialization.jsonObject(with: data) as? [String:Any] {
                if let size = object["resize"] as? [Double] { window.setContentSize(NSSize(width:size[0],height:size[1])) }
                if object["fullscreen"] as? Bool == true { window.toggleFullScreen(nil) }
            }
        } else {
            exit(body.contains("\"passed\":true") ? 0 : 1)
        }
    }
    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        let url = task.request.url!
        var data: Data
        var type: String
        if url.path == "/index.html" {
            let html = try! String(contentsOf: root.appendingPathComponent("ui/index.html"), encoding: .utf8)
            data = Data(html.replacingOccurrences(of: "<script type=\"module\" src=\"features/library/controller.js\"></script>", with: "<script type=\"module\" src=\"/qa.mjs\"></script>").utf8)
            type = "text/html"
        } else if url.path == "/qa.mjs" {
            data = try! Data(contentsOf: root.appendingPathComponent(driver)); type = "text/javascript"
        } else if url.path == "/features/player/video-zoom-reference.js", let fixture = ProcessInfo.processInfo.environment["CLOUD_STUDY_ZOOM_REFERENCE"] {
            let path = root.appendingPathComponent(fixture).standardizedFileURL
            guard path.path.hasPrefix(root.path + "/") else { task.didFailWithError(NSError(domain:"QA",code:403)); return }
            data = try! Data(contentsOf:path); type = "text/javascript"
        } else if url.path == "/features/player/video-zoom.js", let fixture = ProcessInfo.processInfo.environment["CLOUD_STUDY_ZOOM_MODULE"] {
            let path = root.appendingPathComponent(fixture).standardizedFileURL
            guard path.path.hasPrefix(root.path + "/") else { task.didFailWithError(NSError(domain:"QA",code:403)); return }
            data = try! Data(contentsOf:path); type = "text/javascript"
        } else if url.scheme == "asset" {
            data = try! Data(contentsOf: tone); type = "video/mp4"
        } else {
            let path = root.appendingPathComponent("ui").appendingPathComponent(url.path).standardizedFileURL
            guard path.path.hasPrefix(root.appendingPathComponent("ui").path + "/"),
                  let source = try? Data(contentsOf: path) else { task.didFailWithError(NSError(domain: "QA", code: 404)); return }
            data = source
            type = url.path.hasSuffix(".css") ? "text/css" : "text/javascript"
        }
        let total = data.count
        var status = 200
        var headers = ["Content-Type":type, "Access-Control-Allow-Origin":"tauri://localhost", "Accept-Ranges":"bytes"]
        if let range = task.request.value(forHTTPHeaderField: "Range"), range.hasPrefix("bytes=") {
            let parts = range.dropFirst(6).split(separator: "-", omittingEmptySubsequences: false)
            let start = Int(parts[0]) ?? 0
            let end = min(Int(parts.count > 1 ? parts[1] : "") ?? (total-1), total-1)
            guard start >= 0 && start <= end else {task.didFailWithError(NSError(domain:"QA",code:416));return}
            data = data.subdata(in:start..<(end+1)); status = 206
            headers["Content-Range"] = "bytes \(start)-\(end)/\(total)"
        }
        headers["Content-Length"] = String(data.count)
        task.didReceive(HTTPURLResponse(url:url,statusCode:status,httpVersion:"HTTP/1.1",headerFields:headers)!)
        task.didReceive(data); task.didFinish()
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}
let app = NSApplication.shared
let handler = Harness()
let config = WKWebViewConfiguration()
config.mediaTypesRequiringUserActionForPlayback = []
config.setURLSchemeHandler(handler, forURLScheme:"tauri")
config.setURLSchemeHandler(handler, forURLScheme:"asset")
config.userContentController.add(handler, name:"result")
let view = WKWebView(frame:NSRect(x:0,y:0,width:1440,height:900),configuration:config)
let window = NSWindow(contentRect:view.frame,styleMask: benchmarking ? [.titled,.closable,.miniaturizable,.resizable] : [.titled],backing:.buffered,defer:false)
window.contentView = view
window.orderFrontRegardless()
if benchmarking || driver.hasSuffix("zoom-webkit.mjs") {
    window.level = .floating
    app.setActivationPolicy(.regular)
    window.makeKeyAndOrderFront(nil)
    window.makeFirstResponder(view)
    app.activate(ignoringOtherApps: true)
}
view.load(URLRequest(url:URL(string:"tauri://localhost/index.html")!))
DispatchQueue.main.asyncAfter(deadline:.now() + (benchmarking ? 600 : 25)) { print("{\"passed\":false,\"error\":\"timeout\"}"); exit(1) }
app.run()
