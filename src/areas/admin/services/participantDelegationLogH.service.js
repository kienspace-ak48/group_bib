const mongoose = require('mongoose');
const ParticipantDelegationLog = require('../../../model/ParticipantDelegationLog_h');

const CNAME = 'participantDelegationLogH.service.js ';

function toOid(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return null;
    return new mongoose.Types.ObjectId(String(id));
}

class ParticipantDelegationLogHService {
    _eventOid(eventId) {
        const s = String(eventId);
        return mongoose.Types.ObjectId.isValid(s) ? new mongoose.Types.ObjectId(s) : null;
    }

    /**
     * @param {object} row
     * @param {'admin'|'participant'} row.actor
     * @param {'set'|'clear'|'update'} row.action
     */
    async append(row) {
        try {
            const eoid = this._eventOid(row.event_id);
            const pid = toOid(row.participant_id);
            if (!eoid || !pid) return null;
            const doc = await ParticipantDelegationLog.create({
                event_id: eoid,
                participant_id: pid,
                actor: row.actor,
                actor_admin_id: row.actor_admin_id ? toOid(row.actor_admin_id) : undefined,
                action: row.action,
                delegate_snapshot: row.delegate_snapshot || {},
                summary: row.summary != null ? String(row.summary).slice(0, 500) : '',
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
            const limit = Math.min(500, Math.max(1, Number(options.limit) || 300));
            return await ParticipantDelegationLog.find({ event_id: eoid })
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean();
        } catch (e) {
            console.log(CNAME, e.message);
            return [];
        }
    }

    /** Lịch sử theo danh sách participant (tối đa N dòng / VĐV, mới nhất trước). */
    async listByParticipantIds(participantIds, options = {}) {
        try {
            const oids = (participantIds || [])
                .map((id) => toOid(id))
                .filter(Boolean);
            if (!oids.length) return [];
            const limitPer = Math.min(50, Math.max(1, Number(options.limitPerParticipant) || 30));
            const rows = await ParticipantDelegationLog.find({ participant_id: { $in: oids } })
                .sort({ createdAt: -1 })
                .lean();
            const per = {};
            for (const lg of rows) {
                const pid = String(lg.participant_id);
                if (!per[pid]) per[pid] = [];
                if (per[pid].length < limitPer) per[pid].push(lg);
            }
            return Object.values(per).flat();
        } catch (e) {
            console.log(CNAME, e.message);
            return [];
        }
    }
}

module.exports = new ParticipantDelegationLogHService();
