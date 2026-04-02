const mongoose = require('mongoose');
const Participant = require('../model/ParticipantCheckin_h');
const EventCheckin = require('../model/EventCheckin_h');
const groupAuthorizationHService = require('../areas/admin/services/groupAuthorizationH.service');
const participantCheckinHService = require('../areas/admin/services/participantCheckinH.service');
const eventCheckinHService = require('../areas/admin/services/eventCheckinH.service');
const participantDelegationLogHService = require('../areas/admin/services/participantDelegationLogH.service');
const eventBulkMailService = require('../areas/admin/services/eventBulkMail.service');
const {
    parseDelegationFromToolBody,
    finalizeDelegationState,
    snapshotFromParticipant,
    computeDelegationAction,
    buildDelegationLogSummary,
} = require('../utils/participantDelegation.util');

function isValidEmailForQr(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(String(s || '').trim());
}

function eventId(req) {
    return req.user?.checkin_event_id;
}

/** Khớp participant theo event_id string hoặc ObjectId trong DB */
function eventIdMatch(eid) {
    const sid = String(eid);
    return mongoose.Types.ObjectId.isValid(sid)
        ? { $or: [{ event_id: sid }, { event_id: new mongoose.Types.ObjectId(sid) }] }
        : { event_id: eid };
}

function parseIntSafe(v, fallback) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
}

