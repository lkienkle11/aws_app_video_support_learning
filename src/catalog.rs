use crate::model::{Lesson, LocalizedText, Sidecar, Track};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};
use walkdir::WalkDir;

pub type Result<T> = std::result::Result<T, String>;

pub fn safe_path(root: &Path, relative: &str) -> Result<PathBuf> {
    let path = root
        .join(relative)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    if !path.starts_with(root) {
        return Err("Path is outside the library".into());
    }
    Ok(path)
}

pub fn scan(root: &Path) -> Result<Vec<Lesson>> {
    let mut lessons = Vec::new();
    for entry in WalkDir::new(root).follow_links(false) {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !entry.file_type().is_file()
            || !matches!(
                path.extension().and_then(|e| e.to_str()),
                Some("mp4" | "webm" | "m4v" | "mov")
            )
        {
            continue;
        }
        let stem = path.file_stem().unwrap().to_string_lossy();
        let relative = path
            .strip_prefix(root)
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        let sidecar_path = path.with_extension("lesson.json");
        let mut sidecar: Sidecar = if sidecar_path.exists() {
            serde_json::from_str(&fs::read_to_string(&sidecar_path).map_err(|e| e.to_string())?)
                .map_err(|e| format!("{}: {e}", sidecar_path.display()))?
        } else {
            Sidecar::default()
        };
        let parts: Vec<_> = stem.split('-').collect();
        let title = if parts.len() >= 4 {
            parts[1..parts.len() - 2].join("-")
        } else {
            stem.to_string()
        };
        sidecar.texts.entry("en".into()).or_insert(LocalizedText {
            title,
            description: "Add a lesson description in the lesson editor.".into(),
        });
        let mut tracks = Vec::new();
        for ext in ["srt", "vtt"] {
            let sibling = path.with_extension(ext);
            if sibling.exists() {
                tracks.push(track(root, &sibling, "en")?);
            }
        }
        // Named tracks: video-stem.vi.srt, video-stem.ja.vtt, etc.
        for sibling in fs::read_dir(path.parent().unwrap()).map_err(|e| e.to_string())? {
            let sibling = sibling.map_err(|e| e.to_string())?.path();
            let name = sibling.file_name().unwrap_or_default().to_string_lossy();
            let prefix = format!("{stem}.");
            if let Some(suffix) = name.strip_prefix(&prefix) {
                if let Some((lang, ext)) = suffix.rsplit_once('.') {
                    if matches!(ext, "srt" | "vtt") && valid_language(lang) {
                        tracks.push(track(root, &sibling, lang)?);
                    }
                }
            }
        }
        lessons.push(Lesson {
            id: relative.clone(),
            number: parts[0].parse().unwrap_or(0),
            chapter: sidecar.chapter,
            video: relative,
            texts: sidecar.texts,
            tracks,
            position: 0.0,
            duration: sidecar.duration,
            completed: false,
            notes: String::new(),
        });
    }
    lessons.sort_by(|a, b| a.number.cmp(&b.number).then(a.id.cmp(&b.id)));
    Ok(lessons)
}
fn track(root: &Path, path: &Path, language: &str) -> Result<Track> {
    let labels: BTreeMap<_, _> = [
        ("en", "English"),
        ("vi", "Tiếng Việt"),
        ("ja", "日本語"),
        ("zh", "中文"),
        ("ko", "한국어"),
        ("fr", "Français"),
        ("es", "Español"),
    ]
    .into();
    Ok(Track {
        language: language.into(),
        label: labels.get(language).unwrap_or(&language).to_string(),
        path: path
            .strip_prefix(root)
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .replace('\\', "/"),
    })
}
pub fn valid_language(lang: &str) -> bool {
    !lang.is_empty()
        && lang.len() <= 20
        && lang.chars().all(|c| c.is_ascii_alphabetic() || c == '-')
}
