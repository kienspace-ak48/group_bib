const CNAME = 'orderItem.service.js ';
const OrderItem = require('../model/OrderItem');
class OrderService {
    constructor(parameters) {
        console.log('Initial order.service.js');
    }
    GetAll(){}
    GetbyId(){}
    async Add(datas){
        try {
            const result = await OrderItem.insertMany(datas);
            console.log('insert orderItem co gi', result)
            return {success: true, data: result}
        } catch (error) {
            console.log(CNAME, error.message);
            return {success: false}
        }
    }
    Update(){}
    Delete(){}
}

module.exports = new OrderService();