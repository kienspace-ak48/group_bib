const crypto = require('crypto');
const mongoose = require('mongoose');
const excelDateToJSDate = require('./excelDataToJSDate.util');

/**
 * Map một dòng Excel → payload ParticipantCheckin_h (trừ uid — gán ở controller).
 *
 * Ngày (dob, checkin_time): ô Date/DateTime Excel (serial ≥ 1 hoặc có ngày) hoặc chuỗi parse được.
 *
 * pickup_start / pickup_end — **chỉ giờ (24h) chuẩn Excel**:
 * - Ô định dạng **Time** → số serial trong [0, 1) = phần của 24 giờ (vd 08:00 ≈ 0,333…).
 * - Hoặc chuỗi `HH:mm` / `HH:mm:ss` (24h).
 * - Serial ≥ 1: vẫn hỗ trợ ngày giờ đầy đủ (Date/DateTime) như cũ.
 */
function parseDobCell(dobExcel) {
    if (dobExcel == null || dobExcel === '') return null;
    if (typeof dobExcel === 'number' && !Number.isNaN(dobExcel)) {
        const d = excelDateToJSDate(dobExcel);
        return d && !Number.isNaN(d.getTime()) ? d : null;
    }
    const d = new Date(dobExcel);
    return Number.isNaN(d.getTime()) ? null : d;
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
    const a = parseDobCell(row['dob(mm/dd/yyyy)']);
    if (a) return a;
    const b = parseDobCell(row.dob);
    if (b) return b;
    const c = parseDobCell(firstCell(row, 'Ngày sinh', 'ngay_sinh', 'DOB'));
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

/** Giá trị ô gốc (không ép String) — cần để đọc số serial Time trong Excel */
function firstRawCell(row, ...keys) {
    for (const k of keys) {
        if (row[k] != null && row[k] !== '') return row[k];
    }
    return undefined;
}

/** Serial [0,1) = phần của ngày 24h → Date cố định 2000-01-01 (giờ local) để lưu và hiển thị giờ */
function fractionOfDayToLocalDateTime(serial) {
    const ms = serial * 86400000;
    const totalSec = Math.round(ms / 1000);
    const h = Math.floor(totalSec / 3600) % 24;
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return new Date(2000, 0, 1, h, m, s);
}

/**
 * pickup_start / pickup_end: ưu tiên Time Excel (serial 0–1) hoặc chuỗi HH:mm(:ss).
 */
function parsePickupTimeCell(row, ...keys) {
    const raw = firstRawCell(row, ...keys);
    if (raw == null || raw === '') return undefined;

    if (typeof raw === 'number' && !Number.isNaN(raw)) {
        if (raw >= 0 && raw < 1) return fractionOfDayToLocalDateTime(raw);
        if (raw >= 1) {
            const d = excelDateToJSDate(raw);
            return d && !Number.isNaN(d.getTime()) ? d : undefined;
        }
        return undefined;
    }

    const str = String(raw).trim();
    const num = Number(str);
    if (str !== '' && !Number.isNaN(num) && /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(str)) {
        if (num >= 0 && num < 1) return fractionOfDayToLocalDateTime(num);
        if (num >= 1) {
            const d = excelDateToJSDate(num);
            return d && !Number.isNaN(d.getTime()) ? d : undefined;
        }
        return undefined;
    }

    const m = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
        let hh = parseInt(m[1], 10);
        const mm = parseInt(m[2], 10);
        const ss = m[3] ? parseInt(m[3], 10) : 0;
        if (mm < 0 || mm > 59 || ss < 0 || ss > 59) return undefined;
        if (hh === 24) {
            if (mm !== 0 || ss !== 0) return undefined;
            hh = 0;
        } else if (hh < 0 || hh > 23) return undefined;
        return new Date(2000, 0, 1, hh, mm, ss);
    }

    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? undefined : d;
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

    const pickup_start = parsePickupTimeCell(row, 'pickup_start', 'pickupStart', 'Pickup start');
    const pickup_end = parsePickupTimeCell(row, 'pickup_end', 'pickupEnd', 'Pickup end');

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
        distance: firstCell(row, 'distance', 'cu_ly', 'Cự ly'),
        item: firstCell(row, 'item', 'vat_pham', 'Item'),
        pickup_start,
        pickup_end,
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
