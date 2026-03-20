const express = require('express');
const ms = require('ms');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const isProd = process.env.NODE_ENV === 'production';
const AccountSystemEntity = require('../model/account_system.model');
//fx
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    handler: (req, res) => {
        return res.render('pages/login', {
            layout: false,
            success: false,
            mess: 'Too many login attempts. Please try again in 15 minutes.',
        });
    },
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
});
async function comparePassword(password, hash) {
    const match = await bcrypt.compare(password, hash);
    return match;
}
//form login
router.get('/admin/login', (req, res) => {
    res.render('pages/login', { layout: false });
});
//login
router.post('/admin/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;
    const account = await AccountSystemEntity.findOne({ email: email });
    if (!account) {
        // console.log("ko thay user");
        return res.render('pages/login', {
            layout: false,
            success: false,
            mess: 'username or password is incorrect!',
        });
    }
    if (!account.status) {
        return res.render('pages/login', {
            layout: false,
            success: false,
            mess: 'Your account has been banned. Please contact the administrator.',
        });
    }
    const match = await comparePassword(password, account.password);

    if (!match) {
        // return res.status(401).json({success: false, mess: 'Sai mat khau'});
        return res.render('pages/login', {
            layout: false,
            success: false,
            mess: 'username or password is incorrect!!',
        });
    }
    const payload = {
        id: account._id,
        role: account.role,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE,
    });
    res.cookie('token', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: ms(process.env.JWT_EXPIRE),
    });
    res.redirect('/admin');
    // res.json({success: true, data: 'login success', token})
});
//logout
router.post('/admin/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});
//
router.get('/register', async (res, req) => {
    // const u = new user
    const password = '123@';
    const passwordHash = bcrypt.hashSync(password, 12);
    try {
        const u = new AccountSystemEntity({
            username: 'toppicare_lpa12',
            password: passwordHash,
            email: 'admin@gmail.com',
            name: 'Toppicare LPA12',
            status: true,
        });
        const task1 = await u.save();
        res.success(task1);
    } catch (err) {
        console.log(err.message);
        res.error('Server error');
    }
});

module.exports = router;
