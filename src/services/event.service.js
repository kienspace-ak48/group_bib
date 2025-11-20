const EventEntity = require('../areas/admin/model/Event');
const CNAME = 'event.service.js ';

class EventService {
    constructor(parameters) {
        console.log('Initail event.service.js');
    }
    async GetAll() {
        try {
            const result = await EventEntity.find({}).select('-_id -__v').lean();
            return result;
        } catch (error) {
            console.log(CNAME, error.message);
            return [];
        }
    }
    async GetBySlug(slug) {
        try {
            const result = await EventEntity.findOne({ slug: slug }).select('-_id').lean();
            return result;
        } catch (error) {
            console.log(CNAME, error.message);
            return {};
        }
    }
    GetById() {}
    async Create(data) {
        try {
            const e = new EventEntity(eventDTO);
            await e.save();
            return true;
        } catch (error) {
            console.log(CNAME, error.message);
            return false;
        }
    }
    Update() {}
    Delete() {}
}

module.exports = new EventService(); //export instance singleton
