const jwt = require('jsonwebtoken');
const AccountSystemEntity = require('../model/account_system.model');

const CNAME = 'auth.middleware.js ';

async function auth(req, res, next) {
    // const count = await contactService.countNewNotPartner();
    // res.locals.count = count;
    //res.locals.user = {email: "admin@gmail.com",username: "kien_vu", name:"KienVu"};
    // return next();
    const token = req.cookies?.token || (req.headers?.authorization && req.headers?.authorization.split(' ')[1]);
    if (!token) {
        return res.redirect('/auth/admin/login');
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const getInfoLogin = await AccountSystemEntity.findById(decoded.id).select('_id name username email role').lean();
        req.user = getInfoLogin;
        // 👇 cho EJS dùng global
        res.locals.user = getInfoLogin;

        next();
    } catch (error) {
        console.log(CNAME, error.message);
        // return res.status(401).json({success: false, data: 'Token loi'});
        return res.redirect('/auth/admin/login', { layout: false, mess: 'token is expired' });
    }
}

module.exports = auth;
