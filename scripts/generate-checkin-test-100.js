/**
 * Tạo file Excel ~100 dòng để test import / check-in.
 * Chạy: node scripts/generate-checkin-test-100.js
 * Output: scripts/fixtures/checkin-test-100.xlsx
 */
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const outDir = path.join(__dirname, 'fixtures');
const outPath = path.join(outDir, 'checkin-test-100.xlsx');

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

const distances = ['5km', '10km', '21km', '42km', 'Fun run'];
const zones = ['Khu A', 'Khu B', 'Khu VIP'];

const rows = [];
for (let i = 1; i <= 100; i++) {
    const pad = String(i).padStart(3, '0');
    const gender = i % 2 === 1 ? 'M' : 'F';
    const month = 1 + ((i * 3) % 12);
    const day = 1 + ((i * 7) % 28);
    const year = 1988 + (i % 15);
    const dob = `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
    /** 12 chữ số, duy nhất theo STT */
    const cccd = `10${String(i).padStart(10, '0')}`;
    rows.push([
        `Test Runner ${pad}`,
        cccd,
        `test.runner.${pad}@example.test`,
        `09${String(1000000 + i).slice(-8)}`,
        dob,
        gender,
        zones[i % zones.length],
        String(2000 + i),
        `BIB-${pad}`,
        distances[i % distances.length],
        i % 3 === 0 ? 'Áo M' : 'Áo L',
        '',
        'registered',
        'import',
        '',
        '',
        '',
        '',
    ]);
}

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

const wsData = xlsx.utils.aoa_to_sheet([headers, ...rows]);
wsData['!cols'] = headers.map(() => ({ wch: 14 }));

const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, wsData, 'participants');

const note = [
    ['Ghi chú'],
    ['100 dòng mẫu: BIB 2001–2100, CCCD 12 số, status=registered.'],
    ['Import ở bước 2 sự kiện (append hoặc reset tùy nhu cầu).'],
    ['Test check-in qua /tool-checkin sau khi import.'],
];
const wsNote = xlsx.utils.aoa_to_sheet(note);
wsNote['!cols'] = [{ wch: 70 }];
xlsx.utils.book_append_sheet(wb, wsNote, 'ghi_chu');

xlsx.writeFile(wb, outPath);
console.log('Written:', outPath);
