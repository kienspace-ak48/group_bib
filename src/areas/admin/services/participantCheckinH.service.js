const mongoose = require('mongoose');
const ParticipantCheckinH = require('../../../model/ParticipantCheckin_h');

const CNAME = 'participantCheckinH.service.js ';

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class ParticipantCheckinHService {
    _buildParticipantFilterQuery(eventId, filters = {}) {
        const andParts = [this._eventIdQuery(eventId)];
        const addRegex = (field, val) => {
            const t = String(val || '').trim();
            if (!t) return;
            andParts.push({ [field]: new RegExp(escapeRegex(t), 'i') });
        };
        addRegex('fullname', filters.fullname);
        addRegex('bib', filters.bib);
        addRegex('phone', filters.phone);
        addRegex('cccd', filters.cccd);
        return { $and: andParts };
    }

    async findByEventIdWithFilters(eventId, filters = {}, options = {}) {
        try {
            const q = this._buildParticipantFilterQuery(eventId, filters);
            return await ParticipantCheckinH.find(q)
                .sort({ createdAt: -1 })
                .skip(options.skip || 0)
                .limit(Math.min(100, Math.max(1, options.limit || 20)))
                .lean();
        } catch (e) {
            console.log(CNAME, e.message);
            return [];
        }
    }

    async countByEventIdWithFilters(eventId, filters = {}) {
        try {
            const q = this._buildParticipantFilterQuery(eventId, filters);
            return await ParticipantCheckinH.countDocuments(q);
        } catch (e) {
            console.log(CNAME, e.message);
            return 0;
        }
    }

    /** Email có dạng hợp lệ cơ bản (gửi mail hàng loạt) */
    _emailQuery() {
        return { email: { $regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, $options: 'i' } };
    }

    async countWithValidEmailByEventId(eventId) {
        try {
            const q = { $and: [this._eventIdQuery(eventId), this._emailQuery()] };
            return await ParticipantCheckinH.countDocuments(q);
        } catch (e) {
            console.log(CNAME, e.message);
            return 0;
        }
    }

    async findByEventIdWithValidEmail(eventId) {
        try {
            const q = { $and: [this._eventIdQuery(eventId), this._emailQuery()] };
            return await ParticipantCheckinH.find(q).lean();
        } catch (e) {
            console.log(CNAME, e.message);
            return [];
        }
    }

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

    async findOneByEventCccd(eventId, cccd, excludeParticipantId) {
        try {
            const c = String(cccd || '').trim();
            if (!c) return null;
            const q = { ...this._eventIdQuery(eventId), cccd: c };
            if (excludeParticipantId && mongoose.Types.ObjectId.isValid(String(excludeParticipantId))) {
                q._id = { $ne: new mongoose.Types.ObjectId(String(excludeParticipantId)) };
            }
            return await ParticipantCheckinH.findOne(q).lean();
        } catch (e) {
            console.log(CNAME, e.message);
            return null;
        }
    }

    async setQrMailSentAt(participantId, eventId, at) {
        try {
            if (!mongoose.Types.ObjectId.isValid(participantId) || !mongoose.Types.ObjectId.isValid(String(eventId)))
                return null;
            const doc = await ParticipantCheckinH.findById(participantId);
            if (!doc || String(doc.event_id) !== String(eventId)) return null;
            doc.qr_mail_sent_at = at instanceof Date ? at : new Date();
            await doc.save();
            return doc.toObject();
        } catch (e) {
            console.log(CNAME, e.message);
            return null;
        }
    }

    async updateByIdAndEvent(participantId, eventId, payload) {
        try {
            if (!mongoose.Types.ObjectId.isValid(participantId) || !mongoose.Types.ObjectId.isValid(String(eventId)))
                return null;
            const doc = await ParticipantCheckinH.findById(participantId);
            if (!doc || String(doc.event_id) !== String(eventId)) return null;
            Object.assign(doc, payload);
            await doc.save();
            return doc.toObject();
        } catch (e) {
            console.log(CNAME, e.message);
            return null;
        }
    }

    /** Xóa một người tham dự thuộc đúng sự kiện */
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
