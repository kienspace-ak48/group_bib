const ParticipantEntity = require('../model/Participant');
const CNAME = 'participant service ';
class ParticipantService {
    constructor(parameters) {
        console.log('Initial partipant.service.js ');
    }

    async GetAll(user_id, event_id, group_id) {
        try {
            const runners = await ParticipantEntity.find({user_id, event_id, group_id}).lean();
            // console.log(typeof runners, runners);
            return {runners, count: runners.length};
        } catch (error) {
            console.log(CNAME, error.message);
            return {runners: [], count: 0};
        }
    }
    
    async GetById(user_id){
        try {
            const runner = await ParticipantEntity.findOne({_id: user_id}).lean();
            return runner;
        } catch (error) {
            console.log(CNAME, error.message);
            return {};
        }
    }
    async AddByRunner(data){
        try {
            const result =await ParticipantEntity.insertMany(data);
            return {success: true, data: result}
        } catch (error) {
            console.log(CNAME, error.message);
            return {success: false}
        }
    }
    async Add(dataList, user_id, event_id, group_id) {
        try {
            await ParticipantEntity.deleteMany({ group_id, user_id, event_id });
            await ParticipantEntity.insertMany(dataList, { ordered: false });
            return true;
        } catch (error) {
            console.log(CNAME, error.message);
            return false;
        }
    }
    Update() {}
    Delete() {}
}
module.exports = new ParticipantService();
