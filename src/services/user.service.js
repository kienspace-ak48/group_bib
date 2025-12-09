//user.service.js
const CNAME = 'user.service.js ';
const UserEntity = require('../model/User');

class UserService {
    constructor(parameters) {
        console.log('Initial UserService');
    }

    GetAll() {}
    async GetById(username) {}
    async GetByCondition(username) {
        try {
            const result = await UserEntity.findOne({
                $or: [{ phone: username }, { email: username }],
            });
            return result;
        } catch (error) {
            console.log(CNAME, error.message);
            return {};
        }
    }
    async GetByProviderName(name) {
        try {
            const result = await UserEntity.findOne({ 'providers.name': name });
            return result;
        } catch (error) {
            console.log(CNAME, error.message);
            return {};
        }
    }
    async GetByProviderId(id) {
        try {
            const result = await UserEntity.findOne({ 'providers.id': id });
            return result;
        } catch (error) {
            console.log(CNAME, error.message);
            return {};
        }
    }
    async GetByProviderEmail(email) {
        try {
            const result = await UserEntity.findOne({ 'providers.email': email });
            return result;
        } catch (error) {
            console.log(CNAME, error.message);
            return {};
        }
    }
    async GetByEmail(email) {
        try {
            const result = await UserEntity.findOne({ email: email });
            return result;
        } catch (error) {
            console.log(CNAME, error.message);
            return null;
        }
    }
    async Add(user) {
        try {
            const _user = new UserEntity(user);
            const isExitEmail = await UserEntity.findOne({ email: user.email }).lean();
            //const isExitPhone = await UserEntity.findOne({ phone: user.phone }).lean();
            if (isExitEmail) {
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
