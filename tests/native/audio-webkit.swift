// macOS integration: actual WKWebView decoding AAC through the production audio module.
// swift tests/native/audio-webkit.swift <repo> <tone.mp4>
import AppKit
import WebKit

let root = URL(fileURLWithPath: CommandLine.arguments[1])
let tone = URL(fileURLWithPath: CommandLine.arguments[2])
final class Harness: NSObject, WKURLSchemeHandler, WKScriptMessageHandler {
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        print(message.body)
        fflush(stdout)
        exit((message.body as? String)?.contains("\"passed\":true") == true ? 0 : 1)
    }
    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        let url = task.request.url!
        var data: Data
        var type: String
        if url.path == "/qa.html" {
            data = Data(page.utf8); type = "text/html"
        } else if url.scheme == "asset" {
            data = try! Data(contentsOf: tone); type = "video/mp4"
        } else {
            guard url.path == "/audio-output.js" else { task.didFailWithError(NSError(domain: "QA", code: 404)); return }
            data = try! Data(contentsOf: root.appendingPathComponent("ui/features/player/audio-output.js")); type = "text/javascript"
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
let page = """
<!doctype html><video id="v" crossorigin="anonymous" src="asset://localhost/tone.mp4" loop playsinline></video>
<script type="module">
import {AudioOutput} from './audio-output.js';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
 const v=document.querySelector('video');
 await v.play();
 const audio=new AudioOutput(v);
 await audio.setBoost(1.5); await audio.setBoost(1);
 const analyser=audio.context.createAnalyser(); analyser.fftSize=2048;
 const silent=audio.context.createGain(); silent.gain.value=0;
 audio.output.connect(analyser); analyser.connect(silent); silent.connect(audio.context.destination);
 const rms=()=>{const data=new Float32Array(2048); analyser.getFloatTimeDomainData(data); return Math.sqrt(data.reduce((sum,n)=>sum+n*n,0)/data.length);};
 await delay(700); const baseline=rms();
 await audio.setBoost(2); await delay(700); const boosted=rms();
 v.src='asset://localhost/tone.mp4?next'; await v.play(); await delay(700); const next=rms();
 await audio.setBoost(1); await delay(700); const restored=rms();
 audio.toggleMute(); await delay(400); const muted=rms();
 audio.toggleMute(); audio.setVolume(0); await delay(400); const zero=rms();
 audio.toggleMute(); await delay(400); const unmuted=rms();
 v.pause();
 window.webkit.messageHandlers.result.postMessage(JSON.stringify({passed:baseline>0.0001 && boosted/baseline>1.8 && boosted/baseline<2.2 && next/baseline>1.8 && restored/baseline>0.9 && restored/baseline<1.1 && muted<baseline*0.01 && zero<baseline*0.01 && unmuted/baseline>0.9,baseline,boosted,next,restored,muted,zero,unmuted,ratio:boosted/baseline,state:audio.context.state}));
} catch(error) { window.webkit.messageHandlers.result.postMessage(JSON.stringify({passed:false,error:String(error)})); }
</script>
"""
let app = NSApplication.shared
let handler = Harness()
let config = WKWebViewConfiguration()
config.mediaTypesRequiringUserActionForPlayback = []
config.setURLSchemeHandler(handler, forURLScheme:"tauri")
config.setURLSchemeHandler(handler, forURLScheme:"asset")
config.userContentController.add(handler, name:"result")
let view = WKWebView(frame:NSRect(x:0,y:0,width:320,height:240),configuration:config)
let window = NSWindow(contentRect:view.frame,styleMask:[.titled],backing:.buffered,defer:false)
window.contentView = view
window.orderFrontRegardless()
view.load(URLRequest(url:URL(string:"tauri://localhost/qa.html")!))
DispatchQueue.main.asyncAfter(deadline:.now()+25) { print("{\"passed\":false,\"error\":\"timeout\"}"); exit(1) }
app.run()