const toolCheckinController = () => {
    return {
        dashboard: async (req, res) => {
            const eid = eventId(req);
            if (!eid) {
                return res.status(403).render('tool/checkin_unassigned', { layout: false });
            }
            const event = await EventCheckin.findById(eid).lean();
            if (!event) {
                return res.status(404).render('tool/checkin_unassigned', {
                    layout: false,
                    message: 'Sự kiện được gán không còn tồn tại.',
                });
            }
            return res.render('tool/checkin', { layout: false, event });
        },

        getData: async (req, res) => {
            const eid = eventId(req);
            if (!eid) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            const draw = parseIntSafe(req.query.draw, 1);
            const start = Math.max(0, parseIntSafe(req.query.start, 0));
            const length = Math.min(Math.max(1, parseIntSafe(req.query.length, 10)), 100);
            const fsRaw = req.query.filter_status;
            const fsOne = Array.isArray(fsRaw) ? fsRaw[0] : fsRaw;
            const rawFilter = String(fsOne != null && fsOne !== '' ? fsOne : 'all')
                .trim()
                .toLowerCase();
            const filterStatus =
                rawFilter === 'true' || rawFilter === '1'
                    ? 'true'
                    : rawFilter === 'false' || rawFilter === '0'
                      ? 'false'
                      : 'all';
            let searchVal = (req.query.search_custom || '').trim();
            if (!searchVal && req.query['search[value]'] != null) {
                searchVal = String(req.query['search[value]']).trim();
            }
            if (!searchVal && req.query.search) {
                const s = req.query.search;
                if (typeof s === 'object' && s != null && s.value != null) {
                    searchVal = String(s.value).trim();
                }
            }

            const eventCond = eventIdMatch(eid);
            const andParts = [eventCond];
            if (filterStatus === 'true') {
                andParts.push({ status: 'checked_in' });
            } else if (filterStatus === 'false') {
                andParts.push({ status: { $nin: ['checked_in', 'cancelled'] } });
            }
            if (searchVal) {
                const safe = searchVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(safe, 'i');
                andParts.push({
                    $or: [
                        { fullname: regex },
                        { email: regex },
                        { phone: regex },
                        { bib: regex },
                        { uid: regex },
                        { qr_code: regex },
                        { cccd: regex },
                    ],
                });
            }
            const baseMatch = { $and: [eventCond] };
            const match = { $and: andParts };

            const [total, filtered, rows] = await Promise.all([
                Participant.countDocuments(baseMatch),
                Participant.countDocuments(match),
                Participant.find(match).sort({ fullname: 1 }).skip(start).limit(length).lean(),
            ]);

            const data = rows.map((r) => ({
                ...r,
                code: r.uid,
                checkin_status: r.status === 'checked_in',
            }));

            return res.json({
                draw,
                recordsTotal: total,
                recordsFiltered: filtered,
                data,
            });
        },

        getStats: async (req, res) => {
            const eid = eventId(req);
            if (!eid) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            const eventCond = eventIdMatch(eid);
            const [totalParticipants, checkedCount] = await Promise.all([
                Participant.countDocuments({ $and: [eventCond] }),
                Participant.countDocuments({ $and: [eventCond, { status: 'checked_in' }] }),
            ]);
            return res.json({ totalParticipants, checkedCount });
        },

        info: async (req, res) => {
            const eid = eventId(req);
            if (!eid) {
                return res.status(403).render('tool/checkin_unassigned', { layout: false });
            }
            const code = (req.query.code || '').trim();
            if (!code) {
                return res.status(400).send('Thiếu tham số code.');
            }
            const pc = await Participant.findOne({
                $and: [eventIdMatch(eid), { $or: [{ uid: code }, { qr_code: code }] }],
            }).lean();
            if (!pc) {
                return res.status(404).send('Không tìm thấy vận động viên trong sự kiện này.');
            }
            const event = await EventCheckin.findById(eid).lean();
            if (!event) {
                return res.status(404).send('Sự kiện không tồn tại.');
            }
            const returnToRaw = (req.query.return_to || '').trim();
            let returnTo = '';
            if (returnToRaw.startsWith('/tool-checkin/group-auth/')) {
                returnTo = returnToRaw;
            } else if (returnToRaw === '/tool-checkin' || returnToRaw === '/tool-checkin/') {
                returnTo = '/tool-checkin';
            }
            const gaIdQuery = (req.query.ga_id || '').trim();
            let checkinViaGroupId = '';
            if (
                gaIdQuery &&
                mongoose.Types.ObjectId.isValid(gaIdQuery) &&
                pc.group_authorization_id &&
                String(pc.group_authorization_id) === gaIdQuery
            ) {
                checkinViaGroupId = gaIdQuery;
            }
            return res.render('tool/info', {
                layout: false,
                pc,
                event,
                returnTo,
                checkinViaGroupId,
            });
        },

        checkIn: async (req, res) => {
            const eid = eventId(req);
            if (!eid) {
                return res.status(403).json({ success: false, mess: 'Chưa gán sự kiện.' });
            }
            let code = req.body?.code;
            if (Array.isArray(code)) code = code[0];
            code = String(code || '').trim();
            if (!code) {
                return res.status(400).json({ success: false, mess: 'Thiếu mã VĐV (code).' });
            }
            const participant = await Participant.findOne({
                $and: [eventIdMatch(eid), { $or: [{ uid: code }, { qr_code: code }] }],
            });
            if (!participant) {
                return res.status(404).json({ success: false, mess: 'Không tìm thấy VĐV.' });
            }
            if (participant.status === 'checked_in') {
                return res.status(400).json({ success: false, mess: 'Đã check-in trước đó.' });
            }

            const eventDoc = await EventCheckin.findById(eid).select('checkin_capture_mode').lean();
            const rawMode = String(eventDoc?.checkin_capture_mode || 'both').trim();
            const allowedModes = ['none', 'signature', 'photo', 'both'];
            const mode = allowedModes.includes(rawMode) ? rawMode : 'both';
            const sig = req.files?.signature?.[0];
            const photo = req.files?.photo?.[0];

            if (mode === 'both' && (!sig || !photo)) {
                return res.status(400).json({ success: false, mess: 'Cần chữ ký và ảnh chụp.' });
            }
            if (mode === 'signature' && !sig) {
                return res.status(400).json({ success: false, mess: 'Cần chữ ký.' });
            }
            if (mode === 'photo' && !photo) {
                return res.status(400).json({ success: false, mess: 'Cần ảnh chụp.' });
            }

            const relBase = `/uploads/checkin/${eid}`;
            participant.status = 'checked_in';
            participant.checkin_method = 'scan';
            participant.checkin_time = new Date();
            participant.checkin_by = req.user.email || req.user.name || String(req.user._id);
            if (sig) {
                participant.checkin_signature_path = `${relBase}/${sig.filename}`;
            }
            if (photo) {
                participant.checkin_photo_path = `${relBase}/${photo.filename}`;
            }
            let viaGroup = req.body?.checkin_via_group_id;
            if (Array.isArray(viaGroup)) viaGroup = viaGroup[0];
            viaGroup = String(viaGroup || '').trim();
            if (
                viaGroup &&
                mongoose.Types.ObjectId.isValid(viaGroup) &&
                participant.group_authorization_id &&
                String(participant.group_authorization_id) === viaGroup
            ) {
                participant.checkin_via_group_id = new mongoose.Types.ObjectId(viaGroup);
            }
            await participant.save();

            return res.json({ success: true });
        },

        /**
         * Xem nhóm ủy quyền theo token.
         * - account_checkin: token phải thuộc đúng sự kiện đã gán (checkin_event_id).
         * - super_admin / admin: mở được để xem/preview (không cần gán sự kiện trên user).
         */
        groupAuthByToken: async (req, res) => {
            const token = String(req.params.token || '').trim();
            const doc = await groupAuthorizationHService.findByToken(token);
            if (!doc) {
                return res.status(404).send('Không tìm thấy nhóm ủy quyền hoặc token không hợp lệ.');
            }
            const role = req.user?.role;
            if (role === 'account_checkin') {
                const assigned = req.user.checkin_event_id;
                if (!assigned) {
                    return res.status(403).render('tool/checkin_unassigned', { layout: false });
                }
                if (String(doc.event_id) !== String(assigned)) {
                    return res
                        .status(403)
                        .send(
                            'Liên kết này thuộc sự kiện khác với sự kiện được gán cho tài khoản check-in của bạn.',
                        );
                }
            } else if (role !== 'super_admin' && role !== 'admin') {
                return res.status(403).send('Không đủ quyền xem trang này.');
            }

            const eid = doc.event_id;
            const pids = (doc.participant_ids || []).map((pid) => new mongoose.Types.ObjectId(String(pid)));
            const participants = await Participant.find({
                $and: [eventIdMatch(eid), { _id: { $in: pids } }],
            })
                .select('uid qr_code fullname bib category status group_authorization_id')
                .sort({ bib: 1 })
                .lean();
            const event = await EventCheckin.findById(eid).lean();
            return res.render('tool/group_auth', {
                layout: false,
                group: doc,
                participants,
                event,
                groupToken: token,
                groupAuthViewerRole: role,
            });
        },

        /** Form công khai: VĐV điền thông tin người nhận hộ (ủy quyền đơn — link trong mail QR). */
        singleDelegationForm: async (req, res) => {
            try {
                const token = String(req.params.token || '').trim();
                const p = await participantCheckinHService.findByDelegationToken(token);
                if (!p) {
                    return res.status(404).render('tool/delegate_error', {
                        layout: 'layouts/main',
                        title: 'Lỗi — Ủy quyền nhận đồ',
                        message: 'Liên kết không hợp lệ hoặc đã hết hiệu lực.',
                    });
                }
                const event = await eventCheckinHService.getById(p.event_id);
                if (!event) {
                    return res.status(404).render('tool/delegate_error', {
                        layout: 'layouts/main',
                        title: 'Lỗi — Ủy quyền nhận đồ',
                        message: 'Không tìm thấy sự kiện.',
                    });
                }
                if (event.single_delegation_enabled === false) {
                    return res.status(403).render('tool/delegate_error', {
                        layout: 'layouts/main',
                        title: 'Lỗi — Ủy quyền nhận đồ',
                        message: 'Sự kiện không bật ủy quyền đơn qua link.',
                    });
                }
                const delegationLocked =
                    p.delegation_enabled === true && String(p.delegate_fullname || '').trim() !== '';
                const errQuery = String(req.query.err || '').trim() === '1';
                const justSaved = String(req.query.saved || '').trim() === '1';
                const title = `Ủy quyền nhận đồ — ${event.name || 'Sự kiện'}`;
                return res.render('tool/delegate_form', {
                    layout: 'layouts/main',
                    title,
                    participant: p,
                    event,
                    token,
                    delegationLocked,
                    errQuery,
                    justSaved,
                });
            } catch (e) {
                console.error('singleDelegationForm', e);
                if (!res.headersSent) {
                    return res.status(500).render('tool/delegate_error', {
                        layout: 'layouts/main',
                        title: 'Lỗi — Ủy quyền nhận đồ',
                        message: 'Lỗi máy chủ. Vui lòng thử lại sau.',
                    });
                }
            }
        },

        singleDelegationSubmit: async (req, res) => {
            try {
                const token = String(req.params.token || '').trim();
                const p = await participantCheckinHService.findByDelegationToken(token);
                if (!p) {
                    return res.status(404).render('tool/delegate_error', {
                        layout: 'layouts/main',
                        title: 'Lỗi — Ủy quyền nhận đồ',
                        message: 'Liên kết không hợp lệ.',
                    });
                }
                const event = await eventCheckinHService.getById(p.event_id);
                if (!event || event.single_delegation_enabled === false) {
                    return res.status(403).render('tool/delegate_error', {
                        layout: 'layouts/main',
                        title: 'Lỗi — Ủy quyền nhận đồ',
                        message: 'Không thể gửi biểu mẫu.',
                    });
                }
                const alreadyDone =
                    p.delegation_enabled === true && String(p.delegate_fullname || '').trim() !== '';
                if (alreadyDone) {
                    return res.redirect(303, `/tool-checkin/delegate/${encodeURIComponent(token)}`);
                }
                const fullname = String(req.body.fullname || '').trim();
                if (!fullname) {
                    return res.redirect(303, `/tool-checkin/delegate/${encodeURIComponent(token)}?err=1`);
                }
                const oldSnap = snapshotFromParticipant(p);
                const parsed = parseDelegationFromToolBody(req.body);
                const finSnap = finalizeDelegationState(parsed);
                const action = computeDelegationAction(oldSnap, finSnap);
                if (!action) {
                    return res.redirect(303, `/tool-checkin/delegate/${encodeURIComponent(token)}`);
                }
                const saved = await participantCheckinHService.updateByIdAndEvent(p._id, p.event_id, finSnap);
                if (!saved) {
                    return res.status(400).render('tool/delegate_error', {
                        layout: 'layouts/main',
                        title: 'Lỗi — Ủy quyền nhận đồ',
                        message: 'Không lưu được thông tin ủy quyền.',
                    });
                }
                await groupAuthorizationHService.detachParticipantFromLegacyGroup(p._id, p.event_id);
                await participantDelegationLogHService.append({
                    event_id: p.event_id,
                    participant_id: p._id,
                    actor: 'participant',
                    action,
                    delegate_snapshot: {
                        fullname: finSnap.delegate_fullname,
                        email: finSnap.delegate_email,
                        phone: finSnap.delegate_phone,
                        cccd: finSnap.delegate_cccd,
                    },
                    summary: buildDelegationLogSummary('participant', action, finSnap),
                });
                if (finSnap.delegation_enabled && isValidEmailForQr(finSnap.delegate_email)) {
                    try {
                        if (eventBulkMailService.isSendGridConfigured()) {
                            const updated = await participantCheckinHService.getById(p._id);
                            if (updated) {
                                await eventBulkMailService.sendQrMailToParticipant(event, updated);
                            }
                        }
                    } catch (mailErr) {
                        console.error('singleDelegationSubmit sendQrMail', mailErr.message || mailErr);
                    }
                }
                return res.redirect(303, `/tool-checkin/delegate/${encodeURIComponent(token)}?saved=1`);
            } catch (e) {
                console.error('singleDelegationSubmit', e);
                if (!res.headersSent) {
                    return res.status(500).render('tool/delegate_error', {
                        layout: 'layouts/main',
                        title: 'Lỗi — Ủy quyền nhận đồ',
                        message: 'Lỗi máy chủ. Vui lòng thử lại sau.',
                    });
                }
            }
        },
    };
};

module.exports = toolCheckinController;
