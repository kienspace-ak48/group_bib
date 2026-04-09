const express = require('express');
const participantCheckinHService = require('../areas/admin/services/participantCheckinH.service');
const waiverUpload = require('../config/waiverUploadM');
const toolCheckinController = require('../controller/toolCheckin.controller')();

const router = express.Router();

/** Công khai — không auth (token bí mật trên URL). Phải đăng ký trước `/tool-checkin` có authMiddleware trong `index.js`. */
router.get('/tool-checkin/delegate/:token', toolCheckinController.singleDelegationForm);
router.post('/tool-checkin/delegate/:token', toolCheckinController.singleDelegationSubmit);

router.get('/tool-checkin/waiver/:token', toolCheckinController.waiverForm);

async function waiverLoadParticipant(req, res, next) {
    try {
        const token = String(req.params.token || '').trim();
        const p = await participantCheckinHService.findByWaiverToken(token);
        if (!p) {
            return res.status(404).render('tool/delegate_error', {
                layout: 'layouts/main',
                title: 'Lỗi — Ký miễn trừ',
                message: 'Liên kết không hợp lệ hoặc đã hết hiệu lực.',
            });
        }
        req.waiverParticipant = p;
        req.waiverEventId = p.event_id;
        next();
    } catch (e) {
        next(e);
    }
}

router.post(
    '/tool-checkin/waiver/:token',
    waiverLoadParticipant,
    (req, res, next) => {
        waiverUpload(req, res, (err) => {
            if (err) {
                return res.status(400).send(err.message || 'Lỗi tải file.');
            }
            next();
        });
    },
    toolCheckinController.waiverSubmit,
);

module.exports = router;
