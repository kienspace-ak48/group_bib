const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { handleLogin } = require('../services/ggAuth.service');
console.log('env? ',process.env.NODE_ENV)
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL:
                process.env.NODE_ENV === 'production'
                    ? 'https://kienvu.id.vn/gg/auth/google/callback'
                    : 'http://localhost:8080/gg/auth/google/callback',
        },
        async function (accessToken, refreshToken, profile, done) {
            console.log('ggStrategy run')
            console.log(accessToken, refreshToken)
            // Tại đây bạn kiểm tra user trong DB
            // Nếu chưa có -> tạo user -> done(null, newUser)
            // Nếu có -> done(null, user)
            //====> passport luu uẻ vao bien req.user
            try {
                const { user } = await handleLogin(profile, 'google');
                return done(null, user);
            } catch (error) {
                return done(error, null);
            }
        },
    ),
);

// Serialize user vào session (lưu toàn bộ user object vì dùng JWT, không cần query lại)
passport.serializeUser((user, done) => {
    done(null, user);
});

// Deserialize user từ session
passport.deserializeUser((obj, done) => {
    done(null, obj);
});
