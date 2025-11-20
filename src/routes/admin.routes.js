const express = require('express');
const router = express.Router();

const uploadImageMiddleware = require('../middleware/uploadImage.middleware');
const homeController = require('../areas/admin/controller/home.controller')();
const eventController = require('../areas/admin/controller/event.controller')();
const imageController = require('../areas/admin/controller/image.controller')();
const ticketController = require('../areas/admin/controller/ticket.controller')();
const groupController = require('../areas/admin/controller/group.controller')();
// group
router.get('/group', groupController.Index);
// router.get('/', homeController.Index);
router.get('/event/form', eventController.FormAdd);
router.post('/event/form', eventController.AddEvent);
router.get('/event/form-edit/:slug', eventController.FormEdit);
router.put('/event/form-edit/:slug', eventController.UpdateEvent);
router.delete('/event/:id', eventController.DeleteEvent);
router.get('/event', eventController.Index);
// image
router.get('/image/delete/:name', imageController.Delete);
router.post('/image', uploadImageMiddleware.single('file'), imageController.Upload);
router.get('/image', imageController.Index);
// ticket
router.get('/ticket/form-add', ticketController.FormAdd);
router.post('/ticket/create', ticketController.Create);

// index
router.get('/', homeController.Index);
module.exports = router;
