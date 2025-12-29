const multer = require('multer');
const path = require('path');
const fs = require('fs');
const myPath = require('./mypath.config');

//
const uploadDir = path.join(myPath.root, 'src', 'public','e-cert', 'adsys');

if(!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, {recursive: true});
}
//diskStorage
const imageStorage = multer.diskStorage({
    destination: function(req, res, cb){
        cb(null, uploadDir);
    },
    filename: function(req, file, cb){
        cb(null, file.originalname.split('.')[0]+'-'+Date.now()+path.extname(file.originalname));
    }
});
//fileFilter
const imageFilter = (req, file, cb)=>{
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg'];
    if(allowedMimes.includes(file.mimetype))cb(null, true);
    else cb(new Error('Chỉ cho phép ảnh (.jpg, .jpeg, .png)'), false);
}
const uploadImageECert = multer({
    storage: imageStorage,
    fileFilter: imageFilter,
    limits: {fileSize: 5*1024*1024} //5MB
});
//const 


module.exports = uploadImageECert;  