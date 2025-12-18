const CNAME = 'order.service.js '
const OrderEntity = require('../model/Order');

class OrderService {
    constructor(parameters) {
        console.log('Initial order.service.js')
    }
    async Add(data){
        try {
            const order = new OrderEntity({
                user_id: data.user_id,
                event_id: data.event_id,
                group_id: data.group_id,
                amount: data.amount,
                buyer_name: data.buyer_name,
                buyer_email: data.buyer_email,
                buyer_phone: data.buyer_phone,
            });
            const result = await order.save();
            console.log('tra ve gi ', result)
            return {success: true, data: result};
        } catch (error) {
            console.log(CNAME, error.message);
            return {success: false};
        }
    }
    GetAll(){}
    GetById(){}
    Update(){}
    Delete(){}
}

module.exports = new OrderService();