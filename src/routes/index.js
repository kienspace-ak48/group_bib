
const clientRoute = require('./client.routes');
const adminRoute = require('./admin.routes');
const apiEvent = require('./event.routes');
const testRoute = require('./test.routes');
const ggAuthRoute = require('./ggauth.route');
const authRoute = require('./auth.route');
const apiRoute = require('./api.routes.js')

function route(app){
    app.use('/gg', ggAuthRoute);
    app.use('/api/event', apiEvent);
    // login
    app.use('/auth/normal', authRoute);
    // 
    app.use(apiRoute);
    app.use('/admin', adminRoute);
    app.use('/test', testRoute)
    app.use('/', clientRoute);
    app.use((req, res, next)=>{
        res.render('404', {layout: false, title: 'Page notfound'})
    })
}

module.exports = route;