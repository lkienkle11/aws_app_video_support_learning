use crate::domain::{CaptionSettings, PlaybackSettings, Result};
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
        || !(12.0..=64.0).contains(&value.size)
        || !value.x.is_finite()
        || !(0.0..=1.0).contains(&value.x)
        || !value.y.is_finite()
        || !(0.0..=1.0).contains(&value.y)
        || !valid_color(&value.color)
        || !valid_color(&value.background)
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

pub fn load_playback(db: &Connection) -> Result<PlaybackSettings> {
    let value: Option<String> = db
        .query_row(
            "SELECT value FROM preferences WHERE key='playback'",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    value
        .map(|value| serde_json::from_str(&value).map_err(|e| e.to_string()))
        .unwrap_or_else(|| Ok(PlaybackSettings::default()))
}
pub fn save_playback(db: &Connection, value: &PlaybackSettings) -> Result<()> {
    db.execute("INSERT INTO preferences(key,value) VALUES ('playback',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value", params![serde_json::to_string(value).map_err(|e| e.to_string())?]).map_err(|e| e.to_string())?;
    Ok(())
}
