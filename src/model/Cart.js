const mongoose = require('mongoose')
const slugify = require('slugify')

const CartSchema = new mongoose.Schema({
    user_id: {type: mongoose.Schema.Types.ObjectId, ref: 'user'},
    isActive: Boolean,
    total: Number
}, {timestamps: true})


module.exports = mongoose.model('cart', CartSchema);