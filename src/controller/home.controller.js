// home.controller.js — trang chủ: PageSetting + sự kiện check-in công khai (is_show), không lộ dữ liệu nội bộ.
const PageSettingEntity = require('../model/PageSetting');
const eventCheckinHService = require('../areas/admin/services/eventCheckinH.service');

const VLAYOUT = 'layouts/main';

const homeController = () => {
    return {
        Index: async (req, res) => {
            try {
                const ps = await PageSettingEntity.findOne({ type: 'home_page' });
                const events = await eventCheckinHService.listPublicForHome();
                const eventMonths = eventCheckinHService.buildMonthFilterOptions(events);
                res.render('home', { layout: VLAYOUT, hp: ps || {}, events, eventMonths });
            } catch (error) {
                res.render('home', { layout: VLAYOUT, hp: {}, events: [], eventMonths: [] });
            }
        },

        /** GET /events — danh sách sự kiện check-in công khai (is_show), cùng dữ liệu an toàn như trang chủ */
        eventsPublic: async (req, res) => {
            try {
                const events = await eventCheckinHService.listPublicForHome();
                const eventMonths = eventCheckinHService.buildMonthFilterOptions(events);
                res.render('events_public', { layout: VLAYOUT, events, eventMonths });
            } catch (error) {
                res.render('events_public', { layout: VLAYOUT, events: [], eventMonths: [] });
            }
        },
    };
};

module.exports = homeController;
