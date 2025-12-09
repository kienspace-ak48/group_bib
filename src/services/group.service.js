// group.service.js
const CNAME = 'group.service.js ';
const GroupEntity = require('../model/GroupM');
const EventService = require('../areas/admin/services/event.service')

class GroupService {
    constructor() {
        console.log('Initial group.service.js');
    }
    async GetAll() {
        const result = await GroupEntity.find({});
    }

    async GetByEventId(slug){
        try {
            const event = await EventService.GetBySlug(slug);
            const eventID = event._id;
            if(event){
                const result = await GroupEntity.find({event_id: eventID}).select('-__v').lean();
                return result;
            }
            return [];
        } catch (error) {
            console.log(CNAME, error.message);
            return [];
        }
    }
    async GetByCaption(catainId){
        try {
            const result = await GroupEntity.find({captain_id: catainId}).lean();
            console.log(typeof result);
            return result;
        } catch (error) {
            console.log(CNAME, error.message);
            return [];
        }
    }
    // async GetByCaptainAndGroup(captainId, groupId){
    //     try {
            
    //     } catch (error) {
            
    //     }
    // }
    async GetById(id) {
        try {
            const result = await GroupEntity.findOne({_id: id}).lean();
            console.log(typeof result);
            return result;
        } catch (error) {
            console.log(CNAME, error.message);
            return [];
        }
    }
    async Add(group) {
        try {
            const _event = await EventService.GetBySlug(group.event_id);
            const _eventId = _event._id;
            console.log('---');
            console.log(_eventId)
            console.log('Data check', _eventId);
            const _group = new GroupEntity({
                group_name: group.group_name,
                facebook_link: group.facebook_link,
                zalo_link: group.zalo_link,
                discount_percent: group.discount_percent,
                bank_owner: group.bank_owner,
                bank_name: group.bank_name,
                bank_number: group.bank_number,
                bank_transfer_code: group.bank_transfer_code,
                event_id: _eventId,
                captain_id: group.captain_id,
                qr_image: group.qr_image,
                hotline: group.phone,
                cccd: group.cccd,
                dob: new Date(group.dob),
                email: group.email,
                expiry_date: group.expiry_date,
                expiry_time: group.expiry_time,
                leader_name: group.leader_name
            });
            await _group.save();
            return true;
        } catch (error) {
            console.log(CNAME, error.message);
            return false;
        }
    }
    Update() {}
    Delete() {}
}

module.exports = new GroupService();
