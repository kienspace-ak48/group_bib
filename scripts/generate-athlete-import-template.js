/**
 * Tạo file mẫu import: src/utils/athlete_import_example.xlsx
 * Chạy: node scripts/generate-athlete-import-template.js
 */
const path = require('path');
const xlsx = require('xlsx');

const outPath = path.join(__dirname, '..', 'src', 'utils', 'athlete_import_example.xlsx');

/** Khớp participantCheckinExcelRow.util.js — sheet đầu dùng cho import */
const headers = [
    'fullname',
    'cccd',
    'email',
    'phone',
    'dob(mm/dd/yyyy)',
    'gender',
    'zone',
    'bib',
    'bib_name',
    'distance',
    'item',
    'qr_code',
    'status',
    'checkin_method',
    'checkin_by',
    'checkin_time',
    'pickup_start',
    'pickup_end',
];

const exampleRows = [
    [
        'Nguyen Van A',
        '034085012345',
        'nguyenvana@example.com',
        '0909123456',
        '03/15/1990',
        'M',
        'Khu A',
        '1001',
        'NVA-21K',
        '21km',
        'Ao size M',
        '',
        'registered',
        'import',
        '',
        '',
        8 / 24,
        18 / 24,
    ],
    [
        'Tran Thi B',
        '079123456789',
        'tranthib@example.com',
        '0987654321',
        '12/01/1995',
        'F',
        'Khu B',
        '1002',
        'TTB-42K',
        '42km',
        'Ao size S',
        '',
        'registered',
        'import',
        '',
        '',
        '',
        '',
    ],
];

const wsData = xlsx.utils.aoa_to_sheet([headers, ...exampleRows]);
wsData['!cols'] = headers.map(() => ({ wch: 16 }));

const pickupStartCol = headers.indexOf('pickup_start');
const pickupEndCol = headers.indexOf('pickup_end');
for (let r = 1; r <= exampleRows.length; r++) {
    const row = exampleRows[r - 1];
    const vStart = row[pickupStartCol];
    const vEnd = row[pickupEndCol];
    if (typeof vStart === 'number' && pickupStartCol >= 0) {
        const addr = xlsx.utils.encode_cell({ r, c: pickupStartCol });
        wsData[addr] = { t: 'n', v: vStart, z: 'HH:mm' };
    }
    if (typeof vEnd === 'number' && pickupEndCol >= 0) {
        const addr = xlsx.utils.encode_cell({ r, c: pickupEndCol });
        wsData[addr] = { t: 'n', v: vEnd, z: 'HH:mm' };
    }
}

const guideAoA = [
    ['Ten cot', 'Bat buoc', 'Ghi chu'],
    ['fullname, cccd', 'Co', 'Ho ten day du + so giay to (CCCD/CMND).'],
    ['dob(mm/dd/yyyy) hoac dob', 'Khong', 'Ngay sinh; co the dung cot dob thay cho dob(mm/dd/yyyy).'],
    ['gender', 'Khong', 'M hoac F / Nam hoac Nu.'],
    ['status', 'Khong', 'pending | registered | checked_in | cancelled. Mac dinh khi import: registered.'],
    ['checkin_method', 'Khong', 'scan | manual | kiosk | import | app. Mac dinh: import.'],
    ['qr_code', 'Khong', 'De trong: he thong gan bang uid sau khi import.'],
    [
        'pickup_start, pickup_end',
        'Khong',
        'Chi gio 24h chuan Excel: dinh dang o Time (Ho tro: HH:mm) hoac nhap 08:00 / 18:30. He thong doc so serial 0–1 (phan cua ngay). Khong bat buoc nhap ngay.',
    ],
    ['checkin_time', 'Khong', 'Ngay gio day du: o Excel Date/DateTime hoac chuoi parse duoc.'],
    ['Cac cot khac', 'Khong', 'email, phone, zone, bib, bib_name, distance, item, checkin_by...'],
];
const wsGuide = xlsx.utils.aoa_to_sheet(guideAoA);
wsGuide['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 55 }];

const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, wsData, 'participants');
xlsx.utils.book_append_sheet(wb, wsGuide, 'huong_dan');

xlsx.writeFile(wb, outPath);
console.log('Written:', outPath);
