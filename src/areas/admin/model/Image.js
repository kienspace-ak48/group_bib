const mongoose = require('mongoose');
const slugify = require('slugify');

const ImageSchema = new mongoose.Schema(
    {
        name: {type: String},
        path: { type: String },
    },
    { timestamps: true },
);
module.exports = mongoose.model('image', ImageSchema);