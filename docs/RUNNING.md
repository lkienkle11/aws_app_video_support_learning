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

## Tiếp tục học và tự chuyển bài

- Video đang xem được lưu vị trí khoảng mỗi 5 giây, khi tạm dừng, đổi bài, về thư viện hoặc đóng cửa sổ bình thường. Mở lại bài đang xem dở sẽ tiếp tục từ vị trí đã lưu.
- Tiến độ, trạng thái hoàn thành và ghi chú nằm trong `files/cloud-study.sqlite` của thư viện đang chọn; vẫn giữ khi khởi động lại hoặc quét lại thư viện.
- Khi video phát hết, ứng dụng đánh dấu hoàn thành và lưu vị trí 0. Mở lại bài đó bắt đầu từ đầu; nếu phát lại rồi dừng giữa chừng, lần tiếp theo tiếp tục ở vị trí mới.
- Trong ⚙ của trình phát, bật/tắt **Tự phát bài tiếp**. Lựa chọn được lưu vào SQLite theo thư viện.
- Nếu bật và còn bài tiếp, khi video kết thúc sẽ đếm ngược **3 giây**. **Chuyển ngay** bỏ qua thời gian chờ; **Hủy** dừng tự chuyển và hiện **Phát lại**. Khi tắt tự chuyển hoặc ở bài cuối, màn hình kết thúc có **Phát lại**; nếu còn bài tiếp vẫn có **Chuyển ngay**.
- Đổi bài hoặc rời trình phát sẽ hủy bộ đếm cũ. Mất điện/force quit có thể làm mất phần kể từ lần tự lưu gần nhất.

## Màu và độ đậm phụ đề

Mở **Cài đặt phụ đề** bên dưới video (hoặc ⚙ → **Cài đặt phụ đề…**). **Nền phụ đề** có bộ chọn màu nền và thanh **Độ đậm nền** 0–100%; **Chữ phụ đề** có màu chữ và **Độ đậm chữ** riêng. Chọn màu hoặc kéo thanh để xem ngay kết quả; thả thanh/chốt màu để lưu vào SQLite của thư viện. 0% là trong suốt, 100% là hoàn toàn đậm. Mặc định cho thư viện mới: nền đen 100%, chữ trắng 100%.

Màu/opacity, cỡ và vị trí phụ đề được giữ khi đổi bài hoặc khởi động lại. Cài đặt bản cũ vẫn được đọc: nền “Tối” giữ alpha 80%, “Trong suốt” giữ 0%, màu trắng/vàng và cỡ/vị trí không bị mất.

Danh sách “Nội dung khóa học” tự đưa dòng đang mở vào vùng nhìn thấy dưới tiêu đề cố định. Việc này chỉ cuộn khung danh sách, không kéo cả trang khỏi video; bố cục hẹp cũng giữ lựa chọn trong vùng cuộn của danh sách.


## Cỡ chữ và khung nền phụ đề

Trong **Cài đặt phụ đề**, nhập **Cỡ chữ (px)** từ 12 đến 96. Cùng một giá trị giữ nguyên cỡ chữ khi đổi kích thước cửa sổ, theater hoặc toàn màn hình. **Chiều rộng (px)** và **Chiều cao (px)** điều chỉnh kích thước cố định của nền, độc lập với cỡ chữ: ví dụ 420 × 96 px. Nhập 0 cho từng chiều để chiều đó tự động theo nội dung. Giới hạn rộng 3840 px, cao 2160 px; khi cửa sổ nhỏ, nền được giới hạn vừa video và chừa khoảng cách với thanh điều khiển. Nội dung dài trong khung thấp có thể cuộn.

Thay đổi được xem ngay; chốt giá trị/rời ô để lưu. Cỡ chữ, kích thước nền, màu, độ đậm và vị trí kéo đều được lưu vào SQLite của thư viện; giữ qua đổi bài và khởi động lại. Dữ liệu cũ thiếu kích thước nền sẽ dùng chế độ tự động.

## Ngôn ngữ ứng dụng

