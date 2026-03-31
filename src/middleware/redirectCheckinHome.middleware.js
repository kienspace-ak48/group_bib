const jwt = require('jsonwebtoken');
const AccountSystemEntity = require('../model/account_system.model');

/**
 * GET / — nếu đã đăng nhập bằng account_checkin, chuyển thẳng tới tool check-in.
 */
async function redirectCheckinHome(req, res, next) {
    const token = req.cookies?.token;
    if (!token) return next();
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const u = await AccountSystemEntity.findById(decoded.id).select('role token_version').lean();
        if (!u) return next();
        const tv = decoded.tv != null ? Number(decoded.tv) : 0;
        if (tv !== (u.token_version || 0)) return next();
        if (u.role === 'account_checkin') {
            return res.redirect('/tool-checkin');
        }
    } catch (e) {
        /* token lỗi hoặc hết hạn — vẫn cho xem trang chủ */
    }
    next();
}

module.exports = redirectCheckinHome;
