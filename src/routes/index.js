
const clientRoute = require('./client.routes');
const adminRoute = require('./admin.routes');
const testRoute = require('./test.routes');
const authRoute = require('./auth.route');
const apiRoute = require('./api.routes.js');
const authMiddleware = require('../middleware/auth.middleware');
const toolCheckinRoute = require('./toolCheckin.routes');

function route(app){
    // login
    app.use('/auth/normal', authRoute);
    // 
    app.use(apiRoute);
    app.use('/admin', authMiddleware, adminRoute);
    app.use('/tool-checkin', authMiddleware, toolCheckinRoute);
    app.use('/test', testRoute)
    app.use('/', clientRoute);
    app.use((req, res, next)=>{
        res.render('404', {layout: false, title: 'Page notfound'})
    })
}

module.exports = route;