Bộ chọn **Ngôn ngữ ứng dụng / Application language** ở thanh đầu trang chuyển toàn bộ giao diện giữa **Tiếng Việt** và **English**: điều hướng, tìm kiếm, trình phát, cài đặt phụ đề, hộp sửa mô tả, trạng thái và thông báo. Đổi ngay khi đang học, không tải lại video hoặc xóa ghi chú đang nhập. Lựa chọn được lưu trong SQLite theo thư viện; lần đầu mặc định tiếng Việt. localStorage chỉ giữ lựa chọn khởi động trước khi mở thư viện và làm nguồn chuyển tiếp cho dữ liệu cũ; sau khi mở thư viện, SQLite quyết định ngôn ngữ.

Ngôn ngữ giao diện độc lập với bộ chọn **Ngôn ngữ tiêu đề**, **Ngôn ngữ tìm kiếm** và ngôn ngữ phụ đề. Tiêu đề, mô tả, tên chương, ghi chú và nội dung phụ đề là dữ liệu khóa học; không tự dịch khi đổi ngôn ngữ giao diện. Menu/hộp thoại tiêu chuẩn của hệ điều hành vẫn theo ngôn ngữ của hệ điều hành.

Để thêm ngôn ngữ giao diện, bổ sung locale vào `ui/shared/i18n.js` và bản dịch trong `ui/shared/locales/messages.js`, rồi thêm lựa chọn trong `ui/index.html`. `npm test` kiểm tra đủ bản dịch và cùng tham số giữa các locale.


## Phạm vi tìm kiếm

Bộ lọc **Tìm trong: Tất cả / Chỉ tiêu đề / Chỉ mô tả** giới hạn nơi tìm từ khóa. **Tất cả** tìm trong cả tiêu đề và mô tả; kết hợp được với ngôn ngữ tìm kiếm và lọc chương. Không nhập từ khóa sẽ hiển thị mọi bài phù hợp các bộ lọc còn lại. Tìm kiếm vẫn hỗ trợ tiếng Việt không dấu và tiền tố từ.

## Âm lượng và tăng âm

Thanh loa điều chỉnh 0–100% âm lượng video. Trong ⚙ của trình phát, **Tăng âm / Audio boost** cho phép chọn 100%, 150% hoặc 200% để nghe rõ nguồn nhỏ. Mặc định 100%; chỉ tạo xử lý Web Audio khi chọn tăng âm hoặc bắt đầu phát với mức tăng âm đã lưu. Có compressor để hạn chế đỉnh âm; không chỉnh sửa/chuyển mã MP4 hoặc tạo bản audio mới. Độ lớn cảm nhận còn phụ thuộc nguồn thu, loa và âm lượng hệ điều hành.

Âm lượng, mute, mức nghe trước khi tắt tiếng và tăng âm được lưu trong SQLite, giữ qua đổi bài và mở lại app. Mức tăng âm đã lưu được kích hoạt khi bắt đầu phát; nếu WebView chưa cho phép audio, lựa chọn vẫn được giữ để thử lại. Bấm loa sau khi kéo về 0 khôi phục mức nghe trước đó; kéo loa lên hoặc phím ↑ cũng mở tiếng. Nếu WebView không hỗ trợ hoặc chưa cho chạy audio, app thông báo; đường native mặc định không bị đổi trước khi bật được xử lý.

### Lưu toàn bộ cài đặt

SQLite trong thư mục thư viện lưu tốc độ phát, lặp video, tự phát bài tiếp, lựa chọn ngôn ngữ phụ đề (kể cả tắt), âm thanh và toàn bộ kiểu chữ/nền/vị trí phụ đề. Độ lệch thời gian phụ đề được lưu riêng theo từng bài. Ngôn ngữ giao diện, ngôn ngữ tiêu đề, từ khóa và bộ lọc tìm kiếm, chương, chế độ danh sách, theater, tab nội dung, mã ngôn ngữ nhập phụ đề và từ khóa transcript cũng được khôi phục từ SQLite. Mỗi thư viện có cài đặt riêng.

Các thay đổi được gom ghi sau 150 ms; đổi bài, đổi thư viện và đóng cửa sổ/thoát ứng dụng chờ ghi xong. Giá trị cỡ chữ/nền đang xem trước cũng được ghi khi đóng dù chưa rời ô. Nếu ghi lỗi, ứng dụng thông báo và giữ cửa sổ để thử lại. Force Quit hoặc mất điện có thể mất thay đổi chưa ghi. Fullscreen và Picture in Picture là trạng thái tạm thời của hệ điều hành, không tự bật lại khi mở ứng dụng.
