const mongoose = require('mongoose');

const ROLES = ['user', 'admin', 'super_admin', 'account_checkin'];

const AccountSystemSchema = new mongoose.Schema(
    {
        name: String,
        username: String,
        password: String,
        email: String,
        phone: String,
        avatar: String,
        status: { type: Boolean, default: false },
        /** user | admin | super_admin | account_checkin */
        role: {
            type: String,
            enum: ROLES,
            default: 'user',
            set(v) {
                if (v == null) return v;
                const t = String(v).trim();
                return t || 'user';
            },
        },
        /** Quyền chi tiết cho role admin (vd: admin.event, admin.system.accounts) */
        permissions: [{ type: String }],
        last_login_at: Date,
        /** Tăng khi đổi quyền để vô hiệu JWT cũ */
        token_version: { type: Number, default: 0 },
        /** Khi role = account_checkin: sự kiện được phép check-in (FK event_checkin_h) */
        checkin_event_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'event_checkin_h',
            default: null,
        },
    },
    { timestamps: true },
);

module.exports = mongoose.model('account_system', AccountSystemSchema);
module.exports.ROLES = ROLES;
