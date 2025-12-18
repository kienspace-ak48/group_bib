const mongoose = require('mongoose');
const slugify = rquire('slugify');

const CartItemSchema = new mongoose.Schema({
    cart_id: {type: mongoose.Schema.Types.ObjectId, ref: 'cart'},
    ticket_id: {type: mongoose.Schema.Types.ObjectId, ref: 'ticket_type'},
    qty: Number,
    price: Number
}, {timestamps: true})

module.exports = mongoose.model("cart_item", CartItemSchema);