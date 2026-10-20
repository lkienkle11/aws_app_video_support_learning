use cloud_study::application::Service;
use serde_json::json;
use std::fs;

#[test]
fn library_paths_subtitles_and_edits_are_validated() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join("files");
    fs::create_dir(&root).unwrap();
    fs::write(root.join("001-Test-abcd-git.ir.mp4"), []).unwrap();
    fs::write(
        root.join("001-Test-abcd-git.ir.srt"),
        "1\n00:00:01,100 --> 00:00:02,200\nHello, cloud\n",
    )
    .unwrap();
    fs::write(temp.path().join("outside.srt"), "SECRET").unwrap();
    let mut service = Service::default();
    let info = service
        .dispatch("open_library", json!({"path":root}))
        .unwrap();
    assert_eq!(info["lessons"], 1);
    let video = root.join("001-Test-abcd-git.ir.mp4");
    fs::write(&video, [0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]).unwrap();
    let error = service
        .dispatch("media_path", json!({"relative":"001-Test-abcd-git.ir.mp4"}))
        .unwrap_err();
    assert!(error.contains("Matroska/MKV"));
    fs::write(&video, b"\x00\x00\x00\x18ftypisom").unwrap();
    assert!(service
        .dispatch("media_path", json!({"relative":"001-Test-abcd-git.ir.mp4"}))
        .is_ok());
    let defaults = service
        .dispatch("load_caption_settings", json!({}))
        .unwrap();
    assert_eq!(defaults["x"], 0.5);
    let settings = json!({"size":32.0,"x":0.3,"y":0.7,"color":"#ffffff","background":"#000000","opacity":0.65,"background_opacity":0.0});
    service
        .dispatch("save_caption_settings", json!({"settings":settings}))
        .unwrap();
    let mut reopened = Service::default();
    reopened
        .dispatch("open_library", json!({"path":root}))
        .unwrap();
    assert_eq!(
        reopened
            .dispatch("load_caption_settings", json!({}))
            .unwrap(),
        settings
    );
    assert!(service
        .dispatch(
            "save_caption_settings",
            json!({"settings":{"size":800,"x":0,"y":0}})
        )
        .is_err());
    let lessons = service
        .dispatch("search_lessons", json!({"query":"","language":""}))
        .unwrap();
    assert_eq!(lessons[0]["tracks"][0]["language"], "en");
    assert!(service
        .dispatch("media_path", json!({"relative":"../outside.srt"}))
        .is_err());
    assert!(service
        .dispatch(
            "read_subtitle",
            json!({"relative":"001-Test-abcd-git.ir.mp4"})
        )
        .is_err());
    let text = service
        .dispatch(
            "read_subtitle",
            json!({"relative":"001-Test-abcd-git.ir.srt"}),
        )
        .unwrap();
    assert!(text.as_str().unwrap().starts_with("WEBVTT"));
    service.dispatch("save_metadata",json!({"id":"001-Test-abcd-git.ir.mp4", "metadata":{"chapter":"IAM", "texts":{"vi":{"title":"Danh tính", "description":"Bảo mật tài khoản"}}}})).unwrap();
    let found = service
        .dispatch("search_lessons", json!({"query":"bao mat","language":"vi"}))
        .unwrap();
    assert_eq!(found.as_array().unwrap().len(), 1);
    service.dispatch("import_subtitle",json!({"id":"001-Test-abcd-git.ir.mp4","source":temp.path().join("outside.srt"),"language":"vi"})).unwrap();
    assert!(service.dispatch("import_subtitle",json!({"id":"001-Test-abcd-git.ir.mp4","source":temp.path().join("outside.srt"),"language":"vi"})).is_err());
    assert!(service.dispatch("import_subtitle",json!({"id":"001-Test-abcd-git.ir.mp4","source":temp.path().join("outside.srt"),"language":"../bad"})).is_err());
}

