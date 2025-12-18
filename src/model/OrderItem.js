const mongoose = require('mongoose');
const slugify  = require('slugify');

const OrderItem = new mongoose.Schema({
    order_id: {type: mongoose.Schema.Types.ObjectId, ref: 'order'},
    ticket_id: {type: mongoose.Schema.Types.ObjectId, ref: 'ticket_type'},
    price: Number, // gia tung mon 
    qty: Number
}, {timestamps: true});

module.exports = mongoose.model('order_item', OrderItem);