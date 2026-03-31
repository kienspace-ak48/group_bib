const crypto = require('crypto');
const mongoose = require('mongoose');
const GroupAuthorization = require('../../../model/GroupAuthorization_h');
const ParticipantCheckinH = require('../../../model/ParticipantCheckin_h');

const CNAME = 'groupAuthorizationH.service.js ';

function toOid(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return null;
    return new mongoose.Types.ObjectId(String(id));
}

class GroupAuthorizationHService {
    _eventOid(eventId) {
        const s = String(eventId);
        return mongoose.Types.ObjectId.isValid(s) ? new mongoose.Types.ObjectId(s) : null;
    }

    /** Khớp cả event_id lưu string hoặc ObjectId trong DB (giống participantCheckinH.service). */
    _eventIdQuery(eventId) {
        const sid = String(eventId);
        return mongoose.Types.ObjectId.isValid(sid)
            ? { $or: [{ event_id: sid }, { event_id: new mongoose.Types.ObjectId(sid) }] }
            : { event_id: eventId };
    }

    async listByEventId(eventId) {
        try {
            const oid = this._eventOid(eventId);
            if (!oid) return [];
            const rows = await GroupAuthorization.find({ event_id: oid })
                .sort({ createdAt: -1 })
                .lean();
            const allPids = [];
            rows.forEach((r) => {
                (r.participant_ids || []).forEach((p) => allPids.push(p));
            });
            const participants = await ParticipantCheckinH.find({
                _id: { $in: allPids },
            })
                .select('bib fullname')
                .lean();
            const pmap = new Map(participants.map((p) => [String(p._id), p]));
            return rows.map((r) => ({
                ...r,
                participantPreview: (r.participant_ids || []).map((pid) => pmap.get(String(pid)) || { _id: pid }),
            }));
        } catch (e) {
            console.log(CNAME, e.message);
            return [];
        }
    }

    async findByIdAndEvent(gaId, eventId) {
        try {
            const go = toOid(gaId);
            const eoid = this._eventOid(eventId);
            if (!go || !eoid) return null;
            return await GroupAuthorization.findOne({ _id: go, event_id: eoid }).lean();
        } catch (e) {
            console.log(CNAME, e.message);
            return null;
        }
    }

    async findByTokenForEvent(token, eventId) {
        try {
            const t = String(token || '').trim();
            if (!t) return null;
            const eoid = this._eventOid(eventId);
            if (!eoid) return null;
            return await GroupAuthorization.findOne({ token: t, event_id: eoid }).lean();
        } catch (e) {
            console.log(CNAME, e.message);
            return null;
        }
    }

    /** Chỉ theo token (dùng khi admin mở link nhóm — không có checkin_event_id trên user). */
    async findByToken(token) {
        try {
            const t = String(token || '').trim();
            if (!t) return null;
            return await GroupAuthorization.findOne({ token: t }).lean();
        } catch (e) {
            console.log(CNAME, e.message);
            return null;
        }
    }

    /**
     * Khi xóa một participant: gỡ khỏi mảng participant_ids; xóa nhóm nếu rỗng.
     */
    async onParticipantDeleted(participantId, eventId) {
        try {
            const pid = toOid(participantId);
            const eoid = this._eventOid(eventId);
            if (!pid || !eoid) return;
            await GroupAuthorization.updateMany({ event_id: eoid, participant_ids: pid }, { $pull: { participant_ids: pid } });
            await GroupAuthorization.deleteMany({ event_id: eoid, participant_ids: { $size: 0 } });
        } catch (e) {
            console.log(CNAME, e.message);
        }
    }

    /** Parse danh sách BIB (phẩy / xuống dòng) → ObjectId participant cùng sự kiện */
    async resolveParticipantIdsFromBibLines(eventId, bibText) {
        try {
            const eoid = this._eventOid(eventId);
            if (!eoid) return { ok: false, message: 'Sự kiện không hợp lệ.', ids: [] };
            const parts = String(bibText || '')
                .split(/[,;\n\r]+/)
                .map((s) => s.trim())
                .filter(Boolean);
            if (!parts.length) return { ok: false, message: 'Nhập ít nhất một BIB.', ids: [] };
            const seen = new Set();
            const ids = [];
            for (const bib of parts) {
                if (seen.has(bib)) continue;
                seen.add(bib);
                const p = await ParticipantCheckinH.findOne({
                    $and: [this._eventIdQuery(eventId), { bib: String(bib).trim() }],
                })
                    .select('_id')
                    .lean();
                if (!p) {
                    return { ok: false, message: `Không tìm thấy VĐV có BIB: ${bib}`, ids: [] };
                }
                ids.push(p._id);
            }
            return { ok: true, ids, message: '' };
        } catch (e) {
            console.log(CNAME, e.message);
            return { ok: false, message: e.message || 'Lỗi đọc danh sách BIB.', ids: [] };
        }
    }

    async deleteByEventId(eventId) {
        try {
            const eoid = this._eventOid(eventId);
            if (!eoid) return 0;
            await ParticipantCheckinH.updateMany(
                {
                    $and: [this._eventIdQuery(eventId), { group_authorization_id: { $exists: true } }],
                },
                { $unset: { group_authorization_id: 1, checkin_via_group_id: 1 } },
            );
            const r = await GroupAuthorization.deleteMany({ event_id: eoid });
            return r.deletedCount;
        } catch (e) {
            console.log(CNAME, e.message);
            return 0;
        }
    }

