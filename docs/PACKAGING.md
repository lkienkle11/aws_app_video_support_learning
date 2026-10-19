# Build và đóng gói desktop

Chạy các lệnh tại root `aws_clf_c02_src`. Build native trên đúng OS/kiến trúc muốn phát hành. Không cần Docker cho luồng này. `files/` không được nhúng vào bộ cài; người dùng chép riêng theo [RUNNING.md](RUNNING.md).

## Chuẩn bị chung

Cài Node.js 22+, Git và Rust stable. Cài dependency hệ thống theo OS bên dưới. Build cần Internet để lấy dependency; app đã đóng gói chạy offline với khóa học local.

Kiểm tra trước build:

```sh
node --version
cargo --version
rustc -vV
```

`host` trong `rustc -vV` cho biết target mặc định. Các lệnh dưới đây build cho host; không đặt `CARGO_BUILD_TARGET` khác host nếu chưa cấu hình cross-compilation. `beforeBuildCommand` tự build/copy backend qua `scripts/build/core.mjs`; không phải build frontend bằng web server.

## macOS

Cài Xcode Command Line Tools nếu chưa có:

```sh
xcode-select --install
```

Chuẩn bị và build:

```sh
sh scripts/development/bootstrap.sh
. scripts/development/env.sh
npm run build -- --bundles app
python3 scripts/build/package_local.py
node scripts/quality/check-size.mjs 'dist/Cloud Study.app'
```

Output Tauri: `target/release/bundle/macos/Cloud Study.app`. Script Python chép nguyên bundle sang `dist/Cloud Study.app` và chặn gói từ 20.000.000 byte trở lên. Apple Silicon tạo ARM64; Intel tạo x86_64. Script xuất local chỉ giữ bản `.app`, không tạo thêm ZIP trùng.

