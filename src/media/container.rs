//! Identify a known source-container mismatch before passing a URL to WebView.
use crate::domain::Result;
use std::{fs::File, io::Read, path::Path};

pub fn check_mp4(path: &Path) -> Result<()> {
    if !path
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("mp4"))
    {
        return Ok(());
    }
    let mut header = [0; 4];
    let length = File::open(path)
        .and_then(|mut file| file.read(&mut header))
        .map_err(|e| e.to_string())?;
    if length == 4 && header == [0x1a, 0x45, 0xdf, 0xa3] {
        return Err("Tệp mang đuôi .mp4 nhưng nội dung là Matroska/MKV. Cần chuẩn hóa thư viện sang MP4 thật trước khi phát; đây không phải lỗi thiếu codec. Xem docs/RUNNING.md.".into());
    }
    Ok(())
}
