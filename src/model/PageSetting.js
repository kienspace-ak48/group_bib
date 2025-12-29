const mongoose = require('mongoose')
const slugify = require('slugify')

const PageSetting = new mongoose.Schema({
    type: {type: String},

},{strict: false})

module.exports = mongoose.model('page_setting', PageSetting)