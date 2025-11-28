const CNAME = 'groupbib.controller.js ';
const VLAYOUT = 'layouts/main';
const GroupService = require('../services/group.service');

const groupBibController = () => {
    return {
        RegisterGroupBib: async (req, res) => {
            const slug = req.params.slug;
            console.log(slug);
            res.render('pages/registerTeamLeader', { layout: VLAYOUT, slug: slug||'' });
        },
        Index: (req, res) => {
            res.render('pages/groupBib', { layout: VLAYOUT });
        },
        AddGroup: async (req, res) => {
            try {
                const data = req.body;
                const slug = data.slug_hidden;
                console.log(slug);
                var groupDTO = {
                    facebook_link: data.facebook_link,
                    zalo_link: data.zalo_link,
                    discount_percent: Number.parseInt(data.discount_percent),
                    bank_owner: data.bank_account_name,
                    bank_name: data.bank_name,
                    bank_number: data.bank_account_number,
                    bank_transfer_code: data.bank_transfer_fix,
                    event_id: slug, //69143093e41d85097255e609
                    captain_id: '691bfb852a70dc358b2792f0',
                    qr_image: 'qr_code.png',
                    leader_name: data.leader_name,
                    hotline: data.leader_phone,
                    cccd: data.leader_identity,
                    dob: data.leader_dob,
                    email: data.leader_email,
                    expiry_date: data.expiry_date,
                    expiry_time: data.expiry_time,
                    group_name: data.group_name
                };
                console.log(data);
                const result = await GroupService.Add(groupDTO);
                // result = true
                if (!result) return res.json({ success: false, mess: 'Add new failed' });
                res.json({ success: true });
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, mess: error.message });
            }
        },
    };
};

module.exports = groupBibController;
