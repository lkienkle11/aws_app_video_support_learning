# AWS App Video Support Learning

Repository quản lý mã nguồn ứng dụng desktop hỗ trợ học qua video và phụ đề. Mã nguồn được tổ chức theo nhánh khóa học.

## Nhánh trong repository

| Nhánh | Vai trò |
| --- | --- |
| `main` | Chỉ chứa file `readme.md` này để giới thiệu và hướng dẫn chọn nhánh. Không chứa mã nguồn ứng dụng, dữ liệu hoặc cấu hình build. |
| [`aws/clf_c02`](https://github.com/lkienkle11/aws_app_video_support_learning/tree/aws/clf_c02) | Toàn bộ mã nguồn Cloud Study dành riêng cho khóa AWS Certified Cloud Practitioner CLF-C02, tài liệu chạy/đóng gói, scripts và kiểm thử. |

## Lấy mã nguồn ứng dụng CLF-C02

Clone trực tiếp nhánh mã nguồn:

```sh
git clone --branch aws/clf_c02 https://github.com/lkienkle11/aws_app_video_support_learning.git
cd aws_app_video_support_learning
```

Nếu đã clone repository:

```sh
git fetch origin
git switch aws/clf_c02
git pull --ff-only origin aws/clf_c02
```

Nếu chưa có nhánh local, dùng `git switch --track origin/aws/clf_c02`.

## Chạy và đóng gói

Sau khi chuyển sang `aws/clf_c02`, đọc:

- [`README.md`](https://github.com/lkienkle11/aws_app_video_support_learning/blob/aws/clf_c02/README.md): chức năng, cấu trúc và quy trình phát triển.
- [`docs/RUNNING.md`](https://github.com/lkienkle11/aws_app_video_support_learning/blob/aws/clf_c02/docs/RUNNING.md): chạy desktop trên macOS, Windows và Linux; chuẩn bị dữ liệu.
- [`docs/PACKAGING.md`](https://github.com/lkienkle11/aws_app_video_support_learning/blob/aws/clf_c02/docs/PACKAGING.md): build và đóng gói native trên từng hệ điều hành.

Ứng dụng dùng Rust/Tauri với giao diện HTML cục bộ trong cửa sổ desktop. Không có ứng dụng để chạy hoặc build ngay trên `main`.

## Dữ liệu và bản build

Video, phụ đề, SQLite chứa tiến độ/ghi chú và bản build không nằm trong Git. Nhánh mã nguồn bỏ qua `files/`, database, `dist/` và cache build. Khi chuyển máy, chép thư viện dữ liệu riêng theo RUNNING.md. Không xóa thư viện local khi chuyển nhánh hoặc cập nhật mã nguồn.

## Quy ước phát triển và lịch sử

- Phát triển, commit và build ứng dụng CLF-C02 trên `aws/clf_c02`; push nhánh đó bình thường.
- `main` giữ vai trò tài liệu điều hướng. Không merge toàn bộ ứng dụng từ nhánh khóa học vào `main`.
- `main` đã được khởi tạo lại bằng một commit gốc chỉ chứa README. Lịch sử phát triển ứng dụng trước đó vẫn được giữ trong `aws/clf_c02`.
- Bản clone cũ có thể có lịch sử `main` không liên quan với lịch sử mới. Bảo toàn thay đổi local trước khi đồng bộ hoặc clone lại; không dùng thao tác xóa dữ liệu để xử lý khác biệt lịch sử.
