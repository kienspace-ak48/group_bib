const CNAME = 'event.controller.js ';
const VLAYOUT = 'layouts/adminLayout2';
const VNAME = 'admin/event';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const myPathConfig = require('../../../config/mypath.config');
const ATHLETE_IMPORT_TEMPLATE = path.join(myPathConfig.root, 'src/utils/athlete_import_example.xlsx');

const xlsx = require('xlsx');
const QRCode = require('qrcode');
const eventCheckinHService = require('../services/eventCheckinH.service');
const participantCheckinHService = require('../services/participantCheckinH.service');
const groupAuthorizationHService = require('../services/groupAuthorizationH.service');
const delegationAuthorizationLogHService = require('../services/delegationAuthorizationLogH.service');
const auditLogService = require('../services/auditLog.service');
const eventMailConfigService = require('../services/eventMailConfig.service');
const eventBulkMailService = require('../services/eventBulkMail.service');
const mailBulkJobService = require('../services/mailBulkJob.service');
const sendGridMailEventService = require('../../../services/sendGridMailEvent.service');
const { convertRowCheckinH, generateUID } = require('../../../utils/participantCheckinExcelRow.util');
const { normalizePickupTimeRange } = require('../../../utils/pickupTimeRange.util');
const { getPublicBaseUrl } = require('../../../utils/publicBaseUrl.util');
const { buildCheckinScanAbsoluteUrl } = require('../../../utils/checkinScanUrl.util');
const participantDelegationLogHService = require('../services/participantDelegationLogH.service');
const {
    parseDelegationBody,
    finalizeDelegationState,
    snapshotFromParticipant,
    computeDelegationAction,
    buildDelegationLogSummary,
} = require('../../../utils/participantDelegation.util');

const BATCH_SIZE = 1000;
const PARTICIPANT_LIST_LIMIT = 10000;
const PARTICIPANT_PAGE_DEFAULT = 20;
const PARTICIPANT_PAGE_MAX = 100;
const CHECKIN_HISTORY_PAGE_DEFAULT = 25;
const CHECKIN_HISTORY_PAGE_MAX = 100;

async function appendParticipantDelegationLogIfChanged({
    eventId,
    participantId,
    oldSnap,
    finSnap,
    actor,
    actorAdminId,
}) {
    const action = computeDelegationAction(oldSnap, finSnap);
    if (!action) return;
    await groupAuthorizationHService.detachParticipantFromLegacyGroup(participantId, eventId);
    await participantDelegationLogHService.append({
        event_id: eventId,
        participant_id: participantId,
        actor,
        actor_admin_id: actor === 'admin' ? actorAdminId : undefined,
        action,
        delegate_snapshot: {
            fullname: finSnap.delegate_fullname,
            email: finSnap.delegate_email,
            phone: finSnap.delegate_phone,
            cccd: finSnap.delegate_cccd,
        },
        summary: buildDelegationLogSummary(actor === 'admin' ? 'admin' : 'participant', action, finSnap),
    });
}

function stepPath(eventId, step) {
    const n = Math.min(4, Math.max(0, Number(step) || 0));
    return `/admin/event/${eventId}/step/${n}`;
}

function maxConfirmedFromEvent(ev) {
    if (ev == null || ev.max_confirmed_step == null) return -1;
    return Math.min(4, Math.max(-1, Number(ev.max_confirmed_step)));
}

/** Bước xa nhất có thể mở (chưa xác nhận bước biên = max_confirmed + 1) */
function maxAllowedFromEvent(ev) {
    return Math.min(4, maxConfirmedFromEvent(ev) + 1);
}

/** Giữ bộ lọc + trang khi redirect sau thêm/sửa/xóa ở bước 2 */
function redirectSuffixStep1Athletes(body) {
    if (!body || typeof body !== 'object') return '';
    const q = new URLSearchParams();
    const name = String(body.ret_q_name || '').trim();
    const bib = String(body.ret_q_bib || '').trim();
    const phone = String(body.ret_q_phone || '').trim();
    const cccd = String(body.ret_q_cccd || '').trim();
    if (name) q.set('q_name', name);
    if (bib) q.set('q_bib', bib);
    if (phone) q.set('q_phone', phone);
    if (cccd) q.set('q_cccd', cccd);
    const page = String(body.ret_page || '').trim();
    if (page) q.set('page', page);
    const perPage = String(body.ret_perPage || '').trim();
    if (perPage) q.set('perPage', perPage);
    const retTab = String(body.ret_tab || '').trim();
    const tabNorm = retTab === 'group_members' ? 'group' : retTab;
    if (tabNorm === 'single' || tabNorm === 'group') q.set('tab', tabNorm);
    const s = q.toString();
    return s ? `?${s}` : '';
}

/** Payload cùng cấu trúc với `participantRowJson` trong `_step_athletes.ejs` (form sửa). */
function buildParticipantEditPayload(p) {
    const o = {
        _id: String(p._id),
        fullname: p.fullname || '',
        cccd: p.cccd || '',
        email: p.email || '',
        phone: p.phone || '',
        bib: p.bib || '',
        chip: p.chip != null ? String(p.chip) : '',
        bib_name: p.bib_name || '',
        category: p.category || '',
        item: p.item || '',
        zone: p.zone || '',
        qr_code: p.qr_code != null && String(p.qr_code) !== '' ? String(p.qr_code) : '',
        qr_scan_token: p.qr_scan_token != null && String(p.qr_scan_token).trim() !== '' ? String(p.qr_scan_token).trim() : '',
        checkin_method: p.checkin_method || 'import',
        status: p.status || 'registered',
        checkin_by: p.checkin_by || '',
        gender: p.gender,
        group_authorization_id: p.group_authorization_id ? String(p.group_authorization_id) : '',
        group_auth_creation_source: p.group_auth_creation_source ? String(p.group_auth_creation_source) : '',
        delegation_enabled: !!(p.delegation_enabled === true),
        delegate_fullname: p.delegate_fullname != null ? String(p.delegate_fullname) : '',
        delegate_email: p.delegate_email != null ? String(p.delegate_email) : '',
        delegate_phone: p.delegate_phone != null ? String(p.delegate_phone) : '',
        delegate_cccd: p.delegate_cccd != null ? String(p.delegate_cccd) : '',
        delegate_group_tool_url: p.delegate_group_tool_url != null ? String(p.delegate_group_tool_url) : '',
        delegation_logs: (p.delegation_logs || []).map((lg) => ({
            createdAt: lg.createdAt,
            summary: lg.summary != null ? String(lg.summary) : '',
            actor: lg.actor != null ? String(lg.actor) : '',
            action: lg.action != null ? String(lg.action) : '',
        })),
    };
    if (p.dob) o.dob_iso = new Date(p.dob).toISOString();
    if (p.checkin_time) o.checkin_time_iso = new Date(p.checkin_time).toISOString();
    if (p.pickup_time_range != null && String(p.pickup_time_range).trim() !== '') {
        o.pickup_time_range = String(p.pickup_time_range);
    }
    return o;
}

