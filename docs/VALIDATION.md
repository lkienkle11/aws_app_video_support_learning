# Kiểm tra thực tế

Ngày 2026-10-19, máy build macOS ARM64.

## Dữ liệu

- Ba ZIP nguồn đã extract và CRC-check trước khi xóa; ZIP bài tập lồng bên trong cũng đã extract, kiểm tra và xóa.
- 277 video H.264/AAC, toàn bộ 1920×1080; 278 SRT; 5 tài liệu bài tập.
- 277 sidecar mô tả Anh/Việt, 277 ảnh preview và 277 sprite tua 12 mốc.
- 21 chương, tổng 52.190,5 giây (khoảng 14,5 giờ).
- SQLite ở `files/cloud-study.sqlite`; toàn bộ `files/`, `.sqlite`, `target/`, `dist/`, `tools/`, `.codegraph/` bị Git bỏ qua.

## Build và ngân sách

| Bản | Dung lượng toàn gói chưa nén | Kết quả |
| --- | ---: | --- |
| macOS ARM64 .app | 5.029.120 byte | <20.000.000 |
| Windows x64 portable, gồm README | 4.867.346 byte | <20.000.000 |
| Linux ARM64 portable, gồm README | 5.137.327 byte | <20.000.000 |

Số đo tính cả executable core đi cùng. Không tính video hoặc WebView của hệ điều hành. Không đóng gói thêm Electron/Chromium, ffmpeg hay Node.

Backend macOS: RSS lấy mẫu cao nhất 17.350.656 byte khi quét toàn bộ thư viện, tìm kiếm song ngữ, đọc mọi phụ đề và lặp 30 lần tìm kiếm. Backend Linux trong Debian bookworm ARM64 container: 6.025.216 byte. Xem báo cáo JSON tương ứng.

Nhóm GUI macOS gồm host Rust/Tauri cộng tất cả WebKit WebContent/GPU/Networking đang chạy: RSS lấy mẫu cao nhất 178.176.000 byte trong 40 mẫu/10 giây lúc phát video. Bộ nhớ dùng chung có thể bị cộng hai lần; nếu có WebKit của app khác, phép đo này cũng cộng vào để tránh bỏ sót. Đây là đo workload cụ thể, không phải bảo đảm trần tuyệt đối.

Host GUI có mã Rust/Tauri nhưng toàn bộ RSS của host được tính vào ngân sách WebView 750 MB. Chỉ tiến trình `cloud-study-core` áp dụng mức backend 20 MB.

## Kiểm tra qua

- Rust: 2 unit tests và 1 integration test (SQLite/FTS5 song ngữ, giữ tiến độ sau quét lại, path traversal, đọc phụ đề, sửa mô tả, nhập phụ đề và chống ghi đè).
- JavaScript: 4 unit tests (định dạng thời gian, escape nội dung, fallback ngôn ngữ, tọa độ sprite).
- `cargo fmt --all -- --check` và `cargo clippy --all-targets -- -D warnings`.
- macOS desktop: mở thư viện qua hộp chọn native; mở gói cuối trong dist tự nhận `files`; phát video 1080p; phụ đề trên video; transcript và bấm dòng để tua; tìm `bao mat` trả 29 kết quả; mở cài đặt; vào/ra toàn màn hình.
- Windows x64: cross-build MSVC bằng cargo-xwin thành công; kiểm DLL import chỉ có DLL hệ thống/UCRT, không thiếu DLL WebView2Loader đi kèm.
- Linux ARM64: compile GUI/core trong Docker với WebKitGTK 4.1; core chạy và tìm kiếm trên thư viện thật thành công.

## Phạm vi chưa xác minh

- Chưa chạy GUI trên máy Windows hoặc desktop Linux; chưa đo RAM Windows hoặc RAM GUI Linux.
- PiP, codec, fullscreen native và cách hiện phụ đề trong PiP khác nhau giữa WebView/OS; app có thông báo fallback khi API không hỗ trợ. Chưa kiểm PiP bằng mắt trong phiên này.
- Workflow CI macOS/Windows/Linux đã cấu hình build và kiểm dung lượng nhưng chưa chạy trên GitHub; repository hiện chỉ local.
- Các gói local chưa ký chứng thực/notarize; bản macOS đã mở trực tiếp thành công trên máy build.

Mô tả/tiêu đề Việt là nội dung biên soạn có thể sửa; phụ đề gốc là tiếng Anh. App hỗ trợ nhập nhiều ngôn ngữ, không tạo bản dịch phụ đề không có trong nguồn.
