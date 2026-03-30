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
        /** Ảnh hiển thị phía trên footer (cuối nội dung chính), đường dẫn public e.g. /email_img/... */
        end_mail_img: String,
        banner_option: { type: Boolean, default: false },
        //new
         // Thêm các trường cho footer
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
