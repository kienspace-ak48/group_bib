const mongoose = require('mongoose');

const MAIL_BULK_STATUSES = ['queued', 'running', 'completed', 'failed'];

const MailBulkJobSchema = new mongoose.Schema(
    {
        event_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'event_checkin_h',
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: MAIL_BULK_STATUSES,
            default: 'queued',
            index: true,
        },
        total: { type: Number, default: 0 },
        sent: { type: Number, default: 0 },
        failed: { type: Number, default: 0 },
        /** Cursor phân trang theo `_id` participant (batch kế tiếp: `_id` > last) */
        last_participant_id: { type: mongoose.Schema.Types.ObjectId, default: null },
        /** Tối đa ~30 dòng, mỗi dòng ngắn để hiển thị UI */
        errors_sample: { type: [String], default: [] },
        started_at: Date,
        finished_at: Date,
        /** Lỗi toàn job (vd không load được mail config) */
        stop_reason: String,
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'account', default: null },
    },
    { timestamps: true },
);

MailBulkJobSchema.index({ event_id: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('mail_bulk_job', MailBulkJobSchema);
