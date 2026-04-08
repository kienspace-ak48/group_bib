const mongoose = require('mongoose');

const RepresentativeSnapshotSchema = new mongoose.Schema(
    {
        fullname: { type: String, trim: true },
        email: { type: String, trim: true },
        phone: { type: String, trim: true },
        cccd: { type: String, trim: true },
    },
    { _id: false },
);

/**
 * Lịch sử thao tác ủy quyền nhóm (audit): gán / gỡ VĐV, xóa nhóm; trạng thái gửi mail đại diện.
 */
const DelegationAuthorizationLogSchema = new mongoose.Schema(
    {
        event_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'event_checkin_h',
            required: true,
            index: true,
        },
        group_authorization_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'group_authorization_h',
            index: true,
        },
        participant_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'participant_checkin_h',
        },
        kind: {
            type: String,
            enum: ['participant_assigned', 'participant_unassigned', 'group_deleted', 'group_mail_sent'],
            required: true,
            index: true,
        },
        representative: { type: RepresentativeSnapshotSchema, default: undefined },
        participant_bib: { type: String, trim: true },
        participant_fullname: { type: String, trim: true },
        source: {
            type: String,
            enum: ['admin_group_tab', 'admin_participant_modal', 'email_single_link'],
            default: 'admin_group_tab',
        },
        actor_admin_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'account_system',
        },
        mail_to: { type: String, trim: true },
        mail_sent: { type: Boolean, default: false },
        mail_error: { type: String, default: '' },
        /** Tên nhóm (snapshot khi gán / gỡ — tiện lọc lịch sử) */
        group_name: { type: String, trim: true, default: '' },
        /** Danh sách thành viên (kind group_mail_sent — hiển thị khi mở rộng) */
        members_snapshot: [
            {
                bib: { type: String, trim: true, default: '' },
                fullname: { type: String, trim: true, default: '' },
                category: { type: String, trim: true, default: '' },
            },
        ],
    },
    { timestamps: true },
);

DelegationAuthorizationLogSchema.index({ event_id: 1, createdAt: -1 });

module.exports = mongoose.model('delegation_authorization_log_h', DelegationAuthorizationLogSchema);
