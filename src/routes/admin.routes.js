const express = require('express');
const router = express.Router();

const uploadImageMiddleware = require('../middleware/uploadImage.middleware');
const uploadImageECert = require('../config/uploadImageECert');
const uploadExcelECert = require('../config/ecert-xlsx.config');
const homeController = require('../areas/admin/controller/home.controller')();
const eventController = require('../areas/admin/controller/event.controller')();
const imageController = require('../areas/admin/controller/image.controller')();
const ticketController = require('../areas/admin/controller/ticket.controller')();
const groupController = require('../areas/admin/controller/group.controller')();
const ecertController = require('../areas/admin/controller/ecert.controller')();
// 
const imageUploadMemory = require('../config/imageUploadMemory');
// group
router.get('/page-setting', homeController.PageSetting);
router.post('/page-setting/home-page/config', homeController.ConfigHomePage)
router.get('/group', groupController.Index);
// router.get('/', homeController.Index);
router.get('/event/form', eventController.FormAdd);
router.post('/event/form', eventController.AddEvent);
router.get('/event/form-edit/:slug', eventController.FormEdit);
router.put('/event/form-edit/:slug', eventController.UpdateEvent);
router.delete('/event/:id', eventController.DeleteEvent);
router.get('/event', eventController.Index);
// image
router.get('/image/delete/:name', imageController.Delete);
router.post('/image', uploadImageMiddleware.single('file'), imageController.Upload);
router.get('/image', imageController.Index);
// ticket
router.get('/ticket/form-add', ticketController.FormAdd);
router.post('/ticket/create', ticketController.Create);
// ecert
// router.post('/e-cert/upload-image', uploadImageECert.single('ecert_img'), ecertController.UploadImage);
// router.post('/e-cert/save-position/:id', ECertController.SavePosition.bind(ECertController));
router.post('/e-cert/data-table/:cid', ecertController.DataTable);
router.get('/e-cert/render-cert', ecertController.RenderCertificate);
router.post('/e-cert/upload-data/:id',uploadExcelECert.single('ecert_xlsx'), ecertController.UploadExcel); // sua day
router.post('/e-cert/save-position/:id', ecertController.SavePosition);
router.post('/e-cert/upload-image', imageUploadMemory.single('ecert_img'), ecertController.UploadImage2);
router.post('/e-cert/upload-data/:id',uploadExcelECert.single('ecert_xlsx'), ecertController.UploadExcel);
router.post('/e-cert/create-contest', ecertController.AddContest);  
router.get('/e-cert/contest-detail/:id', ecertController.ContestDetail);
router.get('/e-cert', ecertController.Index);
// index
router.get('/', homeController.Index);
module.exports = router;
