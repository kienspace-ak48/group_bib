const jwt = require('jsonwebtoken');
const CNAME = 'ggAuthController.js ';
const { handleLogin } = require('../services/ggAuth.service');
const ggAuthController = () => {
    return {
        Index: (req, res) => {},
        Callback: async (req, res) => {
            try {
                // const { user, token } = await handleLogin(req.user, 'google');
                const user = req.user; //lay tu passport

                if (!user) {
                    console.log(CNAME, 'User is null or undefined');
                    return res.redirect('/user/login');
                }

                console.log(CNAME, 'User from passport:', user._id, user.email);

                // Set token cho client
                const token = jwt.sign({ _id: user._id, email: user.email, avatar: user.avatar, name: user.fullname }, process.env.JWT_SECRET, {
                    expiresIn: '30m',
                });

                // Đổi sameSite thành 'lax' để cookie được gửi trong redirect từ OAuth
                res.cookie('token', token, {
                    httpOnly: true,
                    secure: false, // true nếu dùng HTTPS
                    sameSite: 'lax', // 'lax' cho phép cookie được gửi trong redirect từ external domain
                    maxAge: 30 * 60 * 1000,
                });

                // console.log(CNAME, 'Token set, redirecting to /user/profile');
                res.redirect('/user/profile');
            } catch (error) {
                console.log(CNAME, 'Error:', error.message);
                res.redirect('/user/login');
            }
        },
    };
};
module.exports = ggAuthController;
