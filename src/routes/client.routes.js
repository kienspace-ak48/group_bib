const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const authRoute = require('../middleware/auth.middleware');
const uploadImageMemory = require('../config/imageUploadMemory');
const excelUploadMemory = require('../config/excelUploadM');
const Event = require('../model/Event');
const MailConfigEntity = require('../model/MailConfig');
const ParticipantCheckin = require('../model/ParticipantCheckin');
const runnerResultController = require('../controller/runnerResult.controller')();

const homeController = require('../controller/home.controller')();
const bibIdentitficationController = require('../controller/bibIdentification.controller')();
const userController = require('../controller/user.controller')();
// const ticketController = require('../controller/')
const groupbibController = require('../controller/groupbib.controller')();

router.get('/search', bibIdentitficationController.Checkin);
router.get('/user/login', homeController.Login);
// router.get('/event/register-team-leader', homeController.RegisterGroupBib)
// event
router.get('/event/event-detail/:slug', homeController.EventDetail);
router.get('/event/group-bib/:slug', homeController.GroupBib);
router.get('/event/participant_pre/:event_slug/:group_id', homeController.ParticipantPre);
router.get('/event', homeController.Index0);
// bib group
router.get('/group-bib/form-add/:slug', authRoute, groupbibController.RegisterGroupBib);
router.post('/group-bib/form-add', authRoute, uploadImageMemory.single('imageQR'), groupbibController.AddGroup);
// user
router.post('/user/register', userController.Register);
router.post('/user/login', userController.Login);
router.post('/user/email-verify-resend', userController.ReSendCode);
router.get('/user/email-verify', userController.FormEmailVerify);
router.post('/user/email-verify', userController.EmailVerify);
router.get('/user/profile', authRoute, userController.Profile);
router.get('/user/change-password', userController.ChangePassword);
router.get('/user/event-detail/:slug/checkout', authRoute, userController.Checkout);
router.post('/user/event-detail/:slug/payment', authRoute, userController.Payment);
router.get('/user/event-detail/:slug/transfer', authRoute, userController.Transfer);
router.post('/user/event-detail/:slug/confirm-payment', authRoute, userController.ChangePaymentStatus);
//
// router.get('/user/')
// router.get('/user/event-detail/:slug/payment', userController.PaymentCheckout);
// router.get('/user/group', userController.Group)
router.get('/user/group-detail/runner-info/:runner_id', authRoute, userController.GetRunnerById);
router.get('/user/profile-doc-history-list', userController.ProfileDocHistoryList);
router.get('/user/profile-doc-history', userController.ProfileDocHistory);
router.get('/user/group-management', authRoute, userController.GroupManagement);
router.post(
    '/user/group-detail/import-excel',
    excelUploadMemory.single('excelFile'),
    userController.GroupDetailImportExcel,
);
router.get('/user/group-detail/:slug', authRoute, userController.GroupDetail);
router.get('/user/pre-order-management/:id', userController.OrderPre);
router.post('/user/group-add-member/:slug', authRoute, userController.AddMember);
router.get('/user/group-detail/:slug/runner-data', authRoute, userController.RunnerDataList);
// ---import file excel
// E-Cert
router.get('/e-cert', homeController.Ecert);
router.get('/e-cert/contest-detail/:slug', homeController.ECetDetail);
router.post('/e-cert/data-table/:slug', homeController.DataTable);
router.get('/e-cert/render-cert', homeController.RenderCertificate);

// Runner Result
router.get('/runner/by-distance/:distance', runnerResultController.GetByDistance);
router.get('/runner/result', runnerResultController.CallAPI);
router.get('/runner', runnerResultController.Index);

//tools
// ajax dataTable
router.get('/tool-checkin/get-data', async (req, res) => {
    console.log(req.query)
    try {
        //1.params DataTable gui len
        const draw = Number(req.query.draw || 1);
        const start = Number(req.query.start || 0);
        const length = Number(req.query.length || 10);
        const searchValue = req.query['search[value]'] || '';
        console.log('searchValue: ', searchValue)
        //sort
        // lấy index cột sort
        const orderColumnIndex = req.query['order[0][column]'];
        // lấy hướng sort
        const orderDir = req.query['order[0][dir]'] || 'asc';
        // lấy tên field từ columns
        const sortFiled = req.query[`columns[${orderColumnIndex}][data]`] || 'createdAt';

        console.log('sortColumn:', sortFiled, 'orderDir:', orderDir);
        console.log('sortColumn: ', orderColumnIndex, 'orderDir ', orderDir);

        //2. Build query search
        const query = {};
        if (searchValue) {
            query.$or = [
                { fullname: { $regex: searchValue, $options: 'i' } },
                { email: { $regex: searchValue, $options: 'i' } },
                { bib: { $regex: searchValue, $options: 'i' } },
            ];
        }
        //3. Sort object
        const sort = {
            [sortFiled]: orderDir === 'asc' ? 1 : -1,
        };
        //4. Query song song (toi uu)
        const [data, recordsFiltered, recordsTotal] = await Promise.all([
            ParticipantCheckin.find(query).sort(sort).skip(start).limit(length).lean(),
            ParticipantCheckin.countDocuments(query),
            ParticipantCheckin.countDocuments({}),
        ]);
        res.json({ draw, recordsTotal, recordsFiltered, data });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({
            draw: req.query.draw,
            recordsTotal: 0,
            recordsFiltered: 0,
            data: [],
        });
    }
});
router.post('/tool-checkin/check-in', async (req, res) => {
    try {
        const data = req.body;
        console.log('data', data);
        if (!data.code) {
            return res.status(400).json({
                success: false,
                mess: 'Thieus ma QR code',
            });
        }
        //
        const pc = await ParticipantCheckin.findOneAndUpdate(
            { uid: data.code },
            [
                {
                    $set: {
                        checkin_status: { $not: '$checkin_status' },
                    },
                },
            ],
            { new: true },
        );
        if (!pc) {
            return res.status(404).json({
                success: false,
                mess: 'Ko tim thay thong tin person' + data.code,
            });
        }
        res.json({ success: true, data: pc });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success: false, mess: error.message });
        // res.render('tool/checkin', { layout: 'layouts/main', info: {} });
    }
});
router.get('/tool-checkin/info', async (req, res) => {
    try {
        const data = req.body;
        console.log('data', data);
        const _uid = req.query.code;
        const event = await Event.findOne({ race_function: 'checkin' });

        const pc = await ParticipantCheckin.findOne({ uid: _uid }).lean();
        res.render('tool/info', { layout: 'layouts/main', pc: pc, event });
    } catch (error) {
        res.render('tool/info', { layout: 'layouts/main', pc: {}, event: {} });
    }
});
// router.get('tool')
router.get('/tool-checkin/scan-qr', async (req, res) => {
    res.render('tool/scanQRCode', { layout: false });
});
router.get('/tool-checkin/', async (req, res) => {
    const event = await Event.findOne({ race_function: 'checkin' });
    // console.log(event)
    const mc = await MailConfigEntity.findOne({ event_id: event._id });
    res.render('tool/checkin', { layout: 'layouts/main', event, mc: mc || {} });
});

// test
router.get('/test/getCountry', userController.testGetAllCountry);
router.get('/', homeController.Index);

module.exports = router;
