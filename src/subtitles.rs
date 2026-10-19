/// SRT to WebVTT. Cue IDs may repeat in source archives; browsers accept them.
pub fn to_vtt(source: &str) -> String {
    let source = source.trim_start_matches('\u{feff}').replace("\r\n", "\n");
    if source.starts_with("WEBVTT") {
        return source;
    }
    let mut out = String::from("WEBVTT\n\n");
    for line in source.lines() {
        if line.contains(" --> ") {
            out.push_str(
                &line
                    .split_whitespace()
                    .map(|part| {
                        if part.contains(':') {
                            let normalized = part.replace(',', ".");
                            if let Some((clock, fraction)) = normalized.rsplit_once('.') {
                                format!("{clock}.{fraction:0<3}")
                            } else {
                                normalized
                            }
                        } else {
                            part.to_string()
                        }
                    })
                    .collect::<Vec<_>>()
                    .join(" "),
            );
        } else {
            out.push_str(line);
        }
        out.push('\n');
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn handles_bom_crlf_and_keeps_dialogue_commas() {
        let vtt = to_vtt("\u{feff}1\r\n00:00:01,100 --> 00:00:02,200\r\nHello, cloud!\r\n");
        assert!(vtt.contains("00:00:01.100 --> 00:00:02.200"));
        assert!(vtt.contains("Hello, cloud!"));
        assert_eq!(to_vtt(&vtt), vtt);
        assert!(to_vtt("1\n00:00:00,0 --> 00:00:10,0\nHello\n")
            .contains("00:00:00.000 --> 00:00:10.000"));
    }
}