const adminEventController = () => {
    function uidPrefixFromEvent(event) {
        const s = (event.short_id && String(event.short_id).trim()) || (event.slug && String(event.slug).trim().slice(0, 32)) || 'ev';
        return s.replace(/[^a-zA-Z0-9_-]/g, '_') || 'ev';
    }

    return {
        /** Danh sách sự kiện (event_checkin_h) */
        Index: async (req, res) => {
            try {
                const events = await eventCheckinHService.list();
                const flash = req.session.flash;
                delete req.session.flash;
                return res.render(VNAME + '/index', {
                    layout: VLAYOUT,
                    events,
                    flash: flash || null,
                });
            } catch (error) {
                console.log(CNAME, error.message);
                return res.render(VNAME + '/index', { layout: VLAYOUT, events: [], flash: null });
            }
        },

        /** Tạo nhanh sự kiện */
        create: async (req, res) => {
            try {
                const name = (req.body.name || '').trim();
                if (!name) {
                    req.session.flash = { type: 'danger', message: 'Vui lòng nhập tên sự kiện.' };
                    return res.redirect('/admin/event');
                }
                const created = await eventCheckinHService.create({
                    name,
                    workflow_step: 0,
                    max_confirmed_step: -1,
                    is_show: false,
                });
                if (!created) {
                    req.session.flash = { type: 'danger', message: 'Không tạo được sự kiện.' };
                    return res.redirect('/admin/event');
                }
                await auditLogService.write({
                    actorId: req.user?._id,
                    action: 'create',
                    resource: 'event_checkin_h',
                    documentId: created._id,
                    summary: `Tạo sự kiện: ${name}`,
                    req,
                });
                req.session.flash = { type: 'success', message: 'Đã tạo sự kiện.' };
                return res.redirect(stepPath(created._id, 0));
            } catch (error) {
                console.log(CNAME, error.message);
                req.session.flash = { type: 'danger', message: 'Lỗi server.' };
                return res.redirect('/admin/event');
            }
        },

        /** Xóa sự kiện + toàn bộ người tham dự */
        destroy: async (req, res) => {
            try {
                const { id } = req.params;
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    req.session.flash = { type: 'warning', message: 'Không tìm thấy sự kiện.' };
                    return res.redirect('/admin/event');
                }
                await groupAuthorizationHService.deleteByEventId(id);
                await participantCheckinHService.deleteByEventId(id);
                const ok = await eventCheckinHService.deleteById(id);
                if (ok) {
                    await auditLogService.write({
                        actorId: req.user?._id,
                        action: 'delete',
                        resource: 'event_checkin_h',
                        documentId: id,
                        summary: `Xóa sự kiện: ${event.name || id}`,
                        req,
                    });
                }
                req.session.flash = {
                    type: ok ? 'success' : 'danger',
                    message: ok ? 'Đã xóa sự kiện và danh sách người tham dự.' : 'Không xóa được sự kiện.',
                };
                return res.redirect('/admin/event');
            } catch (error) {
                console.log(CNAME, error.message);
                req.session.flash = { type: 'danger', message: 'Lỗi khi xóa sự kiện.' };
                return res.redirect('/admin/event');
            }
        },

        /** Redirect tới /step/:n theo workflow_step đã lưu */
        workspace: async (req, res) => {
            try {
                const { id } = req.params;
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    req.session.flash = { type: 'warning', message: 'Không tìm thấy sự kiện.' };
                    return res.redirect('/admin/event');
                }
                const ws =
                    event.workflow_step != null ? Math.min(4, Math.max(0, Number(event.workflow_step))) : 0;
                return res.redirect(stepPath(id, ws));
            } catch (error) {
                console.log(CNAME, error.message);
                return res.redirect('/admin/event');
            }
        },

        /** Một bước workspace: chỉ mở được tới max_confirmed+1; lưu workflow_step khi hợp lệ */
        workspaceStep: async (req, res) => {
            try {
                const { id, step: stepParam } = req.params;
                if (!/^[0-4]$/.test(String(stepParam))) {
                    req.session.flash = { type: 'warning', message: 'Bước không hợp lệ.' };
                    return res.redirect(stepPath(id, 0));
                }
                let n = parseInt(stepParam, 10);
                n = Math.min(4, Math.max(0, n));

                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    req.session.flash = { type: 'warning', message: 'Không tìm thấy sự kiện.' };
                    return res.redirect('/admin/event');
                }

                const maxAllowed = maxAllowedFromEvent(event);
                if (n > maxAllowed) {
                    req.session.flash = {
                        type: 'warning',
                        message: 'Hoàn thành và xác nhận bước hiện tại trước khi sang bước sau.',
                    };
                    return res.redirect(stepPath(id, maxAllowed));
                }

                await eventCheckinHService.setWorkflowStep(id, n);

                const refreshed = await eventCheckinHService.getById(id);
                const mc = maxConfirmedFromEvent(refreshed);
                const ma = maxAllowedFromEvent(refreshed);
                const canGoNext = n < ma;
                const showConfirmStep = mc < 4 && n === mc + 1;

                const participantCount = await participantCheckinHService.countByEventId(event._id);
                let participants = [];
                let participantPagination = null;
                let participantFilters = { q_name: '', q_bib: '', q_phone: '', q_cccd: '' };
                if (n === 1) {
                    await participantCheckinHService.backfillQrScanTokensForEvent(refreshed._id, { limit: 2000 });
                    const q_name = String(req.query.q_name || '').trim();
                    const q_bib = String(req.query.q_bib || '').trim();
                    const q_phone = String(req.query.q_phone || '').trim();
                    const q_cccd = String(req.query.q_cccd || '').trim();
                    participantFilters = { q_name, q_bib, q_phone, q_cccd };
                    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
                    const perPage = Math.min(
                        PARTICIPANT_PAGE_MAX,
                        Math.max(5, parseInt(req.query.perPage, 10) || PARTICIPANT_PAGE_DEFAULT),
                    );
                    const filters = {
                        fullname: q_name,
                        bib: q_bib,
                        phone: q_phone,
                        cccd: q_cccd,
                    };
                    const listTotal = await participantCheckinHService.countByEventIdWithFilters(event._id, filters);
                    const totalPages = Math.max(1, Math.ceil(listTotal / perPage));
                    const safePage = Math.min(page, totalPages);
                    const skip = (safePage - 1) * perPage;
                    participants = await participantCheckinHService.findByEventIdWithFilters(event._id, filters, {
                        skip,
                        limit: perPage,
                    });
                    const qsBase = new URLSearchParams();
                    if (q_name) qsBase.set('q_name', q_name);
                    if (q_bib) qsBase.set('q_bib', q_bib);
                    if (q_phone) qsBase.set('q_phone', q_phone);
                    if (q_cccd) qsBase.set('q_cccd', q_cccd);
                    if (perPage !== PARTICIPANT_PAGE_DEFAULT) qsBase.set('perPage', String(perPage));
                    const filterQuery = qsBase.toString();
                    participantPagination = {
                        page: safePage,
                        perPage,
                        total: listTotal,
                        totalPages,
                        hasPrev: safePage > 1,
                        hasNext: safePage < totalPages,
                        filterQuery,
                    };
                }

                let mailConfig = null;
                let mailEligibleCount = 0;
                let sendgridConfigured = false;
                let mailBulkJobLatest = null;
                if (n === 1 || n === 2) {
                    sendgridConfigured = eventBulkMailService.isSendGridConfigured();
                }
                let mailWaiverPendingCount = 0;
                if (n === 2) {
                    mailConfig = await eventMailConfigService.findByEventId(refreshed._id);
                    mailEligibleCount = await participantCheckinHService.countWithValidEmailByEventId(refreshed._id);
                    if (refreshed.online_waiver_first_flow) {
                        mailWaiverPendingCount = await participantCheckinHService.countEligibleForWaiverRequestMail(
                            refreshed._id,
                        );
                    }
                    const latestJob = await mailBulkJobService.findLatestJobForEvent(refreshed._id);
                    mailBulkJobLatest = latestJob ? eventBulkMailService.serializeBulkJobForApi(latestJob) : null;
                }

                let checkinStats = null;
                if (n === 3) {
                    checkinStats = await participantCheckinHService.getCheckinDashboardStats(refreshed._id);
                }

                let groupAuthorizations = [];
                let singleDelegationParticipants = [];
                let participantDelegationLogs = [];
                let delegationLogs = [];
                const tabQ = String(req.query.tab || '').trim();
                const athletesTab =
                    tabQ === 'group' || tabQ === 'single' || tabQ === 'group_members' ? (tabQ === 'group_members' ? 'group' : tabQ) : 'athletes';
                if (n === 1) {
                    delegationLogs = await delegationAuthorizationLogHService.listByEventId(refreshed._id, {
                        limit: 200,
                    });
                    participantDelegationLogs = await participantDelegationLogHService.listByEventId(refreshed._id, {
                        limit: 200,
                    });
                    const rawGroups = await groupAuthorizationHService.listByEventId(refreshed._id);
                    const hostBase = getPublicBaseUrl()
                        || `${req.protocol}://${req.get('host')}`;
                    groupAuthorizations = await Promise.all(
                        rawGroups.map(async (g) => {
                            const t = g.token ? String(g.token) : '';
                            const scanPath = t ? `/tool-checkin/scan/${encodeURIComponent(t)}` : '';
                            const toolFullUrl =
                                (t && buildCheckinScanAbsoluteUrl(t)) ||
                                (hostBase && scanPath ? `${String(hostBase).replace(/\/$/, '')}${scanPath}` : '');
                            let qrDataUrl = '';
                            try {
                                /** Ảnh QR: chỉ token (hex), không nhúng URL — trùng logic mail / quét app. */
                                qrDataUrl = t
                                    ? await QRCode.toDataURL(t, {
                                          width: 240,
                                          margin: 1,
                                          errorCorrectionLevel: 'M',
                                      })
                                    : '';
                            } catch (e) {
                                /* ignore */
                            }
                            return { ...g, toolFullUrl, toolPath: scanPath, qrDataUrl };
                        }),
                    );
                    const pids = (participants || []).map((p) => p._id);
                    const partLogsFlat = await participantDelegationLogHService.listByParticipantIds(pids, {
                        limitPerParticipant: 30,
                    });
                    const logByPid = {};
                    for (const lg of partLogsFlat) {
                        const pid = String(lg.participant_id);
                        if (!logByPid[pid]) logByPid[pid] = [];
                        logByPid[pid].push(lg);
                    }
                    for (const pid of Object.keys(logByPid)) {
                        logByPid[pid].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    }
                    participants = (participants || []).map((p) => ({
                        ...p,
                        delegation_logs: logByPid[String(p._id)] || [],
                    }));
                    participants = groupAuthorizationHService.attachParticipantDelegationForList(participants);
                    singleDelegationParticipants = await participantCheckinHService.findByEventIdWithDelegationEnabled(
                        refreshed._id,
                        500,
                    );
                    singleDelegationParticipants =
                        groupAuthorizationHService.attachParticipantDelegationForList(singleDelegationParticipants);
                }

                const flash = req.session.flash;
                delete req.session.flash;

                const _publicHost = getPublicBaseUrl() || `${req.protocol}://${req.get('host')}`;
                const publicCheckinScanBase = `${String(_publicHost).replace(/\/$/, '')}/tool-checkin/scan/`;
                const publicBaseUrlHint = String(_publicHost).replace(/\/$/, '');

                return res.render(VNAME + '/workspace', {
                    layout: VLAYOUT,
                    event: refreshed,
                    currentWorkflowStep: n,
                    maxConfirmedStep: mc,
                    maxAllowedStep: ma,
                    canGoNext,
                    showConfirmStep,
                    participants,
                    participantCount,
                    participantPagination,
                    participantFilters,
                    mailConfig,
                    mailEligibleCount,
                    mailWaiverPendingCount,
                    mailBulkJobLatest,
                    sendgridConfigured,
                    checkinStats,
                    groupAuthorizations,
                    singleDelegationParticipants,
                    participantDelegationLogs,
                    delegationLogs,
                    athletesTab,
                    publicCheckinScanBase,
                    publicBaseUrlHint,
                    flash: flash || null,
                });
            } catch (error) {
                console.log(CNAME, error.message);
                return res.redirect('/admin/event');
            }
        },

        /** Lịch sử check-in (participant đã checked_in); GET /admin/event/checkin-history?event=&q=&staff=&page= */
        checkinHistory: async (req, res) => {
            try {
                const events = await eventCheckinHService.list();
                const q = String(req.query.q || '').trim();
                const staff = String(req.query.staff || '').trim();
                const page = Math.max(1, parseInt(req.query.page, 10) || 1);
                const perPage = Math.min(
                    CHECKIN_HISTORY_PAGE_MAX,
                    Math.max(5, parseInt(req.query.perPage, 10) || CHECKIN_HISTORY_PAGE_DEFAULT),
                );
                const requestedId = String(req.query.event || '').trim();

                let event = null;
                if (requestedId) {
                    event = await eventCheckinHService.getById(requestedId);
                }
                if (!event && events.length) {
                    event = events[0];
                }

                const flash = req.session.flash;
                delete req.session.flash;

                if (!event) {
                    return res.render(VNAME + '/checkin_history', {
                        layout: VLAYOUT,
                        event: null,
                        events: events || [],
                        rows: [],
                        staffOptions: [],
                        filters: { q, staff },
                        historyPagination: null,
                        flash: flash || null,
                    });
                }

                const id = event._id;
                const [staffOptions, total] = await Promise.all([
                    participantCheckinHService.distinctCheckinStaff(id),
                    participantCheckinHService.countCheckedInHistory(id, { q, staff }),
                ]);
                const totalPages = Math.max(1, Math.ceil(total / perPage));
                const safePage = Math.min(page, totalPages);
                const skip = (safePage - 1) * perPage;
                const rows = await participantCheckinHService.findCheckedInHistory(
                    id,
                    { q, staff },
                    { skip, limit: perPage },
                );

                const basePath = '/admin/event/checkin-history';
                const mkUrl = (pageNum) => {
                    const p = new URLSearchParams();
                    p.set('event', String(id));
                    if (q) p.set('q', q);
                    if (staff) p.set('staff', staff);
                    if (perPage !== CHECKIN_HISTORY_PAGE_DEFAULT) p.set('perPage', String(perPage));
                    if (pageNum > 1) p.set('page', String(pageNum));
                    return `${basePath}?${p.toString()}`;
                };

                const historyPagination = {
                    page: safePage,
                    perPage,
                    total,
                    totalPages,
                    hasPrev: safePage > 1,
                    hasNext: safePage < totalPages,
                    prevUrl: safePage > 1 ? mkUrl(safePage - 1) : null,
                    nextUrl: safePage < totalPages ? mkUrl(safePage + 1) : null,
                };

                return res.render(VNAME + '/checkin_history', {
                    layout: VLAYOUT,
                    event,
                    events,
                    rows,
                    staffOptions,
                    filters: { q, staff },
                    historyPagination,
                    flash: flash || null,
                });
            } catch (error) {
                console.log(CNAME, error.message);
                return res.redirect('/admin/event');
            }
        },

        /** Xác nhận hoàn thành bước hiện tại (theo thứ tự) */
        confirmStep: async (req, res) => {
            try {
                const { id } = req.params;
                const step = parseInt(req.body.step, 10);
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    req.session.flash = { type: 'warning', message: 'Không tìm thấy sự kiện.' };
                    return res.redirect('/admin/event');
                }
                const updated = await eventCheckinHService.confirmStep(id, step);
                if (!updated) {
                    req.session.flash = {
                        type: 'danger',
                        message: 'Không xác nhận được (chỉ xác nhận lần lượt từng bước).',
                    };
                    return res.redirect(stepPath(id, Math.min(maxAllowedFromEvent(event), 4)));
                }
                await auditLogService.write({
                    actorId: req.user?._id,
                    action: 'update',
                    resource: 'event_checkin_h',
                    documentId: id,
                    summary: `Xác nhận bước ${step} workspace`,
                    req,
                });
                req.session.flash = { type: 'success', message: 'Đã xác nhận hoàn thành bước.' };
                const ws = updated.workflow_step != null ? Math.min(4, Math.max(0, Number(updated.workflow_step))) : 0;
                return res.redirect(stepPath(id, ws));
            } catch (error) {
                console.log(CNAME, error.message);
                req.session.flash = { type: 'danger', message: 'Lỗi xác nhận bước.' };
                return res.redirect(stepPath(req.params.id, 0));
            }
        },

        /** Cập nhật thông tin sự kiện (bước Khởi tạo / chung) */
        updateEvent: async (req, res) => {
            try {
                const { id } = req.params;
                const body = req.body;
                const payload = {
                    name: body.name,
                    desc: body.desc,
                    location: body.location,
                    short_id: body.short_id,
                    status: body.status,
                    race_type: body.race_type,
                    organizer_name: body.organizer_name,
                    organizer_web: body.organizer_web,
                    organizer_fanpage: body.organizer_fanpage,
                    organizer_zalo: body.organizer_zalo,
                };
                if (body.start_date) payload.start_date = new Date(body.start_date);
                if (body.end_date) payload.end_date = new Date(body.end_date);
                payload.is_show = !!(body.is_show === 'on' || body.is_show === 'true' || body.is_show === true);

                const capModes = ['none', 'signature', 'photo', 'both'];
                const rawCap = (body.checkin_capture_mode || '').trim();
                payload.checkin_capture_mode = capModes.includes(rawCap) ? rawCap : 'both';

                payload.single_delegation_enabled = !!(
                    body.single_delegation_enabled === 'true' ||
                    body.single_delegation_enabled === true ||
                    body.single_delegation_enabled === 'on'
                );

                payload.online_waiver_first_flow = !!(
                    body.online_waiver_first_flow === 'true' ||
                    body.online_waiver_first_flow === true ||
                    body.online_waiver_first_flow === 'on'
                );
                payload.waiver_notice_html =
                    body.waiver_notice_html != null ? String(body.waiver_notice_html) : '';
                payload.waiver_document_url =
                    body.waiver_document_url != null ? String(body.waiver_document_url).trim() : '';

                const updated = await eventCheckinHService.updateById(id, payload);
                req.session.flash = {
                    type: updated ? 'success' : 'danger',
                    message: updated ? 'Đã lưu thông tin sự kiện.' : 'Không lưu được.',
                };
                return res.redirect(stepPath(id, 0));
            } catch (error) {
                console.log(CNAME, error.message);
                req.session.flash = { type: 'danger', message: 'Lỗi cập nhật.' };
                return res.redirect(stepPath(req.params.id, 0));
            }
        },

        /** Import Excel: append | reset */
        importParticipantsExcel: async (req, res) => {
            const { id } = req.params;
            try {
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    req.session.flash = { type: 'warning', message: 'Không tìm thấy sự kiện.' };
                    return res.redirect('/admin/event');
                }
                if (!req.file || !req.file.buffer) {
                    req.session.flash = { type: 'danger', message: 'Vui lòng chọn file Excel (.xlsx / .xls).' };
                    return res.redirect(stepPath(id, 1));
                }

                const mode = (req.body.import_mode || 'append').toLowerCase();
                if (mode === 'reset') {
                    await groupAuthorizationHService.deleteByEventId(event._id);
                    await participantCheckinHService.deleteByEventId(event._id);
                }

                const workbook = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const excelData = xlsx.utils.sheet_to_json(worksheet, { defval: null, raw: false });

                if (!excelData.length) {
                    req.session.flash = { type: 'danger', message: 'File Excel không có dòng dữ liệu.' };
                    return res.redirect(stepPath(id, 1));
                }

                const prefix = uidPrefixFromEvent(event);
                const rows = [];
                let skipped = 0;
                for (let i = 0; i < excelData.length; i++) {
                    const row = excelData[i];
                    const base = convertRowCheckinH(row, event._id);
                    if (!base.fullname || !base.cccd) {
                        skipped++;
                        continue;
                    }
                    const uid = generateUID(prefix);
                    const qrFromFile = base.qr_code && String(base.qr_code).trim();
                    rows.push({
                        ...base,
                        uid,
                        qr_code: qrFromFile || uid,
                        qr_scan_token: crypto.randomBytes(24).toString('hex'),
                        checkin_method: base.checkin_method || 'import',
                        status: base.status || 'registered',
                    });
                }

                if (!rows.length) {
                    req.session.flash = {
                        type: 'danger',
                        message: 'Không có dòng hợp lệ (cần ít nhất họ tên + CCCD).',
                    };
                    return res.redirect(stepPath(id, 1));
                }

                let totalInserted = 0;
                for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                    const batch = rows.slice(i, i + BATCH_SIZE);
                    const { inserted } = await participantCheckinHService.insertMany(batch);
                    totalInserted += inserted;
                }

                const parts = [
                    mode === 'reset' ? 'Đã xóa danh cũ và import' : 'Đã import thêm',
                    `${totalInserted}/${rows.length} bản ghi.`,
                ];
                if (skipped) parts.push(`Bỏ qua ${skipped} dòng thiếu họ tên/CCCD.`);
                await auditLogService.write({
                    actorId: req.user?._id,
                    action: mode === 'reset' ? 'update' : 'create',
                    resource: 'participant_checkin_h',
                    documentId: id,
                    summary: `Import người tham dự sự kiện ${id}: ${parts.join(' ')}`,
                    req,
                });
                req.session.flash = { type: 'success', message: parts.join(' ') };
                return res.redirect(stepPath(id, 1));
            } catch (error) {
                console.log(CNAME, error.message);
                req.session.flash = { type: 'danger', message: 'Lỗi import Excel: ' + error.message };
                return res.redirect(stepPath(id, 1));
            }
        },

        /** Xuất toàn bộ participant ra Excel (kèm trạng thái check-in) */
        exportParticipantsExcel: async (req, res) => {
            const { id } = req.params;
            try {
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    req.session.flash = { type: 'warning', message: 'Không tìm thấy sự kiện.' };
                    return res.redirect('/admin/event');
                }
                const rows = await participantCheckinHService.findAllByEventIdForExport(event._id, PARTICIPANT_LIST_LIMIT);
                const fmtDt = (d) => {
                    if (!d) return '';
                    const x = d instanceof Date ? d : new Date(d);
                    return Number.isNaN(x.getTime()) ? '' : x.toISOString();
                };
                const fmtDateYmd = (d) => {
                    if (!d) return '';
                    const x = d instanceof Date ? d : new Date(d);
                    return Number.isNaN(x.getTime()) ? '' : x.toISOString().slice(0, 10);
                };
                const exportRows = rows.map((p) => {
                    const gender =
                        p.gender === true ? 'Nam' : p.gender === false ? 'Nữ' : '';
                    const da_checkin = p.status === 'checked_in' ? 'Có' : 'Không';
                    return {
                        bib: p.bib || '',
                        chip: p.chip != null ? String(p.chip) : '',
                        uid: p.uid || '',
                        fullname: p.fullname || '',
                        cccd: p.cccd || '',
                        email: p.email || '',
                        phone: p.phone || '',
                        dob: fmtDateYmd(p.dob),
                        gender,
                        zone: p.zone || '',
                        bib_name: p.bib_name || '',
                        category: p.category != null && String(p.category) !== '' ? String(p.category) : '',
                        item: p.item || '',
                        qr_code: p.qr_code || '',
                        status: p.status || '',
                        checkin_method: p.checkin_method || '',
                        da_checkin,
                        checkin_time: fmtDt(p.checkin_time),
                        checkin_by: p.checkin_by || '',
                        qr_mail_sent_at: fmtDt(p.qr_mail_sent_at),
                        pickup_time_range: p.pickup_time_range != null ? String(p.pickup_time_range) : '',
                    };
                });
                const ws = xlsx.utils.json_to_sheet(exportRows);
                const wb = xlsx.utils.book_new();
                xlsx.utils.book_append_sheet(wb, ws, 'participants');
                const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
                const slug = (event.slug && String(event.slug).trim()) || String(event._id);
                const safeSlug = slug.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'event';
                const fname = `participants_${safeSlug}_${Date.now()}.xlsx`;
                await auditLogService.write({
                    actorId: req.user?._id,
                    action: 'export',
                    resource: 'participant_checkin_h',
                    documentId: id,
                    summary: `Xuất Excel danh sách VĐV sự kiện ${id}: ${exportRows.length} dòng`,
                    req,
                });
                res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
                res.setHeader(
                    'Content-Type',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                );
                return res.send(Buffer.from(buf));
            } catch (error) {
                console.log(CNAME, error.message);
                req.session.flash = { type: 'danger', message: 'Lỗi xuất Excel.' };
                return res.redirect('/admin/event/' + id + '/step/3');
            }
        },

        /** Tạo nhóm ủy quyền (đại diện + danh sách BIB) */
        createGroupAuthorization: async (req, res) => {
            const { id } = req.params;
            try {
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    req.session.flash = { type: 'warning', message: 'Không tìm thấy sự kiện.' };
                    return res.redirect('/admin/event');
                }
                const result = await groupAuthorizationHService.create(id, req.body, {
                    delegationSource: 'admin_group_tab',
                    actorAdminId: req.user?._id,
                });
                if (!result.ok) {
                    req.session.flash = { type: 'danger', message: result.message || 'Không tạo được nhóm.' };
                } else {
                    req.session.flash = { type: 'success', message: 'Đã tạo nhóm ủy quyền.' };
                    const gn = String(req.body.group_name || '').trim();
                    await auditLogService.write({
                        actorId: req.user?._id,
                        action: 'create',
                        resource: 'group_authorization_h',
                        documentId: result.doc?._id,
                        summary: gn
                            ? `Tạo nhóm ủy quyền "${gn}" sự kiện ${id}`
                            : `Tạo nhóm ủy quyền sự kiện ${id}`,
                        req,
                    });
                }
                return res.redirect(`/admin/event/${id}/step/1?tab=group`);
            } catch (error) {
                console.log(CNAME, error.message);
                req.session.flash = { type: 'danger', message: 'Lỗi server.' };
                return res.redirect(`/admin/event/${id}/step/1?tab=group`);
            }
        },

        /** Cập nhật nhóm ủy quyền */
        updateGroupAuthorization: async (req, res) => {
            const { id, gaId } = req.params;
            try {
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    req.session.flash = { type: 'warning', message: 'Không tìm thấy sự kiện.' };
                    return res.redirect('/admin/event');
                }
                const result = await groupAuthorizationHService.update(gaId, id, req.body, {
                    delegationSource: 'admin_group_tab',
                    actorAdminId: req.user?._id,
                });
                if (!result.ok) {
                    req.session.flash = { type: 'danger', message: result.message || 'Không cập nhật được.' };
                } else {
                    req.session.flash = { type: 'success', message: 'Đã cập nhật nhóm ủy quyền.' };
                    await auditLogService.write({
                        actorId: req.user?._id,
                        action: 'update',
                        resource: 'group_authorization_h',
                        documentId: gaId,
                        summary: `Cập nhật nhóm ủy quyền sự kiện ${id}`,
                        req,
                    });
                }
                return res.redirect(`/admin/event/${id}/step/1?tab=group`);
            } catch (error) {
                console.log(CNAME, error.message);
                req.session.flash = { type: 'danger', message: 'Lỗi server.' };
                return res.redirect(`/admin/event/${id}/step/1?tab=group`);
            }
        },

        /** Xóa nhóm ủy quyền */
        deleteGroupAuthorization: async (req, res) => {
            const { id, gaId } = req.params;
            try {
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    req.session.flash = { type: 'warning', message: 'Không tìm thấy sự kiện.' };
                    return res.redirect('/admin/event');
                }
                const result = await groupAuthorizationHService.remove(gaId, id, {
                    delegationSource: 'admin_group_tab',
                    actorAdminId: req.user?._id,
                });
                req.session.flash = {
                    type: result.ok ? 'success' : 'danger',
                    message: result.ok ? 'Đã xóa nhóm ủy quyền.' : result.message || 'Không xóa được.',
                };
                if (result.ok) {
                    await auditLogService.write({
                        actorId: req.user?._id,
                        action: 'delete',
                        resource: 'group_authorization_h',
                        documentId: gaId,
                        summary: `Xóa nhóm ủy quyền sự kiện ${id}`,
                        req,
                    });
                }
                return res.redirect(`/admin/event/${id}/step/1?tab=group`);
            } catch (error) {
                console.log(CNAME, error.message);
                req.session.flash = { type: 'danger', message: 'Lỗi server.' };
                return res.redirect(`/admin/event/${id}/step/1?tab=group`);
            }
        },

        /** Gửi lại mail nhóm BIB tới email người đại diện */
        resendGroupAuthorizationMail: async (req, res) => {
            const { id, gaId } = req.params;
            try {
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    req.session.flash = { type: 'warning', message: 'Không tìm thấy sự kiện.' };
                    return res.redirect('/admin/event');
                }
                const result = await groupAuthorizationHService.resendGroupBibMail(id, gaId, {
                    actorAdminId: req.user?._id,
                });
                req.session.flash = {
                    type: result.ok ? 'success' : 'warning',
                    message: result.message || (result.ok ? 'Đã gửi.' : 'Không gửi được mail.'),
                };
                if (result.ok) {
                    await auditLogService.write({
                        actorId: req.user?._id,
                        action: 'update',
                        resource: 'group_authorization_h',
                        documentId: gaId,
                        summary: `Gửi lại mail nhóm BIB sự kiện ${id}`,
                        req,
                    });
                }
                return res.redirect(`/admin/event/${id}/step/1?tab=group`);
            } catch (error) {
                console.log(CNAME, error.message);
                req.session.flash = { type: 'danger', message: 'Lỗi server.' };
                return res.redirect(`/admin/event/${id}/step/1?tab=group`);
            }
        },

        /** Gán đại diện nhận hộ cho một VĐV (tạo nhóm một người) — POST từ modal sửa VĐV */
        addParticipantGroupDelegate: async (req, res) => {
            const { id, participantId } = req.params;
            const suffix = redirectSuffixStep1Athletes(req.body);
            try {
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    req.session.flash = { type: 'warning', message: 'Không tìm thấy sự kiện.' };
                    return res.redirect('/admin/event');
                }
                const p = await participantCheckinHService.getById(participantId);
                if (!p || String(p.event_id) !== String(event._id)) {
                    req.session.flash = { type: 'danger', message: 'Không tìm thấy người tham dự.' };
                    return res.redirect(`/admin/event/${id}/step/1${suffix}`);
                }
                if (p.group_authorization_id) {
                    req.session.flash = {
                        type: 'warning',
                        message:
                            'VĐV này đã có đại diện nhận hộ. Nếu tạo qua link mail QR → tab Ủy quyền đơn; nếu tạo từ BTC → tab Nhóm.',
                    };
                    return res.redirect(`/admin/event/${id}/step/1${suffix}`);
                }
                const fullname = String(req.body.dlg_fullname || '').trim();
                const email = String(req.body.dlg_email || '').trim();
                const phone = String(req.body.dlg_phone || '').trim();
                const cccd = String(req.body.dlg_cccd || '').trim();
                if (!fullname) {
                    req.session.flash = { type: 'danger', message: 'Nhập họ tên người đại diện.' };
                    return res.redirect(`/admin/event/${id}/step/1${suffix}`);
                }
                const result = await groupAuthorizationHService.create(
                    id,
                    {
                        fullname,
                        email,
                        phone,
                        cccd,
                        participant_ids: [participantId],
                    },
                    { delegationSource: 'admin_participant_modal', actorAdminId: req.user?._id },
                );
                if (!result.ok) {
                    req.session.flash = { type: 'danger', message: result.message || 'Không gán được đại diện.' };
                } else {
                    req.session.flash = {
                        type: 'success',
                        message:
                            'Đã tạo nhóm ủy quyền cho VĐV này. Mail thông báo gửi tới đại diện nếu có email hợp lệ và SendGrid đã cấu hình.',
                    };
                    await auditLogService.write({
                        actorId: req.user?._id,
                        action: 'create',
                        resource: 'group_authorization_h',
                        documentId: result.doc?._id,
                        summary: `Gán đại diện từ danh sách VĐV (modal) sự kiện ${id}`,
                        req,
                    });
                }
                return res.redirect(`/admin/event/${id}/step/1${suffix}`);
            } catch (error) {
                console.log(CNAME, error.message);
                req.session.flash = { type: 'danger', message: 'Lỗi server.' };
                return res.redirect(`/admin/event/${id}/step/1${suffix}`);
            }
        },

        /** Chỉ cập nhật ủy quyền (tab Ủy quyền đơn — form gọn). */
        saveParticipantDelegation: async (req, res) => {
            const { id, participantId } = req.params;
            const suffix = redirectSuffixStep1Athletes(req.body);
            try {
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    req.session.flash = { type: 'warning', message: 'Không tìm thấy sự kiện.' };
                    return res.redirect('/admin/event');
                }
                const existing = await participantCheckinHService.getById(participantId);
                if (!existing || String(existing.event_id) !== String(event._id)) {
                    req.session.flash = { type: 'danger', message: 'Không tìm thấy người tham dự.' };
                    return res.redirect(stepPath(id, 1) + suffix);
                }
                const oldSnap = snapshotFromParticipant(existing);
                const parsed = parseDelegationBody(req.body);
                if (parsed.delegation_enabled && !parsed.delegate_fullname) {
                    req.session.flash = {
                        type: 'danger',
                        message: 'Nhập họ tên người được ủy quyền hoặc tắt ủy quyền.',
                    };
                    return res.redirect(stepPath(id, 1) + suffix);
                }
                const finSnap = finalizeDelegationState(parsed);
                if (!computeDelegationAction(oldSnap, finSnap)) {
                    req.session.flash = { type: 'success', message: 'Không có thay đổi ủy quyền.' };
                    return res.redirect(stepPath(id, 1) + suffix);
                }
                const updated = await participantCheckinHService.updateByIdAndEvent(participantId, id, finSnap);
                if (!updated) {
                    req.session.flash = { type: 'danger', message: 'Không lưu được.' };
                    return res.redirect(stepPath(id, 1) + suffix);
                }
                await appendParticipantDelegationLogIfChanged({
                    eventId: event._id,
                    participantId,
                    oldSnap,
                    finSnap,
                    actor: 'admin',
                    actorAdminId: req.user?._id,
                });
                req.session.flash = { type: 'success', message: 'Đã cập nhật ủy quyền nhận BIB.' };
                await auditLogService.write({
                    actorId: req.user?._id,
                    action: 'update',
                    resource: 'participant_checkin_h',
                    documentId: participantId,
                    summary: `Cập nhật ủy quyền (VĐV ${participantId}) sự kiện ${id}`,
                    req,
                });
                return res.redirect(stepPath(id, 1) + suffix);
            } catch (error) {
                console.log(CNAME, error.message);
                req.session.flash = { type: 'danger', message: 'Lỗi server.' };
                return res.redirect(stepPath(id, 1) + suffix);
            }
        },

        /** Thêm người tham dự thủ công */
        addParticipantManual: async (req, res) => {
            const { id } = req.params;
            try {
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    req.session.flash = { type: 'warning', message: 'Không tìm thấy sự kiện.' };
                    return res.redirect('/admin/event');
                }

                const body = req.body;
                const fullname = (body.fullname || '').trim();
                const cccd = (body.cccd || '').trim();
                if (!fullname || !cccd) {
                    req.session.flash = { type: 'danger', message: 'Họ tên và CCCD là bắt buộc.' };
                    return res.redirect(stepPath(id, 1) + redirectSuffixStep1Athletes(body));
                }

                const g = body.gender;
                let gender;
                if (g === 'M' || g === '1') gender = true;
                else if (g === 'F' || g === '0') gender = false;

                let dob;
                if (body.dob) {
                    const d = new Date(body.dob);
                    if (!Number.isNaN(d.getTime())) dob = d;
                }

                const str = (k) => ((body[k] || '') + '').trim() || undefined;
                const uidVal = generateUID(uidPrefixFromEvent(event));
                const qrManual = str('qr_code');
                const methods = ['scan', 'manual', 'kiosk', 'import', 'app'];
                const statuses = ['pending', 'registered', 'checked_in', 'cancelled'];
                const m = (str('checkin_method') || 'import').toLowerCase();
                const s = (str('status') || 'registered').toLowerCase();
                const pickup_time_range = normalizePickupTimeRange(body.pickup_time_range);
                const payload = {
                    uid: uidVal,
                    event_id: event._id,
                    fullname,
                    cccd,
                    email: str('email'),
                    phone: str('phone'),
                    dob,
                    gender,
                    zone: str('zone'),
                    qr_code: qrManual || uidVal,
                    qr_scan_token: crypto.randomBytes(24).toString('hex'),
                    bib: str('bib'),
                    chip: str('chip'),
                    bib_name: str('bib_name'),
                    category: str('category'),
                    item: str('item'),
                    checkin_method: methods.includes(m) ? m : 'import',
                    status: statuses.includes(s) ? s : 'registered',
                    checkin_by: str('checkin_by'),
                    pickup_time_range,
                };
                if (body.checkin_time) {
                    const ct = new Date(body.checkin_time);
                    if (!Number.isNaN(ct.getTime())) payload.checkin_time = ct;
                }

                const created = await participantCheckinHService.createOne(payload);
                req.session.flash = {
                    type: created ? 'success' : 'danger',
                    message: created ? 'Đã thêm người tham dự.' : 'Không thêm được (kiểm tra dữ liệu).',
                };
                return res.redirect(stepPath(id, 1) + redirectSuffixStep1Athletes(body));
            } catch (error) {
                console.log(CNAME, error.message);
                req.session.flash = { type: 'danger', message: 'Lỗi: ' + error.message };
                return res.redirect(stepPath(id, 1) + redirectSuffixStep1Athletes(req.body));
            }
        },

        /** GET JSON — dữ liệu mới nhất cho popup sửa VĐV (tránh bản snapshot cũ trong data-attribute). */
        getParticipantJson: async (req, res) => {
            const { id, participantId } = req.params;
            try {
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    return res.status(404).json({ ok: false, message: 'Không tìm thấy sự kiện.' });
                }
                let p = await participantCheckinHService.getById(participantId);
                if (!p || String(p.event_id) !== String(event._id)) {
                    return res.status(404).json({ ok: false, message: 'Không tìm thấy người tham dự.' });
                }
                await participantCheckinHService.ensureQrScanToken(participantId);
                p = await participantCheckinHService.getById(participantId);
                const logsFlat = await participantDelegationLogHService.listByParticipantIds([p._id], {
                    limitPerParticipant: 30,
                });
                const logs = logsFlat.filter((lg) => String(lg.participant_id) === String(p._id));
                logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                p = { ...p, delegation_logs: logs };
                const [withDelegation] = groupAuthorizationHService.attachParticipantDelegationForList([p]);
                return res.json({ ok: true, participant: buildParticipantEditPayload(withDelegation) });
            } catch (error) {
                console.log(CNAME, error.message);
                return res.status(500).json({ ok: false, message: 'Lỗi tải dữ liệu.' });
            }
        },

        /** Cập nhật một người tham dự (bước 2) */
        updateParticipant: async (req, res) => {
            const { id, participantId } = req.params;
            try {
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    req.session.flash = { type: 'warning', message: 'Không tìm thấy sự kiện.' };
                    return res.redirect('/admin/event');
                }
                const existing = await participantCheckinHService.getById(participantId);
                if (!existing || String(existing.event_id) !== String(event._id)) {
                    req.session.flash = { type: 'danger', message: 'Không tìm thấy người tham dự.' };
                    return res.redirect(stepPath(id, 1) + redirectSuffixStep1Athletes(req.body));
                }

                const body = req.body;
                const fullname = (body.fullname || '').trim();
                const cccd = (body.cccd || '').trim();
                if (!fullname || !cccd) {
                    req.session.flash = { type: 'danger', message: 'Họ tên và CCCD là bắt buộc.' };
                    return res.redirect(stepPath(id, 1) + redirectSuffixStep1Athletes(body));
                }

                const g = body.gender;
                let gender;
                if (g === 'M' || g === '1') gender = true;
                else if (g === 'F' || g === '0') gender = false;

                let dob;
                if (body.dob) {
                    const d = new Date(body.dob);
                    if (!Number.isNaN(d.getTime())) dob = d;
                }

                const str = (k) => ((body[k] || '') + '').trim() || undefined;
                const uidKeep = existing.uid;
                const qrManual = str('qr_code');
                const methods = ['scan', 'manual', 'kiosk', 'import', 'app'];
                const statuses = ['pending', 'registered', 'checked_in', 'cancelled'];
                const m = (str('checkin_method') || 'import').toLowerCase();
                const s = (str('status') || 'registered').toLowerCase();
                const pickup_time_range = normalizePickupTimeRange(body.pickup_time_range);
                const oldDelegSnap = snapshotFromParticipant(existing);
                let finDelegSnap = null;
                if (body.delegation_fields_present === '1') {
                    const parsed = parseDelegationBody(body);
                    if (parsed.delegation_enabled && !parsed.delegate_fullname) {
                        req.session.flash = {
                            type: 'danger',
                            message: 'Nhập họ tên người được ủy quyền hoặc tắt ủy quyền.',
                        };
                        return res.redirect(stepPath(id, 1) + redirectSuffixStep1Athletes(body));
                    }
                    finDelegSnap = finalizeDelegationState(parsed);
                }
                const payload = {
                    fullname,
                    cccd,
                    email: str('email'),
                    phone: str('phone'),
                    dob,
                    gender,
                    zone: str('zone'),
                    qr_code: qrManual || uidKeep,
                    bib: str('bib'),
                    chip: str('chip'),
                    bib_name: str('bib_name'),
                    category: str('category'),
                    item: str('item'),
                    checkin_method: methods.includes(m) ? m : 'import',
                    status: statuses.includes(s) ? s : 'registered',
                    checkin_by: str('checkin_by'),
                    pickup_time_range,
                };
                if (finDelegSnap) {
                    Object.assign(payload, finDelegSnap);
                }
                if (body.checkin_time) {
                    const ct = new Date(body.checkin_time);
                    if (!Number.isNaN(ct.getTime())) payload.checkin_time = ct;
                }

                const updated = await participantCheckinHService.updateByIdAndEvent(participantId, id, payload);
                req.session.flash = {
                    type: updated ? 'success' : 'danger',
                    message: updated ? 'Đã cập nhật người tham dự.' : 'Không cập nhật được.',
                };
                if (updated) {
                    if (body.delegation_fields_present === '1' && finDelegSnap) {
                        await appendParticipantDelegationLogIfChanged({
                            eventId: event._id,
                            participantId,
                            oldSnap: oldDelegSnap,
                            finSnap: finDelegSnap,
                            actor: 'admin',
                            actorAdminId: req.user?._id,
                        });
                    }
                    await auditLogService.write({
                        actorId: req.user?._id,
                        action: 'update',
                        resource: 'participant_checkin_h',
                        documentId: participantId,
                        summary: `Cập nhật người tham dự ${participantId} sự kiện ${id}`,
                        req,
                    });
                }
                return res.redirect(stepPath(id, 1) + redirectSuffixStep1Athletes(body));
            } catch (error) {
                console.log(CNAME, error.message);
                req.session.flash = { type: 'danger', message: 'Lỗi: ' + error.message };
                return res.redirect(stepPath(id, 1) + redirectSuffixStep1Athletes(req.body));
            }
        },

        /** Tải file Excel mẫu import danh sách */
        downloadAthleteImportTemplate: (req, res) => {
            try {
                if (!fs.existsSync(ATHLETE_IMPORT_TEMPLATE)) {
                    return res.status(404).send('File mẫu không tồn tại.');
                }
                return res.download(ATHLETE_IMPORT_TEMPLATE, 'athlete_import_example.xlsx');
            } catch (error) {
                console.log(CNAME, error.message);
                return res.status(500).send('Không tải được file.');
            }
        },

        /** Lưu cấu hình mail (bước 3 — gửi QR) */
        saveMailConfig: async (req, res) => {
            const { id } = req.params;
            try {
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện.' });
                }
                const body = req.body || {};
                const existing = await eventMailConfigService.findByEventId(event._id);
                const d = (k, fallback = '') =>
                    body[k] !== undefined && body[k] !== null ? String(body[k]) : (existing?.[k] ?? fallback);
                const payload = {
                    sender_name: d('sender_name', ''),
                    title: d('title', ''),
                    content_1: d('content_1', ''),
                    delegation_content_1: d('delegation_content_1', ''),
                    content_2: d('content_2', ''),
                    banner_text: d('banner_text', ''),
                    banner_img: body.banner_img !== undefined ? String(body.banner_img || '') : existing?.banner_img,
                    end_mail_img: '',
                    banner_option: body.banner_option !== undefined ? !!body.banner_option : !!existing?.banner_option,
                    footer_body: d('footer_body', ''),
                    footer_bg_color: d('footer_bg_color', '#f8f8f8'),
                    footer_text_color: d('footer_text_color', '#666666'),
                };
                const doc = await eventMailConfigService.upsert(event._id, payload);
                if (!doc) {
                    return res.status(500).json({ success: false, message: 'Không lưu được cấu hình mail.' });
                }
                await auditLogService.write({
                    actorId: req.user?._id,
                    action: 'update',
                    resource: 'mail_config',
                    documentId: event._id,
                    summary: `Cập nhật cấu hình mail sự kiện ${event.name || id}`,
                    req,
                });
                return res.json({ success: true });
            } catch (error) {
                console.log(CNAME, error.message);
                return res.status(500).json({ success: false, message: error.message || 'Lỗi server.' });
            }
        },

        /** Xem trước mail QR trong tab mới (cấu hình đã lưu + dữ liệu VĐV mẫu) */
        previewQrMail: async (req, res) => {
            const { id } = req.params;
            try {
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    return res
                        .status(404)
                        .type('html')
                        .send(
                            '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Lỗi</title></head><body><p>Không tìm thấy sự kiện.</p></body></html>',
                        );
                }
                const mailConfig = await eventMailConfigService.findByEventId(event._id);
                if (!mailConfig || !String(mailConfig.title || '').trim()) {
                    return res
                        .status(400)
                        .type('html')
                        .send(
                            '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Chưa cấu hình</title></head><body><p>Chưa có cấu hình mail đã lưu (cần có tiêu đề). Hãy bấm <strong>Lưu cấu hình</strong> ở bước 3 rồi mở lại preview.</p></body></html>',
                        );
                }
                const bodyHtml = await eventBulkMailService.buildQrMailPreviewHtml(event, mailConfig);
                const titleSafe = String(mailConfig.title || '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
                const withBanner = bodyHtml.replace(
                    /<body([^>]*)>/,
                    '<body$1><div style="background:#fff8e1;border-bottom:1px solid #e6c200;padding:10px 16px;font-size:13px;font-family:Arial,sans-serif;line-height:1.4;">Xem trước email QR — dữ liệu VĐV <strong>mẫu</strong> (theo cấu hình <strong>đã lưu</strong> trên server). Tiêu đề khi gửi: <strong>' +
                        titleSafe +
                        '</strong></div>',
                );
                const full =
                    '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Xem trước — mail QR</title></head>' +
                    withBanner +
                    '</html>';
                res.set('Content-Type', 'text/html; charset=utf-8');
                res.send(full);
            } catch (error) {
                console.log(CNAME, error.message);
                return res
                    .status(500)
                    .type('html')
                    .send(
                        '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Lỗi</title></head><body><p>Không tạo được preview. Thử lại sau.</p></body></html>',
                    );
            }
        },

        /** Upload banner email (multipart) */
        uploadMailBanner: async (req, res) => {
            const { id } = req.params;
            try {
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện.' });
                }
                const file = req.file;
                if (!file || !file.buffer) {
                    return res.status(400).json({ success: false, message: 'Vui lòng chọn file ảnh.' });
                }

                const existing = await eventMailConfigService.findByEventId(event._id);
                if (existing && existing.banner_img) {
                    const rel = String(existing.banner_img).replace(/^\//, '');
                    const oldAbs = path.join(myPathConfig.root, 'public', rel);
                    if (fs.existsSync(oldAbs)) {
                        try {
                            fs.unlinkSync(oldAbs);
                        } catch (e) {
                            console.log(CNAME, 'unlink banner', e.message);
                        }
                    }
                }

                const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
                const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`;
                const absDir = path.join(myPathConfig.root, 'public', 'email_img');
                if (!fs.existsSync(absDir)) {
                    fs.mkdirSync(absDir, { recursive: true });
                }
                const absFile = path.join(absDir, unique);
                fs.writeFileSync(absFile, file.buffer);
                const pathDB = '/email_img/' + unique;
                const doc = await eventMailConfigService.setBannerImg(event._id, pathDB);
                if (!doc) {
                    return res.status(500).json({ success: false, message: 'Không lưu được đường dẫn banner.' });
                }
                return res.json({ success: true, banner_img: pathDB });
            } catch (error) {
                console.log(CNAME, error.message);
                return res.status(500).json({ success: false, message: error.message || 'Lỗi upload.' });
            }
        },

        /** Gửi mail QR cho một người (thủ công / gửi lại) */
        sendParticipantQrMail: async (req, res) => {
            const { id, participantId } = req.params;
            try {
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện.' });
                }
                if (!eventBulkMailService.isSendGridConfigured()) {
                    return res.status(503).json({
                        success: false,
                        message:
                            'Chưa cấu hình SendGrid: cần API key (SENDGRID_API_KEY hoặc SENDGRID_API_KEY_DOMAIN) và địa chỉ From đã verify (SENDGRID_FROM_EMAIL hoặc SENDGRID_FROM_DOMAIN hoặc SENDGRID_FROM).',
                    });
                }
                const p = await participantCheckinHService.getById(participantId);
                if (!p) {
                    return res.status(404).json({ success: false, message: 'Không tìm thấy người tham dự.' });
                }
                if (String(p.event_id) !== String(event._id)) {
                    return res.status(400).json({ success: false, message: 'Người tham dự không thuộc sự kiện này.' });
                }
                let sent;
                let mailKind = 'qr';
                if (event.online_waiver_first_flow && !p.waiver_signed_at) {
                    sent = await eventBulkMailService.sendWaiverRequestMailToParticipant(event, p);
                    mailKind = 'waiver_request';
                } else {
                    sent = await eventBulkMailService.sendQrMailToParticipant(event, p);
                }
                await auditLogService.write({
                    actorId: req.user?._id,
                    action: 'create',
                    resource: 'mail_single',
                    documentId: event._id,
                    summary:
                        mailKind === 'waiver_request'
                            ? `Gửi mail mời ký miễn trừ: participant ${participantId} → ${sent.to}`
                            : `Gửi mail QR thủ công: participant ${participantId} → ${sent.to} (${sent.recipientType === 'delegate' ? 'người được ủy quyền' : 'VĐV'})`,
                    req,
                });
                return res.json({
                    success: true,
                    mailKind,
                    message:
                        mailKind === 'waiver_request'
                            ? `Đã gửi email mời ký miễn trừ tới ${sent.to}.`
                            : sent.recipientType === 'delegate'
                              ? `Đã gửi email QR tới người được ủy quyền (${sent.to}).`
                              : `Đã gửi email QR tới VĐV (${sent.to}).`,
                    to: sent.to,
                    recipientType: sent.recipientType,
                });
            } catch (error) {
                console.log(CNAME, error.message);
                return res.status(500).json({ success: false, message: error.message || 'Lỗi gửi mail.' });
            }
        },

        /** Gửi mail mời ký miễn trừ hàng loạt (không QR) — job nền */
        sendBulkWaiverRequestMail: async (req, res) => {
            const { id } = req.params;
            try {
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện.' });
                }
                if (!eventBulkMailService.isSendGridConfigured()) {
                    return res.status(503).json({
                        success: false,
                        message:
                            'Chưa cấu hình SendGrid: cần API key (SENDGRID_API_KEY hoặc SENDGRID_API_KEY_DOMAIN) và địa chỉ From đã verify (SENDGRID_FROM_EMAIL hoặc SENDGRID_FROM_DOMAIN hoặc SENDGRID_FROM).',
                    });
                }
                const result = await eventBulkMailService.enqueueBulkWaiverRequestMailJob(event, req.user?._id);
                if (!result.ok) {
                    return res.status(400).json({ success: false, message: result.message });
                }
                return res.status(202).json({
                    success: true,
                    jobId: result.jobId,
                    totalRecipients: result.totalRecipients,
                    message: 'Đã đưa vào hàng đợi gửi mail mời ký miễn trừ.',
                });
            } catch (error) {
                console.log(CNAME, error.message);
                return res.status(500).json({ success: false, message: error.message || 'Lỗi gửi mail.' });
            }
        },

        /** Gửi mail QR hàng loạt — tạo job nền (202 + jobId) */
        sendBulkQrMail: async (req, res) => {
            const { id } = req.params;
            try {
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện.' });
                }
                if (!eventBulkMailService.isSendGridConfigured()) {
                    return res.status(503).json({
                        success: false,
                        message:
                            'Chưa cấu hình SendGrid: cần API key (SENDGRID_API_KEY hoặc SENDGRID_API_KEY_DOMAIN) và địa chỉ From đã verify (SENDGRID_FROM_EMAIL hoặc SENDGRID_FROM_DOMAIN hoặc SENDGRID_FROM).',
                    });
                }
                const result = await eventBulkMailService.enqueueBulkQrMailJob(event, req.user?._id);
                if (!result.ok) {
                    return res.status(400).json({ success: false, message: result.message });
                }
                return res.status(202).json({
                    success: true,
                    jobId: result.jobId,
                    totalRecipients: result.totalRecipients,
                    message: 'Đã đưa vào hàng đợi gửi mail. Tiến độ cập nhật bên dưới.',
                });
            } catch (error) {
                console.log(CNAME, error.message);
                return res.status(500).json({ success: false, message: error.message || 'Lỗi gửi mail.' });
            }
        },

        /** Trạng thái job gửi mail hàng loạt (poll) */
        getBulkMailJobStatus: async (req, res) => {
            const { id, jobId } = req.params;
            try {
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện.' });
                }
                const job = await mailBulkJobService.findJobByIdForEvent(jobId, id);
                if (!job) {
                    return res.status(404).json({ success: false, message: 'Không tìm thấy job.' });
                }
                return res.json({
                    success: true,
                    job: eventBulkMailService.serializeBulkJobForApi(job),
                });
            } catch (error) {
                console.log(CNAME, error.message);
                return res.status(500).json({ success: false, message: error.message || 'Lỗi.' });
            }
        },

        /** Nhật ký phân phối mail (SendGrid Event Webhook — delivered, bounce, …) */
        getMailDeliveryLogs: async (req, res) => {
            const { id } = req.params;
            try {
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện.' });
                }
                const page = Math.max(1, parseInt(req.query.page, 10) || 1);
                const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
                const data = await sendGridMailEventService.listByEventId(id, { page, limit });
                return res.json({ success: true, ...data });
            } catch (error) {
                console.log(CNAME, error.message);
                return res.status(500).json({ success: false, message: error.message || 'Lỗi.' });
            }
        },

        /** Job gửi mail mới nhất của sự kiện (poll / tải trang) */
        getLatestBulkMailJob: async (req, res) => {
            const { id } = req.params;
            try {
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện.' });
                }
                const job = await mailBulkJobService.findLatestJobForEvent(id);
                return res.json({
                    success: true,
                    job: job ? eventBulkMailService.serializeBulkJobForApi(job) : null,
                });
            } catch (error) {
                console.log(CNAME, error.message);
                return res.status(500).json({ success: false, message: error.message || 'Lỗi.' });
            }
        },

        /** Xóa một người tham dự khỏi sự kiện */
        deleteParticipant: async (req, res) => {
            const { id, participantId } = req.params;
            try {
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    req.session.flash = { type: 'warning', message: 'Không tìm thấy sự kiện.' };
                    return res.redirect('/admin/event');
                }
                await groupAuthorizationHService.onParticipantDeleted(participantId, id);
                const ok = await participantCheckinHService.deleteByIdAndEvent(participantId, id);
                if (ok) {
                    await auditLogService.write({
                        actorId: req.user?._id,
                        action: 'delete',
                        resource: 'participant_checkin_h',
                        documentId: participantId,
                        summary: `Xóa người tham dự khỏi sự kiện ${id}`,
                        req,
                    });
                }
                req.session.flash = {
                    type: ok ? 'success' : 'danger',
                    message: ok ? 'Đã xóa người tham dự.' : 'Không xóa được.',
                };
                return res.redirect(stepPath(id, 1) + redirectSuffixStep1Athletes(req.body));
            } catch (error) {
                console.log(CNAME, error.message);
                req.session.flash = { type: 'danger', message: 'Lỗi xóa người tham dự.' };
                return res.redirect(stepPath(id, 1) + redirectSuffixStep1Athletes(req.body));
            }
        },
    };
};

module.exports = adminEventController;
