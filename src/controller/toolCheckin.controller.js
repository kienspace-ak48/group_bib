const mongoose = require('mongoose');
const Participant = require('../model/ParticipantCheckin_h');
const GroupAuthorization = require('../model/GroupAuthorization_h');
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

/** SĐT liên hệ: bắt buộc, chỉ lấy chữ số, 8–15 (VN / quốc tế). */
function validateDelegationPhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return 'Vui lòng nhập số điện thoại.';
    if (digits.length < 8 || digits.length > 15) {
        return 'Số điện thoại không hợp lệ (8–15 chữ số).';
    }
    return null;
}

/** CCCD / CMND / hộ chiếu: bắt buộc, 8–20 ký tự sau bỏ khoảng trắng, chữ/số/gạch. */
function validateDelegationIdDoc(cccd) {
    const raw = String(cccd || '').replace(/\s/g, '');
    if (!raw) return 'Vui lòng nhập số CCCD / hộ chiếu / giấy tờ tùy thân.';
    if (raw.length < 8 || raw.length > 20) {
        return 'Số giấy tờ phải từ 8 đến 20 ký tự.';
    }
    if (!/^[A-Za-z0-9-]+$/.test(raw)) {
        return 'Chỉ dùng chữ, số và dấu gạch ngang (-).';
    }
    return null;
}

/** Form công khai ủy quyền đơn — dùng chung validate + giá trị render lại khi lỗi. */
function validateDelegationPublicForm(body) {
    const fullname = String(body && body.fullname != null ? body.fullname : '').trim();
    const email = String(body && body.email != null ? body.email : '').trim();
    const phone = String(body && body.phone != null ? body.phone : '').trim();
    const cccd = String(body && body.cccd != null ? body.cccd : '').trim();
    const errors = {};
    if (!fullname || fullname.length < 2) {
        errors.fullname = 'Vui lòng nhập họ tên đầy đủ (ít nhất 2 ký tự).';
    }
    if (!email) {
        errors.email = 'Vui lòng nhập email để nhận mã QR.';
    } else if (!isValidEmailForQr(email)) {
        errors.email = 'Email không đúng định dạng.';
    }
    const phoneErr = validateDelegationPhone(phone);
    if (phoneErr) errors.phone = phoneErr;
    const idErr = validateDelegationIdDoc(cccd);
    if (idErr) errors.cccd = idErr;
    const values = { fullname, email, phone, cccd };
    return { ok: Object.keys(errors).length === 0, errors, values };
}

function eventId(req) {
    return req.user?.checkin_event_id;
}

