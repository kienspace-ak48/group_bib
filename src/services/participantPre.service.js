const ParticipantPre = require('../model/ParticipantPre');
const ParticipanPretEntity = require('../model/ParticipantPre');
const CNAME = 'participantPre.service.js ';
class ParticipantPreService {
    constructor(parameters) {
        console.log('Initial partipant.service.js ');
    }

    async GetAll(user_id, event_id, group_id) {
        try {
            const runners = await ParticipanPretEntity.find({ user_id, event_id, group_id }).lean();
            // console.log(typeof runners, runners);
            return { runners, count: runners.length };
        } catch (error) {
            console.log(CNAME, error.message);
            return { runners: [], count: 0 };
        }
    }
    async GetByEventIdAndGroup(eventId, groupId) {
        try {
            const pp = await ParticipanPretEntity.find({ event_id: eventId, group_id: groupId }).lean();
            return pp;
        } catch (error) {
            console.log(CNAME, error.message);
            return [];
        }
    }
    async GetByIdList(idList) {
        try {
            const result = await ParticipanPretEntity.find({
                _id: {$in: idList}
            });
            return result;
        } catch (error) {
            console.log(error.message);
            return [];
        }
    }
    async DeleteByIdList(idList){
        try {
            await ParticipantPre.deleteMany(
                {_id: {$in: idList}}
            )
            return true;
        } catch (error) {
            console.log(CNAME, error.message);
            return false;
        }
    }
    async GetById(user_id) {
        try {
            const runner = await ParticipanPretEntity.findOne({ _id: user_id }).lean();
            return runner;
        } catch (error) {
            console.log(CNAME, error.message);
            return {};
        }
    }
    async AddByRunner(data) {
        try {
            const result = await ParticipanPretEntity.insertMany(data);
            return { success: true, data: result };
        } catch (error) {
            console.log(CNAME, error.message);
            return { success: false };
        }
    }
    async Add(dataList, user_id, event_id, group_id) {
        try {
            await ParticipanPretEntity.deleteMany({ group_id, user_id, event_id });
            await ParticipanPretEntity.insertMany(dataList, { ordered: false });
            return true;
        } catch (error) {
            console.log(CNAME, error.message);
            return false;
        }
    }
    Update() {}
    Delete() {}
}
module.exports = new ParticipantPreService();
