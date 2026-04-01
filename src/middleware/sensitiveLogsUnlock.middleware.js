const crypto = require('crypto');

const UNLOCK_PATH = '/admin/system/logs/unlock';

function getSecret() {
    return (process.env.AUDIT_VIEW_SECRET || '').trim();
}

/** Thời gian “đã nhập mã” còn hiệu lực — không vượt quá thời sống cookie session (SESSION_MAX_AGE_MS trong app.js). */
function getTtlMs() {
    const m = parseInt(process.env.AUDIT_UNLOCK_TTL_MINUTES, 10);
    if (!Number.isFinite(m) || m < 1) return 30 * 60 * 1000;
    return m * 60 * 1000;
}

function isUnlocked(req) {
    const t = req.session && req.session.sensitiveLogsUnlockedAt;
    if (typeof t !== 'number' || !Number.isFinite(t)) return false;
    return Date.now() - t < getTtlMs();
}

/** Chỉ cho phép quay lại các path log trong admin. */
function safeReturnTo(raw) {
    if (raw == null || typeof raw !== 'string') return '/admin/system/logs/audit';
    const t = raw.trim();
    if (!t.startsWith('/admin/system/logs/')) return '/admin/system/logs/audit';
    if (t.includes('//') || t.includes('\\')) return '/admin/system/logs/audit';
    return t;
}

/**
 * Sau super_admin: yêu cầu đã nhập đúng mã (AUDIT_VIEW_SECRET) trong phiên (TTL).
 * Dev: nếu không set secret và NODE_ENV !== production → bỏ qua bước này.
 */
function requireSensitiveLogsUnlock(req, res, next) {
    if (process.env.NODE_ENV !== 'production' && !getSecret()) {
        return next();
    }
    if (!getSecret()) {
        if (req.session) {
            req.session.flash = {
                type: 'danger',
                message: 'Chưa cấu hình biến môi trường AUDIT_VIEW_SECRET trên server.',
            };
        }
        const ret = encodeURIComponent(req.originalUrl || '/admin/system/logs/audit');
        return res.redirect(`${UNLOCK_PATH}?returnTo=${ret}`);
    }
    if (isUnlocked(req)) return next();
    const ret = encodeURIComponent(req.originalUrl || '/admin/system/logs/audit');
    return res.redirect(`${UNLOCK_PATH}?returnTo=${ret}`);
}

/** So sánh chuỗi an toàn (hash SHA-256 cố định 32 byte). */
function codesEqual(a, b) {
    const ha = crypto.createHash('sha256').update(String(a), 'utf8').digest();
    const hb = crypto.createHash('sha256').update(String(b), 'utf8').digest();
    return crypto.timingSafeEqual(ha, hb);
}

module.exports = requireSensitiveLogsUnlock;
module.exports.getSecret = getSecret;
module.exports.getTtlMs = getTtlMs;
module.exports.isUnlocked = isUnlocked;
module.exports.safeReturnTo = safeReturnTo;
module.exports.codesEqual = codesEqual;
module.exports.UNLOCK_PATH = UNLOCK_PATH;
