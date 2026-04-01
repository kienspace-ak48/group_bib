/**
 * IP client thật khi app đứng sau nginx / reverse proxy.
 * Ưu tiên phần tử đầu của `X-Forwarded-For` (client gốc), không dùng `req.ip` trước
 * (vì khi chưa `trust proxy`, `req.ip` thường là 127.0.0.1).
 *
 * @param {import('express').Request | undefined | null} req
 * @returns {string}
 */
function getClientIp(req) {
    if (!req) return '';
    const xf = req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For'];
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
