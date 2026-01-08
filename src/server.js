const http = require('http');
const https = require('https');
const HTTPS_PORT = 8443;
require('dotenv').config();
const fs = require('fs')
const app = require('./app');
const HOST ='0.0.0.0';
console.log(process.env.NODE_ENV)
const success = require('../src/middleware/success.middleware')()
success.Test();
// Initial double server setup for HTTP and HTTPS 🚀
// HTTP Server 🔵
const httpServer = http.createServer(app);
httpServer.listen(process.env.HTTP_PORT, HOST, ()=>{
    console.log(`HTTP Server is running on: http://localhost:${process.env.HTTP_PORT}`)
});
// cmt khi push code
const options={
    key: fs.readFileSync('./certificates/key.pem'),
    cert: fs.readFileSync('./certificates/cert.pem')
}
// HTTPS server 8443
const httpsServer = https.createServer(options,app);
httpsServer.listen(HTTPS_PORT, HOST, ()=>{
    console.log(`HTTPS server is running on: https://localhost:${HTTPS_PORT} `)
});


