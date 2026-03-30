const mongoose = require('mongoose');

const loginHistorySchema = new mongoose.Schema(
    {
        account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'account_system', index: true },
        at: { type: Date, default: Date.now, index: true },
        ip: String,
        user_agent: String,
        success: { type: Boolean, default: true },
        failure_reason: String,
        method: { type: String, default: 'password' },
    },
    { timestamps: false },
);

module.exports = mongoose.model('login_history', loginHistorySchema);
