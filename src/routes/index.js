
const clientRoute = require('./client.routes');
const adminRoute = require('./admin.routes');
const testRoute = require('./test.routes');
const authRoute = require('./auth.route');
const apiRoute = require('./api.routes.js');
const authMiddleware = require('../middleware/auth.middleware');
const toolCheckinRoute = require('./toolCheckin.routes');
const delegatePublicRoutes = require('./delegatePublic.routes');
const athleteQrPublicRoutes = require('./athleteQrPublic.routes');

function route(app){
    // login
    app.use('/auth/normal', authRoute);
    // SendGrid Event Webhook (không session / không admin)
    app.use('/webhooks', require('./webhooks.routes'));
    //
    app.use(apiRoute);
    app.use(athleteQrPublicRoutes);
    app.use('/admin', authMiddleware, adminRoute);
    app.use(delegatePublicRoutes);
    app.use('/tool-checkin', authMiddleware, toolCheckinRoute);
    app.use('/test', testRoute)
    app.use('/', clientRoute);
    app.use((req, res, next)=>{
        res.render('404', {layout: false, title: 'Page notfound'})
    })
}

module.exports = route;