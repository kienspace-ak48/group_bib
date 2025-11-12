
// api-event.js
const EventService = require('../areas/admin/services/event.service');
const CANAME = 'event.controller.js ';

const categories = ['Apple', 'Clother', 'Book', 'drink', 'food']
const apiEvent = ()=>{
    return{
        Index: (req, res)=>{
            const result = categories;
            res.json({success: 'ok', data: result})
        },
        GetById: async(req, res)=>{
            console.log(req.params?.id);
            const id = req.params.id||0;
            const result = categories[id];
            res.json({succes: 'oke', data: result})
        },
        Create: async(req, res)=>{
            try {
                const result = await EventService.Create();
            if(result){
                return res.json({success: true, mess: 'add success'})
            }
            } catch (error) {
                console.log(CANAME, error.message);
                return res.status(500).json({success: false, mess: error.message})
            }
           
        }
    }
}

module.exports = apiEvent;