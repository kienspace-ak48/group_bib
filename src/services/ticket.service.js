const CNAME = 'ticket.service.js ';
const TicketEntity = require('../areas/admin/model/TicketType');
const eventService = require('./event.service');

class TicketService {
    constructor(parameters) {
        console.log('Initial Ticket service');
    }
    async GetAll() {
        try {
            const tickets = await TicketEntity.find().lean();
            return tickets;
        } catch (error) {
            console.log(CNAME, error.message);
            return []
        }
    }
    async GetById(id) {
        try {
            const ticket = await TicketEntity.findById(id);
            console.log(typeof ticket, ticket)
            return ticket;
        } catch (error) {
            console.log(CNAME, error.message);
            return {};
        }
    }
    async GetByEventSlug(slug) {
        try {
            const event = await eventService.GetBySlug(slug);
            if(!event) return [];
            const tickets = await TicketEntity.find({event_id: event._id});
            return tickets;
        } catch (error) {
            console.log(CNAME, error.message)
            return [];
        }
    }
    async GetsByEventId(id){
        try {
            const tickets = await TicketEntity.find({event_id: id}).lean();
            return tickets;
        } catch (error) {
            console.log(CNAME, error.message);
            return [];
        }
    }
    Update() {}
    Delete() {}
}


module.exports = new TicketService();