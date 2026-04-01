const express = require('express');
const router = express.Router();

const rbac = require('../middleware/rbac.middleware');
const { requireAdminWeb, requirePermission, requireRole } = rbac;

const adminHomeController = require('../areas/admin/controller/home.controller')();
const adminEventController = require('../areas/admin/controller/event.controller')();
const systemAccountController = require('../areas/admin/controller/systemAccount.controller')();
const excelUploadM = require('../config/excelUploadM');
const uploadExcelLarge = excelUploadM.large;
const mailBannerUpload = require('../config/mailBannerUploadM');

function handleMulterUpload(upload) {
    return (req, res, next) => {
        upload(req, res, (err) => {
            if (err) {
                req.session.flash = { type: 'danger', message: err.message || 'Lỗi upload file.' };
                return res.redirect('/admin/event/' + req.params.id + '/step/1');
            }
            next();
        });
    };
}

function handleMailBannerUpload(req, res, next) {
    mailBannerUpload.single('file')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message || 'Lỗi upload ảnh.' });
        }
        next();
    });
}

router.use(requireAdminWeb);

const dashPerm = requirePermission('admin.dashboard');
const evPerm = requirePermission('admin.event');

router.get('/', dashPerm, adminHomeController.Index);

router.get('/event', evPerm, adminEventController.Index);
router.post('/event', evPerm, adminEventController.create);
router.get('/event/athlete-import-template', evPerm, adminEventController.downloadAthleteImportTemplate);
router.get('/event/:id/participants/export', evPerm, adminEventController.exportParticipantsExcel);
router.post('/event/:id/delete', evPerm, adminEventController.destroy);
router.post('/event/:id/participants/:participantId/delete', evPerm, adminEventController.deleteParticipant);
router.post(
    '/event/:id/participants/import',
    evPerm,
    handleMulterUpload(uploadExcelLarge.single('excelFile')),
    adminEventController.importParticipantsExcel,
);
router.post('/event/:id/participants/manual', evPerm, adminEventController.addParticipantManual);
router.post('/event/:id/participants/:participantId/update', evPerm, adminEventController.updateParticipant);
router.post('/event/:id/participants/:participantId/send-mail', evPerm, adminEventController.sendParticipantQrMail);
router.post('/event/:id/group-authorizations/:gaId/update', evPerm, adminEventController.updateGroupAuthorization);
router.post('/event/:id/group-authorizations/:gaId/delete', evPerm, adminEventController.deleteGroupAuthorization);
router.post('/event/:id/group-authorizations', evPerm, adminEventController.createGroupAuthorization);
router.post('/event/:id/update', evPerm, adminEventController.updateEvent);
router.post('/event/:id/mail-config', evPerm, adminEventController.saveMailConfig);
router.post('/event/:id/mail/banner', evPerm, handleMailBannerUpload, adminEventController.uploadMailBanner);
router.post('/event/:id/mail/send-bulk', evPerm, adminEventController.sendBulkQrMail);
router.get('/event/:id/mail/bulk-job/latest', evPerm, adminEventController.getLatestBulkMailJob);
router.get('/event/:id/mail/bulk-job/:jobId', evPerm, adminEventController.getBulkMailJobStatus);
router.get('/event/:id/mail/preview', evPerm, adminEventController.previewQrMail);
router.post('/event/:id/step/confirm', evPerm, adminEventController.confirmStep);
/** Lịch sử check-in chung (chọn sự kiện bằng ?event=); phải đứng trước /event/:id để không bị nuốt bởi :id */
router.get('/event/checkin-history', evPerm, adminEventController.checkinHistory);
/** Tương thích URL cũ /event/:id/checkin-history → chuyển sang ?event= */
router.get('/event/:id/checkin-history', evPerm, (req, res) => {
    const q = new URLSearchParams(req.query);
    q.set('event', req.params.id);
    res.redirect(302, '/admin/event/checkin-history?' + q.toString());
});
router.get('/event/:id/step/:step', evPerm, adminEventController.workspaceStep);
router.get('/event/:id', evPerm, adminEventController.workspace);

const superOnly = requireRole('super_admin');
const requireSensitiveLogsUnlock = require('../middleware/sensitiveLogsUnlock.middleware');
router.get('/system/accounts', superOnly, systemAccountController.listAccounts);
router.get('/system/accounts/new', superOnly, systemAccountController.newAccountForm);
router.post('/system/accounts', superOnly, systemAccountController.createAccount);
router.get('/system/accounts/:id/edit', superOnly, systemAccountController.editAccountForm);
router.post('/system/accounts/:id', superOnly, systemAccountController.updateAccount);
router.post('/system/accounts/:id/delete', superOnly, systemAccountController.deleteAccount);
router.get('/system/logs/unlock', superOnly, systemAccountController.sensitiveLogsUnlockForm);
router.post('/system/logs/unlock', superOnly, systemAccountController.sensitiveLogsUnlockPost);
router.get('/system/logs/login', superOnly, requireSensitiveLogsUnlock, systemAccountController.loginLogs);
router.get('/system/logs/audit', superOnly, requireSensitiveLogsUnlock, systemAccountController.auditLogs);

module.exports = router;
