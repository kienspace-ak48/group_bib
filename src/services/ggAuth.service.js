const jwt = require('jsonwebtoken');

/**
 * Đăng nhập Google OAuth — không còn phụ thuộc model User legacy; lưu profile vào session/passport.
 */
exports.handleLogin = async (profile, providerName) => {
    const email = profile.emails?.[0]?.value;
    const user = {
        _id: profile.id,
        fullname: profile.displayName,
        email,
        avatar: profile.photos?.[0]?.value,
        provider: providerName,
        providerId: profile.id,
    };
    return { user };
};
