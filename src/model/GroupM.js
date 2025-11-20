const mongoose = require('mongoose');
const slugify = require('slugify');

const GroupSchema = new mongoose.Schema(
    {
        event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'event' },
        captain_id: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
        group_name: { type: String, length: 100 },
        desc: String,
        zalo_link: { type: String, length: 200 },
        facebook_link: { type: String, length: 200 },
        hotline: { type: String, length: 15 },
        status: { type: String, default: 'pendding' },
        join_code: { type: String, length: 50 },
        total_member: Number,
        total_paid: Number,
        discount_percent: Number,
        bank_owner: { type: String, length: 50 },
        bank_name: { type: String, length: 50 },
        bank_number: { type: String, length: 50 },
        bank_transfer_code: { type: String },
        qr_image: String,
        leader_name: {type: String, length: 50},
        cccd: {type: String, length: 20},
        dob: Date,
        email: {type: String, length: 50},
        is_paid: {type: Boolean, default: 0},
        expiry_date: Date,
        expiry_time: {type: String, require}
    },
    { timestamps: true },
);

module.exports = mongoose.model('Group', GroupSchema);
