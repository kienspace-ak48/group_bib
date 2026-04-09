const mongoose = require('mongoose');

/**
 * Sự kiện từ SendGrid Event Webhook (delivered, bounce, …) — gắn sự kiện/VĐV qua custom args gb_eid, gb_pid.
 */
const SendGridMailEventSchema = new mongoose.Schema(
    {
        sg_event_id: { type: String, required: true, unique: true, index: true },
        event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'event_checkin_h', default: null, index: true },
        participant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'participant_checkin_h', default: null },
        to_email: { type: String, default: '', index: true },
        sg_message_id: { type: String, default: '' },
        event_type: { type: String, default: '' },
        mail_kind: { type: String, default: '' },
        reason: { type: String, default: '' },
        /** Thời điểm SendGrid ghi nhận (từ trường timestamp trong webhook) */
        ts: { type: Date, default: Date.now, index: true },
    },
    { timestamps: true },
);

SendGridMailEventSchema.index({ event_id: 1, ts: -1 });

module.exports = mongoose.model('sendgrid_mail_event', SendGridMailEventSchema);
