const express = require('express');
const router = express.Router();
const sendgridWebhook = require('../controller/sendgridWebhook.controller');

/** SendGrid gửi application/json — body đã được express.json() parse ở app */
router.post('/sendgrid', sendgridWebhook.ingest);

module.exports = router;
