// middleware/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();
const SECRET = process.env.JWT_SECRET;

function isAuthenticated(req, res, next) {
    try {
        const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
        if (!token) {
            // return res.status(401).json({ success: false, mess: 'Khong co token, vui long dang nhap' });
            return res.redirect('/login');
        }
        const decode = jwt.verify(token, SECRET);
        req.user = decode;
        next();
    } catch (error) {
        // res.status(401).json({ success: false, mess: 'Token khong hop le, vui long dang nhap lai' });
        return res.redirect('/login');
    }
}
module.exports = isAuthenticated;
