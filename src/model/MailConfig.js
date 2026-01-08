const mongoose = require('mongoose');
const slugify = require('slugify');

const MailConfigSchema = new mongoose.Schema(
    {
        event_id: String,
        sender_name: String,
        title: String,
        content_1: String,
        content_2: String,
        banner_text: String,
        banner_img: String,
        banner_option: { type: Boolean, default: false },
    },
    { timestamps: true },
);

module.exports = mongoose.model('mail_config', MailConfigSchema);
