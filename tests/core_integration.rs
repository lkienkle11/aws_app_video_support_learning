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
    let defaults = service
        .dispatch("load_caption_settings", json!({}))
        .unwrap();
    assert_eq!(defaults["x"], 0.5);
    let settings = json!({"size":32.0,"x":0.3,"y":0.7,"color":"white","background":"transparent"});
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
