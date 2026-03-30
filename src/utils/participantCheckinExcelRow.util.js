const crypto = require('crypto');
const mongoose = require('mongoose');
const excelDateToJSDate = require('./excelDataToJSDate.util');

/**
 * Map một dòng Excel (cùng convention cột với RunnerCheckinImport cũ) → payload ParticipantCheckin_h.
 * Cột ngày sinh: dob(mm/dd/yyyy)
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

/** Lấy giá trị ô theo nhiều tên cột có thể có trong file mẫu / tiếng Việt */
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

function convertRowCheckinH(row, eventId) {
    const dob = parseDobFromRow(row);
    const g = firstCell(row, 'gender', 'gioi_tinh', 'Giới tính') || row.gender;
    const gender =
        g === 'M' || g === 'm' || g === 1 || g === '1' || g === true || g === 'Nam'
            ? true
            : g === 'F' || g === 'f' || g === 0 || g === '0' || g === false || g === 'Nữ'
              ? false
              : undefined;

    const nat = row.nationality != null ? String(row.nationality).trim() : '';
    const fullname =
        firstCell(row, 'fullname', 'ho_ten', 'Họ tên', 'name') ||
        (row.fullname != null ? String(row.fullname).trim() : '');
    const cccdRaw = firstCell(row, 'cccd', 'CCCD', 'cmnd', 'CMND') || (row.cccd != null ? String(row.cccd).trim() : '');

    return {
        event_id: new mongoose.Types.ObjectId(String(eventId)),
        cccd: cccdRaw,
        bib: firstCell(row, 'bib', 'BIB') || (row.bib != null ? String(row.bib).trim() : undefined),
        fullname,
        distance:
            firstCell(row, 'distance', 'cu_ly', 'Cự ly') ||
            (row.distance != null ? String(row.distance).trim() : undefined),
        distance_name: firstCell(row, 'distance_name', 'ten_cu_ly'),
        tshirt_size:
            firstCell(row, 'tshirt_size', 'size_ao', 'Size áo', 'size') ||
            (row.tshirt_size != null ? String(row.tshirt_size).trim() : undefined),
        bib_name: firstCell(row, 'bib_name') || (row.bib_name != null ? String(row.bib_name).trim() : undefined),
        email: firstCell(row, 'email', 'Email') || (row.email != null ? String(row.email).trim() : undefined),
        phone:
            firstCell(row, 'phone', 'dien_thoai', 'Phone', 'SĐT') ||
            (row.phone != null ? String(row.phone).trim() : undefined),
        dob: dob || undefined,
        line: firstCell(row, 'line', 'Line') || (row.line != null ? String(row.line).trim() : undefined),
        gender,
        nationality: nat || undefined,
        nationlity: nat || undefined,
        nation: firstCell(row, 'nation') || (row.nation != null ? String(row.nation).trim() : undefined),
        city: firstCell(row, 'city', 'thanh_pho') || (row.city != null ? String(row.city).trim() : undefined),
        patron_name: firstCell(row, 'patron_name') || (row.patron_name != null ? String(row.patron_name).trim() : undefined),
        patron_phone: firstCell(row, 'patron_phone') || (row.patron_phone != null ? String(row.patron_phone).trim() : undefined),
        team: firstCell(row, 'team') || (row.team != null ? String(row.team).trim() : undefined),
        blood: firstCell(row, 'blood') || (row.blood != null ? String(row.blood).trim() : undefined),
        medical: firstCell(row, 'medical') || (row.medical != null ? String(row.medical).trim() : undefined),
        medicine: firstCell(row, 'medicine') || (row.medicine != null ? String(row.medicine).trim() : undefined),
        chip_id: firstCell(row, 'chip_id', 'ChipId', 'chipId', 'CHIP'),
        mail_status: firstCell(row, 'mail_status', 'Mail_status', 'Mail Status'),
        group_checkin_status: firstCell(row, 'group_checkin_status', 'checkin_nhom', 'Checkin theo nhóm'),
        authorization_status: firstCell(row, 'authorization_status', 'uy_quyen', 'Ủy quyền'),
        waiver_status: firstCell(row, 'waiver_status', 'waiver', 'Waiver'),
        order_id: firstCell(row, 'order_id', 'orderId'),
        order_item_id: firstCell(row, 'order_item_id', 'orderItemId'),
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
