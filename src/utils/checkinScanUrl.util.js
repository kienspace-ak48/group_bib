const { getPublicBaseUrl } = require('./publicBaseUrl.util');

/**
 * URL tuyệt đối cho QR thống nhất: GET /tool-checkin/scan/:token (sau đăng nhập TNV).
 * @param {string} scanToken — token nhóm (group_authorization_h.token) hoặc qr_scan_token VĐV
 */
function buildCheckinScanAbsoluteUrl(scanToken) {
    const t = String(scanToken || '').trim();
    if (!t) return '';
    const base = getPublicBaseUrl().replace(/\/$/, '');
    if (!base) return '';
    return `${base}/tool-checkin/scan/${encodeURIComponent(t)}`;
}

module.exports = { buildCheckinScanAbsoluteUrl };
