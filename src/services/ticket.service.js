const CNAME = 'ticket.service.js ';
const TicketEntity = require('../areas/admin/model/TicketType');

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
    async GetBySlug() {}
    async GetByEventId(id){
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