const CNAME ="group.service.js ";
const GroupEntity= require('../../../model/GroupM');
const EventEntity = require('../../../model/Event');

class GroupService {
    constructor(){
        console.log('Initial group.service.js')
    };
    GetAll(){}
    async  GetsBySlug(slug){
        try {
            const eventId = await EventEntity.findOne({slug: slug});
            // console.log('data type: ', typeof eventId);
            if(!eventId) return {};
            const groups = await GroupEntity.find({event_id: eventId._id});
            return groups;
        } catch (error) {
            console.log(CNAME, error.message);
            return {};
        }
    }
    GetBySlug(){}
    GetById(){}
    Create(){}
    Update(){}
    Delete(){}
}
module.exports =new GroupService();//export kieu sigleton 