
const clientRoute = require('./client.routes');
const adminRoute = require('./admin.routes');
const apiEvent = require('./event.routes');
const testRoute = require('./test.routes');

function route(app){
    app.use('/api/event', apiEvent);
    // app.use(apiRoute);
    app.use('/admin', adminRoute);
    app.use('/test', testRoute)
    app.use('/', clientRoute);
    app.use((req, res, next)=>{
        res.render('404', {layout: false, title: 'Page notfound'})
    })
}

module.exports = route;