/** Chuỗi khung giờ nhận (vd "08:00 - 10:00") — thay cho pickup_start / pickup_end. */
const MAX_LEN = 120;

function normalizePickupTimeRange(s) {
    if (s == null) return '';
    return String(s).trim().slice(0, MAX_LEN);
}

/**
 * Hiển thị mail: ưu tiên `pickup_time_range`. Tham số start/end chỉ dùng cho dữ liệu rất cũ (controller legacy).
 * @param {string|undefined} range
 * @param {Date|undefined} [start]
 * @param {Date|undefined} [end]
 */
function resolvePickupRangeDisplay(range, start, end) {
    const t = normalizePickupTimeRange(range);
    if (t) return t;
    if (start != null || end != null) return buildPickupRangeFromLegacyDates(start, end);
    return '';
}

function formatTime24hVi(d) {
    if (!d) return '—';
    const x = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(x.getTime())) return '—';
    return x.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

function buildPickupRangeFromLegacyDates(start, end) {
    const a = start ? formatTime24hVi(start) : '—';
    const b = end ? formatTime24hVi(end) : '—';
    if (a === '—' && b === '—') return '';
    return `${a} - ${b}`;
}

module.exports = {
    MAX_PICKUP_TIME_RANGE_LEN: MAX_LEN,
    normalizePickupTimeRange,
    resolvePickupRangeDisplay,
    buildPickupRangeFromLegacyDates,
};
