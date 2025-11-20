//user.service.js
const CNAME = 'user.service.js ';
const UserEntity = require('../model/User');
var userDTO = {
    fullname: 'Kien Vu',
    email: 'test@gmail.com',
    password: '123',
    phone: '19001900',
    role_id: 'root',
    username: 'Kien kute',
    avatar: 'img.jpg',
};
class UserService {
    constructor(parameters) {
        console.log('Initial UserService');
    }

    GetAll() {}
    GetById() {}
    async Add(user) {
        try {
            const isExitEmail = await UserEntity.findOne({ email: userDTO.email }).lean();
            const isExitPhone = await UserEntity.findOne({ phone: userDTO.phone }).lean();
            if (isExitEmail || isExitPhone) {
                return 0;
            }
            const user = new UserEntity(userDTO);
            await user.save();
            return 1;
        } catch (error) {
            console.log(CNAME, error.message);
            return 9;
        }
    }
    Update() {}
    Delete() {}
}

module.exports = new UserService();
