const mongoose = require('mongoose');
const slugify = require('slugify');

const RunnerSchema = new mongoose.Schema({
    id: String,
    name: String,
    gender: String,
    bib: String,
    epc: String,
    item_id: String,
    total_score: String,
    net_score: String,
    start_time: String,
    item_total_ranking: Number,
    item_name: String,
    cp1: String,
    cp2: String,
    cp3: String,
    cp4: String,
    cp5: String,
    cp6: String,
    cp7: String,
    cp8: String,
    cp9: String,
    finish_time: String,
    pace: String,
    cp1_cp2: String,
    cp2_cp3: String,
    cp3_cp4: String,
    cp4_cp5: String,
    cp5_cp6: String,
    cp6_cp7: String,
    cp7_cp8: String,
    cp8_cp9: String,
});

module.exports = mongoose.model('runner', RunnerSchema);