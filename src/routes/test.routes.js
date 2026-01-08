const express = require('express');
const router = express.Router();
const bibIdentification = require('../controller/bibIdentification.controller')();
const bcrypt = require('bcrypt');
const SALT = 12;
const excelUpload = require('../config/excelUploadM');
const xlsx = require('xlsx');
const crypto = require('crypto');
const EventEntity = require('../model/Event');
const RunnerEntity = require('../model/Runner');
const ParticipantEntity = require('../model/Participant');
const { sendOtpMail } = require('../services/mail.service');
const {sendMailDomainQRCode}= require('../services/mailDomainQRCode.service');
const QRCode = require('qrcode');
//fake data database
//table accounts
const accounts = [
    { id: 1, username: 'kien', password: '$2b$12$RKmO8HEdn57p6Lt6awFq8em9w2il55dHcOhXm826Ms2m19reITcNe' }, //123
    { id: 2, username: 'sa', password: '$2b$12$kPFvpgzxsfE5e1lvoty2/.Abnuyr.7lxlfVmF5SS7ZkUF/fC2ut8q' }, //12345
];

async function hashPassword(password) {
    console.log('before', password);
    const hash = await bcrypt.hash(password, SALT);
    console.log('after', hash);
    return hash;
}
async function decodePassword(plainPassword, storeHash) {
    const result = await bcrypt.compare(plainPassword, storeHash);
    return result;
}
async function auth(req, res, next) {
    // if (req.cookies.loggedIn === 'true') {
    //     console.log('login with cookie success');
    //     return next();
    // }
    if (req.session.user) {
        console.log(req.session);
        return next();
    }
    console.log('pls login');
    res.redirect('/test/login');
}
//router.get('/checkin', bibIdentification.Index);
router.get('/dashboard', auth, (req, res) => {
    res.render('test/dashboard', { layout: false });
});
router.get('/login', (req, res) => {
    res.send(`
    <form method="POST" action="/test/login">
      <input name="username" placeholder="enter username..." />
      <input name="password" placeholder="password" type="password" />
      <button type="submit">Login</button>
    </form>
  `);
});
router.post('/login', async (req, res) => {
    console.log('running');
    const { username, password } = req.body;
    // const hash = await hashPassword(password);
    console.log(username, password);
    const result = accounts.find((u) => u.username === username);
    console.log(typeof result, result);
    if (result) {
        const isMatch = await decodePassword(password, result.password);
        console.log(typeof isMatch, isMatch);
        if (isMatch) {
            console.log('password dung');
            //luu thong tin user vao session
            req.session.user = {
                id: result.id,
                name: result.username,
            };
            return res.redirect('/test/dashboard');
        }
        console.log('password sai');
        return res.redirect('/test/login');
    }
    console.log('ko co user');
    res.json({ mess: 'ko co user' });
});
router.get('/sendgrid', async (req, res) => {
    try {
        const otp = '123456';
        console.log('running here');
        await sendOtpMail('kienvu.dev@gmail.com', otp);
        return res.json({ success: true, mess: 'ok' });
    } catch (error) {
        return res.status(500).json({ success: false, mess: 'failed' });
    }
});
// excel
router.get('/xlsx', (req, res) => {
    res.send(`
        <h1>Form import data</h1>
        <form action="/test/xlsx" method="post" enctype="multipart/form-data">
        <label for="">Drag file here</label>
        <input type="file" name="excelFile" id=""> 
        <button type="submit">Submit</button>
    </form>
        `);
});
router.post('/xlsx', excelUpload.single('excelFile'), (req, res) => {
    try {
        if (!req.file) return res.status(400).send('chua co file');
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        //lay sheet dau tien
        const sheetName = workbook.SheetNames[0]; //lay sheet dau tien
        //lay sheet theo ten
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet); //convert to JSON
        console.log(data);
        res.json({ mess: 'read file', data });
    } catch (error) {
        console.log(error.message);
        res.status(500).send(error.message);
    }
});
router.get('/api/runner', (req, res) => {
    const runners = [
        { id: 1, name: 'Nguyen Van A', bib: '1234' },
        { id: 2, name: 'Tran Thanh Hai', bib: '1235' },
        { id: 3, name: 'Nguyen Ba Long', bib: '1236' },
    ];
    res.json({ success: true, data: runners });
});
//send mail
router.get('/sendmail/', async (req, res) => {
    const _eventId = 'event_test';
    const _groupId = 'group_admin';
    const event = await EventEntity.findOne({ _id: '69290d190cfdc66e0f753c76' });
    console.log(event);
    const pp = await ParticipantEntity.find({ event_id: _eventId, group_id: _groupId }).lean();
    console.log(pp)
    const qrBase64 =await QRCode.toDataURL('event_test_21c6a70a2f');
    const sendMail =await sendMailDomainQRCode('kienvu.dev@gmail.com', 'Nguyen Van A',qrBase64 )
    // const randomPart = crypto.randomBytes(5).toString('hex');
    res.json({ success: true, sendMail, qrBase64});
});
router.get('/tool-scan', async(req, res)=>{
    res.render('pages/scanQRCode', {layout: false});
})
//
module.exports = router;
