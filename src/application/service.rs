//! Headless backend: no WebView, UI framework, network listener or video decoder.
use crate::{
    domain::Result,
    domain::{LibraryInfo, Sidecar},
    infrastructure::{catalog, database, preferences},
    media::{container, subtitles},
};
use serde_json::{json, Value};
use std::{fs, path::PathBuf};

#[derive(Default)]
pub struct Service {
    root: Option<PathBuf>,
}
impl Service {
    pub fn dispatch(&mut self, command: &str, args: Value) -> Result<Value> {
        let string = |key: &str| -> Result<&str> {
            args[key].as_str().ok_or_else(|| format!("Missing {key}"))
        };
        if command == "open_library" {
            let path = PathBuf::from(string("path")?)
                .canonicalize()
                .map_err(|e| e.to_string())?;
            if !path.is_dir() {
                return Err("Choose a folder".into());
            }
            let lessons = catalog::scan(&path)?;
            if lessons.is_empty() {
                return Err("No videos found in this folder".into());
            }
            database::synchronize(&mut database::open(&path)?, &lessons)?;
            let info = LibraryInfo {
                root: path.to_string_lossy().into(),
                lessons: lessons.len(),
            };
            self.root = Some(path);
            return serde_json::to_value(info).map_err(|e| e.to_string());
        }
        let root = self.root.as_ref().ok_or("Choose your files folder first")?;
        match command {
            "load_caption_settings" => {
                serde_json::to_value(preferences::load_captions(&database::open(root)?)?)
                    .map_err(|e| e.to_string())
            }
            "save_caption_settings" => {
                let settings =
                    serde_json::from_value(args["settings"].clone()).map_err(|e| e.to_string())?;
                preferences::save_captions(&database::open(root)?, &settings)?;
                Ok(Value::Null)
            }
            "search_lessons" => serde_json::to_value(database::search(
                &database::open(root)?,
                string("query")?,
                string("language")?,
            )?)
            .map_err(|e| e.to_string()),
            "media_path" => {
                let path = catalog::safe_path(root, string("relative")?)?;
                container::check_mp4(&path)?;
                Ok(json!(path.to_string_lossy()))
            }
            "read_subtitle" => {
                let path = catalog::safe_path(root, string("relative")?)?;
                if !matches!(
                    path.extension().and_then(|e| e.to_str()),
                    Some("srt" | "vtt")
                ) {
                    return Err("Expected SRT or VTT".into());
                }
                if path.metadata().map_err(|e| e.to_string())?.len() > 10_000_000 {
                    return Err("Subtitle exceeds 10 MB".into());
                }
                Ok(json!(subtitles::to_vtt(
                    &fs::read_to_string(path).map_err(|e| e.to_string())?
                )))
            }
            "save_progress" => {
                let id = string("id")?;
                catalog::safe_path(root, id)?;
                database::save_progress(
                    &database::open(root)?,
                    id,
                    args["position"].as_f64().ok_or("Invalid position")?,
                    args["duration"].as_f64().ok_or("Invalid duration")?,
                    args["completed"].as_bool().ok_or("Invalid completion")?,
                    string("notes")?,
                )?;
                Ok(Value::Null)
            }
            "save_metadata" => {
                let video = catalog::safe_path(root, string("id")?)?;
                let metadata: Sidecar =
                    serde_json::from_value(args["metadata"].clone()).map_err(|e| e.to_string())?;
                let target = video.with_extension("lesson.json");
                let mut document: Value = if target.exists() {
                    serde_json::from_str(&fs::read_to_string(&target).map_err(|e| e.to_string())?)
                        .map_err(|e| e.to_string())?
                } else {
                    json!({})
                };
                for (key, value) in serde_json::to_value(metadata)
                    .map_err(|e| e.to_string())?
                    .as_object()
                    .ok_or("Invalid metadata")?
                {
                    document[key] = value.clone();
                }
                let json = serde_json::to_string_pretty(&document).map_err(|e| e.to_string())?;
                let pending = video.with_extension("lesson.json.pending");
                fs::write(&pending, json).map_err(|e| e.to_string())?;
                fs::rename(pending, target).map_err(|e| e.to_string())?;
                database::synchronize(&mut database::open(root)?, &catalog::scan(root)?)?;
                Ok(Value::Null)
            }
            "import_subtitle" => {
                let language = string("language")?;
                if !catalog::valid_language(language) {
                    return Err("Use a language code such as vi, en or ja".into());
                }
                let video = catalog::safe_path(root, string("id")?)?;
                let source = PathBuf::from(string("source")?);
                let ext = source.extension().and_then(|e| e.to_str()).unwrap_or("");
                if !matches!(ext, "srt" | "vtt") {
                    return Err("Select an SRT or VTT file".into());
                }
                if source.metadata().map_err(|e| e.to_string())?.len() > 10_000_000 {
                    return Err("Subtitle exceeds 10 MB".into());
                }
                let mut input = fs::File::open(&source).map_err(|e| e.to_string())?;
                let target = video.with_extension(format!("{language}.{ext}"));
                let mut output = fs::OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(target)
                    .map_err(|e| e.to_string())?;
                std::io::copy(&mut input, &mut output).map_err(|e| e.to_string())?;
                database::synchronize(&mut database::open(root)?, &catalog::scan(root)?)?;
                Ok(Value::Null)
            }
            _ => Err("Unknown backend command".into()),
        }
    }
}
