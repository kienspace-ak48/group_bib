const express = require('express');
const router = express.Router();
const UserEntity = require('../model/User');
const jwt = require('jsonwebtoken');
const bcript = require('bcrypt');
const SECRET = process.env.JWT_SECRET;

router.post('/login', async (req, res) => {
    const username = req.body.l_username;
    const password = req.body.l_password;
    // const { username, password } = req.body;
    const user = await UserEntity.findOne({ email: username });
    if (!user) return res.redirect('/login');
    // const isMatch = await user.comparePassword(password);
    let isMatch = password === user.password;
    console.log('match? ',typeof isMatch)
    console.log(isMatch)
    if (isMatch) {
        const token = jwt.sign({ _id: user._id, username: user.username }, SECRET, { expiresIn: '30m' });
        res.cookie('token', token, {
            httpOnly: true,
            secure: false,
            sameSite: 'strict',
            maxAge: 30 * 60 * 1000,
        });
        console.log("login success");
        res.redirect('/user/profile')
    }else{
        console.log('login failed')
        res.redirect('/login');
    }
});

module.exports = router;
