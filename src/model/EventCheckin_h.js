const mongoose = require('mongoose');
const slugify = require('slugify');

/** Giai đoạn workflow: 0 Khởi tạo | 1 Quản lý người tham dự | 2 Mail QR | 3 Check-in | 4 Kết thúc */
const WORKFLOW_STEPS = {
    INIT: 0,
    ATHLETES: 1,
    MAIL_QR: 2,
    CHECKIN: 3,
    DONE: 4,
};

const eventSchema = new mongoose.Schema(
    {
        name: String,
        slug: String,
        short_id: String,
        desc: String,
        img_thumb: String,
        img_banner: String,
        location: String,
        start_date: Date,
        end_date: Date,
        is_show: { type: Boolean, default: false },
        status: String,
        race_type: String,
        organizer_name: String,
        organizer_web: String,
        organizer_fanpage: String,
        organizer_zalo: String,
        /** Bước đang mở / resume (0–4) */
        workflow_step: {
            type: Number,
            default: WORKFLOW_STEPS.INIT,
            min: 0,
            max: 4,
        },
        /**
         * Bước cao nhất đã xác nhận hoàn thành (-1 = chưa bước nào).
         * Cho phép xem tới bước max_confirmed_step + 1 (bước đang làm); không cho Next sang bước sau khi chưa xác nhận bước hiện tại.
         */
        max_confirmed_step: {
            type: Number,
            default: -1,
            min: -1,
            max: 4,
        },
        /**
         * Cấu hình khi check-in tại tool: không thu thập | chỉ chữ ký | chỉ ảnh | cả hai.
         * none | signature | photo | both
         */
        checkin_capture_mode: {
            type: String,
            enum: ['none', 'signature', 'photo', 'both'],
            default: 'both',
        },
        /**
         * Bật ủy quyền đơn (link trong mail QR): VĐV forward cho người nhận hộ mở form công khai.
         * Mặc định true; tắt khi không dùng luồng tự phục vụ.
         */
        single_delegation_enabled: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true },
);

// pre save
eventSchema.pre('save', function (next) {
    if (!this.slug || this.slug.trim() === '') {
        this.slug = slugify(this.name + '-' + Date.now(), { lower: true, strict: true, locale: 'vi' });
    }
    next();
});

module.exports = mongoose.model('event_checkin_h', eventSchema);
module.exports.WORKFLOW_STEPS = WORKFLOW_STEPS;
