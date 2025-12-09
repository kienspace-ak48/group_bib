// ticket.controller.js
const CNAME = 'ticket.controller.js ';
const VNAME = 'admin/ticket/';
const VLAYOUT = 'layouts/adminLayout';
const eventService = require('../services/event.service');
const ticketService = require('../services/ticket.service');
const TicketService = require('../services/ticket.service');
const a = {
    name: '5KM-GBib',
    desc: 'Ve nay re nha',
    price: 175,
    quantity: 400,
    event_id: '69143093e41d85097255e609',
};
const ticketController = () => {
    return {
        Index: async (req, res) => {},
        FormAdd: async (req, res) => {
            try {
                const result = await ticketService.GetAll();
                const events = await eventService.GetAllEventForCreateTicketDropdown();
                // console.log(events);
                res.render(VNAME + 'formAdd', { layout: VLAYOUT, tickets: result, events:events||[] });
            } catch (error) {
                console.log(CNAME, error.message);
                res.render(VNAME + 'formAdd', { layout: VLAYOUT, tickets: [], events: [] });
            }
        },
        Create: async (req, res) => {
            try {
                const dc = req.body;

                const ticketDTO = {
                    name: dc.name,
                    desc: dc.desc,
                    price: dc.price,
                    quantity: dc.quantity,
                    event_id: dc.event_id,
                    register_start: dc.start,
                    register_end: dc.end,
                };
                console.log(ticketDTO);
                const result = await TicketService.Add(ticketDTO);
                if (!result) return res.json({ success: false });

                res.json({ success: true });
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, mess: error.message });
            }
        },
    };
};

module.exports = ticketController;
