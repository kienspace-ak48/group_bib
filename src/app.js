const express = require('express');
const app = express();
/** Sau nginx / reverse proxy: Express dùng X-Forwarded-For cho `req.ip`. Tắt: TRUST_PROXY=0 */
(function configureTrustProxy() {
    const tp = process.env.TRUST_PROXY;
    if (tp === '0' || tp === 'false') {
        app.set('trust proxy', false);
    } else if (tp != null && String(tp).trim() !== '') {
        const n = parseInt(tp, 10);
        app.set('trust proxy', Number.isFinite(n) && n >= 0 ? n : true);
    } else {
        app.set('trust proxy', 1);
    }
})();
const expressEjsLayouts = require('express-ejs-layouts');
const swaggerUi = require('swagger-ui-express');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');
require('./middleware/passport.middleware');
const aixos = require('axios');
//
const MongoDBStore = require('connect-mongodb-session')(session);
const { getMongoUri } = require('./config/mongoEnv');
const mongoUri = getMongoUri();
if (!mongoUri) {
    console.error(
        'Thiếu MONGO_URI hoặc MONGODB_URI trong .env — cần thiết cho session store và mongoose.',
    );
    process.exit(1);
}
// Tạo store MongoDB
const store = new MongoDBStore({
    uri: mongoUri,
    collection: 'sessions', // Tên collection lưu session
});
//
const myPathConfig = require('./config/mypath.config');
const authConfig = require('./config/auth.config');
const mongoose = require('mongoose');
const dbConnection = require('./config/dbConnection');
const { formatDateTimeVn } = require('./utils/formatDateTimeVn.util');
const routes = require('./routes/index');
const swaggerFile = require('./swagger/swagger-output.json');

//middleware
app.use(passport.initialize());
app.use(express.json()); //Chỉ dùng để parse body JSON của request POST/PUT/PATCH.
app.use(cookieParser());
app.use(express.urlencoded({ extended: true })); //Chỉ parse body của form POST gửi lên dạng Content-Type: application/x-www-form-urlencoded
//static files
app.use(express.static(myPathConfig.public));
//template engine
app.set('view engine', 'ejs');
app.set('views', myPathConfig.root + '/src/views');
app.use(expressEjsLayouts);
app.set('layout', 'layouts/main');
app.locals.ADMIN_LOGIN_URL = authConfig.ADMIN_LOGIN_URL;
app.locals.ADMIN_LOGOUT_URL = authConfig.ADMIN_LOGOUT_URL;
/** Dùng trong EJS (audit, login history, …) — giờ VN, không phụ thuộc TZ server */
app.locals.formatDateTimeVn = formatDateTimeVn;
/** Cookie session: trước đây 20*1000 = 20 giây → phiên mất rất nhanh (kể cả AUDIT_UNLOCK_TTL). */
const sessionMaxAgeMs = (() => {
    const raw = process.env.SESSION_MAX_AGE_MS;
    if (raw != null && String(raw).trim() !== '') {
        const n = parseInt(raw, 10);
        if (Number.isFinite(n) && n >= 60000) return n;
    }
    return 24 * 60 * 60 * 1000;
})();

//session
app.use(
    session({
        secret: 'secret-key',
        resave: false,
        store: store,
        saveUninitialized: false,
        rolling: true,
        cookie: { maxAge: sessionMaxAgeMs, httpOnly: true, secure: false, sameSite: 'lax' },
    }),
);
app.use(passport.initialize());
app.use(passport.session());

// connect DB
dbConnection();
function startMailBulkWorkerSafe() {
    try {
        const { startMailBulkWorker } = require('./workers/mailBulk.worker');
        startMailBulkWorker();
    } catch (e) {
        console.error('Mail bulk worker failed to start', e);
    }
}
if (mongoose.connection.readyState === 1) {
    startMailBulkWorkerSafe();
} else {
    mongoose.connection.once('connected', startMailBulkWorkerSafe);
}
// --- Cấu hình Swagger ---
// const swaggerDocument= JSON.parse(fs.readFileSync('./src/swagger.json', 'utf-8'));
// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
// --- Cấu hình Swagger ---
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));

// Area test
app.get('/test', (req, res) => {
    // res.json({ success: true, status: 'OK', mess: 'hello world' });
    res.render('index', { title: 'Home Page', layout: 'layouts/main' });
});

app.get('/layout', (req, res)=>{
    res.render('layouts/adminLayout2', { layout: false });
})
// end
routes(app);

module.exports = app;
