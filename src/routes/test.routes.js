const express = require('express');
const router = express.Router();
const bibIdentification = require('../controller/bibIdentification.controller')();

router.get('/checkin', bibIdentification.Index);

module.exports = router;