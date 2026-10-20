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

Bản macOS `.app` mới gồm GUI và core: 5.045.696 byte (<20 MB); giữ trong `dist/Cloud Study.app`, không đưa vào Git.

Trong QA cuối đã gặp SIGABRT trên `tokio-rt-worker` (`panic_cannot_unwind`) khi kiểm phát lại/bàn phím. Dấu hiệu khớp race phản hồi custom-protocol của Wry trên macOS khi WKURLSchemeTask bị hủy. Đã đọc bản sửa upstream [Wry #1856](https://github.com/tauri-apps/wry/pull/1856), pin revision `a1e9973c44f1e6ccb6a1f17a16ded28be26d3ff1` trong Cargo.toml/Cargo.lock: đưa kiểm tra task và cả phản hồi về main queue. PR còn mở; bỏ patch khi có release chính thức đã chứa fix. Không sửa file registry cục bộ, không vendor runtime vào repo. Giữ nguyên các dependency Windows đã khóa.

Sau patch, Clippy `--all-targets --locked` và 4 Rust tests qua; native đã đổi bài nhanh 9 lượt, phát lại và tua tới hết không abort. Đây là kiểm tra cục bộ, không phải chứng minh hết mọi race có thể có. Bộ kiểm tra native cũng xác minh sau restart, autoplay=false vẫn giữ bài 2 trên màn hình kết thúc.

## Danh sách đang học và màu/opacity phụ đề — 2026-10-20

- Lỗi danh sách: `scrollTop` trước đây gán vào `#playlist`, trong khi `.playlist` bao ngoài mới là phần tử cuộn. Mã mới cuộn đúng panel sau layout, chừa tiêu đề sticky, tính lại khi resize. Chiều cao panel desktop giới hạn theo vùng cửa sổ còn lại để bài cuối cũng hiện trọn; ở tablet/mobile giữ viewport danh sách riêng.
- Native macOS ARM64: trong thư viện thử 277 bài, tìm/mở bài 117 đưa dòng 117 tô sáng vào vùng nhìn thấy, giữ video ở đầu trang. Mở bài 277 đưa dòng cuối vào màn hình, không bị cắt dưới cửa sổ. Thu cửa sổ còn 320 px, cuộn trang tới danh sách vẫn thấy dòng 277 trong viewport nội bộ.
- Hai nhóm cài đặt “Nền phụ đề” và “Chữ phụ đề” có color picker và opacity 0–100% độc lập; dùng RGBA cho từng màu, không đặt opacity cho toàn bộ overlay. Thư viện mới mặc định nền đen/chữ trắng 100%. Cài đặt cũ giữ nguyên cỡ, vị trí, trắng/vàng và alpha 80%/0% tương ứng; chỉ chuẩn hóa trong bộ nhớ khi đọc, không tự ghi lại preferences.
- Native: mở palette nền, chờ hơn 3 giây rồi chọn màu vẫn hoạt động. Chọn nền tím `#942192`, chữ vàng `#fffb00`, kéo opacity nền thành 50%, chữ thành 84%; kiểm tra trực tiếp JSON preferences trong SQLite đúng cả bốn giá trị. Đóng/mở app và mở lại bài 117, UI khôi phục nền tím 50% và chữ vàng 84%. Menu có chiều rộng giới hạn; đang chọn màu native thì tạm giữ menu, chọn xong trả lại quy tắc ẩn điều khiển.
- 24 Node tests và 5 Rust tests qua trên macOS: gồm đầu/giữa/cuối danh sách, sticky header, kích thước tablet/mobile, hai kênh alpha độc lập, preview và thứ tự ghi SQLite, khởi động lại Service, đọc dữ liệu cũ và từ chối màu/opacity không hợp lệ. `cargo fmt --all -- --check`, Clippy `--all-targets --locked -- -D warnings`, Prettier và `git diff --check` qua.
- Gói macOS ARM64 mới gồm GUI/core: 5.045.696 byte (<20 MB). Backend macOS peak sampled RSS 17.973.248 byte với 277 bài và toàn bộ phụ đề; số đo workload cục bộ, không suy ra ngân sách RAM cho mọi máy.
- Không thêm dependency hoặc API riêng một OS cho tính năng này. Chỉ build/chạy macOS trong phiên sửa. Không build/test EXE hoặc Linux trên host này theo yêu cầu. PACKAGING.md có lệnh build native trên máy đích; gate Windows/Linux kiểm tổng executable GUI/core trước khi kiểm installer. Không coi cấu hình CI là bằng chứng runtime trên hai OS chưa chạy.


## Cỡ chữ, nền cố định và i18n — 2026-10-20

- Thêm hộp Cài đặt phụ đề riêng, mở từ nút dưới video hoặc menu ⚙. Cỡ chữ 12–96 px; chiều rộng/cao nền cố định độc lập, mỗi chiều 0 là tự động. SQLite lưu kích thước, cỡ chữ cùng vị trí và hai kênh màu/alpha. Dữ liệu cũ thiếu kích thước dùng 0, không bị tự ghi đè khi đọc.
- Giao diện Việt/Anh dùng catalog nội bộ, gồm nhãn tĩnh, placeholder, tooltip, aria-label, trạng thái động, thông báo, hộp cài đặt và màn hình kết thúc. Lựa chọn nhớ qua localStorage; nội dung khóa học và ngôn ngữ tiêu đề/tìm kiếm/phụ đề độc lập. Không thêm dependency runtime.
- 28 Node tests và 5 Rust tests qua; fmt, Clippy với warnings-as-errors, kiểm cú pháp JS, HTML ID không trùng và git diff check qua. Kiểm catalog đủ hai ngôn ngữ/cùng tham số, đổi DOM không mất nội dung input, nhớ locale qua reload và storage bị chặn, kích thước nền/preview/ghi nối tiếp, SQLite khởi động lại và giới hạn không hợp lệ.
- Native macOS ARM64, thư viện thử riêng: chọn 36 px, nền 420 × 96 px, SQLite có đúng giá trị; nền thực tế đúng kích thước. Đóng/mở app rồi mở bài khác, cài đặt vẫn 36/420/96. Bộ chọn English và toàn giao diện vẫn tiếng Anh sau restart. Đổi Việt/Anh khi video phát, thời gian tiếp tục tăng 0:03 → 0:07; ghi chú đang nhập vẫn giữ khi đổi locale.
- Native kiểm ở 1320 px và 320 px: hộp phụ đề Việt/Anh vừa cửa sổ, nền giới hạn theo video; nội dung dài trong nền thấp cuộn được. Trả cửa sổ và ngôn ngữ tiếng Việt sau QA.
- Gói macOS trong dist: 5.062.208 byte (<20 MB), đã build lại từ nguồn sửa. Backend peak sampled RSS 10.240.000 byte trên workload 277 bài, tìm kiếm song ngữ và đọc mọi phụ đề; đo cục bộ, không bảo đảm trần RAM cho mọi workload.
- Hash logical progress/notes/preferences của hai SQLite thật trước/sau QA không thay đổi. Chỉ build/chạy macOS; Windows/Linux cần build native trên máy đích.


## Bộ lọc tìm kiếm và âm lượng — 2026-10-20

- Search thêm phạm vi all/title/description tại UI và SQLite FTS5, kết hợp ngôn ngữ và chương. Chỉ cho phép tên cột nằm trong allowlist; token vẫn được quote; request cũ không có field dùng all, field không hợp lệ bị từ chối. Không đổi schema/database hoặc dữ liệu khóa học.
- Native macOS, thư viện thử riêng: từ khóa security trả 2 bài với All fields, chỉ bài 1 với Title only và chỉ bài 2 với Description only. Kiểm bố cục ở 320/650/1320 px: search đầy hàng và các select xuống hai cột trên cửa sổ hẹp.
- Đo 60 giây đầu video 001: mean -23,2 dB/max -2,6 dB; bài 117: mean -23,8 dB/max -3,5 dB bằng ffmpeg volumedetect. Đây là hai mẫu nguồn, không phải phép đo loa/âm lượng hệ điều hành hoặc toàn bộ khóa học. App trước chỉ hỗ trợ volume 0–100%.
- Thêm Audio boost 100/150/200% trong menu trình phát, khởi tạo Web Audio khi người dùng yêu cầu. Gain → compressor → output volume; không nạp/chuyển mã toàn bộ audio/video, không thêm dependency runtime. Native volume giữ unity khi đã tạo graph để không áp dụng âm lượng hai lần; thanh loa/mute được áp dụng ở output gain, đồng bộ khi native volume thay đổi. Tắt/mở loa sau mức 0 khôi phục mức nghe trước đó; phím ↑/slider mở tiếng khi tăng âm lượng.
- 31 Node tests và 6 Rust tests qua. Kiểm tra cả bộ lọc song ngữ/không dấu, query trống, backward compatibility, từ chối field lạ và ký tự FTS; graph tạo một lần/đổi boost, mute/zero/unmute và chặn activation không làm đổi native playback. fmt, Clippy --all-targets --locked với warnings-as-errors, kiểm cú pháp JavaScript, Prettier và git diff check qua.
- Native WKWebView test `tests/native/audio-webkit.swift`: chạy module production với AAC, tauri://localhost và asset://localhost riêng, CORS như Tauri. RMS baseline 0,00945; 200% 0,01880 (~1,99 lần); đổi media giữ tín hiệu 0,01890; về 100% 0,00941. Mute và volume 0 đều RMS=0; mở tiếng khôi phục 0,00942. Regression này đo tín hiệu thật sau output gain, không suy ra âm lượng cảm nhận trên loa hoặc runtime Windows/Linux. Xem `tests/native/README.md` để chạy lại.
- Gói macOS mới được build lại và kiểm dưới 20 MB. Backend peak sampled RSS 9.912.320 byte với 277 bài, tìm kiếm song ngữ và đọc mọi phụ đề; không phải bảo đảm mọi workload/máy.
- Hash logical tiến độ, ghi chú và preferences của hai SQLite thật không đổi. QA dùng thư viện riêng trong tools/test-library. Chỉ build/chạy macOS; không push trong phiên này theo yêu cầu.


## Giảm công việc thừa khi phát video — 2026-10-20

- Pointer move chỉ gia hạn idle timer 3 giây; callback hiển thị/đặt lại vị trí phụ đề chỉ chạy khi control đổi trạng thái. Regression phát 100 sự kiện move chỉ có một callback hiện và một callback ẩn.
- Thanh thời gian/seek không cập nhật DOM khi control ẩn hoặc tài liệu ở nền; hiện control cập nhật ngay timestamp hiện tại. Đồng hồ chỉ thay text khi giá trị hiển thị đổi. Việc ghi tiến độ mỗi 5 giây vẫn giữ nguyên.
- Cuechange của track không được chọn không dựng lại phụ đề. Cue có nội dung trùng không thay text/tính lại bố cục; phụ đề rỗng không đo geometry. Transcript chỉ dựng khi mở tab; highlight chỉ đổi node khi cue đổi.
- Lưu tiến độ không cập nhật thống kê thư viện đang ẩn hoặc quét mọi nút playlist; map nút được làm mới khi dựng playlist.
- Về thư viện: chờ ghi tiến độ/settings xong rồi gỡ media src, gọi load để nhả decoder, xóa track/blob URL/sprite/transcript và suspend audio context đã tạo. Phát lại tái dùng audio graph sau resume. Không sửa/chuyển mã hoặc giảm chất lượng MP4.
- 41 Node tests pass, gồm regression cho giữ timestamp/ghi chú/completion, visibility timer, phụ đề lặp, UI ẩn và thứ tự lưu trước khi giải phóng media. Các kiểm thử đếm công việc thừa không phải phép đo phần trăm CPU giảm hay chứng minh không rò rỉ RAM dài hạn.
- Build macOS ARM64 thành công: dist/Cloud Study.app 5.095.296 byte. Native mở bài 189 khôi phục 0:43/2:37, phát được video và mở được transcript; quay về thư viện rồi mở lại nguồn video hoạt động. Mẫu ngắn sau khởi động: tổng CPU nhóm app khoảng 8,5–23,2%, RSS 153–219 MB; hai mẫu sau khoảng 8,5–8,6% và 153–183 MB. Đây không phải benchmark A/B đồng nhất hoặc peak dài hạn; không suy ra tỷ lệ giảm so với bản cũ. Core khoảng 8–10 MB RSS, riêng host GUI khoảng 73–86 MB; giới hạn 20 MB cho tổng mọi tiến trình Rust chưa đạt. Chỉ kiểm runtime macOS.
