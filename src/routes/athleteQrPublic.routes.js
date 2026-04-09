const express = require('express');
const rateLimit = require('express-rate-limit');
const athleteQrPublicController = require('../controller/athleteQrPublic.controller');

const router = express.Router();

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Quá nhiều lượt truy cập. Thử lại sau.',
});

/** Công khai — chỉ hiển thị QR VĐV theo token (link trong email). Không thuộc /tool-checkin. */
router.get('/qr/:token', limiter, athleteQrPublicController.showAthleteQr);

module.exports = router;
