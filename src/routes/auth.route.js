const express = require('express');
const ms = require('ms');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const isProd = process.env.NODE_ENV === 'production';
const AccountSystemEntity = require('../model/account_system.model');
const loginHistoryService = require('../areas/admin/services/loginHistory.service');
const { ADMIN_LOGIN_URL } = require('../config/auth.config');

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

/** Tìm email không phân biệt hoa thường (tránh lệch DB) */
function findAccountByEmail(email) {
    const safe = String(email || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return AccountSystemEntity.findOne({ email: new RegExp(`^${safe}$`, 'i') });
}

router.get('/admin/login', (req, res) => {
    res.render('pages/login', { layout: false });
});

router.post('/admin/login', loginLimiter, async (req, res) => {
    const email = (req.body.email || req.body.l_username || '').trim().toLowerCase();
    const password =
        req.body.password != null ? String(req.body.password) : req.body.l_password != null ? String(req.body.l_password) : '';

    const account = await findAccountByEmail(email);
    if (!account) {
        await loginHistoryService.recordFailure(null, 'unknown_email', req);
        return res.render('pages/login', {
            layout: false,
            success: false,
            mess: 'username or password is incorrect!',
        });
    }
    if (!account.status) {
        await loginHistoryService.recordFailure(account._id, 'banned', req);
        return res.render('pages/login', {
            layout: false,
            success: false,
            mess: 'Your account has been banned. Please contact the administrator.',
        });
    }
    const match = await comparePassword(password, account.password);

    if (!match) {
        await loginHistoryService.recordFailure(account._id, 'wrong_password', req);
        return res.render('pages/login', {
            layout: false,
            success: false,
            mess: 'username or password is incorrect!!',
        });
    }

    await loginHistoryService.recordSuccess(account._id, req);
    await AccountSystemEntity.updateOne({ _id: account._id }, { $set: { last_login_at: new Date() } });

    const tv = account.token_version != null ? Number(account.token_version) : 0;
    const payload = {
        id: account._id,
        role: account.role,
        tv,
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
});

router.post('/admin/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect(ADMIN_LOGIN_URL);
});

router.get('/admin/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect(ADMIN_LOGIN_URL);
});

router.get('/register', async (req, res) => {
    const password = '123@';
    const passwordHash = bcrypt.hashSync(password, 12);
    try {
        const u = new AccountSystemEntity({
            username: 'toppicare_lpa12',
            password: passwordHash,
            email: 'admin@gmail.com',
            name: 'Toppicare LPA12',
            status: true,
            role: 'super_admin',
            permissions: ['admin.event', 'admin.dashboard'],
        });
        const task1 = await u.save();
        return res.status(200).json({ success: true, data: task1 });
    } catch (err) {
        console.log(err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
});

module.exports = router;
