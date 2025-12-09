const mongoose = require('mongoose');
const slugify= require('slugify');

const ParticipantSchema = new mongoose.Schema({
    group_id: {type: mongoose.Schema.Types.ObjectId, ref: 'group'},
    user_id: {type: mongoose.Schema.Types.ObjectId, ref: 'user'},
    event_id: {type: mongoose.Schema.Types.ObjectId, ref: 'event'},
    ticket_type_id: {type: mongoose.Schema.Types.ObjectId, ref: 'ticket_type'},
    fullname: {type: String, require},
    cccd: {type: String, require},
    distance: String,
    tshirt_size: String,
    bib_name: String,
    email: String,
    phone: String,
    dob: Date,
    gender: Boolean,
    nationlity: String,
    nation: String,
    city: String,
    patron_name: String,
    patron_phone: String,
    team: String,
    blood: String,
    medical: String,
    medicine: String,
    payment_status: String
}, {timestamps: true});


module.exports = mongoose.model('participant', ParticipantSchema)