    async _validateParticipantIds(eventId, participantIds, excludeGroupId) {
        const eoid = this._eventOid(eventId);
        if (!eoid) return { ok: false, message: 'Sự kiện không hợp lệ.', ids: [] };
        const unique = [...new Set(participantIds.map((x) => String(x)).filter(Boolean))];
        const oids = unique.map(toOid).filter(Boolean);
        if (!oids.length) return { ok: false, message: 'Chọn ít nhất một VĐV trong danh sách.', ids: [] };

        const found = await ParticipantCheckinH.find({
            $and: [this._eventIdQuery(eventId), { _id: { $in: oids } }],
        })
            .select('_id group_authorization_id')
            .lean();
        if (found.length !== oids.length) {
            return { ok: false, message: 'Một số VĐV không thuộc sự kiện này.', ids: [] };
        }
        const ex = excludeGroupId ? String(excludeGroupId) : '';
        for (const p of found) {
            const gid = p.group_authorization_id ? String(p.group_authorization_id) : '';
            if (!gid) continue;
            if (ex && gid === ex) continue;
            return {
                ok: false,
                message: 'Một hoặc nhiều VĐV đã thuộc nhóm ủy quyền khác. Gỡ VĐV khỏi nhóm cũ trước.',
                ids: [],
            };
        }
        return { ok: true, ids: oids, message: '' };
    }

    async create(eventId, body) {
        try {
            const rep = {
                fullname: String(body.fullname || '').trim(),
                email: String(body.email || '').trim(),
                phone: String(body.phone || '').trim(),
                cccd: String(body.cccd || '').trim(),
            };
            if (!rep.fullname) return { ok: false, message: 'Nhập họ tên người đại diện.' };

            let rawIds = Array.isArray(body.participant_ids) ? body.participant_ids : [];
            if (typeof body.bib_list === 'string' && body.bib_list.trim()) {
                const r = await this.resolveParticipantIdsFromBibLines(eventId, body.bib_list);
                if (!r.ok) return r;
                rawIds = r.ids;
            }
            const v = await this._validateParticipantIds(eventId, rawIds, null);
            if (!v.ok) return v;

            const token = crypto.randomBytes(24).toString('hex');
            const doc = await GroupAuthorization.create({
                event_id: this._eventOid(eventId),
                representative: rep,
                participant_ids: v.ids,
                token,
            });

            await ParticipantCheckinH.updateMany(
                { _id: { $in: v.ids } },
                { $set: { group_authorization_id: doc._id } },
            );

            return { ok: true, doc: doc.toObject() };
        } catch (e) {
            console.log(CNAME, e.message);
            return { ok: false, message: e.message || 'Không tạo được nhóm.' };
        }
    }

    async update(gaId, eventId, body) {
        try {
            const existing = await this.findByIdAndEvent(gaId, eventId);
            if (!existing) return { ok: false, message: 'Không tìm thấy nhóm ủy quyền.' };

            const rep = {
                fullname: String(body.fullname ?? existing.representative?.fullname ?? '').trim(),
                email: String(body.email ?? existing.representative?.email ?? '').trim(),
                phone: String(body.phone ?? existing.representative?.phone ?? '').trim(),
                cccd: String(body.cccd ?? existing.representative?.cccd ?? '').trim(),
            };
            if (!rep.fullname) return { ok: false, message: 'Nhập họ tên người đại diện.' };

            let rawIds = Array.isArray(body.participant_ids) ? body.participant_ids : existing.participant_ids || [];
            if (typeof body.bib_list === 'string' && body.bib_list.trim()) {
                const r = await this.resolveParticipantIdsFromBibLines(eventId, body.bib_list);
                if (!r.ok) return r;
                rawIds = r.ids;
            }
            const v = await this._validateParticipantIds(eventId, rawIds, gaId);
            if (!v.ok) return v;

            const oldIds = (existing.participant_ids || []).map((x) => String(x));
            const newIds = v.ids.map((x) => String(x));
            const removed = oldIds.filter((id) => !newIds.includes(id));
            const added = newIds.filter((id) => !oldIds.includes(id));

            if (removed.length) {
                const roids = removed.map(toOid).filter(Boolean);
                await ParticipantCheckinH.updateMany(
                    { _id: { $in: roids }, group_authorization_id: existing._id },
                    { $unset: { group_authorization_id: 1 } },
                );
            }
            if (added.length) {
                const addOids = added.map(toOid).filter(Boolean);
                if (addOids.length) {
                    await ParticipantCheckinH.updateMany(
                        { _id: { $in: addOids } },
                        { $set: { group_authorization_id: existing._id } },
                    );
                }
            }

            const updated = await GroupAuthorization.findOneAndUpdate(
                { _id: existing._id, event_id: existing.event_id },
                {
                    $set: {
                        representative: rep,
                        participant_ids: v.ids,
                    },
                },
                { new: true },
            ).lean();

            return { ok: true, doc: updated };
        } catch (e) {
            console.log(CNAME, e.message);
            return { ok: false, message: e.message || 'Không cập nhật được.' };
        }
    }

    async remove(gaId, eventId) {
        try {
            const existing = await this.findByIdAndEvent(gaId, eventId);
            if (!existing) return { ok: false, message: 'Không tìm thấy nhóm.' };

            const pids = (existing.participant_ids || []).map(toOid).filter(Boolean);
            if (pids.length) {
                await ParticipantCheckinH.updateMany(
                    { _id: { $in: pids }, group_authorization_id: existing._id },
                    { $unset: { group_authorization_id: 1 } },
                );
            }
            await GroupAuthorization.deleteOne({ _id: existing._id });
            return { ok: true };
        } catch (e) {
            console.log(CNAME, e.message);
            return { ok: false, message: e.message || 'Không xóa được.' };
        }
    }
}

module.exports = new GroupAuthorizationHService();
