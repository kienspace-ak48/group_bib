// home.controller.js
const CNAME = 'home.controller.js ';
const EventService = require('../services/event.service');
const GroupService = require('../services/group.service');
const participantPreService = require('../services/participantPre.service');
const TicketService = require('../services/ticket.service');

const VLAYOUT = 'layouts/main';

const homeController = () => {
    return {
        Index: async (req, res) => {
            const events = await EventService.GetAll();
            // console.log(events)
            res.render('index', { title: 'Home Page', layout: 'layouts/main', events });
        },
        EventDetail: async (req, res) => {
            try {
                const slug = req.params.slug;
                const event = await EventService.GetBySlug(slug);
                const ticket_types = await TicketService.GetByEventId(event);
                // console.log(ticket_types)
                res.render('pages/eventDetail', { layout: VLAYOUT, event, slug, tickets: ticket_types||[] });
            } catch (error) {
                console.log(CNAME, error.message);
                res.render('pages/eventDetail', { layout: VLAYOUT, event: '', slug: '', tickets: []});
            }
        },
        GroupBib: async (req, res) => {
            try {
                const eventId = req.params.slug;
                const result = await GroupService.GetByEventId(eventId);
                res.render('pages/groupBib', { layout: VLAYOUT, groups: result || [], slug: eventId || '' });
            } catch (error) {
                console.log(CNAME, error.message);
                res.render('pages/groupBib', { layout: VLAYOUT, groups: [], slug: '' });
            }
        },
        ParticipantPre: async(req, res)=>{
            const eventSlug = req.params.event_slug;
            const groupId = req.params.group_id;
            try {
                const event =await EventService.GetBySlug(eventSlug);
                console.log('event co gi ',event)
                if(!event) return res.render(CNAME+'user/orderPre', {layout: VLAYOUT});
                const pp = await participantPreService.GetByEventIdAndGroup(event._id,groupId);
                console.log('pp co gi ', pp)
                res.render('pages/orderPre', {layout: VLAYOUT, pp:pp||[]})
            } catch (error) {
                console.log(CNAME, error.message);
                res.render('pages/orderPre', {layout: VLAYOUT, pp:[]})
            }
        },
        // RegisterGroupBib: async(req, res)=>{
        //     res.render('pages/registerTeamLeader', {layout: VLAYOUT})
        // },
        Login: async (req, res) => {
            res.render('pages/login', { layout: false });
        },
    };
};

module.exports = homeController; //export function static
