/**
 * Đường dẫn auth admin — mount auth route tại `app.use('/auth/normal', authRoute)`
 * => login: GET/POST `/auth/normal/admin/login`
 */
const AUTH_PREFIX = process.env.AUTH_ADMIN_PREFIX || '/auth/normal';
const ADMIN_LOGIN_PATH = `${AUTH_PREFIX}/admin/login`;
const ADMIN_LOGIN_URL = process.env.ADMIN_LOGIN_URL || ADMIN_LOGIN_PATH;
const ADMIN_LOGOUT_PATH = `${AUTH_PREFIX}/admin/logout`;
const ADMIN_LOGOUT_URL = process.env.ADMIN_LOGOUT_URL || ADMIN_LOGOUT_PATH;

module.exports = {
    AUTH_PREFIX,
    ADMIN_LOGIN_PATH,
    ADMIN_LOGIN_URL,
    ADMIN_LOGOUT_PATH,
    ADMIN_LOGOUT_URL,
};
