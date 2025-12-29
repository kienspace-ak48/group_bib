const multer = require("multer");
//dung memoryStorage
const storage = multer.memoryStorage();

//chi chap nhan file excel
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel", // .xls
  ];
  if(allowedMimes.includes(file.mimetype)){
    cb(null,true);
  }else{
    cb(new Error("Chi cho phep upload file Excel (.xls, .xlsx)"))
  }
};

//gioi han dung luong file 
const limits = {fileSize: 2 *1024 *1024};
const uploadExcelECert = multer({storage, fileFilter, limits});
module.exports = uploadExcelECert;
