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


## Refactor và dọn dẹp tiếp theo

Rust chia application/domain/infrastructure/media/desktop; UI chia library/player/shared/styles; scripts chia build/development/library/quality/maintenance. Node hiện có 7 tests, gồm timer controls và hình học phụ đề. Rust integration kiểm thêm lưu/đọc caption preferences qua SQLite và từ chối cỡ chữ không hợp lệ. Native macOS kiểm cửa sổ 375 px và mở bài học không tự cuộn xuống playlist. Thử bố cục 320–1320 px không tràn ngang; các bản build Windows/Linux nêu phía trên thuộc phiên trước, đã dọn output cũ và chưa build lại sau refactor.

Desktop nhúng HTML qua Tauri; không có web server production. Không chuyển mã MP4 lúc chạy. Các báo cáo đo và cleanup local chuyển vào `docs/reports/` (gitignored). Bản macOS hiện tại được đo lại khi đóng gói; số đo cũ ở bảng trên không đại diện bản mới.

Docker Desktop đã restart có kiểm soát để nhả các file build dự án bị VM giữ sau khi xóa. Redis SAVE thành công; PostgreSQL/Redis khởi động lại healthy, giữ nguyên ID container/volume và Redis key count. Không prune Docker hoặc đụng dữ liệu ứng dụng khác.


Kết quả cuối sau cleanup: repo gồm toàn bộ khóa học 4.807.029.629 byte (<7 GB); app macOS 5.045.680 byte (<20 MB); backend mới đạt peak sampled RSS 17.154.048 byte. Dung lượng trống trước phiên 55.709.261.824 byte, sau dọn 73.139.851.264 byte, tăng 17.430.589.440 byte. Mốc 134 GB trống chưa đạt/không khớp số đo thực tế; không xóa dữ liệu hay cache khác để bù. Không còn SDK, target hoặc node_modules trong repo; bootstrap lại khi phát triển.

SHA-256 xác minh 555 MP4/SRT nguồn cùng hash logical tiến độ/ghi chú trong 2 SQLite không thay đổi. Redis và PostgreSQL vẫn healthy sau cleanup. Các kiểm thử/build hoàn thành trước khi xóa cache; không build lại sau dọn để tránh tái tạo dung lượng.


Người dùng xác nhận tiêu chí dung lượng là thu hồi ít nhất 12 GB do dự án tạo ra. Số thu hồi đã ghi nhận khoảng 17,4 GB đạt tiêu chí này; không yêu cầu ổ đĩa trống tuyệt đối 134 GB.


## Sửa lỗi bài 117 không phát được

Lần kiểm codec trước bỏ sót định dạng container: 274/277 file đuôi `.mp4` thực tế là Matroska (magic EBML `1a45dfa3`), dù stream H.264/AAC. AVFoundation báo -11829/-12848 trên bài 117 nguồn. Remux sang MP4 thật bằng `-c copy -movflags +faststart` làm macOS đọc và phát được; không chuyển mã hoặc giảm độ phân giải.

Đã sửa 274 file. Mỗi file chỉ thay thế sau khi codec name/profile/extradata hash và SHA-256 của từng packet video/audio khớp nguồn; báo cáo append tại `docs/reports/mp4-repair.jsonl`. Cả 277 file có header MP4 thật; AVFoundation native nhận playable và thời lượng hợp lệ cho 277/277. Dữ liệu phụ đề/ảnh/sidecar và hash logical progress/notes ở 2 database (1111 mục kiểm tra tổng cộng) không thay đổi. Container overhead tăng khoảng 38,5 MB; không tạo bản video chất lượng khác hoặc cache remux lúc phát.

Bản desktop macOS mới đã phát bài 117 với hình, phụ đề và thời gian tăng tới 0:12/2:18, tua +10 giây thành công. Fixture MKV đặt sai đuôi hiển thị thông báo cụ thể từ backend. Kiểm thử regression Rust kiểm đường media_path từ chối EBML đặt sai đuôi và cho MP4 đi qua; JavaScript tests, Rust tests, fmt/Clippy đều qua. GUI kiểm bằng bản sao dữ liệu để không đổi tiến độ người dùng. Windows/Linux chưa được kiểm runtime trong lần sửa này.

