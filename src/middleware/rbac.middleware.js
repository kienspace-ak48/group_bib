const { ADMIN_LOGIN_URL } = require('../config/auth.config');

/** Không redirect về `/admin` khi thiếu quyền — sẽ gây ERR_TOO_MANY_REDIRECTS (cùng route). */
function redirectForbidden(req, res, message) {
    if (req.session) {
        req.session.flash = { type: 'danger', message: message || 'Không có quyền truy cập khu vực này.' };
    }
    return res.redirect('/');
}

/** Khớp quyền dạng admin.event hoặc admin.* */
function permissionMatches(granted, required) {
    if (!granted || !required) return false;
    if (granted === required) return true;
    if (granted === '*' || granted === 'admin.*') return required.startsWith('admin.');
    if (granted.endsWith('.*')) {
        const prefix = granted.slice(0, -1);
        return required.startsWith(prefix);
    }
    return false;
}

function userHasPermission(user, required) {
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    if (user.role !== 'admin') return false;
    let perms = user.permissions || [];
    if (!perms.length) {
        perms = ['admin.event', 'admin.dashboard'];
    }
    return perms.some((g) => permissionMatches(g, required));
}

/**
 * Chặn account_checkin khỏi toàn bộ admin web (luồng check-in build sau).
 */
function requireAdminWeb(req, res, next) {
    if (!req.user) {
        return res.redirect(ADMIN_LOGIN_URL);
    }
    if (req.user.role === 'account_checkin') {
        if (req.session) {
            req.session.flash = {
                type: 'warning',
                message: 'Tài khoản check-in không dùng trang quản trị này.',
            };
        }
        return res.redirect('/');
    }
    next();
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) return res.redirect(ADMIN_LOGIN_URL);
        if (!roles.includes(req.user.role)) {
            return redirectForbidden(req, res, 'Không đủ quyền.');
        }
        next();
    };
}

function requirePermission(required) {
    return (req, res, next) => {
        if (!req.user) return res.redirect(ADMIN_LOGIN_URL);
        if (userHasPermission(req.user, required)) return next();
        return redirectForbidden(req, res, 'Không có quyền thao tác (cần quyền admin phù hợp).');
    };
}

module.exports = {
    requireAdminWeb,
    requireRole,
    requirePermission,
    userHasPermission,
};
