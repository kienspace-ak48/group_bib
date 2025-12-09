const express = require('express');
const app = express();
const expressEjsLayouts = require('express-ejs-layouts');
const swaggerUi = require('swagger-ui-express');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');
require('./middleware/passport.middleware');
// 
const MongoDBStore = require('connect-mongodb-session')(session);
// Tạo store MongoDB
const store = new MongoDBStore({
  uri: process.env.MONGO_URI,  // URL MongoDB
  collection: 'sessions'                  // Tên collection lưu session
});
//
const myPathConfig = require('./config/mypath.config');
const dbConnection = require('./config/dbConnection');
const routes = require('./routes/index');
const swaggerFile = require('./swagger/swagger-output.json');

//middleware
app.use(passport.initialize());
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extendedys: true }));
//static files
app.use(express.static(myPathConfig.public));
//template engine
app.set('view engine', 'ejs');
app.set('views', myPathConfig.root + '/src/views');
app.use(expressEjsLayouts);
app.set('layout', 'layouts/main');
//session
app.use(
    session({
        secret: 'secret-key',
        resave: false,
        store: store,
        saveUninitialized: false,
        cookie: {maxAge: 20*1000, httpOnly: true, secure: false, sameSite: 'lax'}
    }),
);
app.use(passport.initialize());
app.use(passport.session());

// connect DB
dbConnection();
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
routes(app);

// end

module.exports = app;
