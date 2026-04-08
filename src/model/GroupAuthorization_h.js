const mongoose = require('mongoose');

/**
 * Nhóm ủy quyền: một đại diện được gắn nhiều participant (BIB) trong cùng sự kiện.
 */
const RepresentativeSchema = new mongoose.Schema(
    {
        fullname: { type: String, required: true, trim: true },
        email: { type: String, trim: true },
        phone: { type: String, trim: true },
        cccd: { type: String, trim: true },
    },
    { _id: false },
);

const GroupAuthorizationSchema = new mongoose.Schema(
    {
        event_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'event_checkin_h',
            required: true,
            index: true,
        },
        representative: { type: RepresentativeSchema, required: true },
        participant_ids: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'participant_checkin_h',
            },
        ],
        /** Tên nhóm (BTC đặt khi tạo nhóm theo danh sách BIB ở tab Nhóm) */
        group_name: { type: String, trim: true, default: '' },
        /** Token không đoán được — tra cứu trong tool check-in cùng sự kiện */
        token: { type: String, unique: true, sparse: true, index: true },
        /** Cách tạo nhóm: link mail (ủy quyền đơn) vs admin */
        creation_source: {
            type: String,
            enum: ['email_single_link', 'admin_group_tab', 'admin_participant_modal'],
        },
    },
    { timestamps: true },
);

GroupAuthorizationSchema.index({ event_id: 1, createdAt: -1 });

module.exports = mongoose.model('group_authorization_h', GroupAuthorizationSchema);
