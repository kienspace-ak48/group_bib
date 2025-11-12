const express = require('express');
const router = express.Router();
const eventApi = require('../api/event.controller')();


router.get(
  '/', 
  /* #swagger.tags = ['Events'] */
  /* #swagger.summary = 'Get all events' */
  eventApi.Index
);

router.get(
    '/:id',
    /* #swagger.tags = ['Events'] */
    /* #swagger.summary = 'Get events by id' */
    /* #swagger.parameters['id'] = {
        in: 'path',
        description: 'Event ID',
        required: true,
        schema: { type: 'integer' }
  } */

    eventApi.GetById
)
router.post(
  '/', 
  /* #swagger.tags = ['Events'] */
  /* #swagger.summary = 'Create a new event' */
  eventApi.Create
);


module.exports = router;