/** Khi đã ký miễn trừ online: bỏ bắt buộc chữ ký tại quầy (vẫn giữ ảnh nếu cấu hình có ảnh). */
function resolveEffectiveCheckinMode(rawMode, participant, event) {
    const allowedModes = ['none', 'signature', 'photo', 'both'];
    const mode = allowedModes.includes(String(rawMode || '').trim()) ? String(rawMode).trim() : 'both';
    const online = event && event.online_waiver_first_flow === true;
    const signed = participant && participant.waiver_signed_at;
    if (online && signed) {
        if (mode === 'both') return 'photo';
        if (mode === 'signature') return 'none';
    }
    return mode;
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

/** Snapshot đại diện nhóm lưu trên từng participant khi check-in BIB nhóm. */
function snapshotGroupRepresentative(rep) {
    if (!rep || typeof rep !== 'object') return undefined;
    const o = {
        fullname: String(rep.fullname || '').trim(),
        email: String(rep.email || '').trim(),
        phone: String(rep.phone || '').trim(),
        cccd: String(rep.cccd || '').trim(),
    };
    if (!o.fullname && !o.email && !o.phone && !o.cccd) return undefined;
    return o;
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

            const gaIds = [
                ...new Set(
                    rows
                        .map((r) => r.group_authorization_id)
                        .filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)))
                        .map((id) => String(id)),
                ),
            ];
            const gaOids = gaIds.map((id) => new mongoose.Types.ObjectId(id));
            const gaRows =
                gaOids.length > 0
                    ? await GroupAuthorization.find({ _id: { $in: gaOids } })
                          .select('_id token')
                          .lean()
                    : [];
            const groupTokenByGaId = new Map(gaRows.map((g) => [String(g._id), g.token ? String(g.token) : '']));

            const data = rows.map((r) => {
                const gid = r.group_authorization_id ? String(r.group_authorization_id) : '';
                const group_scan_token = gid ? groupTokenByGaId.get(gid) || '' : '';
                return {
                    ...r,
                    code: r.uid,
                    checkin_status: r.status === 'checked_in',
                    group_scan_token,
                };
            });

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
            /** TNV: VĐV thuộc BIB nhóm → luôn vào trang nhóm (một thủ tục check-in cho cả danh sách). */
            if (req.user?.role === 'account_checkin' && pc.group_authorization_id) {
                const gaRedirect = await groupAuthorizationHService.findByIdAndEvent(
                    pc.group_authorization_id,
                    eid,
                );
                if (gaRedirect && gaRedirect.token) {
                    return res.redirect(
                        302,
                        `/tool-checkin/group-auth/${encodeURIComponent(gaRedirect.token)}`,
                    );
                }
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
            let groupBibForInfo = null;
            if (pc.group_authorization_id) {
                const ga = await groupAuthorizationHService.findByIdAndEvent(pc.group_authorization_id, eid);
                if (ga) {
                    const orderedIds = (ga.participant_ids || []).map((x) => String(x));
                    const oids = orderedIds
                        .filter((id) => mongoose.Types.ObjectId.isValid(id))
                        .map((id) => new mongoose.Types.ObjectId(id));
                    const partDocs = oids.length
                        ? await Participant.find({ _id: { $in: oids } })
                              .select('bib fullname category')
                              .lean()
                        : [];
                    const pmap = new Map(partDocs.map((p) => [String(p._id), p]));
                    const membersOrdered = orderedIds.map((id) => pmap.get(id)).filter(Boolean);
                    groupBibForInfo = {
                        group_name: ga.group_name != null ? String(ga.group_name).trim() : '',
                        representative: ga.representative || {},
                        members: membersOrdered,
                    };
                }
            }
            const capModeRaw = String(event.checkin_capture_mode || 'both').trim();
            const effectiveCapMode = resolveEffectiveCheckinMode(capModeRaw, pc, event);
            return res.render('tool/info', {
                layout: false,
                pc,
                event,
                capMode: effectiveCapMode,
                capModeRaw,
                returnTo,
                checkinViaGroupId,
                groupBibForInfo,
            });
        },

        /**
         * Một điểm vào cho mọi QR (VĐV: qr_scan_token, nhóm: group token) — chỉ sau đăng nhập TNV + đúng sự kiện.
         */
        scanResolve: async (req, res) => {
            const eid = eventId(req);
            if (!eid) {
                return res.status(403).send('Chưa gán sự kiện.');
            }
            let raw = String(req.params.token || '').trim();
            try {
                raw = decodeURIComponent(raw);
            } catch (e) {
                /* ignore */
            }
            raw = String(raw || '').trim();
            if (!raw) {
                return res.status(400).send('Thiếu mã.');
            }
            const ga = await GroupAuthorization.findOne({
                $and: [eventIdMatch(eid), { token: raw }],
            })
                .select('_id')
                .lean();
            if (ga) {
                return res.redirect(302, `/tool-checkin/group-auth/${encodeURIComponent(raw)}`);
            }
            const p = await Participant.findOne({
                $and: [eventIdMatch(eid), { qr_scan_token: raw }],
            })
                .select('uid')
                .lean();
            if (p && p.uid) {
                const qs = new URLSearchParams({
                    code: String(p.uid),
                    return_to: '/tool-checkin',
                });
                return res.redirect(302, `/tool-checkin/info?${qs.toString()}`);
            }
            return res.status(404).send('Mã QR không hợp lệ hoặc không thuộc sự kiện này.');
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

            const eventDoc = await EventCheckin.findById(eid).select('checkin_capture_mode online_waiver_first_flow').lean();
            const rawMode = String(eventDoc?.checkin_capture_mode || 'both').trim();
            const mode = resolveEffectiveCheckinMode(rawMode, participant, eventDoc);
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
                const gaRep = await groupAuthorizationHService.findByIdAndEvent(viaGroup, eid);
                const repSnap = gaRep ? snapshotGroupRepresentative(gaRep.representative) : undefined;
                if (repSnap) {
                    participant.checkin_group_representative = repSnap;
                }
            }
            await participant.save();

            return res.json({ success: true });
        },

        /**
         * Tương thích URL cũ: gộp vào một trang group-auth (không còn bước riêng).
         */
        groupCheckInPage: async (req, res) => {
            let token = String(req.params.token || '').trim();
            try {
                token = decodeURIComponent(token);
            } catch (e) {
                /* ignore */
            }
            token = String(token || '').trim();
            if (!token) {
                return res.status(400).send('Thiếu mã.');
            }
            return res.redirect(302, `/tool-checkin/group-auth/${encodeURIComponent(token)}`);
        },

        /** POST: check-in hàng loạt cùng ảnh/chữ ký; mỗi BIB một dòng lịch sử + snapshot đại diện. */
        groupCheckInSubmit: async (req, res) => {
            const eid = eventId(req);
            if (!eid) {
                return res.status(403).json({ success: false, mess: 'Chưa gán sự kiện.' });
            }
            let token = String(req.params.token || '').trim();
            try {
                token = decodeURIComponent(token);
            } catch (e) {
                /* ignore */
            }
            token = String(token || '').trim();
            const ga = await groupAuthorizationHService.findByToken(token);
            if (!ga || String(ga.event_id) !== String(eid)) {
                return res.status(404).json({ success: false, mess: 'Không tìm thấy nhóm hoặc không thuộc sự kiện này.' });
            }

            const eventDoc = await EventCheckin.findById(eid).select('checkin_capture_mode online_waiver_first_flow').lean();
            const rawMode = String(eventDoc?.checkin_capture_mode || 'both').trim();
            const mode = resolveEffectiveCheckinMode(rawMode, null, eventDoc);
            const sig = req.files?.signature?.[0];
            const photo = req.files?.photo?.[0];

            if (mode === 'both' && (!sig || !photo)) {
                return res.status(400).json({ success: false, mess: 'Cần chữ ký và ảnh chụp.' });
            }
            if (mode === 'signature' && !sig) {
                return res.status(400).json({ success: false, mess: 'Cần chữ ký.' });
            }
            if (mode === 'photo' && !photo) {
                return res.status(400).json({ success: false, mess: 'Cần chụp ảnh.' });
            }

            const relBase = `/uploads/checkin/${eid}`;
            const staff = req.user.email || req.user.name || String(req.user._id);
            const now = new Date();
            const repSnap = snapshotGroupRepresentative(ga.representative);
            const setDoc = {
                checkin_method: 'scan',
                checkin_time: now,
                checkin_by: staff,
                checkin_via_group_id: ga._id,
            };
            if (repSnap) {
                setDoc.checkin_group_representative = repSnap;
            }
            if (sig) {
                setDoc.checkin_signature_path = `${relBase}/${sig.filename}`;
            }
            if (photo) {
                setDoc.checkin_photo_path = `${relBase}/${photo.filename}`;
            }

            const result = await groupAuthorizationHService.applyGroupRepresentativeCheckIn(eid, ga._id, setDoc);
            if (!result.ok) {
                return res.status(400).json({ success: false, mess: 'Không cập nhật được nhóm.' });
            }
            if (!result.updated) {
                return res.status(400).json({
                    success: false,
                    mess: 'Không còn VĐV nào trong nhóm cần check-in (đã check-in hoặc đã hủy).',
                });
            }
            return res.json({ success: true, count: result.updated });
        },

        /**
         * Xem nhóm ủy quyền theo token.
         * - account_checkin: token phải thuộc đúng sự kiện đã gán (checkin_event_id).
         * - super_admin / admin: mở được để xem/preview (không cần gán sự kiện trên user).
         */
        groupAuthByToken: async (req, res) => {
            let token = String(req.params.token || '').trim();
            try {
                token = decodeURIComponent(token);
            } catch (e) {
                /* ignore */
            }
            token = String(token || '').trim();
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
            const groupCheckinPostPath = `/tool-checkin/group-check-in/${encodeURIComponent(token)}`;
            return res.render('tool/group_auth', {
                layout: false,
                group: doc,
                participants,
                event,
                groupToken: token,
                groupAuthViewerRole: role,
                groupCheckinPostPath,
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
                let formErrors = {};
                let formValues = {};
                if (errQuery && !delegationLocked) {
                    formErrors = { fullname: 'Vui lòng nhập họ tên người nhận hộ.' };
                }
                return res.render('tool/delegate_form', {
                    layout: 'layouts/main',
                    title,
                    participant: p,
                    event,
                    token,
                    delegationLocked,
                    errQuery,
                    justSaved,
                    formErrors,
                    formValues,
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
                const validation = validateDelegationPublicForm(req.body);
                if (!validation.ok) {
                    const title = `Ủy quyền nhận đồ — ${event.name || 'Sự kiện'}`;
                    return res.status(422).render('tool/delegate_form', {
                        layout: 'layouts/main',
                        title,
                        participant: p,
                        event,
                        token,
                        delegationLocked: false,
                        errQuery: false,
                        justSaved: false,
                        formErrors: validation.errors,
                        formValues: validation.values,
                    });
                }
                const oldSnap = snapshotFromParticipant(p);
                const parsed = parseDelegationFromToolBody(validation.values);
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

        /** Trang công khai: ký miễn trừ online (bước 1 — trước mail QR). */
        waiverForm: async (req, res) => {
            try {
                const token = String(req.params.token || '').trim();
                const p = await participantCheckinHService.findByWaiverToken(token);
                if (!p) {
                    return res.status(404).render('tool/delegate_error', {
                        layout: 'layouts/main',
                        title: 'Lỗi — Ký miễn trừ',
                        message: 'Liên kết không hợp lệ hoặc đã hết hiệu lực.',
                    });
                }
                const event = await eventCheckinHService.getById(p.event_id);
                if (!event) {
                    return res.status(404).render('tool/delegate_error', {
                        layout: 'layouts/main',
                        title: 'Lỗi — Ký miễn trừ',
                        message: 'Không tìm thấy sự kiện.',
                    });
                }
                if (!event.online_waiver_first_flow) {
                    return res.status(403).render('tool/delegate_error', {
                        layout: 'layouts/main',
                        title: 'Lỗi — Ký miễn trừ',
                        message: 'Sự kiện không bật luồng ký miễn trừ online.',
                    });
                }
                const title = `Ký miễn trừ — ${event.name || 'Sự kiện'}`;
                const alreadySigned = !!p.waiver_signed_at;
                const justCompleted = String(req.query.done || '').trim() === '1';
                return res.render('tool/waiver_form', {
                    layout: 'layouts/main',
                    title,
                    participant: p,
                    event,
                    token,
                    alreadySigned,
                    justCompleted,
                    formError: null,
                });
            } catch (e) {
                console.error('waiverForm', e);
                if (!res.headersSent) {
                    return res.status(500).render('tool/delegate_error', {
                        layout: 'layouts/main',
                        title: 'Lỗi — Ký miễn trừ',
                        message: 'Lỗi máy chủ. Vui lòng thử lại sau.',
                    });
                }
            }
        },

        waiverSubmit: async (req, res) => {
            try {
                const token = String(req.params.token || '').trim();
                const p0 = req.waiverParticipant || (await participantCheckinHService.findByWaiverToken(token));
                if (!p0) {
                    return res.status(404).render('tool/delegate_error', {
                        layout: 'layouts/main',
                        title: 'Lỗi — Ký miễn trừ',
                        message: 'Liên kết không hợp lệ.',
                    });
                }
                const event = await eventCheckinHService.getById(p0.event_id);
                if (!event || !event.online_waiver_first_flow) {
                    return res.status(403).render('tool/delegate_error', {
                        layout: 'layouts/main',
                        title: 'Lỗi — Ký miễn trừ',
                        message: 'Không thể gửi biểu mẫu.',
                    });
                }
                if (p0.waiver_signed_at) {
                    return res.redirect(303, `/tool-checkin/waiver/${encodeURIComponent(token)}`);
                }
                const agree = req.body?.agree === '1' || req.body?.agree === 'on' || req.body?.agree === true;
                const sig = req.file;
                if (!agree) {
                    return res.status(422).render('tool/waiver_form', {
                        layout: 'layouts/main',
                        title: `Ký miễn trừ — ${event.name || ''}`,
                        participant: p0,
                        event,
                        token,
                        alreadySigned: false,
                        justCompleted: false,
                        formError: 'Vui lòng tick xác nhận đã đọc và đồng ý.',
                    });
                }
                if (!sig) {
                    return res.status(422).render('tool/waiver_form', {
                        layout: 'layouts/main',
                        title: `Ký miễn trừ — ${event.name || ''}`,
                        participant: p0,
                        event,
                        token,
                        alreadySigned: false,
                        justCompleted: false,
                        formError: 'Vui lòng ký tên trên vùng chữ ký.',
                    });
                }
                const eid = String(p0.event_id);
                const relBase = `/uploads/waiver/${eid}`;
                const waiverPath = `${relBase}/${sig.filename}`;
                const updated = await participantCheckinHService.updateByIdAndEvent(p0._id, p0.event_id, {
                    waiver_signed_at: new Date(),
                    waiver_signature_path: waiverPath,
                });
                if (!updated) {
                    return res.status(400).render('tool/delegate_error', {
                        layout: 'layouts/main',
                        title: 'Lỗi — Ký miễn trừ',
                        message: 'Không lưu được. Vui lòng thử lại.',
                    });
                }
                await participantCheckinHService.ensureQrScanToken(p0._id);
                try {
                    if (eventBulkMailService.isSendGridConfigured()) {
                        const fresh = await participantCheckinHService.getById(p0._id);
                        if (fresh) {
                            await eventBulkMailService.sendQrMailToParticipant(event, fresh);
                        }
                    }
                } catch (mailErr) {
                    console.error('waiverSubmit sendQrMail', mailErr.message || mailErr);
                }
                return res.redirect(303, `/tool-checkin/waiver/${encodeURIComponent(token)}?done=1`);
            } catch (e) {
                console.error('waiverSubmit', e);
                if (!res.headersSent) {
                    return res.status(500).render('tool/delegate_error', {
                        layout: 'layouts/main',
                        title: 'Lỗi — Ký miễn trừ',
                        message: 'Lỗi máy chủ. Vui lòng thử lại sau.',
                    });
                }
            }
        },
    };
};

module.exports = toolCheckinController;
