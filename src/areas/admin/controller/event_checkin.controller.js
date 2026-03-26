const CNAME ="event_checkin.controller.js ";
const VNAME ="admin/event_checkin";
const EventCheckinController = ()=>{
    return {
        Index:async (req, res)=>{
            res.render(VNAME+"/index");
        }
    }
}

module.exports = EventCheckinController;