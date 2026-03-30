---
name: Flow check-in sự kiện
overview: "Tóm tắt flow admin (event_checkin_h + participant_checkin_h), workspace 0–4, route chính. Bản đầy đủ trong docs/checkin-flow.md."
todos: []
isProject: true
---

# Flow check-in (bản rút gọn cho Cursor Plan)

Nguồn đầy đủ và sơ đồ Mermaid: [docs/checkin-flow.md](../../docs/checkin-flow.md).

## Dữ liệu

- `event_checkin_h`: sự kiện, `workflow_step`, `max_confirmed_step`.
- `participant_checkin_h`: người tham dự, `event_id`, `uid`, `fullname`, `cccd`, `bib`, `chip_id`, `checkin_status`.

## Workspace admin (0 → 4)

0 Khởi tạo | 1 Người tham dự (import Excel / thủ công) | 2 Mail QR | 3 Check-in | 4 Kết thúc.

Quy tắc: chỉ mở tới bước `max_confirmed_step + 1`; xác nhận lần lượt qua `POST /admin/event/:id/step/confirm`.

## Route chính

- `GET/POST /admin/event` — danh sách / tạo sự kiện
- `GET /admin/event/:id/step/:step` — workspace
- `POST .../participants/import`, `.../manual`, `.../participants/:participantId/delete`
- `POST /admin/event/:id/step/confirm` — xác nhận bước

## Tool công khai

View `src/views/tool/checkin.ejs` — route `/tool-checkin` có thể gắn sau; luồng đầy đủ hiện ở admin.
