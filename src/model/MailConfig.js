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
        /** @deprecated Không còn dùng trong template mới */
        end_mail_img: String,
        banner_option: { type: Boolean, default: false },
        /** Nội dung chân email (HTML-safe: xuống dòng → &lt;br&gt;) */
        footer_body: { type: String, default: '' },
        footer_email: { type: String },
        footer_hotline: { type: String },
        footer_company_vi: { type: String },
        footer_company_en: { type: String },
        footer_bg_color: { type: String },
        footer_text_color: { type: String },
        footer_link_color: { type: String },
        footer_border_color: { type: String },
        footer_show: { type: Boolean },
    },
    { timestamps: true },
);

module.exports = mongoose.model('mail_config', MailConfigSchema);
