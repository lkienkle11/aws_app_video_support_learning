use serde_json::{json, Value};
use std::io::{self, BufRead, Write};
fn main() {
    let mut service = cloud_study::service::Service::default();
    let stdin = io::stdin();
    let mut stdout = io::stdout().lock();
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        let result = serde_json::from_str::<Value>(&line)
            .map_err(|e| e.to_string())
            .and_then(|request| {
                service.dispatch(
                    request["command"].as_str().ok_or("Missing command")?,
                    request["args"].clone(),
                )
            });
        let response = match result {
            Ok(value) => json!({"ok":value}),
            Err(error) => json!({"error":error}),
        };
        if writeln!(stdout, "{response}")
            .and_then(|_| stdout.flush())
            .is_err()
        {
            break;
        }
    }
}
