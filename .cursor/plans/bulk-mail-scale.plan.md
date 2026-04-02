---
name: Bulk mail scale 1k-10k + UI tiến trình
overview: Job nền + API poll; hiển thị trực quan tiến trình gửi mail (progress bar, số liệu, trạng thái) trong bước Mail.
todos:
    - id: model-job
      content: Thêm model MailBulkJob + index + (tuỳ chọn) endpoint GET status
      status: pending
    - id: service-batch
      content: Refactor eventBulkMail batch/cursor, p-limit, retry 429, updateOne qr_mail_sent_at
      status: pending
    - id: worker
      content: Worker trong server.js, idempotent resume
      status: pending
    - id: api
      content: POST send-bulk trả jobId; GET bulk-job status; chặn trùng job running
      status: pending
    - id: ui-visual
      content: Khối UI trực quan tiến trình (progress bar, %, sent/total/failed, badge trạng thái, poll)
      status: pending
isProject: true
---

# Mở rộng gửi mail hàng loạt 1k–10k + hiển thị trực quan

## 1. Kiến trúc đã thống nhất (tóm tắt)

- **Không** chờ một HTTP request cho đến khi gửi xong.
- **Mongo** lưu job (`MailBulkJob`): `status`, `total`, `sent`, `failed`, thời gian, mẫu lỗi.
- **POST** tạo job → trả `jobId` ngay.
- **Worker** xử lý batch + giới hạn song song + retry 429.
- **GET** trả tiến độ cho UI poll.

Chi tiết kỹ thuật (batch, `updateOne`, worker) giữ nguyên như phiên bản plan trước.

---

## 2. Hiển thị trực quan tình trạng gửi mail (bổ sung)

Mục tiêu: admin **nhìn một lần** là biết job đang chạy / xong / lỗi và **tiến độ** thực.

### 2.1 Vị trí

- Trang `**[_step_mail.ejs](src/views/admin/event/_step_mail.ejs)`** (bước 3 Mail), ngay dưới nút **Gửi mail hàng loạt / cạnh `#send_bulk_status`.

### 2.2 Thành phần UI (Bootstrap 5 + CSS hiện có)

| Thành phần               | Mô tả                                                                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Thanh tiến độ**        | `progress` (Bootstrap): `width` = `Math.round((sent + failed) / total * 100)` hoặc `sent/total` tùy cách định nghĩa “hoàn thành” (nên: phần trăm đã xử lý = `(sent+failed)/total`). |
| **Số liệu dòng chữ**     | Ví dụ: `Đã gửi: 1.240 / 10.000` · `Lỗi: 3` (nếu `failed > 0` dùng `text-warning` / `text-danger`).                                                                                  |
| **Phần trăm**            | Nhãn `42%` cạnh thanh hoặc trong `<span class="progress-bar">`.                                                                                                                     |
| **Badge trạng thái**     | `Đang gửi…` (primary/pulse) · `Hoàn tất` (success) · `Thất bại` (danger) · `Đang chờ` (secondary) nếu có queue.                                                                     |
| **Thời gian** (tuỳ chọn) | `Cập nhật: HH:mm:ss` mỗi lần poll; hoặc “Chạy từ …” nếu API trả `started_at`.                                                                                                       |
| **Spinner**              | `spinner-border spinner-border-sm` chỉ khi `status === running`.                                                                                                                    |

### 2.3 Hành vi

- **Trước khi gửi**: khối tiến trình ẩn hoặc chỉ placeholder.
- **Sau POST** (có `jobId`): hiện khối, bắt đầu **poll** GET mỗi 2–5s, cập nhật thanh + số.
- **Khi `completed` / `failed`**: dừng poll, tắt spinner, giữ thanh 100% (hoặc màu đỏ nếu partial failure), có thể `toast` / dòng `send_bulk_status` tóm tắt.
- **Nút “Gửi mail hàng loạt`**:` disabled`trong lúc`running` (và khi đã có job active cho event — theo API).

### 2.4 API (để UI đủ dữ liệu)

GET `/admin/event/:id/mail/bulk-job/:jobId` (hoặc `latest`) trả tối thiểu:

- `status`, `total`, `sent`, `failed`, `started_at`, `finished_at`
- `errors_sample` (mảng ngắn) để hiển thị dưới thanh (collapse “Chi tiết lỗi” nếu cần).

### 2.5 Không gian / a11y

- `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax` cho thanh.
- Màu và chữ đủ tương phản (tránh chỉ dựa vào màu).

---

## 3. File chính

- `[_step_mail.ejs](src/views/admin/event/_step_mail.ejs)` — markup khối tiến trình + JS poll + cập nhật DOM.
- `[public/css/main.css](src/main.css)` (build) — chỉ nếu cần chỉnh nhỏ (thường Bootstrap đủ).

---

## 4. Tách biệt với “chỉ text”

- `#send_bulk_status` hiện có có thể **gộp** hoặc **đồng bộ** với dòng tiêu đề ngắn; phần **trực quan** chính là **progress + badge + số từng bước**, không chỉ một chuỗi chữ “Đang gửi…”.
