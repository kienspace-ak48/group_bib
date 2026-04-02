---
name: ""
overview: ""
todos: []
isProject: false
---

# Plan (lần 2): ủy quyền nhận nhóm + check-in hàng loạt vs check-in cá nhân

## Thay đổi hướng sản phẩm (theo yêu cầu)

- **Tại quầy nhận nhóm**, TNV cần **xem toàn bộ danh sách** người được ủy quyền (trong nhóm).
- **Check-in theo nhóm** được hiểu là: **một thao tác (hoặc một luồng ngắn) cập nhật trạng thái đã check-in cho toàn bộ (hoặc tập con) các participant trong nhóm**, thay vì bắt buộc TNV vào từng màn `info` như hiện tại.
- Điều này **lệch** với luồng code hiện tại: `[group_auth.ejs](src/views/tool/group_auth.ejs)` đang dẫn **Check-in từng dòng** → `[info.ejs](src/views/tool/info.ejs)` (chữ ký/ảnh **theo từng VĐV**).

**Cần quyết định thiết kế trước khi code:** “một lần bấm = check-in hết” có **vẫn thu chữ ký/ảnh cho từng BIB** không? Nếu có, “một thao tác” thực chất vẫn là **nhiều bước capture** (chỉ gộp UI). Nếu không (một ảnh/chữ ký cho cả nhóm), cần **quy tắc pháp lý/audit** và chỉnh model (vd một file đính kèm chung vs per participant).

---

## Xung đột cố hữu: check-in cá nhân vs check-in nhóm


| Tình huống                         | Mô tả                                                                            | Nguy cơ                                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Trùng participant**              | Cùng một VĐV vừa quét QR cá nhân check-in, vừa nằm trong nhóm sắp “check-in hết” | Hai nguồn cập nhật `status`; race; log sai “ai check-in trước”.                             |
| **Một phần đã check-in**           | Trong nhóm 5 người, 2 đã check-in cá nhân trước đó                               | Batch “tất cả” có thể **gây lỗi**, **bỏ qua thầm**, hoặc **ghi đè** — cần quy tắc rõ.       |
| **Đồng thời (2 TNV)**              | TNV A mở nhóm, TNV B quét QR một VĐV trong nhóm cùng lúc                         | Cập nhật song song trên cùng document → cần **atomic update** / **idempotent** API.         |
| **Sai thứ tự thao tác**            | Batch nhóm chạy trước, sau đó ai đó quét QR cá nhân của người đã trong batch     | Thường an toàn nếu check-in cá nhân = idempotent “đã check-in rồi”; ngược lại cần kiểm tra. |
| **Nhóm thay đổi sau khi gửi mail** | BTC sửa nhóm / gỡ BIB sau khi VĐV đã nhận QR cá nhân                             | DS trên màn nhóm không khớp kỳ vọng; cần **phiên bản nhóm** hoặc **refresh server-side**.   |


---

## Nguy cơ khác (cần có trong plan)

1. **Audit & truy vết:** Hiện có `checkin_via_group_id` khi đi qua nhóm từng bước. Nếu batch một API: cần **một bản ghi batch** (actor TNV, thời điểm, id nhóm, danh sách participant đã cập nhật).
2. **Chữ ký / ảnh:** `checkin_capture_mode` đang áp **theo phiên** từng VĐV. Batch “một nút” **không** tự động thỏa “bắt buộc ký từng người” — phải tách **chính sách nhóm** (vd chỉ khi `none`) vs **wizard nhiều bước**.
3. **Gian lận / nhầm nhóm:** QR nhóm lộ → ai đăng nhập TNV cũng batch được — giảm rủi ro bằng **chỉ role check-in + đúng sự kiện** (đã có) + có thể **xác nhận đại diện** (CCCD) trước batch.
4. **Hiệu năng:** Nhóm lớn (hàng trăm BIB) — transaction dài, timeout; nên **giới hạn kích thước nhóm** hoặc **chunk** + báo cáo từng phần.

---

## Validate kỹ lúc tạo / sửa nhóm ủy quyền (đề xuất bổ sung)

**Ý tưởng của bạn:** ngay khi BTC (hoặc sau này VĐV self-service) **tạo nhóm**, server **kiểm tra từng VĐV đã check-in chưa** — giảm xung đột sau này giữa “đưa vào nhóm để nhận hộ” và “người đó đã lên quầy lấy BIB rồi”.

**Trạng thái trong DB:** `[ParticipantCheckin_h](src/model/ParticipantCheckin_h.js)` dùng `status` (`registered` | `checked_in` | …). Hiện tại `[_validateParticipantIds](src/areas/admin/services/groupAuthorizationH.service.js)` chỉ chặn **trùng nhóm khác**, **chưa** chặn người đã `checked_in`.

### Hành vi đề xuất


| Chính sách                       | Mô tả                                                                                                                                                         | Ưu / nhược                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Chặn cứng (đã chốt — strict)** | Nếu **bất kỳ** BIB trong payload đã `status === 'checked_in'` → **từ chối toàn bộ** tạo/sửa; message **liệt kê từng BIB** và lý do. Không tạo nhóm “một nửa”. | Rõ ràng; tránh nhóm chứa người “đã nhận rồi”. |
| **Chỉ cảnh báo (soft)**          | Cho phép lưu nhưng hiển thị cảnh báo — dễ gây nhầm vận hành.                                                                                                  | Ít dùng trừ khi có lý do đặc biệt.            |
| **Tự động loại (auto-exclude)**  | Bỏ khỏi danh sách những người đã check-in, chỉ thêm người còn lại.                                                                                            | Cần UX rõ “đã bỏ BIB X vì đã check-in”.       |


