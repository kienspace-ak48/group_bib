const mongoose = require('mongoose');
const Counter = require('./Counter');
const slugify = require('slugify');

const OrderSchema = new mongoose.Schema({
    event_id: {type: mongoose.Schema.Types.ObjectId, ref: 'event'},
    group_id: {type: mongoose.Schema.Types.ObjectId, ref: 'group'},
    user_id: {type: mongoose.Schema.Types.ObjectId, ref: 'user'},
    amount: {type: Number, default: 0},// tong hoa don
    payment_method: {type: String, default: 'handle'},
    status: {type: Number, default: 0}, //0: unpaid - 1: paid 
    orderNo:{
        type: Number,
        unique: true
    },
    payment_ref: String,
    buyer_name: String,
    buyer_email: String,
    buyer_phone: String,
    confirm_at: Date, 
    verify_by: {type: mongoose.Schema.Types.ObjectId, ref: 'user'},
}, {timestamps: true})

OrderSchema.pre("save", async function(next){
    if(!this.isNew) return next();
    const counter = await Counter.findByIdAndUpdate(
        "order",
        {$inc: {seq: 1}},
        {new: true, upsert: true}
    );
    this.orderNo = counter.seq,
    this.payment_ref = `RUN${counter.seq}`;
    next();
})

module.exports = mongoose.model('Order', OrderSchema);