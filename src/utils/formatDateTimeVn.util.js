/**
 * Hiển thị Date/ISO theo giờ Việt Nam (không phụ thuộc TZ của server).
 * MongoDB lưu UTC; dùng timeZone Asia/Ho_Chi_Minh để luôn đúng giờ VN.
 */
function formatDateTimeVn(value) {
    if (value == null) return '—';
    const x = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(x.getTime())) return '—';
    return x.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
}

module.exports = { formatDateTimeVn };
