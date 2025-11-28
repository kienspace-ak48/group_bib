const express = require('express');
const router = express.Router();
const authRoute = require('../middleware/auth.middleware');

const homeController = require('../controller/home.controller')();
const bibIdentitficationController = require('../controller/bibIdentification.controller')();
const userController = require('../controller/user.controller')();
// const ticketController = require('../controller/')
const groupbibController = require('../controller/groupbib.controller')();

router.get('/search', bibIdentitficationController.Checkin);
router.get('/login', homeController.Login);
// router.get('/event/register-team-leader', homeController.RegisterGroupBib)
// event
router.get('/event/event-detail/:slug', homeController.EventDetail);
router.get('/event/group-bib/:slug' , homeController.GroupBib);
router.get('/', homeController.Index);
// bib group
router.get('/group-bib/form-add/:slug' , groupbibController.RegisterGroupBib);
router.post('/group-bib/form-add', groupbibController.AddGroup);
// user
router.post('/user/register', userController.Register);
router.post('/user/login', userController.Login);
router.get('/user/profile',  userController.Profile);
router.get('/user/change-password', userController.ChangePassword);
router.get('/user/group', userController.Group)
router.get('/user/profile-doc-history-list', userController.ProfileDocHistoryList);
router.get('/user/profile-doc-history' ,userController.ProfileDocHistory);

module.exports = router;
