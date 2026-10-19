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
    value
        .map(|value| serde_json::from_str(&value).map_err(|e| e.to_string()))
        .unwrap_or_else(|| Ok(CaptionSettings::default()))
}

pub fn save_captions(db: &Connection, value: &CaptionSettings) -> Result<()> {
    if !value.size.is_finite()
        || !(12.0..=64.0).contains(&value.size)
        || !value.x.is_finite()
        || !(0.0..=1.0).contains(&value.x)
        || !value.y.is_finite()
        || !(0.0..=1.0).contains(&value.y)
        || !["white", "#ffe56a"].contains(&value.color.as_str())
        || !["rgba(0,0,0,.8)", "transparent"].contains(&value.background.as_str())
    {
        return Err("Invalid caption settings".into());
    }
    db.execute("INSERT INTO preferences(key,value) VALUES ('captions',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        params![serde_json::to_string(value).map_err(|e| e.to_string())?]).map_err(|e| e.to_string())?;
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
