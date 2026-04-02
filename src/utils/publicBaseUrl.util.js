/**
 * URL gốc công khai (không có `/` cuối). Chỉ đọc từ `.env`: `PUBLIC_BASE_URL`
 * (vd `http://localhost:8080`, `https://localhost:8443`, `https://ten-mien.com`).
 */
function getPublicBaseUrl() {
    return (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
}

module.exports = { getPublicBaseUrl };
