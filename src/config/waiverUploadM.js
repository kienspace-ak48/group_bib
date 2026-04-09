const path = require('path');
const fs = require('fs');
const multer = require('multer');

const BASE = path.join(__dirname, '../../public/uploads/waiver');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const eid = req.waiverEventId;
        if (!eid) {
            return cb(new Error('Thiếu sự kiện (waiver).'));
        }
        const dir = path.join(BASE, String(eid));
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext =
            path.extname(file.originalname) ||
            (file.mimetype === 'image/png' ? '.png' : '.jpg');
        cb(null, `waiver_sig_${Date.now()}_${Math.random().toString(36).slice(2, 10)}${ext}`);
    },
});

const limits = { fileSize: 8 * 1024 * 1024 };

const fileFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ chấp nhận file ảnh (JPEG, PNG, WebP).'), false);
    }
};

const upload = multer({ storage, limits, fileFilter });

module.exports = upload.single('signature');
