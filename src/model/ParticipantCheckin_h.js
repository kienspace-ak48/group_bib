const mongoose = require('mongoose');

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
        distance: String,
        item: String,
        pickup_start: Date,
        pickup_end: Date,
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
    },
    { timestamps: true },
);

ParticipantCheckinSchema.index({ event_id: 1, cccd: 1 });
ParticipantCheckinSchema.index({ group_authorization_id: 1 }, { sparse: true });

module.exports = mongoose.model('participant_checkin_h', ParticipantCheckinSchema);
module.exports.CHECKIN_METHODS = CHECKIN_METHODS;
module.exports.PARTICIPANT_STATUS = PARTICIPANT_STATUS;
