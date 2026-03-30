const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
    {
        actor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'account_system', index: true },
        action: { type: String, required: true, index: true },
        resource: { type: String, required: true, index: true },
        document_id: String,
        summary: String,
        changes: mongoose.Schema.Types.Mixed,
        ip: String,
        created_at: { type: Date, default: Date.now, index: true },
    },
    { timestamps: false },
);

auditLogSchema.index({ created_at: -1, actor_id: 1 });

module.exports = mongoose.model('audit_log', auditLogSchema);
