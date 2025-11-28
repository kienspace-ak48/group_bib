const express = require('express');
const passport = require('passport');
const router = express.Router();
const ggAuthController = require('../controller/ggAuth.controller')();

// Bấm nút login
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google trả về

router.get(
    '/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    ggAuthController.Callback,
);

// Logout
router.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

module.exports = router;
