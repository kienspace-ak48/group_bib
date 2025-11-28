// home.controller.js
const CNAME = "home.controller.js ";
const EventService = require('../services/event.service');
const GroupService = require('../services/group.service');

const VLAYOUT = 'layouts/main';

const homeController = () => {
    return {
        Index: async(req, res) => {
            const events =await EventService.GetAll();
            // console.log(events)
            res.render('index', {title: 'Home Page', layout: 'layouts/main', events});
        },
        EventDetail: async(req, res)=>{
            const slug = req.params.slug;
            const event = await EventService.GetBySlug(slug);
            console.log(event);
            console.log('slug: ',slug)
            res.render('pages/eventDetail', {layout: VLAYOUT, event, slug});
        },
        GroupBib: async(req, res)=>{
            try {
                const eventId = req.params.slug;
                const result = await GroupService.GetByEventId(eventId);
                console.log(result);
                res.render('pages/groupBib', {layout: VLAYOUT, groups: result||[], slug: eventId||''});
            } catch (error) {
                console.log(CNAME, error.message);
                res.render('pages/groupBib', {layout: VLAYOUT, groups: [], slug: ''});
            }
        },
        // RegisterGroupBib: async(req, res)=>{
        //     res.render('pages/registerTeamLeader', {layout: VLAYOUT})
        // },
        Login: async(req, res)=>{
            res.render('pages/login', {layout: false});
        },

        
    };
};

module.exports = homeController; //export function static
