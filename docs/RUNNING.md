# Chạy Cloud Study trên desktop

## Trạng thái gói hiện tại

| Hệ điều hành | Gói mới nhất có sẵn trong repo này | Đã chạy GUI bản hiện tại |
| --- | --- | --- |
| macOS Apple Silicon (ARM64) | `dist/Cloud Study.app`, khoảng 5,05 MB | Có |
| macOS Intel | Chưa có; cần build trên máy Intel | Chưa |
| Windows | Chưa có installer mới; xem PACKAGING.md | Chưa |
| Linux | Chưa có DEB mới; xem PACKAGING.md | Chưa |

Các bản Windows/Linux của phiên trước đã được dọn. Có workflow CI không có nghĩa là đã có artifact phát hành: workflow chưa được chạy trên GitHub trong phiên này.

Đây là app desktop Rust/Tauri với HTML nhúng, không mở bằng trình duyệt hoặc chạy web server. Responsive mobile/tablet là bố cục khi cửa sổ desktop thu nhỏ; chưa có APK/IPA.

## Chuẩn bị dữ liệu trên mọi OS

1. Chép toàn bộ thư mục `files/` từ máy đang có khóa học sang máy đích. Git clone không tải thư mục này vì đã gitignore.
2. Giữ nguyên cấu trúc thư mục con, MP4, SRT/VTT, ảnh, `.lesson.json` và SQLite để giữ mô tả, phụ đề, tiến độ và ghi chú. Đóng app trước khi chép dữ liệu.
3. Đặt `files/` tại nơi tài khoản có quyền đọc và ghi, ví dụ thư mục tài liệu cá nhân; tránh thư mục cài đặt chỉ đọc.
4. Mở app, bấm ⚙ góc thư viện và chọn đúng thư mục `files/` nếu app chưa tự tìm thấy. App không tự tải khóa học từ Internet.

Người dùng bản đóng gói không cần Node, Rust hoặc ffmpeg. MP4 phát trực tiếp; codec/WebView dùng thư viện hệ điều hành.

## macOS

Trên máy Apple Silicon hiện tại, từ root `aws_clf_c02_src`:

```sh
./run.command
```

Hoặc mở `dist/Cloud Study.app` trong Finder. Có thể chép nguyên `.app` vào Applications rồi chọn thư mục dữ liệu trong app. Giữ nguyên toàn bộ bundle, không chỉ chép executable bên trong.

Bản hiện tại là build local chưa ký/notarize. Phân phối rộng cần ký/notarize theo hướng dẫn đóng gói; tài liệu này không yêu cầu tắt Gatekeeper. Mac Intel cần gói x86_64 riêng, không dùng gói ARM64 này.

## Windows

Sau khi có installer NSIS `.exe` đúng kiến trúc:

1. Chạy installer để cài Cloud Study.
2. Mở Cloud Study từ Start Menu hoặc shortcut được installer tạo.
3. Chọn thư mục `files/` đã chép vào máy.

Cần Microsoft Edge WebView2 Runtime. Nếu dùng bản portable xuất bằng script thay cho installer, giữ `cloud-study.exe` và `cloud-study-core.exe` cùng thư mục, rồi chạy `cloud-study.exe`. Không chạy `cloud-study-core.exe` để mở giao diện.

Repo hiện chưa kèm installer/portable Windows mới nhất. Phải build trên Windows hoặc lấy artifact từ một lần CI đã chạy thành công.

## Linux

Hướng dẫn gói DEB áp dụng cho Debian/Ubuntu có WebKitGTK 4.1; chưa xác minh mọi distro Linux. Dùng gói đúng kiến trúc CPU (amd64/x86_64 hoặc arm64/aarch64).

Trên máy đã build, từ root repository:

```sh
sudo apt install ./target/release/bundle/deb/*.deb
sudo apt install gstreamer1.0-libav gstreamer1.0-plugins-good
cloud-study
```

Khi nhận gói riêng, thay đường dẫn trên bằng đường dẫn tới file DEB đó. Có thể mở Cloud Study từ menu ứng dụng sau khi cài; chọn `files/` trong giao diện. Cần phiên desktop có màn hình; container/headless không thay thế kiểm tra GUI.

Bản portable từ script gồm `cloud-study` và `cloud-study-core` cùng thư mục; chạy `./cloud-study`. Portable vẫn cần WebKitGTK/GStreamer và thư viện hệ thống tương thích, không phải binary độc lập chạy trên mọi distro.

## Khi gặp lỗi

| Hiện tượng | Kiểm tra |
| --- | --- |
| Thư viện trống | Đã chép `files/` thật chưa? Chọn lại thư mục bằng ⚙; Git không chứa video. |
| Không lưu tiến độ/cài đặt | Thư mục dữ liệu có quyền ghi; không đặt trong Program Files hoặc vùng chỉ đọc. |
| Cannot start Rust core | Bundle/portable có đủ backend đi cùng; không di chuyển riêng executable GUI. |
| Có tiếng nhưng không có hình hoặc không phát MP4 | Kiểm tra WebView và codec H.264/AAC của OS; Linux kiểm GStreamer. |
| App báo `.mp4` nhưng nội dung Matroska/MKV | Nguồn bị đặt sai đuôi. Chuẩn hóa một lần bằng hướng dẫn bên dưới, không cài thêm codec để chữa lỗi đặt sai container. |
| Sai kiến trúc executable | Dùng gói build đúng CPU và đúng OS. |

Nguồn khóa học đã gặp lỗi 274 file MKV mang đuôi MP4, trong đó có bài 117. Thư viện trên máy này đã được sửa. Nếu giải nén lại nguồn cũ hoặc mang dữ liệu chưa sửa sang máy khác, đóng app rồi chạy tại root repo trên máy có Python 3, ffmpeg và ffprobe:

```sh
python3 scripts/library/repair_mp4.py
python3 scripts/library/repair_mp4.py --apply
```

Windows có thể dùng `py -3` thay `python3`. Đây là bước sửa dữ liệu offline: giữ nguyên video/audio nén, không giảm chất lượng hay độ phân giải; chỉ đổi container. Mỗi file phải qua kiểm tra toàn bộ packet và codec configuration trước khi thay thế. Tên file giữ nguyên nên phụ đề, mô tả, ID bài học và tiến độ vẫn gắn đúng bài. Báo cáo append tại `docs/reports/mp4-repair.jsonl`. Chạy lại trên thư viện đã sửa sẽ không remux lại.

Xem [hướng dẫn đóng gói](PACKAGING.md) để tạo gói còn thiếu. Yêu cầu WebView và dependency dựa trên [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).
