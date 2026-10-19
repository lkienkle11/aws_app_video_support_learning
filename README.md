# Cloud Study

Ứng dụng **desktop Rust + Tauri 2**, giao diện HTML/CSS/JavaScript cục bộ, dành cho khóa AWS Cloud Practitioner. macOS dùng WKWebView, Windows dùng WebView2, Linux dùng WebKitGTK. Không chạy web server, không cần tài khoản, không tải video lên mạng.

## Mở ứng dụng

Trên máy macOS Apple Silicon hiện tại, mở `dist/Cloud Study.app`, hoặc chạy `./run.command`. Thư viện nằm tại `files/`. Nếu chưa tìm thấy dữ liệu, bấm ⚙ ở góc trái và chọn thư mục `files`.

Đã có ba bản build thực tế trong `dist/`:

| Nền tảng | Gói chạy | Dung lượng chưa nén |
| --- | --- | ---: |
| macOS ARM64 | `Cloud Study.app` | 5,03 MB |
| Windows x64 | `windows-x64/` hoặc `cloud-study-windows-x64.zip` | 4,87 MB |
| Linux ARM64 | `linux-arm64/` hoặc `cloud-study-linux-arm64.tar.gz` | 5,14 MB |

Các gói bao gồm cả executable giao diện và backend, không kèm WebView hệ thống hoặc khóa học. Windows/Linux đã compile thành công; GUI và bộ nhớ frontend chỉ được chạy kiểm tra trực tiếp trên macOS. Backend Linux đã chạy với toàn bộ thư viện trong Docker.

Ứng dụng cần quyền ghi thư mục thư viện để lưu SQLite, mô tả và phụ đề nhập thêm. Chép toàn bộ `files/` cùng ứng dụng khi chuyển máy; dữ liệu khóa học không nằm trong bộ cài.

## Chức năng

- Thư viện 277 video, 21 chương, 14,5 giờ; thumbnail từng bài và ảnh tua gồm 12 mốc/video.
- Xem mô tả trước khi phát; tiêu đề và mô tả Anh/Việt; sửa hoặc thêm ngôn ngữ ngay trong desktop.
- Tìm theo tiêu đề, mô tả và ngôn ngữ; hỗ trợ từ khóa không dấu tiếng Việt; lọc chương, bài đang học, bài hoàn thành.
- Video phát trực tiếp từ đĩa qua asset protocol có HTTP Range, tránh đọc cả video vào RAM.
- Tua, next/previous, âm lượng, tốc độ 0,5–2x, lặp, tự chuyển bài, rạp, toàn màn hình và PiP khi WebView hỗ trợ.
- SRT/VTT trên video; chọn ngôn ngữ, cỡ chữ, màu, nền, lệch thời gian; transcript có tìm kiếm và bấm để tua.
- Tiến độ, hoàn thành và ghi chú lưu trong `files/cloud-study.sqlite`.
- Thêm phụ đề Việt/Nhật/Trung… từ máy. Bộ nguồn cung cấp phụ đề Anh; app không giả lập bản dịch chưa tồn tại.

Phím tắt khi focus trình phát: Space/K phát, ←/→ 5 giây, J/L 10 giây, ↑/↓ âm lượng, M tắt tiếng, C phụ đề, F toàn màn hình, T rạp, Shift N/P chuyển bài. Cmd/Ctrl K tìm bài học.

## Cấu trúc

```text
src/
  bin/core.rs       # backend Rust đọc JSON qua pipe riêng, không WebView
  service.rs        # use cases và kiểm tra dữ liệu
  catalog.rs        # quét video, ghép phụ đề, chặn path traversal
  database.rs       # SQLite, FTS5 và tiến độ
  model.rs          # mô hình dữ liệu
  subtitles.rs      # SRT -> WebVTT
  desktop.rs        # host WebView, vòng đời backend, IPC
  main.rs           # điểm vào desktop
ui/
  index.html        # shell desktop
  styles.css        # giao diện
  app.js            # điều phối thư viện và màn hình bài học
  lib/{api,player,utils}.js
scripts/            # chuẩn bị media, build, đo RAM, kiểm tra dung lượng
tests/              # kiểm tra hợp đồng backend và UI utilities
capabilities/       # quyền desktop tối thiểu
.github/workflows/  # kiểm tra/build macOS, Windows, Linux
files/              # video, subtitle, JPEG, lesson.json, SQLite; gitignored
tools/              # Rust toolchain và cache cục bộ; gitignored
```

Một video `001-Topic-id-git.ir.mp4` có:

- `001-Topic-id-git.ir.lesson.json`: `chapter`, `duration`, `texts.en/vi/...` gồm `title`, `description`.
- `001-Topic-id-git.ir.srt`: phụ đề Anh nguồn; `001-Topic-id-git.ir.vi.srt` hoặc `.ja.vtt` cho ngôn ngữ thêm.
- `.preview.jpg`: ảnh xem trước; `.sprite.jpg`: 12 ảnh tua bố cục 4×3.

