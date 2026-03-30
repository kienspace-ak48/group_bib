const mongoose = require('mongoose');
const AuditLog = require('../../../model/audit_log.model');

const CNAME = 'auditLog.service.js ';

class AuditLogService {
    /**
     * @param {object} opts
     * @param {import('mongoose').Types.ObjectId|string} [opts.actorId]
     * @param {string} opts.action
     * @param {string} opts.resource
     * @param {string} [opts.documentId]
     * @param {string} [opts.summary]
     * @param {object} [opts.changes]
     * @param {import('express').Request} [opts.req]
     */
    async write(opts) {
        try {
            const { actorId, action, resource, documentId, summary, changes, req } = opts;
            const ip = req?.ip || req?.headers?.['x-forwarded-for']?.split?.(',')?.[0]?.trim() || '';
            await AuditLog.create({
                actor_id: actorId || undefined,
                action,
                resource,
                document_id: documentId != null ? String(documentId) : undefined,
                summary,
                changes: changes || undefined,
                ip,
                created_at: new Date(),
            });
        } catch (e) {
            console.log(CNAME, e.message);
        }
    }

    async list(options = {}) {
        const { page = 1, limit = 50, resource, actorId } = options;
        const skip = (page - 1) * limit;
        const q = {};
        if (resource) q.resource = resource;
        if (actorId && mongoose.Types.ObjectId.isValid(actorId)) q.actor_id = actorId;
        const [items, total] = await Promise.all([
            AuditLog.find(q).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
            AuditLog.countDocuments(q),
        ]);
        return { items, total, page, limit, pages: Math.ceil(total / limit) || 1 };
    }
}

module.exports = new AuditLogService();
