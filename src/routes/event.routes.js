const express = require('express');
const router = express.Router();
const eventApi = require('../api/event.controller')();


router.get(
    '/',
    /* #swagger.tags = ['Events'] */
    /* #swagger.summary = 'Get all events' */
    eventApi.Index,
);

router.get(
    '/slug/:slug',
    /* #swagger.tags = ['Events'] */
    /* #swagger.summary = 'Get events by slug' */

    eventApi.GetBySlug,
);
router.get(
  '/id/:id',
  /* #swagger.tags =['Events'] */
  /* #swagger.summary = 'Get event by id */
  eventApi.GetById
)
router.post(
    '/',
    /* #swagger.tags = ['Events'] */
    /* #swagger.summary = 'Create a new event' */
    eventApi.Create,
);
router.put(
    '/:id',
    /* #swagger.tags = ['Events'] */
    /* #swagger.summary = 'Update an event' */
    /* #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              data: {
                type: "object",
                description: "Object dữ liệu update (các field tuỳ ý)",
                
              }
            },
            required: ["id", "data"]
          }
        }
      }
} */

    eventApi.Update,
);
router.delete(
  '/:id',
  /* #swagger.tags = ['Events'] */
  /* #swagger.summary = 'Delete an event' */
  eventApi.Delete,
)

module.exports = router;
