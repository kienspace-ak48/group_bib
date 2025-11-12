const express = require('express');
const router = express.Router();

const homeController = require('../areas/admin/controller/home.controller')();

router.get('/', homeController.Index);

module.exports = router;