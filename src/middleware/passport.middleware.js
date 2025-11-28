const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { handleLogin } = require('../services/ggAuth.service');

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: 'http://localhost:8080/gg/auth/google/callback',
        },
        async function (accessToken, refreshToken, profile, done) {
            // Tại đây bạn kiểm tra user trong DB
            // Nếu chưa có -> tạo user -> done(null, newUser)
            // Nếu có -> done(null, user)
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
