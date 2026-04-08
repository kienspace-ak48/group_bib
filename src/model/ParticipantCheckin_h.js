const mongoose = require('mongoose');

/** Snapshot người đại diện nhóm khi check-in BIB nhóm (một lần cho cả nhóm). */
const CheckinGroupRepresentativeSchema = new mongoose.Schema(
    {
        fullname: { type: String, trim: true, default: '' },
        email: { type: String, trim: true, default: '' },
        phone: { type: String, trim: true, default: '' },
        cccd: { type: String, trim: true, default: '' },
    },
    { _id: false },
);

/** Cách thực hiện check-in (ghi nhận sau này; import mặc định `import`) */
const CHECKIN_METHODS = ['scan', 'manual', 'kiosk', 'import', 'app'];

/** Trạng thái người tham dự / check-in */
const PARTICIPANT_STATUS = ['pending', 'registered', 'checked_in', 'cancelled'];

/**
 * Người tham dự check-in theo sự kiện (`event_checkin_h`).
 * `event_id` tương đương FK `event_checkin_id` trong thiết kế bảng.
 *
 * `uid`: mã duy nhất dùng cho QR / tra cứu (sinh khi import, giống logic `generateUID` ở controller cũ).
 * `qr_code`: thường trùng `uid` sau khi tạo; có thể ghi đè từ Excel nếu có cột.
 */
const ParticipantCheckinSchema = new mongoose.Schema(
    {
        uid: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        /** FK → event_checkin_h (thiết kế: event_checkin_id) */
        event_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'event_checkin_h',
            required: true,
            index: true,
        },
        fullname: { type: String, required: true },
        email: String,
        phone: String,
        dob: Date,
        gender: Boolean,
        cccd: { type: String, required: true },
        zone: String,
        /** Nội dung in QR; mặc định gán bằng uid khi import nếu trống */
        qr_code: { type: String, index: true },
        /** Token ngẫu nhiên cho URL thống nhất `/tool-checkin/scan/:token` (không dùng uid làm QR nữa). */
        qr_scan_token: { type: String, unique: true, sparse: true, index: true },
        checkin_method: {
            type: String,
            enum: CHECKIN_METHODS,
            default: 'import',
        },
        status: {
            type: String,
            enum: PARTICIPANT_STATUS,
            default: 'registered',
        },
        checkin_by: String,
        checkin_time: Date,
        bib: String,
        bib_name: String,
        /** Hạng mục / cự ly (import Excel: cột category) */
        category: String,
        item: String,
        /** Mã chip (RFID timing / gán tay) */
        chip: { type: String, trim: true, default: '' },
        /** Khung giờ nhận (vd "08:00 - 10:00") — một chuỗi */
        pickup_time_range: { type: String, default: '', maxlength: 120 },
        /** Lần gửi mail QR gần nhất (thủ công hoặc hàng loạt) */
        qr_mail_sent_at: Date,
        /** Đường dẫn public (vd /uploads/checkin/...) sau khi check-in có chữ ký */
        checkin_signature_path: String,
        /** Ảnh chụp người tham gia lúc check-in */
        checkin_photo_path: String,
        /** Thuộc nhóm ủy quyền (nếu có) — một VĐV tối đa một nhóm */
        group_authorization_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'group_authorization_h',
            default: undefined,
        },
        /** Ghi nhận khi check-in thực hiện theo nhóm ủy quyền (audit) */
        checkin_via_group_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'group_authorization_h',
            default: undefined,
        },
        /** Người đại diện nhận hộ (snapshot lúc check-in nhóm — mỗi BIB một dòng lịch sử). */
        checkin_group_representative: {
            type: CheckinGroupRepresentativeSchema,
            default: undefined,
        },
        /** Token bí mật cho link ủy quyền đơn trong mail (một VĐV một token) */
        delegation_token: {
            type: String,
            unique: true,
            sparse: true,
            index: true,
        },
        /** Ủy quyền nhận BIB — theo từng VĐV (không gộp nhóm). Nhiều VĐV có thể cùng trỏ một người nhận. */
        delegation_enabled: { type: Boolean, default: false },
        delegate_fullname: { type: String, trim: true, default: '' },
        delegate_email: { type: String, trim: true, default: '' },
        delegate_phone: { type: String, trim: true, default: '' },
        delegate_cccd: { type: String, trim: true, default: '' },
    },
    { timestamps: true },
);

ParticipantCheckinSchema.index({ event_id: 1, cccd: 1 });
ParticipantCheckinSchema.index({ group_authorization_id: 1 }, { sparse: true });

module.exports = mongoose.model('participant_checkin_h', ParticipantCheckinSchema);
module.exports.CHECKIN_METHODS = CHECKIN_METHODS;
module.exports.PARTICIPANT_STATUS = PARTICIPANT_STATUS;
