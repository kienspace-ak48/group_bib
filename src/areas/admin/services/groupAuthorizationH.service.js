const crypto = require('crypto');
const mongoose = require('mongoose');
const GroupAuthorization = require('../../../model/GroupAuthorization_h');
const ParticipantCheckinH = require('../../../model/ParticipantCheckin_h');
const eventCheckinHService = require('./eventCheckinH.service');
const delegationAuthorizationLogHService = require('./delegationAuthorizationLogH.service');
const eventBulkMailService = require('./eventBulkMail.service');
const { getPublicBaseUrl } = require('../../../utils/publicBaseUrl.util');

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

    /**
     * Chuẩn hóa field hiển thị: ủy quyền lưu trên participant (không gộp nhóm).
     */
    attachParticipantDelegationForList(participants) {
        if (!participants || !participants.length) return participants;
        return participants.map((p) => ({
            ...p,
            delegation_enabled: p.delegation_enabled === true,
            delegate_fullname: p.delegate_fullname != null ? String(p.delegate_fullname) : '',
            delegate_email: p.delegate_email != null ? String(p.delegate_email) : '',
            delegate_phone: p.delegate_phone != null ? String(p.delegate_phone) : '',
            delegate_cccd: p.delegate_cccd != null ? String(p.delegate_cccd) : '',
            group_auth_creation_source: p.group_authorization_id ? 'legacy_group' : undefined,
            delegate_group_tool_url: '',
        }));
    }

    /** @deprecated Dùng attachParticipantDelegationForList */
    async attachGroupAuthCreationSource(participants) {
        return this.attachParticipantDelegationForList(participants);
    }

    /** Gỡ VĐV khỏi nhóm legacy (khi chuyển sang ủy quyền trên participant). */
    async detachParticipantFromLegacyGroup(participantId, eventId) {
        try {
            const pid = toOid(participantId);
            const eoid = this._eventOid(eventId);
            if (!pid || !eoid) return { ok: false };
            const p = await ParticipantCheckinH.findById(pid).lean();
            if (!p || String(p.event_id) !== String(eventId)) return { ok: false };
            const gid = p.group_authorization_id;
            if (!gid) return { ok: true, detached: false };
            await ParticipantCheckinH.updateOne({ _id: pid }, { $unset: { group_authorization_id: 1 } });
            await GroupAuthorization.updateOne({ _id: gid }, { $pull: { participant_ids: pid } });
            const left = await GroupAuthorization.findById(gid).lean();
            if (!left || !left.participant_ids || left.participant_ids.length === 0) {
                await GroupAuthorization.deleteOne({ _id: gid });
            }
            return { ok: true, detached: true };
        } catch (e) {
            console.log(CNAME, e.message);
            return { ok: false };
        }
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
                .select('bib fullname email phone cccd category')
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
            .select('_id group_authorization_id bib')
            .lean();
        if (found.length !== oids.length) {
            return { ok: false, message: 'Một số VĐV không thuộc sự kiện này.', ids: [] };
        }
        const ex = excludeGroupId ? String(excludeGroupId) : '';
        const conflictBibs = [];
        for (const p of found) {
            const gid = p.group_authorization_id ? String(p.group_authorization_id) : '';
            if (!gid) continue;
            if (ex && gid === ex) continue;
            const b = p.bib != null && String(p.bib).trim() !== '' ? String(p.bib).trim() : null;
            conflictBibs.push(b || `id:${String(p._id).slice(-8)}`);
        }
        if (conflictBibs.length) {
            const list = [...new Set(conflictBibs)].join(', ');
            return {
                ok: false,
                message: `Không thêm được: các BIB sau đã gán cho nhóm ủy quyền khác — ${list}. Mở nhóm đó để gỡ BIB hoặc sửa nhóm hiện có. Không thể nhập cùng một VĐV vào hai nhóm.`,
                ids: [],
            };
        }
        return { ok: true, ids: oids, message: '' };
    }

    /**
     * Không gán nhóm cho VĐV đã check-in hoặc đã bật ủy quyền đơn (nhận BIB hộ).
     * @param {import('mongoose').Types.ObjectId[]} participantOids
     */
    async _validateEligibilityForGroupMembers(eventId, participantOids) {
        const eoid = this._eventOid(eventId);
        if (!eoid) return { ok: false, message: 'Sự kiện không hợp lệ.' };
        const oids = (participantOids || []).map(toOid).filter(Boolean);
        if (!oids.length) return { ok: true, message: '' };
        const found = await ParticipantCheckinH.find({
            $and: [this._eventIdQuery(eventId), { _id: { $in: oids } }],
        })
            .select('_id bib status delegation_enabled')
            .lean();
        if (found.length !== oids.length) {
            return { ok: false, message: 'Một số VĐV không thuộc sự kiện này.' };
        }
        const checkedIn = [];
        const delegated = [];
        for (const p of found) {
            const bib =
                p.bib != null && String(p.bib).trim() !== ''
                    ? String(p.bib).trim()
                    : `id:${String(p._id).slice(-8)}`;
            if (p.status === 'checked_in') checkedIn.push(bib);
            if (p.delegation_enabled === true) delegated.push(bib);
        }
        if (checkedIn.length || delegated.length) {
            const parts = [];
            if (checkedIn.length) parts.push(`đã check-in: ${[...new Set(checkedIn)].join(', ')}`);
            if (delegated.length) parts.push(`đã bật ủy quyền đơn: ${[...new Set(delegated)].join(', ')}`);
            return { ok: false, message: `Không gán nhóm cho BIB — ${parts.join('; ')}.` };
        }
        return { ok: true, message: '' };
    }

    /**
     * @param {object} [options]
     * @param {'admin_group_tab'|'admin_participant_modal'} [options.delegationSource]
     * @param {import('mongoose').Types.ObjectId|string} [options.actorAdminId]
     */
    async _afterParticipantsAssigned(eventId, gaDoc, participantIds, rep, options = {}) {
        const source = options.delegationSource || 'admin_group_tab';
        const actorAdminId = options.actorAdminId;
        const event = await eventCheckinHService.getById(eventId);
        if (!event) return null;
        const hostBase = getPublicBaseUrl();
        const token = gaDoc && gaDoc.token ? String(gaDoc.token) : '';
        /** QR/mail thống nhất: resolve → redirect tới group-auth sau khi khớp sự kiện. */
        const toolPath = token ? `/tool-checkin/scan/${encodeURIComponent(token)}` : '';
        const toolFullUrl = hostBase && toolPath ? `${hostBase}${toolPath}` : toolPath;

        const gaFresh = await GroupAuthorization.findById(gaDoc._id).lean();
        if (!gaFresh) return null;
        const orderedIds = (gaFresh.participant_ids || []).map((x) => String(x));
        const oids = orderedIds.map(toOid).filter(Boolean);
        const participants = oids.length
            ? await ParticipantCheckinH.find({ _id: { $in: oids } })
                  .select('bib fullname category')
                  .lean()
            : [];
        const pmap = new Map(participants.map((p) => [String(p._id), p]));
        const ordered = orderedIds.map((id) => pmap.get(id)).filter(Boolean);

        const groupName = gaFresh.group_name != null ? String(gaFresh.group_name).trim() : '';
        const mailTo = String(rep.email || '').trim();
        let mailSent = false;
        let mailError = '';
        if (mailTo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailTo)) {
            if (eventBulkMailService.isSendGridConfigured()) {
                try {
                    await eventBulkMailService.sendGroupBibNotificationMail({
                        event,
                        representative: rep,
                        groupName,
                        participants: ordered,
                        toolFullUrl: toolFullUrl || toolPath,
                        toolPath,
                    });
                    mailSent = true;
                } catch (e) {
                    mailError = e.message || String(e);
                }
            } else {
                mailError = 'SendGrid chưa cấu hình';
            }
        } else {
            mailError = 'Không có email đại diện hợp lệ';
        }

        const members_snapshot = ordered.map((p) => ({
            bib: p.bib != null ? String(p.bib) : '',
            fullname: p.fullname != null ? String(p.fullname) : '',
            category: p.category != null ? String(p.category) : '',
        }));

        await delegationAuthorizationLogHService.append({
            event_id: eventId,
            group_authorization_id: gaDoc._id,
            kind: 'group_mail_sent',
            representative: rep,
            participant_bib: '',
            participant_fullname: '',
            source,
            actor_admin_id: actorAdminId,
            mail_to: mailTo,
            mail_sent: mailSent,
            mail_error: mailError,
            group_name: groupName,
            members_snapshot,
        });
        return { mailSent, mailError };
    }

    /**
     * Gửi lại mail nhóm BIB tới người đại diện (cùng nội dung như khi tạo/cập nhật nhóm).
     * @param {{ delegationSource?: string, actorAdminId?: import('mongoose').Types.ObjectId|string }} [options]
     */
    async resendGroupBibMail(eventId, gaId, options = {}) {
        const ga = await this.findByIdAndEvent(gaId, eventId);
        if (!ga) return { ok: false, message: 'Không tìm thấy nhóm.' };
        const r = await this._afterParticipantsAssigned(eventId, ga, [], ga.representative, {
            delegationSource: options.delegationSource || 'admin_group_tab',
            actorAdminId: options.actorAdminId,
        });
        if (!r) return { ok: false, message: 'Không gửi được mail.' };
        if (r.mailSent) return { ok: true, message: 'Đã gửi lại mail tới người đại diện.' };
        return { ok: false, message: r.mailError || 'Không gửi được mail.' };
    }

    async _afterParticipantsUnassigned(eventId, gaDoc, participantIds, rep, options = {}) {
        const source = options.delegationSource || 'admin_group_tab';
        const actorAdminId = options.actorAdminId;
        const pids = (participantIds || []).map(toOid).filter(Boolean);
        for (const pid of pids) {
            const p = await ParticipantCheckinH.findById(pid).lean();
            await delegationAuthorizationLogHService.append({
                event_id: eventId,
                group_authorization_id: gaDoc ? gaDoc._id : undefined,
                participant_id: pid,
                kind: 'participant_unassigned',
                representative: rep || {},
                participant_bib: p ? p.bib : '',
                participant_fullname: p ? p.fullname : '',
                source,
                actor_admin_id: actorAdminId,
                mail_sent: false,
                mail_error: '',
                group_name: gaDoc && gaDoc.group_name != null ? String(gaDoc.group_name).trim() : '',
            });
        }
    }

    async create(eventId, body, options = {}) {
        try {
            const rep = {
                fullname: String(body.fullname || '').trim(),
                email: String(body.email || '').trim(),
                phone: String(body.phone || '').trim(),
                cccd: String(body.cccd || '').trim(),
            };
            if (!rep.fullname) return { ok: false, message: 'Nhập họ tên người đại diện.' };

            const hasBibList = typeof body.bib_list === 'string' && body.bib_list.trim();
            const group_name = String(body.group_name || '').trim();
            if (hasBibList && !group_name) {
                return { ok: false, message: 'Nhập tên nhóm.' };
            }

            let rawIds = Array.isArray(body.participant_ids) ? body.participant_ids : [];
            if (hasBibList) {
                const r = await this.resolveParticipantIdsFromBibLines(eventId, body.bib_list);
                if (!r.ok) return r;
                rawIds = r.ids;
            }
            const v = await this._validateParticipantIds(eventId, rawIds, null);
            if (!v.ok) return v;
            const el = await this._validateEligibilityForGroupMembers(eventId, v.ids);
            if (!el.ok) return el;

            const token = crypto.randomBytes(24).toString('hex');
            const rawSrc = options.delegationSource || options.creation_source;
            const CREATION = ['email_single_link', 'admin_group_tab', 'admin_participant_modal'];
            const creation_source = CREATION.includes(rawSrc) ? rawSrc : 'admin_group_tab';
            const doc = await GroupAuthorization.create({
                event_id: this._eventOid(eventId),
                representative: rep,
                participant_ids: v.ids,
                token,
                creation_source,
                group_name: group_name || '',
            });

            await ParticipantCheckinH.updateMany(
                { _id: { $in: v.ids } },
                { $set: { group_authorization_id: doc._id } },
            );

            const gaObj = doc.toObject();
            await this._afterParticipantsAssigned(eventId, gaObj, v.ids, rep, options);

            return { ok: true, doc: gaObj };
        } catch (e) {
            console.log(CNAME, e.message);
            return { ok: false, message: e.message || 'Không tạo được nhóm.' };
        }
    }

    async update(gaId, eventId, body, options = {}) {
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
            const hasBibList = typeof body.bib_list === 'string' && body.bib_list.trim();
            const group_name = String(
                body.group_name !== undefined && body.group_name !== null
                    ? body.group_name
                    : (existing.group_name || ''),
            ).trim();
            if (hasBibList && !group_name) {
                return { ok: false, message: 'Nhập tên nhóm.' };
            }

            if (hasBibList) {
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

            const addedOids = added.map(toOid).filter(Boolean);
            const el = await this._validateEligibilityForGroupMembers(eventId, addedOids);
            if (!el.ok) return el;

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
                        group_name: group_name || '',
                    },
                },
                { new: true },
            ).lean();

            if (removed.length) {
                await this._afterParticipantsUnassigned(eventId, existing, removed, existing.representative, options);
            }
            if (added.length) {
                await this._afterParticipantsAssigned(eventId, updated, added, rep, options);
            }

            return { ok: true, doc: updated };
        } catch (e) {
            console.log(CNAME, e.message);
            return { ok: false, message: e.message || 'Không cập nhật được.' };
        }
    }

    /**
     * Đại diện nhóm check-in một lần: gán cùng chữ ký/ảnh/TNV/thời gian cho mọi BIB chưa check-in; lưu snapshot đại diện nhận hộ.
     * @param {object} setDoc
     * @param {string} setDoc.checkin_method
     * @param {Date} setDoc.checkin_time
     * @param {string} setDoc.checkin_by
     * @param {import('mongoose').Types.ObjectId} setDoc.checkin_via_group_id
     * @param {{ fullname?: string, email?: string, phone?: string, cccd?: string }} setDoc.checkin_group_representative
     * @param {string} [setDoc.checkin_signature_path]
     * @param {string} [setDoc.checkin_photo_path]
     */
    async applyGroupRepresentativeCheckIn(eventId, groupAuthorizationId, setDoc) {
        const ga = await this.findByIdAndEvent(groupAuthorizationId, eventId);
        if (!ga) return { ok: false, updated: 0 };
        const oids = (ga.participant_ids || [])
            .map((x) => String(x))
            .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
            .map((id) => new mongoose.Types.ObjectId(id));
        if (!oids.length) return { ok: true, updated: 0 };
        const $set = {
            status: 'checked_in',
            checkin_method: setDoc.checkin_method || 'scan',
            checkin_time: setDoc.checkin_time,
            checkin_by: setDoc.checkin_by,
            checkin_via_group_id: setDoc.checkin_via_group_id,
        };
        if (setDoc.checkin_group_representative && typeof setDoc.checkin_group_representative === 'object') {
            $set.checkin_group_representative = setDoc.checkin_group_representative;
        }
        if (setDoc.checkin_signature_path) {
            $set.checkin_signature_path = setDoc.checkin_signature_path;
        }
        if (setDoc.checkin_photo_path) {
            $set.checkin_photo_path = setDoc.checkin_photo_path;
        }
        const res = await ParticipantCheckinH.updateMany(
            {
                $and: [
                    this._eventIdQuery(eventId),
                    { _id: { $in: oids } },
                    { status: { $nin: ['checked_in', 'cancelled'] } },
                ],
            },
            { $set },
        );
        return { ok: true, updated: res.modifiedCount || 0 };
    }

    async remove(gaId, eventId, options = {}) {
        try {
            const existing = await this.findByIdAndEvent(gaId, eventId);
            if (!existing) return { ok: false, message: 'Không tìm thấy nhóm.' };

            const pids = (existing.participant_ids || []).map(toOid).filter(Boolean);
            if (pids.length) {
                await this._afterParticipantsUnassigned(eventId, existing, pids, existing.representative, options);
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
