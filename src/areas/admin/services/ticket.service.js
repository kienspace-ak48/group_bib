// ticket.service.js 
const CNAME ="ticket.service.js ";
const ticketEntity = require('../model/TicketType');

class TicketService {
    constructor() {
        console.log('Initial ticket.service.js');
    }
    GetAll(){
        try {
            const tickets = ticketEntity.find({}).lean();
            return tickets
        } catch (error) {
            console.log(CNAME, error.message);
            return [];
        }
    }
    GetById(){}
    GetBySlug(){}
    async Add(data){
        try {
            const _ticket = new ticketEntity(data);
            await _ticket.save();
            return true
        } catch (error) {
            console.log(CNAME, error.message);
            return falsel;
        }
    }
    Update(){}
    Delete(){}
}

module.exports = new TicketService();