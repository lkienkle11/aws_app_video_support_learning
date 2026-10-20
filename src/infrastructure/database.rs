use crate::domain::{Lesson, Result};
use rusqlite::{params, Connection};
use std::path::Path;
use unicode_normalization::{char::is_combining_mark, UnicodeNormalization};

fn fold(text: &str) -> String {
    text.nfd()
        .filter(|c| !is_combining_mark(*c))
        .map(|c| match c {
            'đ' => 'd',
            'Đ' => 'D',
            other => other,
        })
        .collect()
}

pub fn open(root: &Path) -> Result<Connection> {
    let db = Connection::open(root.join("cloud-study.sqlite")).map_err(|e| e.to_string())?;
    db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA cache_size=-1024;
        CREATE TABLE IF NOT EXISTS lessons(id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS progress(id TEXT PRIMARY KEY, position REAL NOT NULL DEFAULT 0, duration REAL NOT NULL DEFAULT 0, completed INTEGER NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '');
        CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5(id UNINDEXED, language UNINDEXED, title, description, tokenize='unicode61 remove_diacritics 2');
        CREATE TABLE IF NOT EXISTS preferences(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        PRAGMA user_version=2;").map_err(|e| e.to_string())?;
    Ok(db)
}
pub fn synchronize(db: &mut Connection, lessons: &[Lesson]) -> Result<()> {
    let tx = db.transaction().map_err(|e| e.to_string())?;
    tx.execute_batch("DELETE FROM lessons; DELETE FROM search;")
        .map_err(|e| e.to_string())?;
    for lesson in lessons {
        tx.execute(
            "INSERT INTO lessons VALUES (?1,?2)",
            params![
                lesson.id,
                serde_json::to_string(lesson).map_err(|e| e.to_string())?
            ],
        )
        .map_err(|e| e.to_string())?;
        for (lang, text) in &lesson.texts {
            tx.execute(
                "INSERT INTO search(id,language,title,description) VALUES (?1,?2,?3,?4)",
                params![lesson.id, lang, fold(&text.title), fold(&text.description)],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    tx.commit().map_err(|e| e.to_string())
}
pub fn search(db: &Connection, query: &str, language: &str, field: &str) -> Result<Vec<Lesson>> {
    // Quoted tokens prevent FTS operators, malformed quotes and SQL injection.
    let folded = fold(query);
    let tokens: Vec<_> = folded
        .split(|c: char| !c.is_alphanumeric())
        .filter(|s| !s.is_empty())
        .map(|s| format!("\"{s}\"*"))
        .collect();
    let terms = tokens.join(" AND ");
    let column = match field {
        "all" => "",
        "title" => "title",
        "description" => "description",
        _ => return Err("Invalid search field".into()),
    };
    let fts = if terms.is_empty() || column.is_empty() {
        terms
    } else {
        format!("{column} : ({terms})")
    };
    let mut stmt = db.prepare("SELECT l.data,coalesce(p.position,0),coalesce(p.duration,0),coalesce(p.completed,0),coalesce(p.notes,'') FROM lessons l LEFT JOIN progress p ON p.id=l.id WHERE (?1='' OR l.id IN (SELECT id FROM search WHERE search MATCH ?1 AND (?2='' OR language=?2))) ORDER BY l.id").map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query(params![fts, language])
        .map_err(|e| e.to_string())?;
    let mut lessons = Vec::new();
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let json: String = row.get(0).map_err(|e| e.to_string())?;
        let mut lesson: Lesson = serde_json::from_str(&json).map_err(|e| e.to_string())?;
        lesson.position = row.get(1).map_err(|e| e.to_string())?;
        let saved_duration: f64 = row.get(2).map_err(|e| e.to_string())?;
        if saved_duration > 0.0 {
            lesson.duration = saved_duration;
        }
        lesson.completed = row.get(3).map_err(|e| e.to_string())?;
        lesson.notes = row.get(4).map_err(|e| e.to_string())?;
        lessons.push(lesson);
    }
    lessons.sort_by_key(|l| l.number);
    Ok(lessons)
}
pub fn save_progress(
    db: &Connection,
    id: &str,
    position: f64,
    duration: f64,
    completed: bool,
    notes: &str,
) -> Result<()> {
    if !position.is_finite() || !duration.is_finite() || position < 0.0 || duration < 0.0 {
        return Err("Invalid playback position".into());
    }
    db.execute("INSERT INTO progress(id,position,duration,completed,notes) VALUES (?1,?2,?3,?4,?5) ON CONFLICT(id) DO UPDATE SET position=excluded.position,duration=excluded.duration,completed=excluded.completed,notes=excluded.notes", params![id, position, duration, completed, notes]).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{Lesson, LocalizedText};
    #[test]
    fn bilingual_search_and_progress_survive_rescan() {
        let dir = tempfile::tempdir().unwrap();
        let mut db = open(dir.path()).unwrap();
        let lesson = Lesson {
            id: "001.mp4".into(),
            number: 1,
            chapter: "Security".into(),
            video: "001.mp4".into(),
            texts: [
                (
                    "en".into(),
                    LocalizedText {
                        title: "Identity access".into(),
                        description: "Manage permissions".into(),
                    },
                ),
                (
                    "vi".into(),
                    LocalizedText {
                        title: "Quản lý quyền".into(),
                        description: "Bảo mật tài khoản".into(),
                    },
                ),
            ]
            .into(),
            tracks: vec![],
            position: 0.0,
            duration: 0.0,
            completed: false,
            notes: String::new(),
        };
        synchronize(&mut db, std::slice::from_ref(&lesson)).unwrap();
        assert_eq!(search(&db, "bao mat", "vi", "all").unwrap().len(), 1);
        assert!(search(&db, "permissions", "vi", "all").unwrap().is_empty());
        assert_eq!(search(&db, "permissions", "en", "all").unwrap().len(), 1);
        assert!(search(&db, "\" OR drop-table", "en", "all")
            .unwrap()
            .is_empty());
        save_progress(&db, "001.mp4", 32.0, 120.0, true, "Remember IAM").unwrap();
        synchronize(&mut db, &[lesson]).unwrap();
        let result = search(&db, "", "", "all").unwrap();
        assert_eq!(result[0].position, 32.0);
        assert!(result[0].completed);
        assert_eq!(result[0].notes, "Remember IAM");
    }
}
