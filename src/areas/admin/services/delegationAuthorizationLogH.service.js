const mongoose = require('mongoose');
const DelegationAuthorizationLog = require('../../../model/DelegationAuthorizationLog_h');

const CNAME = 'delegationAuthorizationLogH.service.js ';

function toOid(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return null;
    return new mongoose.Types.ObjectId(String(id));
}

class DelegationAuthorizationLogHService {
    _eventOid(eventId) {
        const s = String(eventId);
        return mongoose.Types.ObjectId.isValid(s) ? new mongoose.Types.ObjectId(s) : null;
    }

    /**
     * @param {object} row
     * @param {string} row.kind
     * @param {string} [row.mail_to]
     * @param {boolean} [row.mail_sent]
     * @param {string} [row.mail_error]
     */
    async append(row) {
        try {
            const eoid = this._eventOid(row.event_id);
            if (!eoid) return null;
            const doc = await DelegationAuthorizationLog.create({
                event_id: eoid,
                group_authorization_id: row.group_authorization_id ? toOid(row.group_authorization_id) : undefined,
                participant_id: row.participant_id ? toOid(row.participant_id) : undefined,
                kind: row.kind,
                representative: row.representative || undefined,
                participant_bib: row.participant_bib != null ? String(row.participant_bib) : '',
                participant_fullname: row.participant_fullname != null ? String(row.participant_fullname) : '',
                source: row.source || 'admin_group_tab',
                actor_admin_id: row.actor_admin_id ? toOid(row.actor_admin_id) : undefined,
                mail_to: row.mail_to != null ? String(row.mail_to).trim() : '',
                mail_sent: !!row.mail_sent,
                mail_error: row.mail_error != null ? String(row.mail_error) : '',
                group_name: row.group_name != null ? String(row.group_name).trim() : '',
                members_snapshot: Array.isArray(row.members_snapshot)
                    ? row.members_snapshot.map((m) => ({
                          bib: m && m.bib != null ? String(m.bib) : '',
                          fullname: m && m.fullname != null ? String(m.fullname) : '',
                          category: m && m.category != null ? String(m.category) : '',
                      }))
                    : undefined,
            });
            return doc.toObject();
        } catch (e) {
            console.log(CNAME, e.message);
            return null;
        }
    }

    async listByEventId(eventId, options = {}) {
        try {
            const eoid = this._eventOid(eventId);
            if (!eoid) return [];
            const limit = Math.min(500, Math.max(1, Number(options.limit) || 200));
            return await DelegationAuthorizationLog.find({ event_id: eoid })
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean();
        } catch (e) {
            console.log(CNAME, e.message);
            return [];
        }
    }
}

module.exports = new DelegationAuthorizationLogHService();
