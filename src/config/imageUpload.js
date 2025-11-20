const multer = require('multer');
const myPath = require('./mypath.config');
const path = require('path');
const fs= require('fs')

// Lùi 2 cấp: từ config/ -> gốc dự án -> cha của dự án
const uploadDir = path.join(myPath.root,'public', 'uploads', 'imgs');


// Tạo folder nếu chưa có
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storageImage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // thư mục lưu ảnh
  },
  filename: function (req, file, cb) {
    // Lấy phần tên gốc (không có phần mở rộng) test.png
    const originalName = path.parse(file.originalname).name; // -> "test"
    const ext = path.extname(file.originalname);   //.png
    // const uniqueName = 
    //   Date.now() +
    //   '-' +
    //   Math.round(Math.random() * 1e9) +
    //   path.extname(file.originalname);
    // n============new
    const uniqueName =
    path.parse(file.originalname).name+
    '-'+
    Math.round(Math.random()* 1e9)+
    path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

// chỉ cho phép file ảnh
function fileFilter(req, file, cb) {
  const allowed = /jpeg|jpg|png|gif|svg/; // regex
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowed.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ được upload ảnh (jpeg|jpg|png|gif)!'), false);
  }
}

const upload = multer({ storage: storageImage, fileFilter });

module.exports = upload;
