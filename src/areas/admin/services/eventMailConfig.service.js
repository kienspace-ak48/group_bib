const mongoose = require('mongoose');
const MailConfig = require('../../../model/MailConfig');

const CNAME = 'eventMailConfig.service.js ';

class EventMailConfigService {
    async findByEventId(eventId) {
        try {
            const sid = String(eventId);
            let doc = await MailConfig.findOne({ event_id: sid }).lean();
            if (!doc && mongoose.Types.ObjectId.isValid(sid)) {
                doc = await MailConfig.findOne({ event_id: new mongoose.Types.ObjectId(sid) }).lean();
            }
            return doc;
        } catch (e) {
            console.log(CNAME, e.message);
            return null;
        }
    }

    /**
     * Lưu cấu hình mail (sender, tiêu đề, nội dung, footer, banner path đã có sẵn).
     */
    async upsert(eventId, data) {
        try {
            const eid = String(eventId);
            const set = {};
            const copy = (k, fn = (v) => v) => {
                if (data[k] !== undefined) set[k] = fn(data[k]);
            };
            copy('sender_name');
            copy('title');
            copy('content_1');
            copy('content_2');
            copy('banner_text');
            copy('banner_img');
            copy('end_mail_img');
            copy('banner_option', (v) => !!v);
            copy('footer_email');
            copy('footer_hotline');
            copy('footer_company_vi');
            copy('footer_company_en');
            copy('footer_bg_color');
            copy('footer_text_color');
            copy('footer_link_color');
            copy('footer_border_color');
            if (data.footer_show !== undefined) set.footer_show = !!data.footer_show;

            if (Object.keys(set).length === 0) {
                return await MailConfig.findOne({ event_id: eid }).lean();
            }

            const doc = await MailConfig.findOneAndUpdate(
                { event_id: eid },
                { $set: set, $setOnInsert: { event_id: eid } },
                { upsert: true, new: true },
            ).lean();
            return doc;
        } catch (e) {
            console.log(CNAME, e.message);
            return null;
        }
    }

    async setBannerImg(eventId, publicPath) {
        try {
            const eid = String(eventId);
            return await MailConfig.findOneAndUpdate(
                { event_id: eid },
                { $set: { banner_img: publicPath }, $setOnInsert: { event_id: eid } },
                { upsert: true, new: true },
            ).lean();
        } catch (e) {
            console.log(CNAME, e.message);
            return null;
        }
    }

    async setEndMailImg(eventId, publicPath) {
        try {
            const eid = String(eventId);
            return await MailConfig.findOneAndUpdate(
                { event_id: eid },
                { $set: { end_mail_img: publicPath }, $setOnInsert: { event_id: eid } },
                { upsert: true, new: true },
            ).lean();
        } catch (e) {
            console.log(CNAME, e.message);
            return null;
        }
    }
}

module.exports = new EventMailConfigService();
