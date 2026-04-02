const express = require('express');
const toolCheckinController = require('../controller/toolCheckin.controller')();

const router = express.Router();

/** Công khai — không auth (token bí mật trên URL). Phải đăng ký trước `/tool-checkin` có authMiddleware trong `index.js`. */
router.get('/tool-checkin/delegate/:token', toolCheckinController.singleDelegationForm);
router.post('/tool-checkin/delegate/:token', toolCheckinController.singleDelegationSubmit);

module.exports = router;
