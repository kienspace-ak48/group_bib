/**
 * IP client thật khi app đứng sau Cloudflare / nginx / reverse proxy.
 * 1) Cloudflare: `CF-Connecting-IP` (IP visitor — ưu tiên khi có).
 * 2) `X-Forwarded-For`: phần tử đầu thường là client gốc qua chuỗi proxy.
 * 3) `req.ip` (cần `trust proxy` đúng hop).
 * 4) Socket (thường là IP proxy nếu không có header).
 *
 * @param {import('express').Request | undefined | null} req
 * @returns {string}
 */
function getClientIp(req) {
    if (!req) return '';
    const h = req.headers || {};
    const cf = h['cf-connecting-ip'] || h['CF-Connecting-IP'];
    if (cf) {
        const ip = String(typeof cf === 'string' ? cf.split(',')[0].trim() : cf).trim();
        if (ip) return stripV4Mapped(ip);
    }
    const xf = h['x-forwarded-for'] || h['X-Forwarded-For'];
    if (xf) {
        const first = typeof xf === 'string' ? xf.split(',')[0] : xf[0];
        const ip = String(first != null ? first : '').trim();
        if (ip) return stripV4Mapped(ip);
    }
    if (req.ip) return stripV4Mapped(String(req.ip));
    const sock = req.socket && req.socket.remoteAddress;
    const legacy = req.connection && req.connection.remoteAddress;
    const raw = sock || legacy || '';
    return raw ? stripV4Mapped(String(raw)) : '';
}

function stripV4Mapped(ip) {
    return ip.replace(/^::ffff:/i, '');
}

module.exports = { getClientIp };
