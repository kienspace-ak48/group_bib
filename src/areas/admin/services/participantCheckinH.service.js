const mongoose = require('mongoose');
const ParticipantCheckinH = require('../../../model/ParticipantCheckin_h');

const CNAME = 'participantCheckinH.service.js ';

class ParticipantCheckinHService {
    async findByEventId(eventId, options = {}) {
        try {
            const sid = String(eventId);
            const q = mongoose.Types.ObjectId.isValid(sid)
                ? { $or: [{ event_id: sid }, { event_id: new mongoose.Types.ObjectId(sid) }] }
                : { event_id: eventId };
            return await ParticipantCheckinH.find(q)
                .sort({ createdAt: -1 })
                .limit(options.limit || 500)
                .lean();
        } catch (e) {
            console.log(CNAME, e.message);
            return [];
        }
    }

    async countByEventId(eventId) {
        try {
            const sid = String(eventId);
            const q = mongoose.Types.ObjectId.isValid(sid)
                ? { $or: [{ event_id: sid }, { event_id: new mongoose.Types.ObjectId(sid) }] }
                : { event_id: eventId };
            return await ParticipantCheckinH.countDocuments(q);
        } catch (e) {
            console.log(CNAME, e.message);
            return 0;
        }
    }

    async getById(id) {
        try {
            if (!mongoose.Types.ObjectId.isValid(id)) return null;
            return await ParticipantCheckinH.findById(id).lean();
        } catch (e) {
            console.log(CNAME, e.message);
            return null;
        }
    }

    _eventIdQuery(eventId) {
        const sid = String(eventId);
        return mongoose.Types.ObjectId.isValid(sid)
            ? { $or: [{ event_id: sid }, { event_id: new mongoose.Types.ObjectId(sid) }] }
            : { event_id: eventId };
    }

    async deleteByEventId(eventId) {
        try {
            const q = this._eventIdQuery(eventId);
            const r = await ParticipantCheckinH.deleteMany(q);
            return r.deletedCount;
        } catch (e) {
            console.log(CNAME, e.message);
            return 0;
        }
    }

    async insertMany(docs, options = {}) {
        try {
            if (!docs || !docs.length) return { inserted: 0, err: null };
            const result = await ParticipantCheckinH.insertMany(docs, { ordered: false, ...options });
            return { inserted: result.length, err: null };
        } catch (e) {
            const inserted = e.insertedDocs ? e.insertedDocs.length : 0;
            console.log(CNAME, e.message);
            return { inserted, err: e };
        }
    }

    async createOne(payload) {
        try {
            const doc = new ParticipantCheckinH(payload);
            await doc.save();
            return doc.toObject();
        } catch (e) {
            console.log(CNAME, e.message);
            return null;
        }
    }

    async findOneByEventCccd(eventId, cccd) {
        try {
            const c = String(cccd || '').trim();
            if (!c) return null;
            const q = { ...this._eventIdQuery(eventId), cccd: c };
            return await ParticipantCheckinH.findOne(q).lean();
        } catch (e) {
            console.log(CNAME, e.message);
            return null;
        }
    }

    /** Xóa một VĐV thuộc đúng sự kiện */
    async deleteByIdAndEvent(participantId, eventId) {
        try {
            if (!mongoose.Types.ObjectId.isValid(participantId) || !mongoose.Types.ObjectId.isValid(String(eventId)))
                return false;
            const doc = await ParticipantCheckinH.findById(participantId).lean();
            if (!doc || !doc.event_id) return false;
            if (String(doc.event_id) !== String(eventId)) return false;
            const r = await ParticipantCheckinH.deleteOne({ _id: participantId });
            return r.deletedCount === 1;
        } catch (e) {
            console.log(CNAME, e.message);
            return false;
        }
    }
}

module.exports = new ParticipantCheckinHService();
