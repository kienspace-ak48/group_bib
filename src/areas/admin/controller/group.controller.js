const CNAME = 'group.controller.js ';
const VNAME = 'admin/group/';
const VLAYOUT = 'layouts/adminLayout';
const EventService = require('../../../services/event.service');
const GroupService = require('../../../services/group.service');

const groupController = () => {
    return {
        Index: async (req, res) => {
            res.render(VNAME + 'index', { layout: VLAYOUT });
        },
        GetAllEvent: async (req, res) => {
            try {
                const events = await EventService.GetAll();
                return res.render(VNAME + 'index', { layout: VLAYOUT, events: events });
            } catch (error) {
                console.log(CNAME, error.message);
                res.render(VNAME + 'index', { layout: VLAYOUT, events: [] });
            }
        },
        GroupList: async(req, res)=>{
            try {
                const groups = await GroupService.GetAll();
                return 
            } catch (error) {
                
            }
        }
        // GetAllEvent: async(req, res)=>{
        //     try {
        //         const events = EventService.GetAll();
        //         res.render(VNAME+'registerTeamLeader', {layout: VLAYOUT})
        //     } catch (error) {
        //         console.log(CNAME+error.message)
        //         res.render(VNAME+'registerTeamLeader', {layout: VLAYOUT})

        //     }
        // }
    };
};

module.exports = groupController;
