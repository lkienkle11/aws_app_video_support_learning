//! WebView host. Business logic and SQLite live in the isolated core process.
use serde_json::{json, Value};
use std::{
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, ChildStdin, ChildStdout, Command, Stdio},
    sync::Mutex,
};
use tauri::{Manager, State};
type Result<T> = std::result::Result<T, String>;
struct Core {
    child: Child,
    input: ChildStdin,
    output: BufReader<ChildStdout>,
}
impl Core {
    fn start() -> Result<Self> {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let filename = if cfg!(windows) {
            "cloud-study-core.exe"
        } else {
            "cloud-study-core"
        };
        let mut command = Command::new(
            exe.parent()
                .ok_or("Missing executable folder")?
                .join(filename),
        );
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let mut child = command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|e| format!("Cannot start Rust core: {e}"))?;
        let input = child.stdin.take().ok_or("No core stdin")?;
        let output = BufReader::new(child.stdout.take().ok_or("No core stdout")?);
        Ok(Self {
            child,
            input,
            output,
        })
    }
    fn call(&mut self, command: &str, args: Value) -> Result<Value> {
        writeln!(self.input, "{}", json!({"command":command,"args":args}))
            .and_then(|_| self.input.flush())
            .map_err(|e| e.to_string())?;
        let mut line = String::new();
        if self
            .output
            .read_line(&mut line)
            .map_err(|e| e.to_string())?
            == 0
        {
            return Err("Rust core stopped unexpectedly. Restart the application.".into());
        }
        let response: Value = serde_json::from_str(&line).map_err(|e| e.to_string())?;
        if let Some(error) = response.get("error") {
            Err(error.as_str().unwrap_or("Backend error").into())
        } else {
            Ok(response["ok"].clone())
        }
    }
}
impl Drop for Core {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
struct Backend(Mutex<Core>);
fn load(app: &tauri::AppHandle, core: &mut Core, path: PathBuf) -> Result<Value> {
    let result = core.call("open_library", json!({"path":path}))?;
    let root = result["root"].as_str().ok_or("Invalid library root")?;
    app.asset_protocol_scope()
        .allow_directory(root, true)
        .map_err(|e| e.to_string())?;
    Ok(result)
}
#[tauri::command]
fn backend(
    app: tauri::AppHandle,
    state: State<Backend>,
    command: String,
    args: Value,
) -> Result<Value> {
    let mut core = state.0.lock().map_err(|e| e.to_string())?;
    if command == "open_library" {
        return load(
            &app,
            &mut core,
            PathBuf::from(args["path"].as_str().ok_or("Missing path")?),
        );
    }
    if command == "default_library" {
        let mut paths = Vec::new();
        if let Some(path) = std::env::var_os("CLOUD_STUDY_FILES") {
            paths.push(PathBuf::from(path));
        }
        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                paths.push(parent.join("files"));
                paths.push(parent.join("../../../files"));
                paths.push(parent.join("../../../../files"));
            }
        }
        if let Ok(cwd) = std::env::current_dir() {
            paths.push(cwd.join("files"));
        }
        for path in paths {
            if path.is_dir() {
                return load(&app, &mut core, path);
            }
        }
        return Err("Select the extracted files folder to get started.".into());
    }
    core.call(&command, args)
}
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(Backend(Mutex::new(Core::start()?)));
            // Optional compact desktop size, also used for native responsive QA.
            if let Ok(value) = std::env::var("CLOUD_STUDY_WINDOW_SIZE") {
                if let Some((width, height)) = value.split_once('x') {
                    if let (Ok(width), Ok(height)) = (width.parse::<f64>(), height.parse::<f64>()) {
                        if (320.0..=4000.0).contains(&width) && (400.0..=3000.0).contains(&height) {
                            if let Some(window) = app.get_webview_window("main") {
                                window.set_size(tauri::LogicalSize::new(width, height))?;
                            }
                        }
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![backend])
        .run(tauri::generate_context!())
        .expect("Unable to start Cloud Study");
}
