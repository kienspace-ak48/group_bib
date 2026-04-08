const crypto = require('crypto');
const mongoose = require('mongoose');
const ParticipantCheckinH = require('../../../model/ParticipantCheckin_h');

const CNAME = 'participantCheckinH.service.js ';
const CHECKIN_HISTORY_LIMIT = 100;
/** Khớp giới hạn export trong event.controller */
const EXPORT_PARTICIPANT_MAX = 10000;

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

    /** VĐV đang bật ủy quyền (theo participant, không gộp nhóm). */
    async findByEventIdWithDelegationEnabled(eventId, limit = 500) {
        try {
            const lim = Math.min(500, Math.max(1, Number(limit) || 500));
            return await ParticipantCheckinH.find({
                $and: [
                    this._eventIdQuery(eventId),
                    { delegation_enabled: true },
                    { delegate_fullname: { $nin: [null, ''] } },
                ],
            })
                .sort({ updatedAt: -1 })
                .limit(lim)
                .lean();
        } catch (e) {
            console.log(CNAME, e.message);
            return [];
        }
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

    /**
     * Người nhận mail QR: nếu bật ủy quyền và có email đại diện hợp lệ → đại diện; không thì email VĐV.
     * Nếu bật ủy quyền nhưng thiếu email đại diện hợp lệ → fallback email VĐV.
     */
    _qrMailRecipientQuery() {
        const rx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
        return {
            $or: [
                { $and: [{ delegation_enabled: true }, { delegate_email: rx }] },
                {
                    $and: [
                        {
                            $or: [
                                { delegation_enabled: { $ne: true } },
                                { delegation_enabled: { $exists: false } },
                            ],
                        },
                        { email: rx },
                    ],
                },
                {
                    $and: [
                        { delegation_enabled: true },
                        {
                            $or: [
                                { delegate_email: { $exists: false } },
                                { delegate_email: '' },
                                { delegate_email: { $not: rx } },
                            ],
                        },
                        { email: rx },
                    ],
                },
            ],
        };
    }

    async countWithValidEmailByEventId(eventId) {
        try {
            const q = { $and: [this._eventIdQuery(eventId), this._qrMailRecipientQuery()] };
            return await ParticipantCheckinH.countDocuments(q);
        } catch (e) {
            console.log(CNAME, e.message);
            return 0;
        }
    }

    async findByEventIdWithValidEmail(eventId) {
        try {
            const q = { $and: [this._eventIdQuery(eventId), this._qrMailRecipientQuery()] };
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

    _buildCheckedInHistoryQuery(eventId, { q, staff } = {}) {
        const andParts = [this._eventIdQuery(eventId), { status: 'checked_in' }];
        const staffTrim = String(staff || '').trim();
        if (staffTrim) {
            andParts.push({ checkin_by: staffTrim });
        }
        const search = String(q || '').trim();
        if (search) {
            const rx = new RegExp(escapeRegex(search), 'i');
            andParts.push({
                $or: [
                    { fullname: rx },
                    { bib: rx },
                    { phone: rx },
                    { email: rx },
                    { cccd: rx },
                    { checkin_by: rx },
                    { 'checkin_group_representative.fullname': rx },
                    { 'checkin_group_representative.email': rx },
                    { 'checkin_group_representative.phone': rx },
                    { 'checkin_group_representative.cccd': rx },
                    { delegate_fullname: rx },
                    { delegate_email: rx },
                    { delegate_phone: rx },
                    { delegate_cccd: rx },
                ],
            });
        }
        return { $and: andParts };
    }

    /** Các giá trị checkin_by đã ghi khi check-in (để lọc TNV) */
    async distinctCheckinStaff(eventId) {
        try {
            const q = {
                $and: [
                    this._eventIdQuery(eventId),
                    { status: 'checked_in' },
                    { checkin_by: { $nin: [null, ''] } },
                ],
            };
            const arr = await ParticipantCheckinH.distinct('checkin_by', q);
            return (arr || []).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b)));
        } catch (e) {
            console.log(CNAME, e.message);
            return [];
        }
    }

    async countCheckedInHistory(eventId, filters = {}) {
        try {
            const q = this._buildCheckedInHistoryQuery(eventId, filters);
            return await ParticipantCheckinH.countDocuments(q);
        } catch (e) {
            console.log(CNAME, e.message);
            return 0;
        }
    }

    async findCheckedInHistory(eventId, filters = {}, options = {}) {
        try {
            const q = this._buildCheckedInHistoryQuery(eventId, filters);
            return await ParticipantCheckinH.find(q)
                .sort({ checkin_time: -1, updatedAt: -1 })
                .skip(options.skip || 0)
                .limit(Math.min(CHECKIN_HISTORY_LIMIT, Math.max(1, options.limit || 50)))
                .lean();
        } catch (e) {
            console.log(CNAME, e.message);
            return [];
        }
    }

    /**
     * Thống kê dashboard bước Check-in: tổng, đã/chưa/hủy, % đã check-in trên tổng, theo hạng mục (category).
     */
    async getCheckinDashboardStats(eventId) {
        try {
            const baseMatch = this._eventIdQuery(eventId);
            const pipeline = [
                { $match: baseMatch },
                {
                    $facet: {
                        overall: [
                            {
                                $group: {
                                    _id: null,
                                    total: { $sum: 1 },
                                    checkedIn: {
                                        $sum: { $cond: [{ $eq: ['$status', 'checked_in'] }, 1, 0] },
                                    },
                                    cancelled: {
                                        $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
                                    },
                                    notCheckedIn: {
                                        $sum: {
                                            $cond: [
                                                {
                                                    $and: [
                                                        { $ne: ['$status', 'checked_in'] },
                                                        { $ne: ['$status', 'cancelled'] },
                                                    ],
                                                },
                                                1,
                                                0,
                                            ],
                                        },
                                    },
                                },
                            },
                        ],
                        byCategory: [
                            {
                                $addFields: {
                                    catVal: { $ifNull: ['$category', ''] },
                                },
                            },
                            {
                                $addFields: {
                                    catKey: {
                                        $cond: [
                                            {
                                                $or: [{ $eq: ['$catVal', null] }, { $eq: ['$catVal', ''] }],
                                            },
                                            '(Không rõ)',
                                            '$catVal',
                                        ],
                                    },
                                },
                            },
                            {
                                $group: {
                                    _id: '$catKey',
                                    total: { $sum: 1 },
                                    checkedIn: {
                                        $sum: { $cond: [{ $eq: ['$status', 'checked_in'] }, 1, 0] },
                                    },
                                    cancelled: {
                                        $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
                                    },
                                    notCheckedIn: {
                                        $sum: {
                                            $cond: [
                                                {
                                                    $and: [
                                                        { $ne: ['$status', 'checked_in'] },
                                                        { $ne: ['$status', 'cancelled'] },
                                                    ],
                                                },
                                                1,
                                                0,
                                            ],
                                        },
                                    },
                                },
                            },
                            { $sort: { _id: 1 } },
                        ],
                    },
                },
            ];
            const [row] = await ParticipantCheckinH.aggregate(pipeline);
            const o = row?.overall?.[0] || {};
            const total = o.total || 0;
            const checkedIn = o.checkedIn || 0;
            const cancelled = o.cancelled || 0;
            const notCheckedIn = o.notCheckedIn || 0;
            const pctCheckedIn = total > 0 ? Math.round((checkedIn / total) * 1000) / 10 : 0;
            const byCategory = (row?.byCategory || []).map((d) => ({
                category: d._id,
                total: d.total,
                checkedIn: d.checkedIn,
                notCheckedIn: d.notCheckedIn,
                cancelled: d.cancelled,
            }));
            return {
                total,
                checkedIn,
                notCheckedIn,
                cancelled,
                pctCheckedIn,
                byCategory,
            };
        } catch (e) {
            console.log(CNAME, e.message);
            return {
                total: 0,
                checkedIn: 0,
                notCheckedIn: 0,
                cancelled: 0,
                pctCheckedIn: 0,
                byCategory: [],
            };
        }
    }

    /** Toàn bộ participant của sự kiện (xuất Excel), giới hạn bản ghi. */
    async findAllByEventIdForExport(eventId, limit = EXPORT_PARTICIPANT_MAX) {
        try {
            const q = this._eventIdQuery(eventId);
            const lim = Math.min(EXPORT_PARTICIPANT_MAX, Math.max(1, limit || EXPORT_PARTICIPANT_MAX));
            return await ParticipantCheckinH.find(q).sort({ fullname: 1 }).limit(lim).lean();
        } catch (e) {
            console.log(CNAME, e.message);
            return [];
        }
    }

    /**
     * Batch kế tiếp có email hợp lệ, sort `_id` tăng (cursor cho job gửi mail hàng loạt).
     * @param {string|import('mongoose').Types.ObjectId} eventId
     * @param {string|import('mongoose').Types.ObjectId|null} afterId — `_id` lớn nhất batch trước; null = từ đầu
     */
    async findNextBatchWithValidEmail(eventId, afterId, limit) {
        try {
            const q = { $and: [this._eventIdQuery(eventId), this._qrMailRecipientQuery()] };
            if (afterId != null && mongoose.Types.ObjectId.isValid(String(afterId))) {
                q.$and.push({ _id: { $gt: new mongoose.Types.ObjectId(String(afterId)) } });
            }
            const lim = Math.min(200, Math.max(1, limit || 50));
            return await ParticipantCheckinH.find(q).sort({ _id: 1 }).limit(lim).lean();
        } catch (e) {
            console.log(CNAME, e.message);
            return [];
        }
    }

    /** Cập nhật `qr_mail_sent_at` một lần (updateOne), dùng worker gửi mail hàng loạt */
    async updateQrMailSentAtById(participantId, eventId, at) {
        try {
            if (!mongoose.Types.ObjectId.isValid(String(participantId))) return false;
            const q = { $and: [{ _id: participantId }, this._eventIdQuery(eventId)] };
            const t = at instanceof Date ? at : new Date();
            const r = await ParticipantCheckinH.updateOne(q, { $set: { qr_mail_sent_at: t } });
            return r.modifiedCount > 0 || r.matchedCount > 0;
        } catch (e) {
            console.log(CNAME, e.message);
            return false;
        }
    }

    /** Sinh `delegation_token` một lần cho mail ủy quyền đơn (lazy). */
    async ensureDelegationToken(participantId) {
        try {
            if (!mongoose.Types.ObjectId.isValid(String(participantId))) return null;
            const id = new mongoose.Types.ObjectId(String(participantId));
            const cur = await ParticipantCheckinH.findById(id).select('delegation_token').lean();
            if (!cur) return null;
            if (cur.delegation_token) return cur.delegation_token;
            const token = crypto.randomBytes(24).toString('hex');
            await ParticipantCheckinH.updateOne(
                {
                    _id: id,
                    $or: [
                        { delegation_token: { $exists: false } },
                        { delegation_token: null },
                        { delegation_token: '' },
                    ],
                },
                { $set: { delegation_token: token } },
            );
            const again = await ParticipantCheckinH.findById(id).select('delegation_token').lean();
            return again && again.delegation_token ? again.delegation_token : token;
        } catch (e) {
            console.log(CNAME, e.message);
            return null;
        }
    }

    async findByDelegationToken(token) {
        try {
            const t = String(token || '').trim();
            if (!t) return null;
            return await ParticipantCheckinH.findOne({ delegation_token: t }).lean();
        } catch (e) {
            console.log(CNAME, e.message);
            return null;
        }
    }

    /** Sinh `qr_scan_token` một lần — dùng cho URL `/tool-checkin/scan/:token`. */
    async ensureQrScanToken(participantId) {
        try {
            if (!mongoose.Types.ObjectId.isValid(String(participantId))) return null;
            const id = new mongoose.Types.ObjectId(String(participantId));
            const cur = await ParticipantCheckinH.findById(id).select('qr_scan_token').lean();
            if (!cur) return null;
            if (cur.qr_scan_token && String(cur.qr_scan_token).trim()) return String(cur.qr_scan_token).trim();
            const token = crypto.randomBytes(24).toString('hex');
            await ParticipantCheckinH.updateOne(
                {
                    _id: id,
                    $or: [
                        { qr_scan_token: { $exists: false } },
                        { qr_scan_token: null },
                        { qr_scan_token: '' },
                    ],
                },
                { $set: { qr_scan_token: token } },
            );
            const again = await ParticipantCheckinH.findById(id).select('qr_scan_token').lean();
            return again && again.qr_scan_token ? String(again.qr_scan_token).trim() : token;
        } catch (e) {
            console.log(CNAME, e.message);
            return null;
        }
    }

    /**
     * Gán hàng loạt qr_scan_token cho VĐV chưa có (dùng khi mở workspace — QR mới chuẩn hóa).
     * @param {{ limit?: number }} [options]
     */
    async backfillQrScanTokensForEvent(eventId, options = {}) {
        const lim = Math.min(5000, Math.max(1, Number(options.limit) || 2000));
        try {
            const q = {
                $and: [
                    this._eventIdQuery(eventId),
                    {
                        $or: [
                            { qr_scan_token: { $exists: false } },
                            { qr_scan_token: null },
                            { qr_scan_token: '' },
                        ],
                    },
                ],
            };
            const rows = await ParticipantCheckinH.find(q).select('_id').limit(lim).lean();
            if (!rows.length) return { updated: 0 };
            const bulk = rows.map((r) => ({
                updateOne: {
                    filter: { _id: r._id },
                    update: { $set: { qr_scan_token: crypto.randomBytes(24).toString('hex') } },
                },
            }));
            const res = await ParticipantCheckinH.bulkWrite(bulk, { ordered: false });
            return { updated: res.modifiedCount || rows.length };
        } catch (e) {
            console.log(CNAME, e.message);
            return { updated: 0, err: e.message };
        }
    }
}

module.exports = new ParticipantCheckinHService();