Nếu cần DMG, chạy `npm run build -- --bundles dmg`; kiểm tra file trong `target/release/bundle/dmg/`. Bản hiện tại đã xác minh là `.app`, chưa có DMG phát hành mới. Ký/notarize trước khi phát hành rộng theo [hướng dẫn macOS signing của Tauri](https://v2.tauri.app/distribute/sign/macos/).

## Windows (PowerShell)

Cài Visual Studio Build Tools với workload **Desktop development with C++**, Rust stable dùng MSVC và WebView2 Runtime. Xem [prerequisites chính thức](https://v2.tauri.app/start/prerequisites/#windows). Dùng PowerShell; không chạy bootstrap shell dành cho macOS/Linux.

```powershell
npm ci --cache ./tools/npm-cache
npm run build -- --bundles nsis
Get-ChildItem target/release/bundle/nsis/*.exe | ForEach-Object {
    node scripts/quality/check-size.mjs $_.FullName
    if ($LASTEXITCODE -ne 0) { throw 'Installer exceeds size limit' }
}
```

Installer ở `target/release/bundle/nsis/`. Chạy installer trên Windows để xác minh mở GUI, phát video, chọn thư viện và lưu dữ liệu. NSIS là bộ cài; `cloud-study-core.exe` là backend đi cùng do Tauri đóng gói.

Nếu muốn bản portable thay vì installer, sau build chạy `py -3 scripts/build/package_local.py` (cần Python 3). Output `dist/windows/` có hai executable; luôn phân phối cùng nhau. Script này xuất portable, không chuyển installer NSIS vào dist. Bản portable không mang theo WebView2 Runtime.

Installer có thể tải/cài WebView2 khi máy thiếu runtime theo chế độ Tauri mặc định; kích thước download/runtime hệ thống không thuộc kích thước executable app. Xem [Windows installer của Tauri](https://v2.tauri.app/distribute/windows-installer/).

## Linux (Debian/Ubuntu)

Cài build dependencies và codec:

```sh
sudo apt update
sudo apt install build-essential curl wget file pkg-config libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev librsvg2-dev patchelf libssl-dev libxdo-dev \
  gstreamer1.0-libav gstreamer1.0-plugins-good
sh scripts/development/bootstrap.sh
. scripts/development/env.sh
npm run build -- --bundles deb
node scripts/quality/check-size.mjs target/release/bundle/deb/*.deb
```

Output ở `target/release/bundle/deb/`. Build trên kiến trúc CPU cần phát hành. Cài gói bằng `sudo apt install ./target/release/bundle/deb/*.deb` rồi mở `cloud-study`. Chọn thư mục `files/`, thử phát MP4 và phụ đề trên desktop thật.

Nếu cần portable, chạy `python3 scripts/build/package_local.py` sau build: output `dist/linux/` giữ hai executable. Portable vẫn liên kết thư viện hệ thống; DEB là luồng cài đặt ưu tiên trên Debian/Ubuntu. Các distro khác cần dependency và gói riêng theo [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) và [Debian packaging](https://v2.tauri.app/distribute/debian/).

`scripts/build/linux.sh` là tiện ích cũ build Linux ARM64 qua Docker, không phải luồng native ở trên, không tạo DEB và có thể tạo SDK/cache lớn. Không cần chạy nó để dùng app hoặc build native.

## Kiểm tra trước phát hành

Sau `npm ci`, trên mọi OS:

```sh
npm test
cargo fmt --all -- --check
cargo test --no-default-features --locked
node scripts/build/core.mjs
cargo clippy --all-targets -- -D warnings
```

Kiểm tra kích thước gói theo lệnh riêng của OS ở trên; với portable, script xuất đã đo tổng hai executable. Gói phải nhỏ hơn 20 MB; WebView và video không nằm trong gói. Installer nén nhỏ không tự chứng minh RAM hoặc kích thước sau cài; cần đo thêm trên OS đích.

Kiểm tra thủ công trên mỗi OS/CPU: mở app, chọn thư viện, tìm Anh/Việt, phát MP4, tua, phụ đề, kéo/chỉnh cỡ phụ đề rồi mở lại để kiểm persistence, thu nhỏ cửa sổ, fullscreen/PiP khi OS hỗ trợ. Đo RAM trên máy đích; không dùng số đo macOS để khẳng định Windows/Linux đạt cùng giới hạn.

`.github/workflows/desktop.yml` chứa các job macOS/Windows/Linux, test và gate kích thước. Sau khi đẩy repo lên GitHub và chạy workflow thành công, tải artifact tương ứng trong Actions; workflow hiện có không phải link download bản phát hành đã tồn tại.

## Giữ repo nhẹ sau build

Giữ gói cuối cần dùng trước khi dọn: macOS chạy script xuất vào dist; Windows/Linux giữ installer trong vị trí phân phối riêng hoặc xuất portable vào dist. Cleanup sẽ xóa target, bao gồm installer còn nằm trong target.

```sh
python3 scripts/maintenance/clean.py --toolchains
# Xem danh sách rồi mới áp dụng; đóng app trước:
python3 scripts/maintenance/clean.py --apply --toolchains
node scripts/quality/check-footprint.mjs
```

`dist/`, `files/`, SQLite, SDK/cache, target và node_modules đều gitignore. Không commit khóa học hoặc artifact. Muốn phát triển lại sau cleanup, chạy lại bước chuẩn bị. Build tạm thời có thể vượt 7 GB; mốc repo mang sang máy khác dưới 7 GB được kiểm sau cleanup.

Hiện chỉ gói macOS ARM64 đã được build/chạy GUI ở phiên bản mới. Những lệnh Windows/Linux trên đây là quy trình dựa trên cấu hình nguồn và tài liệu Tauri; chưa phải bằng chứng đã phát hành hoặc kiểm runtime trên hai OS đó.

## Dependency fix cho macOS

Cargo.toml tạm pin Wry vào revision của [PR #1856](https://github.com/tauri-apps/wry/pull/1856) để xử lý race phản hồi WebKit. Cargo.lock khóa chính xác commit; lần bootstrap/build đầu cần mạng để tải Git dependency này. Dùng `--locked`; không bỏ patch riêng trên một hệ điều hành rồi phát hành bản không khớp lockfile. Khi release Wry chính thức chứa fix, cập nhật dependency và kiểm lại phát lại/chuyển bài/đóng cửa sổ trên macOS.
