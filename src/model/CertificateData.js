const mongoose = require('mongoose');
const slugify = require('slugify');

const CertificateDataSchema = new mongoose.Schema({
    contest_ref: {type: mongoose.Schema.Types.ObjectId, ref: 'CertificatePosition', require: true },
    name: {type: String, required: true},
    field_1: {type: String},
    field_2: {type: String},
    field_3: {type: String},
    field_4: {type: String},
    field_5: {type: String},
    field_6: {type: String},
    field_7: {type: String},
    field_8: {type: String},
    field_9: {type: String},
    field_10: {type: String},
    field_11: {type: String},

}, {timestamps: true});

module.exports = mongoose.model('CertificateData', CertificateDataSchema);
