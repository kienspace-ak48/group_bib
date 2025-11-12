const EventEntity = require('../model/event');
const CNAME = 'event.service.js ';
const eventDTO = {
    name: 'Hanoi Marathon 2025',
    slug: 'mot-ngay-dep-troi',
    desc: 'Hanoi Marathon là giải chạy thường niên lớn nhất miền Bắc, thu hút hàng ngàn vận động viên trong và ngoài nước.',
    img_thumb: 'https://example.com/images/hanoi_marathon_thumb.jpg',
    img_banner: 'https://example.com/images/hanoi_marathon_banner.jpg',
    location: 'Hà Nội, Việt Nam',
    start_date: '2025-04-10T06:00:00.000Z',
    end_date: '2025-04-10T12:00:00.000Z',
    isShow: true,
    status: 'upcoming',
    race_type: 'marathon',
    organizer_name: 'Hanoi Sports Club',
    organizer_web: 'https://hanoisportsclub.vn',
    organizer_fanpage: 'https://facebook.com/hanoisportsclub',
    organizer_zalo: 'https://zalo.me/123456789',
};

class EventService {
    constructor(parameters) {
        console.log('Initail event.service.js');
    }
    Get() {}
    GetById() {}
    async Create(data) {
        try {
            const e = new EventEntity(eventDTO);
            await e.save();
            return true;
        } catch (error) {
            console.log(CNAME, error.message);
            return false;
        }
    }
    Update() {}
    Delete() {}
}

module.exports = new EventService(); //export instance singleton
