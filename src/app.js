const express = require('express');
const app = express();
const expressEjsLayouts = require('express-ejs-layouts');
const swaggerUi = require('swagger-ui-express');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');
require('./middleware/passport.middleware');
// const momo = require('./utils/momo');
const aixos = require('axios');
//
const MongoDBStore = require('connect-mongodb-session')(session);
// Tạo store MongoDB
const store = new MongoDBStore({
    uri: process.env.MONGO_URI, // URL MongoDB
    collection: 'sessions', // Tên collection lưu session
});
//
const myPathConfig = require('./config/mypath.config');
const dbConnection = require('./config/dbConnection');
const routes = require('./routes/index');
const swaggerFile = require('./swagger/swagger-output.json');

//middleware
app.use(passport.initialize());
app.use(express.json()); //Chỉ dùng để parse body JSON của request POST/PUT/PATCH.
app.use(cookieParser());
app.use(express.urlencoded({ extendedys: true })); //Chỉ parse body của form POST gửi lên dạng Content-Type: application/x-www-form-urlencoded
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
        cookie: { maxAge: 20 * 1000, httpOnly: true, secure: false, sameSite: 'lax' },
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

app.get('/payment', async (req, res) => {
    // momo
    //https://developers.momo.vn/#/docs/en/aiov2/?id=payment-method
    //parameters
    var accessKey = 'F8BBA842ECF85';
    var secretKey = 'K951B6PE1waDMi640xX08PD3vg6EkVlz';
    var orderInfo = 'Kien gui ly tra sữa';
    var partnerCode = 'MOMO';
    var redirectUrl = 'https://webhook.site/b3088a6a-2d17-4f8d-a383-71389a6c600b';
    var ipnUrl = 'https://webhook.site/b3088a6a-2d17-4f8d-a383-71389a6c600b';
    var requestType = 'payWithMethod';
    var amount = '100000';
    var orderId = partnerCode + new Date().getTime();
    var requestId = orderId;
    var extraData = '';
    var paymentCode =
        'T8Qii53fAXyUftPV3m9ysyRhEanUs9KlOPfHgpMR0ON50U10Bh+vZdpJU7VY4z+Z2y77fJHkoDc69scwwzLuW5MzeUKTwPo3ZMaB29imm6YulqnWfTkgzqRaion+EuD7FN9wZ4aXE1+mRt0gHsU193y+yxtRgpmY7SDMU9hCKoQtYyHsfFR5FUAOAKMdw2fzQqpToei3rnaYvZuYaxolprm9+/+WIETnPUDlxCYOiw7vPeaaYQQH0BF0TxyU3zu36ODx980rJvPAgtJzH1gUrlxcSS1HQeQ9ZaVM1eOK/jl8KJm6ijOwErHGbgf/hVymUQG65rHU2MWz9U8QUjvDWA==';
    var orderGroupId = '';
    var autoCapture = true;
    var lang = 'vi';
    //before sign HMAC SHA256 with format
    //accessKey=$accessKey&amount=$amount&extraData=$extraData&ipnUrl=$ipnUrl&orderId=$orderId&orderInfo=$orderInfo&partnerCode=$partnerCode&redirectUrl=$redirectUrl&requestId=$requestId&requestType=$requestType
    var rawSignature =
        'accessKey=' +
        accessKey +
        '&amount=' +
        amount +
        '&extraData=' +
        extraData +
        '&ipnUrl=' +
        ipnUrl +
        '&orderId=' +
        orderId +
        '&orderInfo=' +
        orderInfo +
        '&partnerCode=' +
        partnerCode +
        '&redirectUrl=' +
        redirectUrl +
        '&requestId=' +
        requestId +
        '&requestType=' +
        requestType;
    //puts raw signature
    console.log('--------------------RAW SIGNATURE----------------');
    console.log(rawSignature);
    //signature
    const crypto = require('crypto');
    const axios = require('axios');
    var signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');
    console.log('--------------------SIGNATURE----------------');
    console.log(signature);

    //json object send to MoMo endpoint
    const requestBody = JSON.stringify({
        partnerCode: partnerCode,
        partnerName: 'Test',
        storeId: 'MomoTestStore',
        requestId: requestId,
        amount: amount,
        orderId: orderId,
        orderInfo: orderInfo,
        redirectUrl: redirectUrl,
        ipnUrl: ipnUrl,
        lang: lang,
        requestType: requestType,
        autoCapture: autoCapture,
        extraData: extraData,
        orderGroupId: orderGroupId,
        signature: signature,
    });
    //default
    const options = {
        method: 'POST',
        url: 'https://test-payment.momo.vn/v2/gateway/api/create',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody),
        },
        data: requestBody,
    };
    let result;
    try {
        result = await axios(options);
        return res.status(200).json(result.data);
    } catch (error) {
        return res.status(500).json({ success: false, mess: 'Err' });
    }
});

// end
routes(app);

module.exports = app;
