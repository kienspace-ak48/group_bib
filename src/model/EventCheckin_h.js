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
        /**
         * Luồng: gửi mail ký miễn trừ online trước (không QR) → VĐV ký trên web → sau đó mới gửi mail QR nhận BIB.
         * Check-in tại quầy: bỏ bắt buộc chữ ký nếu đã ký online (vẫn có thể bắt buộc ảnh theo cấu hình).
         */
        online_waiver_first_flow: {
            type: Boolean,
            default: false,
        },
        /** Nội dung HTML hiển thị trên trang ký miễn trừ (do BTC soạn ở bước Khởi tạo). */
        waiver_notice_html: { type: String, default: '' },
        /** Liên kết file miễn trừ (PDF/DOC) để VĐV đọc trước khi ký. */
        waiver_document_url: { type: String, default: '' },
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
