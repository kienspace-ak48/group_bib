// areas/ home.controller.js
const stringValue = require('../../../config/stringvalue.config');
const VNAME = 'admin/home/';
const VLAYOUT = 'layouts/adminLayout';

const homeController = ()=>{
    return {
        Index: (req, res)=>{
            // res.json({success: true, mess: 'from admin controller',})
            res.render(VNAME+'index', {layout: VLAYOUT, title: 'admin dashboard'})
        }
    }
}

module.exports = homeController;