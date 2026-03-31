const CNAME = 'systemAccount.controller.js ';
const VLAYOUT = 'layouts/adminLayout2';
const VNAME = 'admin/system';
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const AccountSystem = require('../../../model/account_system.model');
const EventCheckin = require('../../../model/EventCheckin_h');
const ROLES = AccountSystem.ROLES;

async function loadEventsForAccountForm() {
    return EventCheckin.find({})
        .select('name start_date end_date')
        .sort({ updatedAt: -1 })
        .limit(500)
        .lean();
}

function parseCheckinEventId(body) {
    const raw = (body.checkin_event_id || '').trim();
    if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return null;
    return new mongoose.Types.ObjectId(raw);
}
const loginHistoryService = require('../services/loginHistory.service');
const auditLogService = require('../services/auditLog.service');

const PAGE_SIZE = 30;

const systemAccountController = () => {
    return {
        listAccounts: async (req, res) => {
            try {
                const page = Math.max(1, parseInt(req.query.page, 10) || 1);
                const skip = (page - 1) * PAGE_SIZE;
                const [accounts, total] = await Promise.all([
                    AccountSystem.find({})
                        .select('-password')
                        .sort({ updatedAt: -1 })
                        .skip(skip)
                        .limit(PAGE_SIZE)
                        .lean(),
                    AccountSystem.countDocuments({}),
                ]);
                const flash = req.session.flash;
                delete req.session.flash;
                return res.render(VNAME + '/accounts', {
                    layout: VLAYOUT,
                    accounts,
                    page,
                    total,
                    pages: Math.ceil(total / PAGE_SIZE) || 1,
                    roles: ROLES,
                    flash: flash || null,
                });
            } catch (e) {
                console.log(CNAME, e.message);
                return res.redirect('/admin');
            }
        },

        newAccountForm: async (req, res) => {
            try {
                const flash = req.session.flash;
                delete req.session.flash;
                const events = await loadEventsForAccountForm();
                return res.render(VNAME + '/account_form', {
                    layout: VLAYOUT,
                    roles: ROLES,
                    account: null,
                    events,
                    flash: flash || null,
                });
            } catch (e) {
                console.log(CNAME, e.message);
                return res.redirect('/admin/system/accounts');
            }
        },

        createAccount: async (req, res) => {
            try {
                const body = req.body;
                const email = (body.email || '').trim();
                const password = body.password || '';
                const name = (body.name || '').trim();
                if (!email || !password || !name) {
                    req.session.flash = { type: 'danger', message: 'Email, mật khẩu và tên là bắt buộc.' };
                    return res.redirect('/admin/system/accounts/new');
                }
                const exists = await AccountSystem.findOne({ email });
                if (exists) {
                    req.session.flash = { type: 'danger', message: 'Email đã tồn tại.' };
                    return res.redirect('/admin/system/accounts/new');
                }
                const role = ROLES.includes(body.role) ? body.role : 'admin';
                let permissions = [];
                if (typeof body.permissions === 'string' && body.permissions.trim()) {
                    permissions = body.permissions
                        .split(/[\n,]/)
                        .map((s) => s.trim())
                        .filter(Boolean);
                }
                if (role === 'admin' && !permissions.length) {
                    permissions = ['admin.event', 'admin.dashboard'];
                }
                let checkin_event_id = null;
                if (role === 'account_checkin') {
                    checkin_event_id = parseCheckinEventId(body);
                    if (!checkin_event_id) {
                        req.session.flash = { type: 'danger', message: 'Tài khoản check-in phải chọn sự kiện.' };
                        return res.redirect('/admin/system/accounts/new');
                    }
                    const ev = await EventCheckin.findById(checkin_event_id).select('_id').lean();
                    if (!ev) {
                        req.session.flash = { type: 'danger', message: 'Sự kiện không tồn tại.' };
                        return res.redirect('/admin/system/accounts/new');
                    }
                }
                const hash = await bcrypt.hash(password, 12);
                const doc = await AccountSystem.create({
                    email,
                    name,
                    username: (body.username || '').trim() || email.split('@')[0],
                    password: hash,
                    status: body.status === 'on' || body.status === 'true',
                    role,
                    permissions,
                    checkin_event_id,
                });
                await auditLogService.write({
                    actorId: req.user?._id,
                    action: 'create',
                    resource: 'account_system',
                    documentId: doc._id,
                    summary: `Tạo tài khoản ${email}`,
                    req,
                });
                req.session.flash = { type: 'success', message: 'Đã tạo tài khoản.' };
                return res.redirect('/admin/system/accounts');
            } catch (e) {
                console.log(CNAME, e.message);
                req.session.flash = { type: 'danger', message: 'Lỗi tạo tài khoản.' };
                return res.redirect('/admin/system/accounts/new');
            }
        },

        editAccountForm: async (req, res) => {
            try {
                const { id } = req.params;
                if (!mongoose.Types.ObjectId.isValid(id)) {
                    req.session.flash = { type: 'danger', message: 'ID không hợp lệ.' };
                    return res.redirect('/admin/system/accounts');
                }
                const account = await AccountSystem.findById(id).select('-password').lean();
                if (!account) {
                    req.session.flash = { type: 'warning', message: 'Không tìm thấy tài khoản.' };
                    return res.redirect('/admin/system/accounts');
                }
                const events = await loadEventsForAccountForm();
                const flash = req.session.flash;
                delete req.session.flash;
                return res.render(VNAME + '/account_form', {
                    layout: VLAYOUT,
                    roles: ROLES,
                    account,
                    events,
                    flash: flash || null,
                });
            } catch (e) {
                console.log(CNAME, e.message);
                return res.redirect('/admin/system/accounts');
            }
        },

        updateAccount: async (req, res) => {
            try {
                const { id } = req.params;
                if (!mongoose.Types.ObjectId.isValid(id)) {
                    req.session.flash = { type: 'danger', message: 'ID không hợp lệ.' };
                    return res.redirect('/admin/system/accounts');
                }
                const existing = await AccountSystem.findById(id);
                if (!existing) {
                    req.session.flash = { type: 'warning', message: 'Không tìm thấy tài khoản.' };
                    return res.redirect('/admin/system/accounts');
                }
                const body = req.body;
                const email = (body.email || '').trim();
                const name = (body.name || '').trim();
                if (!email || !name) {
                    req.session.flash = { type: 'danger', message: 'Email và tên là bắt buộc.' };
                    return res.redirect('/admin/system/accounts/' + id + '/edit');
                }
                const other = await AccountSystem.findOne({ email, _id: { $ne: id } });
                if (other) {
                    req.session.flash = { type: 'danger', message: 'Email đã được dùng bởi tài khoản khác.' };
                    return res.redirect('/admin/system/accounts/' + id + '/edit');
                }
                const role = ROLES.includes(body.role) ? body.role : existing.role;
                let permissions = [];
                if (typeof body.permissions === 'string' && body.permissions.trim()) {
                    permissions = body.permissions
                        .split(/[\n,]/)
                        .map((s) => s.trim())
                        .filter(Boolean);
                }
                if (role === 'admin' && !permissions.length) {
                    permissions = ['admin.event', 'admin.dashboard'];
                }
                let checkin_event_id = null;
                if (role === 'account_checkin') {
                    checkin_event_id = parseCheckinEventId(body);
                    if (!checkin_event_id) {
                        req.session.flash = { type: 'danger', message: 'Tài khoản check-in phải chọn sự kiện.' };
                        return res.redirect('/admin/system/accounts/' + id + '/edit');
                    }
                    const ev = await EventCheckin.findById(checkin_event_id).select('_id').lean();
                    if (!ev) {
                        req.session.flash = { type: 'danger', message: 'Sự kiện không tồn tại.' };
                        return res.redirect('/admin/system/accounts/' + id + '/edit');
                    }
                }
                const permsBefore = JSON.stringify((existing.permissions || []).slice().sort());
                const permsAfter = JSON.stringify(permissions.slice().sort());
                const checkinBefore = existing.checkin_event_id ? String(existing.checkin_event_id) : '';
                const checkinAfter = role === 'account_checkin' && checkin_event_id ? String(checkin_event_id) : '';
                const authChanged =
                    existing.role !== role || permsBefore !== permsAfter || checkinBefore !== checkinAfter;

                existing.email = email;
                existing.name = name;
                existing.username = (body.username || '').trim() || email.split('@')[0];
                existing.status = body.status === 'on' || body.status === 'true';
                existing.role = role;
                existing.permissions = permissions;
                existing.checkin_event_id = role === 'account_checkin' ? checkin_event_id : null;
                const pwd = (body.password || '').trim();
                if (pwd) {
                    existing.password = await bcrypt.hash(pwd, 12);
                    existing.token_version = (existing.token_version || 0) + 1;
                } else if (authChanged) {
                    existing.token_version = (existing.token_version || 0) + 1;
                }
                await existing.save();
                await auditLogService.write({
                    actorId: req.user?._id,
                    action: 'update',
                    resource: 'account_system',
                    documentId: existing._id,
                    summary: `Cập nhật tài khoản ${email}`,
                    req,
                });
                req.session.flash = { type: 'success', message: 'Đã lưu tài khoản.' };
                return res.redirect('/admin/system/accounts');
            } catch (e) {
                console.log(CNAME, e.message);
                req.session.flash = { type: 'danger', message: 'Lỗi cập nhật.' };
                return res.redirect('/admin/system/accounts/' + req.params.id + '/edit');
            }
        },

        deleteAccount: async (req, res) => {
            try {
                const { id } = req.params;
                if (!mongoose.Types.ObjectId.isValid(id)) {
                    req.session.flash = { type: 'danger', message: 'ID không hợp lệ.' };
                    return res.redirect('/admin/system/accounts');
                }
                if (String(req.user._id) === id) {
                    req.session.flash = { type: 'danger', message: 'Không thể xóa chính mình.' };
                    return res.redirect('/admin/system/accounts');
                }
                const acc = await AccountSystem.findById(id).lean();
                if (!acc) {
                    req.session.flash = { type: 'warning', message: 'Không tìm thấy tài khoản.' };
                    return res.redirect('/admin/system/accounts');
                }
                await AccountSystem.deleteOne({ _id: id });
                await auditLogService.write({
                    actorId: req.user?._id,
                    action: 'delete',
                    resource: 'account_system',
                    documentId: id,
                    summary: `Xóa tài khoản ${acc.email}`,
                    req,
                });
                req.session.flash = { type: 'success', message: 'Đã xóa tài khoản.' };
                return res.redirect('/admin/system/accounts');
            } catch (e) {
                console.log(CNAME, e.message);
                req.session.flash = { type: 'danger', message: 'Lỗi xóa.' };
                return res.redirect('/admin/system/accounts');
            }
        },

        loginLogs: async (req, res) => {
            try {
                const page = Math.max(1, parseInt(req.query.page, 10) || 1);
                const { items, total, pages } = await loginHistoryService.list({ page, limit: PAGE_SIZE });
                return res.render(VNAME + '/logs_login', {
                    layout: VLAYOUT,
                    items,
                    page,
                    total,
                    pages,
                });
            } catch (e) {
                console.log(CNAME, e.message);
                return res.redirect('/admin');
            }
        },

        auditLogs: async (req, res) => {
            try {
                const page = Math.max(1, parseInt(req.query.page, 10) || 1);
                const { items, total, pages } = await auditLogService.list({ page, limit: PAGE_SIZE });
                return res.render(VNAME + '/logs_audit', {
                    layout: VLAYOUT,
                    items,
                    page,
                    total,
                    pages,
                });
            } catch (e) {
                console.log(CNAME, e.message);
                return res.redirect('/admin');
            }
        },
    };
};

module.exports = systemAccountController;
