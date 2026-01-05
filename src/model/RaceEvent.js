const mongoose = require('mongoose');
const slugify = require('slugify');

const RaceEventSchema = new mongoose.Schema({
    id_feibot: String,
    name: String,
    date_time: Date,
    distances: []
}, {timestamps: true})

module.exports = mongoose.model('race_event', RaceEventSchema);