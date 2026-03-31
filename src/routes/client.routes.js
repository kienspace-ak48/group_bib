const express = require('express');
const router = express.Router();
const clientHomeController = require('../controller/home.controller')();
const redirectCheckinHome = require('../middleware/redirectCheckinHome.middleware');

router.get('/', redirectCheckinHome, clientHomeController.Index);
router.get('/events', redirectCheckinHome, clientHomeController.eventsPublic);

module.exports = router;