Kiểm thử chuyển bài còn tái hiện được sự kiện pause cũ ghi nhầm position/duration sang bài mới trong thư viện test. Bản sửa buộc currentSrc khớp source của bài trước khi lưu, tắt liên kết source trong lúc chuyển bài và reset time/seek khi nạp video. Test Node mới xác minh sự kiện cũ không sửa tiến độ/ghi chú bài mới, còn source đúng vẫn lưu bình thường. Tổng Node tests hiện là 8.


## Tăng cỡ chữ toàn app

Chữ giao diện tăng 1 px; tiêu đề lớn từ 34 px trở lên tăng 2 px. Các stylesheet desktop/tablet/mobile cùng được điều chỉnh; header tablet cho phép xuống dòng. Giữ nguyên cỡ phụ đề người dùng đã lưu. Đã kiểm tra native macOS ở 320, 650 và 1320 px, gồm thư viện và màn hình bài học ở cửa sổ hẹp. Bản `.app` trong dist đã build lại, 5.045.680 byte. 8 Node tests và 3 Rust tests qua; formatter và git diff check qua.

## Lưu tiến độ và kết thúc video — 2026-10-19

- 14 Node tests và 4 Rust tests qua; fmt, Prettier và Clippy qua. Kiểm thử mới bao gồm thứ tự các lần ghi bất đồng bộ để autosave cũ không ghi đè trạng thái xem hết, lưu ghi chú cùng timestamp thực, và hủy callback đếm ngược đã xếp hàng.
- SQLite integration: lưu 32,25 giây + ghi chú, tạo Service mới và quét lại thư viện vẫn khôi phục đúng; xem hết lưu position=0/completed=true; bật/tắt tự chuyển được lưu qua lần khởi động mới.
- Native macOS ARM64, thư viện thử riêng: bài 1 xem đến 6,51 giây → về thư viện → mở bài 2 → quay lại bài 1 hiển thị 0:06. Đóng cửa sổ ở 9,93 giây → khởi động lại → bài 1 hiển thị 0:09.
- Clip 6 giây tự hoàn thành, lưu position=0/completed=true rồi tự phát bài 3. Mở lại bài hoàn thành hiển thị 0:00. Kiểm thử policy xác nhận bộ đếm đủ 3.000 ms, hiển thị 3/2/1 và chỉ chuyển một lần.
- Native: thấy đếm ngược “Bài tiếp theo sau 3 giây”, bấm Hủy → giữ nguyên bài, hiện Phát lại; bấm Phát lại → 0:00 và phát; bấm Chuyển ngay → phát bài tiếp ngay. Bài cuối chỉ hiện Phát lại. Công tắc tắt tự chuyển lưu `{"autoplay":false}` và màn hình kết thúc không đếm ngược.
- Màn hình kết thúc kiểm tra native ở 1320 px và 320 px, chữ/nút nằm trong khung video. Phím Space/Enter trên nút giữ hành vi nút, không bị phím tắt trình phát chặn.
- Hash logical progress/notes của hai SQLite thật trước/sau kiểm thử không đổi. Video thử nằm trong tools/test-library, không ghi vào thư viện thật.
- Backend macOS ARM64: peak sampled RSS 17.629.184 byte khi mở 277 bài, tìm kiếm song ngữ và đọc mọi phụ đề; dưới giới hạn 20.000.000 byte. Đây là số đo workload cục bộ, không phải bảo đảm mọi máy.
- Lần thay đổi này build/kiểm runtime macOS ARM64. Windows/Linux cần build và kiểm runtime trên hệ điều hành tương ứng theo PACKAGING.md.

Bản macOS `.app` mới gồm GUI và core: 5.045.680 byte (<20 MB); giữ trong `dist/Cloud Study.app`, không đưa vào Git.
