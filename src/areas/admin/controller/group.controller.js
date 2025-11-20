const CNAME = 'group.controller.js ';
const VNAME = 'admin/group/';
const VLAYOUT = 'layouts/adminLayout'
const groupController = () => {
    return {
        Index: async (req, res) => {
            res.render(VNAME+'index', {layout: VLAYOUT });
        },
    };
};

module.exports = groupController;
