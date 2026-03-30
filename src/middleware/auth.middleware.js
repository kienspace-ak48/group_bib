const jwt = require('jsonwebtoken');
const AccountSystemEntity = require('../model/account_system.model');
const { ADMIN_LOGIN_URL } = require('../config/auth.config');

const CNAME = 'auth.middleware.js ';

/** Tránh lệch so khớp RBAC khi DB lưu thừa khoảng trắng (vd: "super_admin "). */
function normalizeAccountUser(doc) {
    if (!doc) return doc;
    const u = { ...doc };
    if (u.role != null) u.role = String(u.role).trim();
    if (Array.isArray(u.permissions)) {
        u.permissions = u.permissions.map((p) => String(p).trim()).filter(Boolean);
    }
    return u;
}

async function auth(req, res, next) {
    const token = req.cookies?.token || (req.headers?.authorization && req.headers?.authorization.split(' ')[1]);
    if (!token) {
        return res.redirect(ADMIN_LOGIN_URL);
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const getInfoLogin = await AccountSystemEntity.findById(decoded.id)
            .select('_id name username email role permissions token_version')
            .lean();
        if (!getInfoLogin) {
            res.clearCookie('token');
            return res.redirect(ADMIN_LOGIN_URL);
        }
        const tv = decoded.tv != null ? Number(decoded.tv) : 0;
        if (tv !== (getInfoLogin.token_version || 0)) {
            res.clearCookie('token');
            return res.redirect(ADMIN_LOGIN_URL);
        }
        const user = normalizeAccountUser(getInfoLogin);
        req.user = user;
        res.locals.user = user;
        next();
    } catch (error) {
        console.log(CNAME, error.message);
        res.clearCookie('token');
        return res.redirect(ADMIN_LOGIN_URL);
    }
}

module.exports = auth;
