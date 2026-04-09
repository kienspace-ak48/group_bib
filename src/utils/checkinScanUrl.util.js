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

/**
 * Trang công khai (không đăng nhập) để VĐV mở từ email và xem lại mã QR — `qr_scan_token`, route độc lập `/qr/:token`.
 */
function buildPublicAthleteQrPageUrl(scanToken) {
    const t = String(scanToken || '').trim();
    if (!t) return '';
    const base = getPublicBaseUrl().replace(/\/$/, '');
    if (!base) return '';
    return `${base}/qr/${encodeURIComponent(t)}`;
}

/**
 * Nội dung nhúng trong ảnh QR (email / in): chỉ token, không phải URL — tránh lộ path `/tool-checkin/scan/...`.
 * TNV quét trong app → ghép `/tool-checkin/scan/:token` (xem `routeScanDecoded` ở checkin.ejs).
 */
function getQrPlaintextPayloadForEmbedding(scanToken) {
    return String(scanToken || '').trim();
}

/** Lấy token từ URL dạng `.../tool-checkin/scan/:token` (dùng khi mail nhóm vẫn truyền href đầy đủ). */
function extractScanTokenFromAbsoluteScanUrl(url) {
    const s = String(url || '').trim();
    const m = s.match(/\/tool-checkin\/scan\/([^/?#]+)/i);
    if (!m || !m[1]) return '';
    try {
        return decodeURIComponent(m[1]);
    } catch (e) {
        return m[1];
    }
}

module.exports = {
    buildCheckinScanAbsoluteUrl,
    buildPublicAthleteQrPageUrl,
    getQrPlaintextPayloadForEmbedding,
    extractScanTokenFromAbsoluteScanUrl,
};
