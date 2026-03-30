const CNAME = 'event.controller.js ';
const VLAYOUT = 'layouts/adminLayout2';
const VNAME = 'admin/event';

const path = require('path');
const fs = require('fs');
const myPathConfig = require('../../../config/mypath.config');
const ATHLETE_IMPORT_TEMPLATE = path.join(myPathConfig.root, 'src/utils/athlete_import_example.xlsx');

const xlsx = require('xlsx');
const eventCheckinHService = require('../services/eventCheckinH.service');
const participantCheckinHService = require('../services/participantCheckinH.service');
const auditLogService = require('../services/auditLog.service');
const { convertRowCheckinH, generateUID } = require('../../../utils/participantCheckinExcelRow.util');

const BATCH_SIZE = 1000;
const PARTICIPANT_LIST_LIMIT = 10000;

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

        /** Xóa sự kiện + toàn bộ VĐV */
        destroy: async (req, res) => {
            try {
                const { id } = req.params;
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    req.session.flash = { type: 'warning', message: 'Không tìm thấy sự kiện.' };
                    return res.redirect('/admin/event');
                }
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
                    message: ok ? 'Đã xóa sự kiện và danh sách VĐV.' : 'Không xóa được sự kiện.',
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
                if (n === 1) {
                    participants = await participantCheckinHService.findByEventId(event._id, {
                        limit: PARTICIPANT_LIST_LIMIT,
                    });
                }

                const flash = req.session.flash;
                delete req.session.flash;

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
                    await participantCheckinHService.deleteByEventId(event._id);
                }

                const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const excelData = xlsx.utils.sheet_to_json(worksheet, { defval: null, raw: false });

                if (!excelData.length) {
                    req.session.flash = { type: 'danger', message: 'File Excel không có dòng dữ liệu.' };
                    return res.redirect(stepPath(id, 1));
                }

                const prefix = uidPrefixFromEvent(event);
                const runners = [];
                let skipped = 0;
                for (let i = 0; i < excelData.length; i++) {
                    const row = excelData[i];
                    const base = convertRowCheckinH(row, event._id);
                    if (!base.fullname || !base.cccd) {
                        skipped++;
                        continue;
                    }
                    runners.push({
                        ...base,
                        uid: generateUID(prefix),
                    });
                }

                if (!runners.length) {
                    req.session.flash = {
                        type: 'danger',
                        message: 'Không có dòng hợp lệ (cần ít nhất họ tên + CCCD).',
                    };
                    return res.redirect(stepPath(id, 1));
                }

                let totalInserted = 0;
                for (let i = 0; i < runners.length; i += BATCH_SIZE) {
                    const batch = runners.slice(i, i + BATCH_SIZE);
                    const { inserted } = await participantCheckinHService.insertMany(batch);
                    totalInserted += inserted;
                }

                const parts = [
                    mode === 'reset' ? 'Đã xóa danh cũ và import' : 'Đã import thêm',
                    `${totalInserted}/${runners.length} bản ghi.`,
                ];
                if (skipped) parts.push(`Bỏ qua ${skipped} dòng thiếu họ tên/CCCD.`);
                await auditLogService.write({
                    actorId: req.user?._id,
                    action: mode === 'reset' ? 'update' : 'create',
                    resource: 'participant_checkin_h',
                    documentId: id,
                    summary: `Import VĐV sự kiện ${id}: ${parts.join(' ')}`,
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

        /** Thêm VĐV thủ công */
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
                    return res.redirect(stepPath(id, 1));
                }

                const dup = await participantCheckinHService.findOneByEventCccd(event._id, cccd);
                if (dup) {
                    req.session.flash = { type: 'warning', message: 'CCCD này đã tồn tại trong sự kiện.' };
                    return res.redirect(stepPath(id, 1));
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

                const nat = (body.nationality || '').trim();
                const str = (k) => ((body[k] || '') + '').trim() || undefined;
                const payload = {
                    uid: generateUID(uidPrefixFromEvent(event)),
                    event_id: event._id,
                    fullname,
                    cccd,
                    bib: str('bib'),
                    distance: str('distance'),
                    distance_name: str('distance_name'),
                    tshirt_size: str('tshirt_size'),
                    bib_name: str('bib_name'),
                    email: str('email'),
                    phone: str('phone'),
                    dob,
                    line: str('line'),
                    gender,
                    nationality: nat || undefined,
                    nationlity: nat || undefined,
                    nation: str('nation'),
                    city: str('city'),
                    patron_name: str('patron_name'),
                    patron_phone: str('patron_phone'),
                    team: str('team'),
                    blood: str('blood'),
                    medical: str('medical'),
                    medicine: str('medicine'),
                    chip_id: str('chip_id'),
                    mail_status: str('mail_status'),
                    group_checkin_status: str('group_checkin_status'),
                    authorization_status: str('authorization_status'),
                    waiver_status: str('waiver_status'),
                    order_item_id: str('order_item_id'),
                    order_id: str('order_id'),
                };

                const created = await participantCheckinHService.createOne(payload);
                req.session.flash = {
                    type: created ? 'success' : 'danger',
                    message: created ? 'Đã thêm VĐV.' : 'Không thêm được (kiểm tra dữ liệu).',
                };
                return res.redirect(stepPath(id, 1));
            } catch (error) {
                console.log(CNAME, error.message);
                req.session.flash = { type: 'danger', message: 'Lỗi: ' + error.message };
                return res.redirect(stepPath(id, 1));
            }
        },

        /** Tải file Excel mẫu import VĐV */
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

        /** Xóa một VĐV khỏi sự kiện */
        deleteParticipant: async (req, res) => {
            const { id, participantId } = req.params;
            try {
                const event = await eventCheckinHService.getById(id);
                if (!event) {
                    req.session.flash = { type: 'warning', message: 'Không tìm thấy sự kiện.' };
                    return res.redirect('/admin/event');
                }
                const ok = await participantCheckinHService.deleteByIdAndEvent(participantId, id);
                if (ok) {
                    await auditLogService.write({
                        actorId: req.user?._id,
                        action: 'delete',
                        resource: 'participant_checkin_h',
                        documentId: participantId,
                        summary: `Xóa VĐV khỏi sự kiện ${id}`,
                        req,
                    });
                }
                req.session.flash = {
                    type: ok ? 'success' : 'danger',
                    message: ok ? 'Đã xóa VĐV.' : 'Không xóa được.',
                };
                return res.redirect(stepPath(id, 1));
            } catch (error) {
                console.log(CNAME, error.message);
                req.session.flash = { type: 'danger', message: 'Lỗi xóa VĐV.' };
                return res.redirect(stepPath(id, 1));
            }
        },
    };
};

module.exports = adminEventController;
