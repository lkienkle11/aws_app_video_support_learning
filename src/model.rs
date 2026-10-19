use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

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