Mô tả là nội dung biên soạn để định hướng học, không phải nội dung chính thức của AWS. Nguồn tham khảo tiếng Anh: [CLF-C02 exam guide](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/). Nguồn tiếng Việt: [AWS Certified Cloud Practitioner](https://aws.amazon.com/vi/certification/certified-cloud-practitioner/). Các thuật ngữ/tên dịch vụ được giữ khi cần. Không tự gọi dịch vụ dịch thuật.

## Phát triển và build

Yêu cầu Node.js 22+, Rust stable và công cụ build hệ điều hành. Node và ffmpeg chỉ phục vụ phát triển/chuẩn bị thư viện, không cần lúc dùng app. SQLite được link vào Rust.

```sh
# Chỉ trên máy này: Rust đã cài trong tools/; chạy từ root repository.
. scripts/env.sh
npm ci
npm run dev

cargo test --no-default-features --locked
npm test
cargo clippy --all-targets -- -D warnings
cargo fmt --all -- --check

npm run build -- --bundles app   # macOS
npm run build -- --bundles nsis  # Windows, chạy trên Windows
npm run build -- --bundles deb   # Linux, chạy trên Linux
```

Trên máy mới có Rust sẵn, bỏ lệnh `. scripts/env.sh`. Xem [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) để cài Xcode CLT/macOS, MSVC + WebView2/Windows, hoặc WebKitGTK 4.1 và GStreamer H.264/AAC/Linux. Linux dùng `.deb` phụ thuộc thư viện hệ thống để giữ bộ cài nhỏ; không đóng gói WebKit/GStreamer vào AppImage. Windows dùng WebView2 hệ thống; kích thước bộ cài không bao gồm runtime của hệ điều hành.

Build sẽ tự tạo sidecar backend theo target triple. Khi phát hành, giữ nguyên toàn bộ `.app` hoặc bộ cài, không tách riêng executable frontend khỏi backend. CI tạo artifacts cho cả 3 OS và fail nếu gói đạt/tới 20.000.000 byte. Workflow đã viết nhưng chưa chạy trên runner Windows/Linux trong phiên local này.

## Dữ liệu và công cụ

`python3 scripts/extract_courses.py`: giải nén đệ quy ZIP trong `files`, kiểm CRC từng file rồi mới xóa ZIP đã xác minh. Đã chạy cả ZIP bài tập lồng bên trong; xem `docs/extraction-report.json`.

`python3 scripts/prepare_library.py`: cần ffprobe/ffmpeg, tạo sidecar song ngữ và thumbnail; giữ file đã có. Đã xử lý toàn bộ 277 video. Nội dung mô tả có thể sửa trên giao diện.

Git đã init ở root repository này. `npm ci` cài hook `commit-msg` dùng commitlint JS. Commit theo Conventional Commits, ví dụ `feat: add offline course player`. Hook chặn câu commit không hợp lệ.

RTK 0.45.0 và CodeGraph 1.6.0 đã cài bản local trong `tools/`, dùng qua `. scripts/env.sh`. RTK đã init qua `rtk init --codex`; mọi lệnh shell của agent dùng `rtk`. CodeGraph đã init trong `.codegraph/`; dùng `codegraph sync` sau thay đổi và `codegraph explore 'symbol or question'` trước khi dò mã. Chúng là công cụ phát triển, không được nhúng vào bộ cài người học.

## Ngân sách tài nguyên

Theo yêu cầu đã điều chỉnh: **backend Rust ≤20 MB; giao diện WebView ≤750 MB; bộ cài <20 MB**.

Backend chạy trong `cloud-study-core`; host giao diện `cloud-study` được viết bằng Rust/Tauri và chứa WebView native. Báo RAM **tính toàn bộ RSS của host vào phần giao diện**, cùng WebContent/GPU/Networking; không tuyên bố host Rust/Tauri chỉ dùng 20 MB.

`python3 scripts/measure_core.py` kiểm tra thư viện thật, tìm kiếm Anh/Việt, đọc mọi phụ đề và lấy mẫu RSS. `node scripts/check-size.mjs 'target/release/bundle/macos/Cloud Study.app'` kiểm toàn bộ gói gồm cả backend. Xem báo cáo tại `docs/` để biết số đo cụ thể, phạm vi và hạn chế. Số đo local không phải bảo đảm cho mọi video, mọi máy hoặc mọi hệ điều hành. Chưa kiểm GUI runtime Windows/Linux.

Đo cuối phiên: backend macOS khoảng 17,35 MB RSS cao nhất lấy mẫu; backend Linux ARM64 khoảng 6,03 MB; nhóm WebView/Tauri macOS khoảng 178,18 MB trong 10 giây phát video 1080p. RAM frontend Linux và RAM Windows chưa được đo. Các báo cáo JSON lưu rõ phương pháp và PID quan sát; không trộn RAM backend với nhóm WebView.

PiP, fullscreen và codec phụ thuộc WebView/OS; app thông báo khi API không được hỗ trợ. Phụ đề trong cửa sổ PiP phụ thuộc hệ điều hành. Không có chọn nhiều độ phân giải vì nguồn chỉ cung cấp một bản video.
