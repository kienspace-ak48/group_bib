const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { handleLogin } = require('../services/ggAuth.service');

const hasGoogleOAuth = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

if (hasGoogleOAuth) {
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
                try {
                    const { user } = await handleLogin(profile, 'google');
                    return done(null, user);
                } catch (error) {
                    return done(error, null);
                }
            },
        ),
    );
} else {
    console.warn('[passport] GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET chưa cấu hình — bỏ qua Google OAuth.');
}

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});
