const EventService = require('../services/event.service');
const stringValue = require('../../../config/stringvalue.config');
const CNAME = 'event.controller.js ';
const VLAYOUT = stringValue.adminLayout;
const VNAME = 'admin/event/';

const eventController = () => {
    return {
        Index: async (req, res) => {
            try {
                const events = await EventService.GetAll();
                res.render(VNAME + 'index', { layout: VLAYOUT, events });
            } catch (error) {
                console.log(CNAME, error.message);
                res.render(VNAME + 'index', { layout: VLAYOUT, events: [] });
            }
        },
        FormAdd: async (req, res) => {
            try {
                res.render(VNAME + 'form', { layout: VLAYOUT });
            } catch (error) {
                console.log(CNAME, error.message);
                res.render(VNAME + 'form', { layout: VLAYOUT });
            }
        },
        FormEdit: async (req, res) => {
            try {
                const slug = req.params.slug;
                console.log(slug)
                const event = await EventService.GetBySlug(slug);
                res.render(VNAME + 'formEdit', { layout: VLAYOUT, event:event||{}});
            } catch (error) {
                console.log(CNAME, error.message);
                res.render(VNAME + 'formEdit', { layout: VLAYOUT, event: {} });
            }
        },
        AddEvent: async (req, res) => {
            try {
                const data = req.body;
                console.log(data);
                const eventDTO = {
                    name: data.name,
                    desc: data.description,
                    img_banner: data.img_banner,
                    img_thumb: data.img_thumb,
                    race_type: data.race_type,
                    location: data.location,
                    isShow: data.is_show,
                    start_date: data.start_date,
                    end_date: data.end_date,
                    status: data.status,
                    organizer_name: data.organizer_name,
                    organizer_web: data.organizer_web,
                    organizer_fanpage: data.organizer_fanpage,
                    organizer_zalo: data.organizer_zalo,
                };
                const result = await EventService.Create(eventDTO);
                if (!result) return res.json({ success: true, mess: 'add failed' });
                return res.json({ success: true });
            } catch (error) {
                console.log(CNAME, error.message);
                return res.json({ success: false, mess: error.message });
            }
        },
        UpdateEvent: async(req, res)=>{
            try {
                console.log('A')
                const slug = req.params.slug;
                console.log(slug);
                const data = req.body;
                const eventDTO = {
                    name: data.name,
                    // slug: data.slug,
                    desc: data.description,
                    img_banner: data.img_banner,
                    img_thumb: data.img_thumb,
                    race_type: data.race_type,
                    location: data.location,
                    isShow: data.is_show,
                    start_date: data.start_date,
                    end_date: data.end_date,
                    status: data.status,
                    organizer_name: data.organizer_name,
                    organizer_web: data.organizer_web,
                    organizer_fanpage: data.organizer_fanpage,
                    organizer_zalo: data.organizer_zalo,
                };
                // console.log(eventDTO);
                const result = await EventService.UpdateBySlug(slug,eventDTO);
                if(!result) return res.json({success: false, mess: 'update failed'})
                return res.json({success: true, redirect: '/admin/event'})
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({success: false, mess: error.message});
            }
        },
        DeleteEvent: async (req, res) => {
            try {
                const id = req.params.id;
                const result = await EventService.Delete(id);
                if (!result) {
                    return res.json({ success: false });
                }
                res.json({ success: true });
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, mess: error.message });
            }
        },
    };
};

module.exports = eventController;
