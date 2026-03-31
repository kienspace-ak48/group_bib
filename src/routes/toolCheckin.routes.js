const express = require('express');
const router = express.Router();
const rbac = require('../middleware/rbac.middleware');
const checkinUpload = require('../config/checkinUploadM');
const { ADMIN_LOGIN_URL } = require('../config/auth.config');
const toolCheckinController = require('../controller/toolCheckin.controller')();

function requireCheckinEvent(req, res, next) {
    if (!req.user?.checkin_event_id) {
        return res.status(403).render('tool/checkin_unassigned', { layout: false });
    }
    next();
}

/** Trang nhóm ủy quyền: TNV (check-in) hoặc admin xem/preview — không dùng requireRole chỉ account_checkin (tránh redirect về / khi đang login admin). */
function requireGroupAuthPageViewer(req, res, next) {
    if (!req.user) {
        return res.redirect(ADMIN_LOGIN_URL);
    }
    const r = req.user.role;
    if (r === 'account_checkin' || r === 'super_admin' || r === 'admin') {
        return next();
    }
    if (req.session) {
        req.session.flash = {
            type: 'danger',
            message: 'Chỉ tài khoản check-in hoặc quản trị mở được liên kết nhóm ủy quyền.',
        };
    }
    return res.redirect('/');
}

router.get('/group-auth/:token', requireGroupAuthPageViewer, toolCheckinController.groupAuthByToken);

router.use(rbac.requireRole('account_checkin'));
router.use(requireCheckinEvent);

router.get('/', toolCheckinController.dashboard);
router.get('/get-data', toolCheckinController.getData);
router.get('/get-stats', toolCheckinController.getStats);
router.get('/info', toolCheckinController.info);
router.post('/check-in', (req, res, next) => {
    checkinUpload(req, res, (err) => {
        if (err) {
            return res.status(400).json({ success: false, mess: err.message || 'Lỗi upload ảnh.' });
        }
        next();
    });
}, toolCheckinController.checkIn);

module.exports = router;
