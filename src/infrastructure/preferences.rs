use crate::domain::{CaptionSettings, LessonSettings, PlaybackSettings, Result, WorkspaceSettings};
use rusqlite::{params, Connection, OptionalExtension};

pub fn load_captions(db: &Connection) -> Result<CaptionSettings> {
    let value: Option<String> = db
        .query_row(
            "SELECT value FROM preferences WHERE key='captions'",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let mut settings: CaptionSettings = value
        .map(|value| serde_json::from_str(&value).map_err(|e| e.to_string()))
        .unwrap_or_else(|| Ok(CaptionSettings::default()))?;
    normalize_captions(&mut settings);
    validate_captions(&settings)?;
    Ok(settings)
}

// Older versions stored two named colors and a precomposed background alpha.
// Normalize in memory; loading a library never overwrites its preferences.
fn normalize_captions(value: &mut CaptionSettings) {
    if value.color == "white" {
        value.color = "#ffffff".into();
    }
    if value.background == "rgba(0,0,0,.8)" {
        value.background = "#000000".into();
        value.background_opacity = 0.8;
    } else if value.background == "transparent" {
        value.background = "#000000".into();
        value.background_opacity = 0.0;
    }
}

fn valid_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit)
}

fn validate_captions(value: &CaptionSettings) -> Result<()> {
    if !value.size.is_finite()
        || !(12.0..=96.0).contains(&value.size)
        || !value.x.is_finite()
        || !(0.0..=1.0).contains(&value.x)
        || !value.y.is_finite()
        || !(0.0..=1.0).contains(&value.y)
        || !valid_color(&value.color)
        || !valid_color(&value.background)
        || !value.background_width.is_finite()
        || !(0.0..=3840.0).contains(&value.background_width)
        || !value.background_height.is_finite()
        || !(0.0..=2160.0).contains(&value.background_height)
        || !value.opacity.is_finite()
        || !(0.0..=1.0).contains(&value.opacity)
        || !value.background_opacity.is_finite()
        || !(0.0..=1.0).contains(&value.background_opacity)
    {
        return Err("Invalid caption settings".into());
    }
    Ok(())
}

pub fn save_captions(db: &Connection, value: &CaptionSettings) -> Result<()> {
    let mut value = value.clone();
    normalize_captions(&mut value);
    validate_captions(&value)?;
    db.execute("INSERT INTO preferences(key,value) VALUES ('captions',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        params![serde_json::to_string(&value).map_err(|e| e.to_string())?]).map_err(|e| e.to_string())?;
    Ok(())
}

fn load<T: serde::de::DeserializeOwned + Default>(db: &Connection, key: &str) -> Result<T> {
    let value: Option<String> = db
        .query_row("SELECT value FROM preferences WHERE key=?1", [key], |row| {
            row.get(0)
        })
        .optional()
        .map_err(|e| e.to_string())?;
    value
        .map(|value| serde_json::from_str(&value).map_err(|e| e.to_string()))
        .unwrap_or_else(|| Ok(T::default()))
}
fn save<T: serde::Serialize>(db: &Connection, key: &str, value: &T) -> Result<()> {
    db.execute("INSERT INTO preferences(key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value", params![key,serde_json::to_string(value).map_err(|e|e.to_string())?]).map_err(|e|e.to_string())?;
    Ok(())
}
fn language(value: &str) -> bool {
    crate::infrastructure::catalog::valid_language(value)
}
fn validate_playback(value: &PlaybackSettings) -> Result<()> {
    if !value.volume.is_finite()
        || !(0.0..=1.0).contains(&value.volume)
        || !value.last_volume.is_finite()
        || !(0.0..=1.0).contains(&value.last_volume)
        || value.last_volume == 0.0
        || ![1.0, 1.5, 2.0].contains(&value.audio_boost)
        || ![0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].contains(&value.speed)
        || !(matches!(value.subtitle_language.as_str(), "auto" | "off")
            || language(&value.subtitle_language))
    {
        return Err("Invalid playback settings".into());
    }
    Ok(())
}
pub fn load_playback(db: &Connection) -> Result<PlaybackSettings> {
    let value = load(db, "playback")?;
    validate_playback(&value)?;
    Ok(value)
}
pub fn save_playback(db: &Connection, value: &PlaybackSettings) -> Result<()> {
    validate_playback(value)?;
    save(db, "playback", value)
}
fn validate_workspace(value: &WorkspaceSettings) -> Result<()> {
    if value
        .locale
        .as_ref()
        .is_some_and(|s| !matches!(s.as_str(), "vi" | "en"))
        || !language(&value.display_language)
        || (!value.search_language.is_empty() && !language(&value.search_language))
        || !language(&value.import_language)
        || !matches!(value.search_field.as_str(), "all" | "title" | "description")
        || !matches!(value.mode.as_str(), "all" | "progress" | "completed")
        || !matches!(
            value.active_tab.as_str(),
            "description" | "transcript" | "notes"
        )
        || value.query.len() > 8192
        || value.chapter.len() > 8192
        || value.transcript_query.len() > 8192
    {
        return Err("Invalid workspace settings".into());
    }
    Ok(())
}
pub fn load_workspace(db: &Connection) -> Result<WorkspaceSettings> {
    let value = load(db, "workspace")?;
    validate_workspace(&value)?;
    Ok(value)
}
pub fn save_workspace(db: &Connection, value: &WorkspaceSettings) -> Result<()> {
    validate_workspace(value)?;
    save(db, "workspace", value)
}
fn validate_lesson(value: &LessonSettings) -> Result<()> {
    if !value.caption_offset.is_finite() || !(-120.0..=120.0).contains(&value.caption_offset) {
        return Err("Invalid lesson settings".into());
    }
    Ok(())
}
pub fn load_lesson(db: &Connection, id: &str) -> Result<LessonSettings> {
    let value = load(db, &format!("lesson:{id}"))?;
    validate_lesson(&value)?;
    Ok(value)
}
pub fn save_lesson(db: &Connection, id: &str, value: &LessonSettings) -> Result<()> {
    validate_lesson(value)?;
    save(db, &format!("lesson:{id}"), value)
}