**Triển khai kỹ thuật:** trong `create` / `update` của `groupAuthorizationH.service`, sau khi có danh sách `participant` hợp lệ, thêm bước query hoặc mở rộng `select` đã có thành `status, bib` và:

- Nếu `status === 'checked_in'` → áp chính sách đã chọn ở bảng trên.

**Lưu ý thời điểm:** validate **tại thời điểm tạo/sửa** không loại trừ race sau đó (ai đó check-in cá nhân **sau** khi nhóm đã được tạo). Vì vậy vẫn cần **idempotent / skip** ở bước check-in nhóm (mục A bên dưới). Hai lớp bảo vệ: **tạo nhóm sạch** + **lúc nhận không ghi đè bừa**.

**Self-service (nếu có sau):** cùng một rule — không cho gán người đã check-in vào nhóm mới.

### Hiển thị lỗi cho admin (đã chốt)

- **Strict** = một BIB lỗi → **cả request fail**; admin phải sửa danh sách và gửi lại.
- **UI:** không chỉ một câu chung; cần **“log” dạng danh sách** (bảng hoặc bullet) **BIB → lý do** (vd *đã check-in*, *không tồn tại*, *đã thuộc nhóm khác*).
- **Triển khai gợi ý:** mở rộng `message` từ service thành **chuỗi nhiều dòng / HTML danh sách** hoặc trả về cấu trúc `errors: [{ bib, code, text }]` và render trong flash EJS; nếu sau này AJAX submit thì hiển thị **cùng modal** không đóng form.

---

## Hướng giải quyết kỹ thuật (đưa vào plan triển khai)

### A. Quy tắc trạng thái (khuyến nghị ghi rõ trong nghiệp vụ)

- **Check-in cá nhân** và **check-in nhóm** đều gọi **cùng một hàm domain** “đánh dấu participant đã check-in” (idempotent: `nếu đã checked_in → không lỗi, trả về skipped`).
- **Batch nhóm:** với mỗi `participant_id` trong nhóm:
  - Nếu **đã** `checked_in` → **bỏ qua** (hoặc báo trong response `already_checked: [...]`).
  - Nếu **chưa** → cập nhật + gắn `checkin_via_group_id` + (tuỳ chính sách) metadata batch.

### B. Tránh race

- Dùng **một transaction MongoDB** cho batch (hoặc `updateMany` có điều kiện `status != checked_in`).
- Hoặc **version field** / chỉ update khi `status` khớp kỳ vọng.

### C. UI TNV (làm rõ trong plan UX)

- **Danh sách đầy đủ** + trạng thái từng người (đã / chưa).
- Nút **“Hoàn tất nhận nhóm”** chỉ kích hoạt khi:
  - **Phương án 1 (đơn giản):** `checkin_capture_mode === 'none'` — cho phép batch thuần trạng thái.
  - **Phương án 2:** vẫn bắt capture từng người — UI là **wizard / checklist** trong một trang (không phải một nút duy nhất trừ khi nới policy).

### D. Cấu hình giải (từ plan trước)

- Cờ “cho phép ủy quyền / nhận nhóm” + (nên có) cờ phụ: **“cho phép check-in nhóm hàng loạt khi không thu chữ ký/ảnh”** để tránh mâu thuẫn với `both`.

---

## Khác biệt so với plan (lần 1)


| Trước                                                     | Sau (yêu cầu mới)                                                                                                            |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Nhấn mạnh CTA mail + khai báo đại diện                    | Vẫn có thể giữ, nhưng **trọng tâm vận hành** là **màn TNV: DS đủ + cơ chế batch** và **xử lý conflict** với check-in cá nhân |
| Check-in nhóm = lần lượt từng `info` (đúng code hiện tại) | **Đổi / bổ sung:** endpoint + UI **batch** hoặc wizard gộp; **phân tích conflict** bắt buộc                                  |


---

## Việc cần làm khi triển khai (checklist ngắn)

1. **Validate strict** trong `groupAuthorizationH.service`: đã `checked_in` + trùng nhóm + không tồn tại — **fail cả request**; trả về **danh sách lỗi theo BIB**. **Flash / view admin** render **bảng hoặc list** (không một dòng chung). Xem tài liệu flow: `[docs/group-bib-delegation-flow.md](docs/group-bib-delegation-flow.md)`.
2. Chốt **chính sách capture** khi batch (none-only vs wizard đa bước vs một chứng từ chung).
3. Thiết kế API batch + idempotent + response `updated` / `skipped`.
4. Sửa / thêm view TNV: bảng đủ + nút batch + thông báo conflict rõ ràng.
5. (Tuỳ chọn) Cập nhật mail/plan self-service link — không làm thay đổi QR cá nhân (đã phân tích trước đó).

---

## Tài liệu tham chiếu code

- Nhóm + token: `[GroupAuthorization_h](src/model/GroupAuthorization_h.js)`, `[groupAuthorizationH.service.js](src/areas/admin/services/groupAuthorizationH.service.js)`
- Trang nhóm hiện tại: `[group_auth.ejs](src/views/tool/group_auth.ejs)`, `[toolCheckin.controller.js](src/controller/toolCheckin.controller.js)` (`groupAuthByToken`)
- Check-in POST: cùng controller (check-in) — cần tái sử dụng logic cho batch

