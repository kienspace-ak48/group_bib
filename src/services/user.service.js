//user.service.js
const CNAME = 'user.service.js ';
const UserEntity = require('../model/User');

class UserService {
    constructor(parameters) {
        console.log('Initial UserService');
    }

    GetAll() {}
    async GetById(username) {
        
    }
    async GetByCondition(username){
        try {
           const result = await UserEntity.findOne({
            $or:[
                {phone: username},
                {email: username}
            ]
           });
           return result; 
        } catch (error) {
            console.log(CNAME, error.message);
            return {};
        }
    }
    async Add(user) {
        try {
            const _user = new UserEntity(user);
            const isExitEmail = await UserEntity.findOne({ email: user.email }).lean();
            const isExitPhone = await UserEntity.findOne({ phone: user.phone }).lean();
            if (isExitEmail || isExitPhone) {
                return 0;
            }
            // const user = new UserEntity(userDTO);
            await _user.save();
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
