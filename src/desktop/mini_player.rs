//! Reuse the existing WebView/video so the floating player supports DOM gestures
//! and captions without a second decoder or a per-frame canvas copy.
use std::sync::Mutex;
use tauri::{Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

type Result<T> = std::result::Result<T, String>;

pub struct Geometry {
    size: PhysicalSize<u32>,
    position: PhysicalPosition<i32>,
    maximized: bool,
    fullscreen: bool,
    decorated: bool,
    on_top: bool,
}

#[derive(Default)]
pub struct MiniPlayer(Mutex<Option<Geometry>>);

fn restore(window: &WebviewWindow, geometry: &Geometry) -> tauri::Result<()> {
    window.set_fullscreen(false)?;
    window.set_always_on_top(geometry.on_top)?;
    window.set_decorations(geometry.decorated)?;
    window.set_min_size(Some(tauri::LogicalSize::new(320.0, 400.0)))?;
    window.set_size(geometry.size)?;
    window.set_position(geometry.position)?;
    if geometry.maximized {
        window.maximize()?;
    }
    window.set_fullscreen(geometry.fullscreen)?;
    Ok(())
}

pub fn set(app: &tauri::AppHandle, active: bool) -> Result<()> {
    let state = app.state::<MiniPlayer>();
    let mut saved = state.0.lock().map_err(|e| e.to_string())?;
    let window = app
        .get_webview_window("main")
        .ok_or("Missing main window")?;
    if active {
        if saved.is_some() {
            return Ok(());
        }
        let geometry = Geometry {
            size: window.inner_size().map_err(|e| e.to_string())?,
            position: window.outer_position().map_err(|e| e.to_string())?,
            maximized: window.is_maximized().map_err(|e| e.to_string())?,
            fullscreen: window.is_fullscreen().map_err(|e| e.to_string())?,
            decorated: window.is_decorated().map_err(|e| e.to_string())?,
            on_top: window.is_always_on_top().map_err(|e| e.to_string())?,
        };
        let enter = || -> tauri::Result<()> {
            window.set_fullscreen(false)?;
            window.unmaximize()?;
            window.set_min_size(Some(tauri::LogicalSize::new(320.0, 180.0)))?;
            window.set_decorations(false)?;
            window.set_always_on_top(true)?;
            window.set_size(tauri::LogicalSize::new(560.0, 315.0))?;
            Ok(())
        };
        if let Err(error) = enter() {
            let _ = restore(&window, &geometry);
            return Err(error.to_string());
        }
        *saved = Some(geometry);
    } else if let Some(geometry) = saved.as_ref() {
        restore(&window, geometry).map_err(|e| e.to_string())?;
        *saved = None;
    }
    Ok(())
}