#[test]
fn progress_notes_and_autoplay_survive_service_restart_and_rescan() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path();
    fs::write(root.join("001-First.mp4"), b"\x00\x00\x00\x18ftypisom").unwrap();
    fs::write(root.join("002-Second.mp4"), b"\x00\x00\x00\x18ftypisom").unwrap();
    let mut service = Service::default();
    service
        .dispatch("open_library", json!({"path":root}))
        .unwrap();
    assert_eq!(
        service
            .dispatch("load_playback_settings", json!({}))
            .unwrap()["autoplay"],
        true
    );
    service
        .dispatch(
            "save_playback_settings",
            json!({"settings":{"autoplay":false}}),
        )
        .unwrap();
    assert!(service
        .dispatch(
            "save_playback_settings",
            json!({"settings":{"autoplay":"false"}})
        )
        .is_err());
    service.dispatch("save_progress", json!({"id":"001-First.mp4","position":32.25,"duration":100,"completed":false,"notes":"Ghi chú"})).unwrap();
    drop(service);
    let mut reopened = Service::default();
    reopened
        .dispatch("open_library", json!({"path":root}))
        .unwrap();
    let lessons = reopened
        .dispatch("search_lessons", json!({"query":"","language":""}))
        .unwrap();
    assert_eq!(lessons[0]["position"], 32.25);
    assert_eq!(lessons[0]["completed"], false);
    assert_eq!(lessons[0]["notes"], "Ghi chú");
    assert_eq!(
        reopened
            .dispatch("load_playback_settings", json!({}))
            .unwrap()["autoplay"],
        false
    );
    reopened.dispatch("save_progress", json!({"id":"001-First.mp4","position":0,"duration":100,"completed":true,"notes":"Ghi chú"})).unwrap();
    reopened
        .dispatch("open_library", json!({"path":root}))
        .unwrap();
    let lessons = reopened
        .dispatch("search_lessons", json!({"query":"","language":""}))
        .unwrap();
    assert_eq!(lessons[0]["position"], 0.0);
    assert_eq!(lessons[0]["completed"], true);
    assert_eq!(lessons[0]["notes"], "Ghi chú");
}

#[test]
fn caption_colors_and_independent_opacities_survive_restart() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path();
    fs::write(root.join("001-Test.mp4"), []).unwrap();
    let mut service = Service::default();
    service
        .dispatch("open_library", json!({"path":root}))
        .unwrap();
    let defaults = service
        .dispatch("load_caption_settings", json!({}))
        .unwrap();
    assert_eq!(defaults["color"], "#ffffff");
    assert_eq!(defaults["background"], "#000000");
    assert_eq!(defaults["opacity"], 1.0);
    assert_eq!(defaults["background_opacity"], 1.0);
    let settings = json!({"size":32.0,"x":0.3,"y":0.7,"color":"#12abef","background":"#743ac9","opacity":0.62,"background_opacity":0.35});
    service
        .dispatch("save_caption_settings", json!({"settings":settings}))
        .unwrap();
    drop(service);
    let mut reopened = Service::default();
    reopened
        .dispatch("open_library", json!({"path":root}))
        .unwrap();
    assert_eq!(
        reopened
            .dispatch("load_caption_settings", json!({}))
            .unwrap(),
        settings
    );
    for (key, value) in [
        ("opacity", json!(-0.01)),
        ("opacity", json!(1.01)),
        ("background_opacity", json!(-1)),
        ("background_opacity", json!(2)),
        ("color", json!("red; background:url(x)")),
        ("color", json!("#fff")),
        ("background", json!("#gg0000")),
        ("background", json!("url(x)")),
    ] {
        let mut invalid = settings.clone();
        invalid[key] = value;
        assert!(reopened
            .dispatch("save_caption_settings", json!({"settings":invalid}))
            .is_err());
    }
    assert_eq!(
        reopened
            .dispatch("load_caption_settings", json!({}))
            .unwrap(),
        settings
    );
    let db = rusqlite::Connection::open(root.join("cloud-study.sqlite")).unwrap();
    for (old_color, old_background, alpha) in [
        ("white", "rgba(0,0,0,.8)", 0.8),
        ("#ffe56a", "transparent", 0.0),
    ] {
        let legacy =
            json!({"size":40,"x":0.25,"y":0.6,"color":old_color,"background":old_background});
        db.execute(
            "UPDATE preferences SET value=?1 WHERE key='captions'",
            [legacy.to_string()],
        )
        .unwrap();
        let loaded = reopened
            .dispatch("load_caption_settings", json!({}))
            .unwrap();
        assert_eq!(
            loaded["color"],
            if old_color == "white" {
                "#ffffff"
            } else {
                old_color
            }
        );
        assert_eq!(loaded["background"], "#000000");
        assert_eq!(loaded["background_opacity"], alpha);
        assert_eq!(loaded["opacity"], 1.0);
        assert_eq!(loaded["size"], 40.0);
        assert_eq!(loaded["x"], 0.25);
        assert_eq!(loaded["y"], 0.6);
        let stored: String = db
            .query_row(
                "SELECT value FROM preferences WHERE key='captions'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&stored).unwrap(),
            legacy
        );
    }
}
