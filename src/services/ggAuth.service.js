const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET;
const UserService = require('./user.service');

exports.handleLogin = async (profile, providerName, res) => {
    let user = await UserService.GetByProviderId(profile.id);
    const email = profile.emails?.[0]?.value;
    console.log('running');
    if (!user) {
        // Tìm user bằng email trong field email của user, không phải providers.email
        user = await UserService.GetByEmail(email);
        if (user) {
            // Cập nhật providers
            user.providers.push({
                name: providerName,
                id: profile.id,
                email,
                avatar: profile.photos?.[0]?.value,
            });
            await user.save();
        } else {
            // Tạo user mới
            const addResult = await UserService.Add({
                fullname: profile.displayName,
                email,
                avatar: profile.photos?.[0]?.value,
                providers: [
                    {
                        name: providerName,
                        id: profile.id,
                        email,
                        avatar: profile.photos?.[0]?.value,
                    },
                ],
            });
            // UserService.Add() trả về số, cần query lại user vừa tạo
            if (addResult === 1) {
                user = await UserService.GetByEmail(email);
            } else {
                throw new Error('Failed to create user');
            }
        }
    }
    //tao JWT
    // const token = jwt.sign({ _id: user._id, username: user.fullname, email: user.email }, SECRET, {
    //     expiresIn: '30m',
    // });
    return { user };
};
