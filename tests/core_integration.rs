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
    let settings = json!({"size":32.0,"x":0.3,"y":0.7,"color":"#ffffff","background":"#000000","opacity":0.65,"background_opacity":0.0,"background_width":0.0,"background_height":0.0});
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
    let settings = json!({"size":32.0,"x":0.3,"y":0.7,"color":"#12abef","background":"#743ac9","opacity":0.62,"background_opacity":0.35,"background_width":420.0,"background_height":96.0});
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
        ("size", json!(11)),
        ("size", json!(97)),
        ("background_width", json!(-1)),
        ("background_width", json!(3841)),
        ("background_height", json!(-1)),
        ("background_height", json!(2161)),
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
        assert_eq!(loaded["background_width"], 0.0);
        assert_eq!(loaded["background_height"], 0.0);
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

#[test]
fn search_filters_title_description_and_language() {
    let temp = tempfile::tempdir().unwrap();
    for (number, title, description) in [
        (1, "Security IAM", "Storage"),
        (2, "Compute", "Security IAM"),
    ] {
        let stem = format!("{number:03}-Test");
        fs::write(temp.path().join(format!("{stem}.mp4")), []).unwrap();
        let vi_title = if number == 1 {
            "Bảo mật IAM"
        } else {
            "Máy chủ"
        };
        let vi_description = if number == 1 {
            "Lưu trữ"
        } else {
            "Bảo mật IAM"
        };
        fs::write(temp.path().join(format!("{stem}.lesson.json")), json!({"texts":{"en":{"title":title,"description":description},"vi":{"title":vi_title,"description":vi_description}}}).to_string()).unwrap();
    }
    let mut service = Service::default();
    service
        .dispatch("open_library", json!({"path":temp.path()}))
        .unwrap();
    for (language, query) in [("en", "security"), ("vi", "bao mat"), ("", "IAM")] {
        for (field, numbers) in [
            ("all", vec![1, 2]),
            ("title", vec![1]),
            ("description", vec![2]),
        ] {
            let result = service
                .dispatch(
                    "search_lessons",
                    json!({"query":query,"language":language,"field":field}),
                )
                .unwrap();
            let actual: Vec<_> = result
                .as_array()
                .unwrap()
                .iter()
                .map(|lesson| lesson["number"].as_u64().unwrap())
                .collect();
            assert_eq!(actual, numbers, "{language}/{field}");
        }
    }
    assert_eq!(
        service
            .dispatch("search_lessons", json!({"query":"IAM","language":""}))
            .unwrap()
            .as_array()
            .unwrap()
            .len(),
        2
    );
    for field in ["all", "title", "description"] {
        assert_eq!(
            service
                .dispatch(
                    "search_lessons",
                    json!({"query":"","language":"","field":field})
                )
                .unwrap()
                .as_array()
                .unwrap()
                .len(),
            2
        );
        assert!(service
            .dispatch(
                "search_lessons",
                json!({"query":"security","language":"vi","field":field})
            )
            .unwrap()
            .as_array()
            .unwrap()
            .is_empty());
        assert!(service
            .dispatch(
                "search_lessons",
                json!({"query":"\" OR * title: compute","language":"en","field":field})
            )
            .unwrap()
            .as_array()
            .unwrap()
            .is_empty());
    }
    for invalid in [json!("title OR description"), json!(null), json!(17)] {
        assert!(service
            .dispatch(
                "search_lessons",
                json!({"query":"","language":"","field":invalid})
            )
            .is_err());
    }
}

