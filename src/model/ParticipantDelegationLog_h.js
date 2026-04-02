const mongoose = require('mongoose');

/**
 * Lịch sử ủy quyền nhận BIB theo từng VĐV (không gộp nhóm).
 * actor: admin (BTC) hoặc participant (VĐV qua link mail).
 */
const ParticipantDelegationLogSchema = new mongoose.Schema(
    {
        event_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'event_checkin_h',
            required: true,
            index: true,
        },
        participant_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'participant_checkin_h',
            required: true,
            index: true,
        },
        actor: {
            type: String,
            enum: ['admin', 'participant'],
            required: true,
        },
        actor_admin_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'account_system',
        },
        /** set | clear | update */
        action: {
            type: String,
            enum: ['set', 'clear', 'update'],
            required: true,
        },
        delegate_snapshot: {
            fullname: { type: String, trim: true },
            email: { type: String, trim: true },
            phone: { type: String, trim: true },
            cccd: { type: String, trim: true },
        },
        /** Dòng hiển thị nhanh (vd "User - Authorized: ...") */
        summary: { type: String, trim: true, default: '' },
    },
    { timestamps: true },
);

ParticipantDelegationLogSchema.index({ event_id: 1, createdAt: -1 });
ParticipantDelegationLogSchema.index({ participant_id: 1, createdAt: -1 });

module.exports = mongoose.model('participant_delegation_log_h', ParticipantDelegationLogSchema);
