const crypto = require('crypto');
const mongoose = require('mongoose');
const excelDateToJSDate = require('./excelDataToJSDate.util');
const { normalizePickupTimeRange } = require('./pickupTimeRange.util');

/**
 * Map một dòng Excel → payload ParticipantCheckin_h (trừ uid — gán ở controller).
 *
 * dob: ô Date Excel hoặc chuỗi yyyy-mm-dd. checkin_time: Date/DateTime Excel hoặc chuỗi parse được.
 *
 * pickup_time_range: chuỗi tự do (vd "08:00 - 10:00").
 */
function dateMatchesYMD(d, y, m0based, day) {
    return d.getFullYear() === y && d.getMonth() === m0based && d.getDate() === day;
}

/**
 * Ngày sinh khi import: ô Date/serial Excel, hoặc chuỗi ISO yyyy-mm-dd (có thể kèm giờ).
 * Không parse dd/mm hay mm/dd trong text — tránh nhầm định dạng.
 */
function parseDobCell(dobExcel) {
    if (dobExcel == null || dobExcel === '') return null;
    if (dobExcel instanceof Date && !Number.isNaN(dobExcel.getTime())) {
        const d = new Date(dobExcel.getFullYear(), dobExcel.getMonth(), dobExcel.getDate());
        return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof dobExcel === 'number' && !Number.isNaN(dobExcel)) {
        const d = excelDateToJSDate(dobExcel);
        return d && !Number.isNaN(d.getTime()) ? d : null;
    }
    const s = String(dobExcel).trim();
    if (!s) return null;
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
    if (iso) {
        const y = parseInt(iso[1], 10);
        const mo = parseInt(iso[2], 10);
        const da = parseInt(iso[3], 10);
        const d = new Date(y, mo - 1, da);
        return dateMatchesYMD(d, y, mo - 1, da) ? d : null;
    }
    return null;
}
function firstCell(row, ...keys) {
    for (const k of keys) {
        if (row[k] != null && row[k] !== '') {
            const s = String(row[k]).trim();
            if (s) return s;
        }
    }
    return undefined;
}

function parseDobFromRow(row) {
    const keys = ['dob(yyyy-mm-dd)', 'dob', 'DOB'];
    for (const key of keys) {
        if (row[key] != null && row[key] !== '') {
            const p = parseDobCell(row[key]);
            if (p) return p;
        }
    }
    const c = parseDobCell(firstCell(row, 'Ngày sinh', 'ngay_sinh'));
    return c || null;
}
function parseOptionalDate(row, ...keys) {
    const raw = firstCell(row, ...keys);
    if (raw == null || raw === '') return undefined;
    if (typeof raw === 'number' && !Number.isNaN(raw)) {
        const d = excelDateToJSDate(raw);
        return d && !Number.isNaN(d.getTime()) ? d : undefined;
    }
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? undefined : d;
}

function parsePickupTimeRangeForRow(row) {
    const direct = firstCell(
        row,
        'pickup_time_range',
        'pickupTimeRange',
        'Pickup time',
        'pickup_hours',
        'pickup',
    );
    if (direct) {
        const n = normalizePickupTimeRange(direct);
        return n || undefined;
    }
    return undefined;
}

function convertRowCheckinH(row, eventId) {
    const dob = parseDobFromRow(row);
    const g = firstCell(row, 'gender', 'gioi_tinh', 'Giới tính') || row.gender;
    const gender =
        g === 'M' || g === 'm' || g === 1 || g === '1' || g === true || g === 'Nam'
            ? true
            : g === 'F' || g === 'f' || g === 0 || g === '0' || g === false || g === 'Nữ'
              ? false
              : undefined;

    const fullname =
        firstCell(row, 'fullname', 'ho_ten', 'Họ tên', 'name') ||
        (row.fullname != null ? String(row.fullname).trim() : '');
    const cccdRaw = firstCell(row, 'cccd', 'CCCD', 'cmnd', 'CMND') || (row.cccd != null ? String(row.cccd).trim() : '');

    const statusRaw = (firstCell(row, 'status', 'trang_thai', 'Trạng thái') || '').toLowerCase();
    const allowedStatus = ['pending', 'registered', 'checked_in', 'cancelled'];
    const status = allowedStatus.includes(statusRaw) ? statusRaw : undefined;

    const methodRaw = (firstCell(row, 'checkin_method', 'checkinMethod') || '').toLowerCase();
    const allowedMethod = ['scan', 'manual', 'kiosk', 'import', 'app'];
    const checkin_method = allowedMethod.includes(methodRaw) ? methodRaw : undefined;

    const pickup_time_range = parsePickupTimeRangeForRow(row);

    return {
        event_id: new mongoose.Types.ObjectId(String(eventId)),
        cccd: cccdRaw,
        fullname,
        email: firstCell(row, 'email', 'Email') || (row.email != null ? String(row.email).trim() : undefined),
        phone:
            firstCell(row, 'phone', 'dien_thoai', 'Phone', 'SĐT') ||
            (row.phone != null ? String(row.phone).trim() : undefined),
        dob: dob || undefined,
        gender,
        zone: firstCell(row, 'zone', 'khu_vuc', 'Khu vực', 'Zone'),
        qr_code: firstCell(row, 'qr_code', 'qrCode', 'QR', 'QR code'),
        checkin_method,
        status,
        checkin_by: firstCell(row, 'checkin_by', 'checkinBy'),
        checkin_time: parseOptionalDate(row, 'checkin_time', 'checkinTime', 'Checkin time'),
        bib: firstCell(row, 'bib', 'BIB') || (row.bib != null ? String(row.bib).trim() : undefined),
        bib_name: firstCell(row, 'bib_name', 'bibName', 'BIB name', 'Ten BIB'),
        category: firstCell(row, 'category', 'cu_ly', 'Cự ly'),
        item: firstCell(row, 'item', 'vat_pham', 'Item'),
        pickup_time_range,
    };
}

function generateUID(prefix) {
    const safe = (prefix && String(prefix).trim()) || 'ev';
    const randomPart = crypto.randomBytes(5).toString('hex');
    return `${safe}_${randomPart}`;
}

module.exports = {
    convertRowCheckinH,
    generateUID,
};
