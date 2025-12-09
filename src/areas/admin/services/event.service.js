const EventEntity = require('../model/EventM');
const CNAME = 'event.service.js ';

class EventService {
    constructor(parameters) {
        console.log('Initail event.service.js');
    }
    async GetAll() {
        try {
            const result = await EventEntity.find({}).select('-__v').lean();
            return result;
        } catch (error) {
            console.log(CNAME, error.message);
            return [];
        }
    }
    async GetById(id) {
        try {
            const result = await EventEntity.findById(id).lean();
            return result;
        } catch (error) {
            console.log(CNAME, error.message);
            return {};
        }
    }
    async GetBySlug(slug) {
        try {
            const result = await EventEntity.findOne({ slug: slug }).lean();
            return result;
        } catch (error) {
            console.log(CNAME, error.message);
            return {};
        }
    }
    async Create(event) {
        try {
            const e = new EventEntity(event);
            await e.save();
            return true;
        } catch (error) {
            console.log(CNAME, error.message);
            return false;
        }
    }
    async Update(id, data) {
        try {
            const result = await EventEntity.findOneAndUpdate({ _id: id }, { $set: data }, { new: true })
                .select('-_id -__v')
                .lean();
            console.log(result);
            return true;
        } catch (error) {
            console.log(CNAME, error.message);
            return false;
        }
    }
    async UpdateBySlug(slug, data) {
        try {
            const result = await EventEntity.findOneAndUpdate({ slug: slug }, { $set: data }, { new: true })
                .select('-_id -__v')
                .lean();
            console.log(result);
            return true;
        } catch (error) {
            console.log(CNAME, error.message);
            return false;
        }
    }
    async Delete(id) {
        try {
            const result = await EventEntity.deleteOne({ _id: id }).lean();
            console.log(result);
            return true;
        } catch (error) {
            console.log(CNAME, error.message);
            return false;
        }
    }
    async GetAllEventForCreateTicketDropdown(){
        try {
            const events = await EventEntity.find().select('name id start_date end_date').lean();
            return events
        } catch (error) {
            console.log(CNAME, error.message);
            return [];
        }
    }
}

module.exports = new EventService(); //export instance singleton
