const express = require('express');
const router = express.Router();

const rbac = require('../middleware/rbac.middleware');
const { requireAdminWeb, requirePermission, requireRole } = rbac;

const adminHomeController = require('../areas/admin/controller/home.controller')();
const adminEventController = require('../areas/admin/controller/event.controller')();
const systemAccountController = require('../areas/admin/controller/systemAccount.controller')();
const excelUploadM = require('../config/excelUploadM');
const uploadExcelLarge = excelUploadM.large;

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

router.use(requireAdminWeb);

const dashPerm = requirePermission('admin.dashboard');
const evPerm = requirePermission('admin.event');

router.get('/', dashPerm, adminHomeController.Index);

router.get('/event', evPerm, adminEventController.Index);
router.post('/event', evPerm, adminEventController.create);
router.get('/event/athlete-import-template', evPerm, adminEventController.downloadAthleteImportTemplate);
router.post('/event/:id/delete', evPerm, adminEventController.destroy);
router.post('/event/:id/participants/:participantId/delete', evPerm, adminEventController.deleteParticipant);
router.post(
    '/event/:id/participants/import',
    evPerm,
    handleMulterUpload(uploadExcelLarge.single('excelFile')),
    adminEventController.importParticipantsExcel,
);
router.post('/event/:id/participants/manual', evPerm, adminEventController.addParticipantManual);
router.post('/event/:id/update', evPerm, adminEventController.updateEvent);
router.post('/event/:id/step/confirm', evPerm, adminEventController.confirmStep);
router.get('/event/:id/step/:step', evPerm, adminEventController.workspaceStep);
router.get('/event/:id', evPerm, adminEventController.workspace);

const superOnly = requireRole('super_admin');
router.get('/system/accounts', superOnly, systemAccountController.listAccounts);
router.get('/system/accounts/new', superOnly, systemAccountController.newAccountForm);
router.post('/system/accounts', superOnly, systemAccountController.createAccount);
router.get('/system/accounts/:id/edit', superOnly, systemAccountController.editAccountForm);
router.post('/system/accounts/:id', superOnly, systemAccountController.updateAccount);
router.post('/system/accounts/:id/delete', superOnly, systemAccountController.deleteAccount);
router.get('/system/logs/login', superOnly, systemAccountController.loginLogs);
router.get('/system/logs/audit', superOnly, systemAccountController.auditLogs);

module.exports = router;
