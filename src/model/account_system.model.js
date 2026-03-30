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
        /** Quyền chi tiết cho role admin (vd: admin.event, admin.system) */
        permissions: [{ type: String }],
        last_login_at: Date,
        /** Tăng khi đổi quyền để vô hiệu JWT cũ */
        token_version: { type: Number, default: 0 },
    },
    { timestamps: true },
);

module.exports = mongoose.model('account_system', AccountSystemSchema);
module.exports.ROLES = ROLES;
