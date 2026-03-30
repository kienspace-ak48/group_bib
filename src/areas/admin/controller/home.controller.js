const CNAME = "home.controller.js ";
const VLAYOUT = "layouts/adminLayout2";
const VNAME = "admin/home";
const adminHomeController = ()=>{
    return {
        Index: async(req, res)=>{
            res.render(VNAME+'/index', {layout: VLAYOUT});
        }
    }
}
module.exports = adminHomeController;