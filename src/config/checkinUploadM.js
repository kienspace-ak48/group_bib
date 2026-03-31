const path = require('path');
const fs = require('fs');
const multer = require('multer');

const BASE = path.join(__dirname, '../../public/uploads/checkin');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const eid = req.user?.checkin_event_id;
        if (!eid) {
            return cb(new Error('Chưa gán sự kiện check-in.'));
        }
        const dir = path.join(BASE, String(eid));
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const prefix = file.fieldname === 'signature' ? 'sig' : 'photo';
        const ext =
            path.extname(file.originalname) ||
            (file.mimetype === 'image/png' ? '.png' : '.jpg');
        cb(null, `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}${ext}`);
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

/** multipart: signature + photo */
module.exports = upload.fields([
    { name: 'signature', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
]);
