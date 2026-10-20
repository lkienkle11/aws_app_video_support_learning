use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct CaptionSettings {
    pub size: f64,
    pub x: f64,
    pub y: f64,
    pub color: String,
    pub background: String,
    pub opacity: f64,
    pub background_opacity: f64,
    pub background_width: f64,
    pub background_height: f64,
}
impl Default for CaptionSettings {
    fn default() -> Self {
        Self {
            size: 24.0,
            x: 0.5,
            y: 0.0,
            color: "#ffffff".into(),
            background: "#000000".into(),
            opacity: 1.0,
            background_opacity: 1.0,
            background_width: 0.0,
            background_height: 0.0,
        }
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct LocalizedText {
    pub title: String,
    pub description: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Track {
    pub language: String,
    pub label: String,
    pub path: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Lesson {
    pub id: String,
    pub number: u32,
    pub chapter: String,
    pub video: String,
    pub texts: BTreeMap<String, LocalizedText>,
    pub tracks: Vec<Track>,
    pub position: f64,
    pub duration: f64,
    pub completed: bool,
    pub notes: String,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Sidecar {
    #[serde(default)]
    pub duration: f64,
    #[serde(default)]
    pub chapter: String,
    #[serde(default)]
    pub texts: BTreeMap<String, LocalizedText>,
}
#[derive(Serialize)]
pub struct LibraryInfo {
    pub root: String,
    pub lessons: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct PlaybackSettings {
    pub autoplay: bool,
}
impl Default for PlaybackSettings {
    fn default() -> Self {
        Self { autoplay: true }
    }
}
