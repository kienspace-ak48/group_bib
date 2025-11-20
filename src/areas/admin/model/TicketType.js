const mongoose = require('mongoose');
const slugify = require('slugify');

const TicketType = new mongoose.Schema({
    event_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Event'},
    name: {type: String, length: 200},
    desc: {type: String, length: 200},
    price: Number,
    register_start: Date,
    register_end: Date,
    quantity: Number
}, {timestamps: true});

module.exports = mongoose.model('ticket_type', TicketType);