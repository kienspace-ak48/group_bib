const multer = require('multer');

const storage = multer.memoryStorage();
const limits = { fileSize: 5 * 1024 * 1024 };
const fileFilter = (req, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype);
    cb(ok ? null : new Error('Chỉ cho phép ảnh JPEG, PNG, GIF hoặc WebP.'), ok);
};

module.exports = multer({ storage, limits, fileFilter });
