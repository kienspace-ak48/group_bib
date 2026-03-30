// home.controller.js — trang chủ: chỉ dùng PageSetting; danh sách sự kiện legacy (model Event) đã gỡ.
const PageSettingEntity = require('../model/PageSetting');

const VLAYOUT = 'layouts/main';

const homeController = () => {
    return {
        Index: async (req, res) => {
            try {
                const ps = await PageSettingEntity.findOne({ type: 'home_page' });
                res.render('home', { layout: VLAYOUT, hp: ps || {}, events: [], eventMonths: [] });
            } catch (error) {
                res.render('home', { layout: VLAYOUT, hp: {}, events: [], eventMonths: [] });
            }
        },
    };
};

module.exports = homeController;
