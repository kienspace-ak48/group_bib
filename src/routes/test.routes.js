const express = require('express');
const router = express.Router();
const bibIdentification = require('../controller/bibIdentification.controller')();
const bcrypt = require('bcrypt');
const SALT = 12;
//fake data database
//table accounts
const accounts = [
    {id:1, username: 'kien', password: '$2b$12$RKmO8HEdn57p6Lt6awFq8em9w2il55dHcOhXm826Ms2m19reITcNe' }, //123
    {id:2, username: 'sa', password: '$2b$12$kPFvpgzxsfE5e1lvoty2/.Abnuyr.7lxlfVmF5SS7ZkUF/fC2ut8q' }, //12345
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
    if(req.session.user){
        console.log(req.session)
        return next();
    }
    console.log('pls login');
    res.redirect('/test/login');
}
router.get('/checkin', bibIdentification.Index);
router.get('/dashboard',auth, (req, res) => {
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
            req.session.user={
                id: result.id,
                name: result.username
            }
            return res.redirect('/test/dashboard');
        }
        console.log('password sai');
        return res.redirect('/test/login');
    }
    console.log('ko co user');
    res.json({ mess: 'ko co user' });
});

module.exports = router;
