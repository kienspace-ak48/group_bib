const CNAME = 'participantCheckin.service.js '
const ParticipantCheckinEntity = require('../../../model/ParticipantCheckin.js');
const EventService = require('../../../services/event.service');
class ParticipantCheckin {
    constructor(parameters) {
        console.log('Initial participantCheckin.service')
    }
    Get(){}
    GetAll(){}
    async GetById(id){
        try {
            const result = await ParticipantCheckinEntity.findOne({_id: id});
            if(!result) return {};
            return result;
        } catch (error) {
            console.log(CNAME, error.message);
            return {}
        }
    }
    GetBySlug(){}
    async Add(_pc, slug){
        try {
            //dung destructuring 
            // const {_id, ...dataWithoutId} = _pc;
            // console.log('before ', _pc);
            // console.log('after ',dataWithoutId);
            const pc = new ParticipantCheckinEntity(_pc);
            await pc.save();
            return true;
        } catch (error) {
            console.log(CNAME+error.message);
            return false;
        }
    }
    async Update(_pc, _id){
        try {
            const result = await ParticipantCheckinEntity.findOneAndUpdate(
                {_id: _id},
                {$set: _pc},
                {new: true} //tra ve doc sau khi update
            );
            return true;
        } catch (error) {
            console.log(CNAME, error.message);
            return false;
        }
    }
    async Delete(id){
        try {
            const result = await ParticipantCheckinEntity.deleteOne({_id: id});
            return true;
        } catch (error) {
            console.log(CNAME, error.message);
            return false;
        }
    }
}

module.exports = new ParticipantCheckin(); // export instance