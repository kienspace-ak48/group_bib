const multer = require('multer');
const mypath = require('./mypath.config');
const path = require('path');
const fs = require('fs');
const uploadDir = path.join(mypath.root, 'public/uploads/image');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
//dung memoryStorage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|svg/; // regex
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowed.test(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ được upload ảnh (jpeg|jpg|png|gif)!'), false);
    }
};
const upload = multer({
    storage,
    fileFilter,
    limits: {fileSize: 5*1024*1024}
})
module.exports = upload;
