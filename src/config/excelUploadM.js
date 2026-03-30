const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedMimes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
    ];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        console.log('file upload ko nam trong 2 loai .xlsx .xls');
        cb(new Error('Chi cho phep upload file Excel'), false);
    }
};
// limit (2MB — test / nhỏ)
const limits = { fileSize: 2 * 1024 * 1024 };
const excelUpload = multer({ storage, fileFilter, limits });

/** Import danh sách VĐV (file lớn hơn) */
const limitsLarge = { fileSize: 25 * 1024 * 1024 };
const excelUploadLarge = multer({ storage, fileFilter, limits: limitsLarge });

module.exports = excelUpload;
module.exports.large = excelUploadLarge;
