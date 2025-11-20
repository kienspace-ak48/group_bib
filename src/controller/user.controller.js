const CNAME = 'user.controller.js ';
const VNAME = 'pages/';
const VLAYOUT = 'layouts/main';
const UserService = require('../services/user.service');
var userDTO = {
    fullname: 'Kien Vu',
    email: 'test@gmail.com',
    password: '123',
    phone: '19001900',
    role_id: 'root',
    username: 'Kien kute',
    avatar: 'img.jpg',
};
const userController = () => {
    return {
        Index: async () => {},
        RegisterOrLogin: async () => {
            res.render(VNAME + '/login', { layout: VLAYOUT });
        },
        Register: async (req, res) => {
            try {
                const data = req.body;
                const result = await UserService.Add(data);
                console.log(typeof result);
                console.log(result);
                if (result === 0) {
                    return res.status(400).json({ success: false, mess: 'Exit' });
                }
                res.json({ success: true });
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, message: error.message });
            }
        },
        Login: async (req, res) => {
            try {
                const { username, password } = req.body;
                console.log(username, password);
                const result = await UserService.GetByCondition(username);
                console.log(result);
                if (!result) return res.json({ success: false, mess: 'ko co account nay' });
                const isMatch = result.password === password;
                if (!isMatch) return res.json({ success: false, mess: 'password wrong' });
                res.json(result);
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, mess: error.message });
            }
        },
    };
};

module.exports = userController;
