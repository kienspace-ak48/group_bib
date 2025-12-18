const express = require('express');
const router = express.Router();
const authRoute = require('../middleware/auth.middleware');
const uploadImageMemory = require('../config/imageUploadMemory');
const excelUploadMemory = require('../config/excelUploadM');

const homeController = require('../controller/home.controller')();
const bibIdentitficationController = require('../controller/bibIdentification.controller')();
const userController = require('../controller/user.controller')();
// const ticketController = require('../controller/')
const groupbibController = require('../controller/groupbib.controller')();

router.get('/search', bibIdentitficationController.Checkin);
router.get('/user/login', homeController.Login);
// router.get('/event/register-team-leader', homeController.RegisterGroupBib)
// event
router.get('/event/event-detail/:slug', homeController.EventDetail);
router.get('/event/group-bib/:slug' , homeController.GroupBib);
router.get('/event/participant_pre/:event_slug/:group_id', homeController.ParticipantPre)
router.get('/', homeController.Index);
// bib group
router.get('/group-bib/form-add/:slug', authRoute, groupbibController.RegisterGroupBib);
router.post('/group-bib/form-add', authRoute,uploadImageMemory.single('imageQR') , groupbibController.AddGroup);
// user
router.post('/user/register', userController.Register);
router.post('/user/login', userController.Login);
router.get('/user/email-verify', userController.FormEmailVerify);
router.post('/user/email-verify', userController.EmailVerify);
router.get('/user/profile', authRoute,  userController.Profile);
router.get('/user/change-password', userController.ChangePassword);
router.get('/user/event-detail/:slug/checkout', authRoute, userController.Checkout);
router.post('/user/event-detail/:slug/payment', authRoute,userController.Payment);
// router.get('/user/')
// router.get('/user/event-detail/:slug/payment', userController.PaymentCheckout);
// router.get('/user/group', userController.Group)
router.get('/user/group-detail/runner-info/:runner_id', authRoute, userController.GetRunnerById);
router.get('/user/profile-doc-history-list', userController.ProfileDocHistoryList);
router.get('/user/profile-doc-history' ,userController.ProfileDocHistory);
router.get('/user/group-management',authRoute ,userController.GroupManagement);
router.post('/user/group-detail/import-excel', excelUploadMemory.single('excelFile'), userController.GroupDetailImportExcel);
router.get('/user/group-detail/:slug',authRoute,  userController.GroupDetail);
router.get('/user/pre-order-management/:id', userController.OrderPre)
router.post('/user/group-add-member/:slug',authRoute, userController.AddMember)
// ---import file excel
// test
router.get('/test/getCountry', userController.testGetAllCountry)

module.exports = router;
