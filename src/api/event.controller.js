
// api-event.js
const EventService = require('../areas/admin/services/event.service');
const CNAME = 'event.controller.js ';
const eventDTO = {
    name: 'Hanoi Marathon 2025',
    slug: '',
    desc: 'Hanoi Marathon là giải chạy thường niên lớn nhất miền Bắc, thu hút hàng ngàn vận động viên trong và ngoài nước.',
    img_thumb: 'https://example.com/images/hanoi_marathon_thumb.jpg',
    img_banner: 'https://example.com/images/hanoi_marathon_banner.jpg',
    location: 'Hà Nội, Việt Nam',
    start_date: '2025-04-10T06:00:00.000Z',
    end_date: '2025-04-10T12:00:00.000Z',
    isShow: true,
    status: 'upcoming',
    race_type: 'marathon',
    organizer_name: 'Hanoi Sports Club',
    organizer_web: 'https://hanoisportsclub.vn',
    organizer_fanpage: 'https://facebook.com/hanoisportsclub',
    organizer_zalo: 'https://zalo.me/123456789',
};

const categories = ['Apple', 'Clother', 'Book', 'drink', 'food']
const apiEvent = ()=>{
    return{
        Index:async (req, res)=>{
            try {
                const result = await EventService.Get();
                res.json({success: true, data: result});
            } catch (error) {
                res.json({success: false, mess: error.message})
            }
        },
        GetById: async(req, res)=>{
            try {
                const id = req.params.id;
                console.log(id)
                const result = await EventService.GetById(id);
                res.json({success: true, data: result})
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({success: false, message: error.message})
            }
        },
        GetBySlug: async(req, res)=>{
            try {
            const slug = req.params.slug;
            if(!slug){
                return res.json({success: false, mess: 'slug is required'})
            }
            const result = await EventService.GetBySlug(slug);
            res.json({succes: true, data: result}) 
            } catch (error) {
                console.log(CNAME, error.message);
                return res.status(500).json({success: false, mess: error.message})
            }
        },
        Create: async(req, res)=>{
            try {
                const result = await EventService.Create(eventDTO);
            if(result){
                return res.json({success: true, mess: 'add success'})
            }
            } catch (error) {
                console.log(CNAME, error.message);
                return res.status(500).json({success: false, mess: error.message})
            }
           
        },
        Update: async(req, res)=>{
            try {
                const id = req.params.id;
                const data = req.body.data;
                const result = await EventService.Update(id, data);
                if(result){
                    return res.json({success: true, mess:'update success'})
                }else{
                    return res.json({success: false, mess:'update failed'})
                }
            } catch (error) {
                console.log(CNAME, error.message);
                return res.status(500).json({success: false, mess: error.message})
            }
        },
        Delete: async(req, res)=>{
            try {
                const id = req.params.id;
                const result = await EventService.Delete(id);
                if(!result){
                    return res.json({success: false, mess:'delete failed'})
                }else{
                    return res.json({success: true, mess:'delete success'})
                }
            } catch (error) {
                console.log(CNAME, error.message);
                return res.status(500).json({success: false, mess: error.message})
            }
        }
    }
}

module.exports = apiEvent;