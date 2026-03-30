const express = require('express');
const router = express.Router();
const clientHomeController =require('../controller/home.controller')();






router.get('/', clientHomeController.Index);

module.exports = router;