#[test]
fn every_preference_survives_restart_and_libraries_are_isolated() {
    let first = tempfile::tempdir().unwrap();
    let second = tempfile::tempdir().unwrap();
    for root in [first.path(), second.path()] {
        for name in ["001-Test.mp4", "002-Test.mp4"] {
            fs::write(root.join(name), []).unwrap();
        }
    }
    let mut service = Service::default();
    service
        .dispatch("open_library", json!({"path":first.path()}))
        .unwrap();
    let db = rusqlite::Connection::open(first.path().join("cloud-study.sqlite")).unwrap();
    db.execute(
        "INSERT INTO preferences(key,value) VALUES ('playback','{\"autoplay\":false}')",
        [],
    )
    .unwrap();
    let legacy = service
        .dispatch("load_playback_settings", json!({}))
        .unwrap();
    assert_eq!(legacy["autoplay"], false);
    assert_eq!(legacy["volume"], 1.0);
    assert_eq!(legacy["audio_boost"], 1.0);
    let raw: String = db
        .query_row(
            "SELECT value FROM preferences WHERE key='playback'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(raw, "{\"autoplay\":false}");
    let playback = json!({"autoplay":false,"volume":0.4,"muted":true,"last_volume":0.6,"audio_boost":2.0,"speed":1.5,"repeat":true,"subtitle_language":"vi"});
    let workspace = json!({"locale":"en","display_language":"en","search_language":"vi","search_field":"description","query":"bao mat","chapter":"IAM","mode":"progress","theater":true,"active_tab":"notes","import_language":"ja","transcript_query":"policy"});
    for (command, value) in [
        ("save_playback_settings", playback.clone()),
        ("save_workspace_settings", workspace.clone()),
    ] {
        service
            .dispatch(command, json!({"settings":value}))
            .unwrap();
    }
    service
        .dispatch(
            "save_lesson_settings",
            json!({"id":"001-Test.mp4","settings":{"caption_offset":2.5}}),
        )
        .unwrap();
    service
        .dispatch(
            "save_lesson_settings",
            json!({"id":"002-Test.mp4","settings":{"caption_offset":-1.0}}),
        )
        .unwrap();
    drop(service);
    let mut reopened = Service::default();
    reopened
        .dispatch("open_library", json!({"path":first.path()}))
        .unwrap();
    assert_eq!(
        reopened
            .dispatch("load_playback_settings", json!({}))
            .unwrap(),
        playback
    );
    assert_eq!(
        reopened
            .dispatch("load_workspace_settings", json!({}))
            .unwrap(),
        workspace
    );
    assert_eq!(
        reopened
            .dispatch("load_lesson_settings", json!({"id":"001-Test.mp4"}))
            .unwrap()["caption_offset"],
        2.5
    );
    assert_eq!(
        reopened
            .dispatch("load_lesson_settings", json!({"id":"002-Test.mp4"}))
            .unwrap()["caption_offset"],
        -1.0
    );
    for (field, value) in [
        ("volume", json!(-0.1)),
        ("volume", json!(1.1)),
        ("last_volume", json!(0)),
        ("audio_boost", json!(3)),
        ("speed", json!(7)),
        ("subtitle_language", json!("<bad>")),
    ] {
        let mut invalid = playback.clone();
        invalid[field] = value;
        assert!(reopened
            .dispatch("save_playback_settings", json!({"settings":invalid}))
            .is_err());
    }
    for (field, value) in [
        ("locale", json!("ja")),
        ("search_field", json!("sql")),
        ("active_tab", json!("bad")),
        ("mode", json!("bad")),
        ("import_language", json!("../")),
    ] {
        let mut invalid = workspace.clone();
        invalid[field] = value;
        assert!(reopened
            .dispatch("save_workspace_settings", json!({"settings":invalid}))
            .is_err());
    }
    assert!(reopened
        .dispatch(
            "save_lesson_settings",
            json!({"id":"001-Test.mp4","settings":{"caption_offset":121}})
        )
        .is_err());
    assert!(reopened
        .dispatch("load_lesson_settings", json!({"id":"../outside.mp4"}))
        .is_err());
    reopened
        .dispatch("open_library", json!({"path":second.path()}))
        .unwrap();
    assert_eq!(
        reopened
            .dispatch("load_playback_settings", json!({}))
            .unwrap()["audio_boost"],
        1.0
    );
    assert_eq!(
        reopened
            .dispatch("load_workspace_settings", json!({}))
            .unwrap()["locale"],
        serde_json::Value::Null
    );
    assert_eq!(
        reopened
            .dispatch("load_lesson_settings", json!({"id":"001-Test.mp4"}))
            .unwrap()["caption_offset"],
        0.0
    );
    reopened
        .dispatch("open_library", json!({"path":first.path()}))
        .unwrap();
    assert_eq!(
        reopened
            .dispatch("load_playback_settings", json!({}))
            .unwrap(),
        playback
    );
    assert_eq!(
        reopened
            .dispatch("load_workspace_settings", json!({}))
            .unwrap(),
        workspace
    );
}
