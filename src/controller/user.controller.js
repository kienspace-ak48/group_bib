const CNAME = 'user.controller.js ';
const VNAME = 'pages/';
const VLAYOUT = 'layouts/main';
const GroupService = require('../services/group.service');
const UserService = require('../services/user.service');
const xlsx = require('xlsx');
const excelDateToJSDateUtil = require('../utils/excelDataToJSDate.util');
const EventService = require('../services/event.service');
const ParticipantService = require('../services/participant.service');
var userDTO = {
    fullname: 'Kien Vu',
    email: 'test@gmail.com',
    password: '123',
    phone: '19001900',
    role_id: 'root',
    username: 'Kien kute',
    avatar: 'img.jpg',
};
function validateRow(row) {
    const errors = [];

    if (!row.cccd || !/^\d+$/.test(row.cccd)) errors.push('cccd invalid');
    if (!row.fullname) errors.push('fullname missing');
    if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push('email invalid');
    if (!row.phone || !/^\+?\d{9,12}$/.test(row.phone)) errors.push('phone invalid');
    // if (!row['dob(mm/dd/yyyy)'] || isNaN(row['dob(mm/dd/yyyy)'])) errors.push("dob invalid");
    if (!row.bib_name) errors.push('bib_name missing');
    // if (!row.team) errors.push("team missing");
    // if (!['unpaid','paid'].includes(row.payment_status)) errors.push("payment_status invalid");
    return errors;
}
function convertRow(row, groupId, event_id, captain_id) {
    const dobExcel = row['dob(mm/dd/yyyy)'];
    const dob = new Date(Math.round((dobExcel - 25569) * 86400 * 1000)); // Excel serial → Date
    return {
        group_id: groupId,
        event_id: event_id,
        user_id: captain_id,
        cccd: row.cccd,
        fullname: row.fullname,
        distance: row.distance,
        tshirt_size: row.tshirt_size,
        bib_name: row.bib_name,
        email: row.email,
        phone: row.phone,
        dob: excelDateToJSDateUtil(dobExcel), // YYYY-MM-DD
        gender: row.gender === 'M' ? 1 : 0,
        nationality: row.nationality,
        nation: row.nation,
        city: row.city,
        patron_name: row.patron_name || null,
        patron_phone: row.patron_phone || null,
        team: row.team,
        blood: row.blood,
        medical: row.medical || null,
        medicine: row.medicine || null,
        payment_status: row.payment_status,
    };
}

const userController = () => {
    return {
        Index: async () => {},
        RegisterOrLogin: async () => {
            res.render(VNAME + '/login', { layout: VLAYOUT });
        },
        Register: async (req, res) => {
            try {
                const data = req.body;
                if (!data.fullname || !data.email || !data.phone || data.password)
                    return res.status(400).json({ success: false, mess: 'Pls fill in your information' });
                // const result = await UserService.Add(data);
                const result = false;
                console.log(typeof result);
                if (result === 0) {
                    return res.status(400).json({ success: false, mess: 'Exit' });
                }
                res.json({ success: true });
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, message: error.message });
            }
        },
        Login: async (req, res) => {
            try {
                const { username, password } = req.body;
                // handle login
                const result = await UserService.GetByCondition(username);

                if (!result) return res.json({ success: false, mess: 'ko co account nay' });
                const isMatch = result.password === password;
                if (!isMatch) return res.json({ success: false, mess: 'password wrong' });
                res.json(result);
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, mess: error.message });
            }
        },
        Profile: async (req, res) => {
            try {
                const user = req.user;
                res.render(VNAME + 'user/profile', { layout: VLAYOUT, user });
            } catch (error) {}
        },
        ChangePassword: async (req, res) => {
            try {
                res.render(VNAME + 'user/changePassword', { layout: VLAYOUT });
            } catch (error) {}
        },
        ProfileDocHistory: async (req, res) => {
            try {
                res.render(VNAME + 'user/profileDocHistory', { layout: VLAYOUT });
            } catch (error) {}
        },
        ProfileDocHistoryList: async (req, res) => {
            try {
                res.render(VNAME + 'user/profileDocHistoryList', { layout: VLAYOUT });
            } catch (error) {}
        },
        GroupManagement: async (req, res) => {
            try {
                //lay idUser tu viec login vao he thong
                const captainId = req.user._id;
                if(!captainId) return res.redirect('/login')
                // console.log('captainId: ',captainId);
                const groups = await GroupService.GetByCaption(captainId);
                res.render(VNAME + 'user/groupList', { layout: VLAYOUT, groups: groups || [] });
            } catch (error) {
                console.log(CNAME, error.message);
                res.render(VNAME + 'user/groupList', { layout: VLAYOUT, groups: [] });
            }
        },
        GroupDetail: async (req, res) => {
            try {
                const groupId = req.params.slug;
                console.log('groupId', groupId);
                const group = await GroupService.GetById(groupId);
                const event_id = group.event_id;
                const captain_id = group.captain_id;
                const runners =await ParticipantService.GetAll(captain_id, event_id, groupId);
                

                // console.log(typeof runners, runners)
                res.render(VNAME + 'user/groupDetail', { layout: VLAYOUT, group: group, runners: runners.runners||[], count: runners.count });
            } catch (error) {
                console.log(CNAME, error.message);
                res.render(VNAME + 'user/groupDetail', { layout: VLAYOUT, group: '', runners: [], count: 0 });
            }
        },
        GroupDetailImportExcel: async (req, res) => {
            const errors = [];
            const groupId = req.body.group;
            console.log('groupId', groupId);
            const group = await GroupService.GetById(groupId);
            const event_id = group.event_id;
            const captain_id = group.captain_id;

            console.log(group);
            try {
                if (!req.file) return res.status(400).send('chua co file');
                const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                //lat sheet theo ten
                const worksheet = workbook.Sheets[sheetName];
                const excelData = xlsx.utils.sheet_to_json(worksheet);
                const excelDataConvert = [];
                excelData.forEach((row, index) => {
                    const rowErrors = validateRow(row);
                    if (rowErrors.length > 0) {
                        errors.push({ row: index + 1, errors: rowErrors });
                    }
                    excelDataConvert.push(convertRow(row, groupId, event_id, captain_id));
                });
                const result = await ParticipantService.Add(excelDataConvert, captain_id, event_id, groupId);
                if (result) {
                }

                res.status(200).json({ success: true, excelData: excelDataConvert });
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false });
            }
        },
        GetRunnerById: async(req, res)=>{
            try {
                const runnerId = req.params.runner_id;
                if(!runnerId) return res.json({success: false, mess: 'param ko hop le'});
                const participant = await ParticipantService.GetById(runnerId);
                res.json({success: true, data: participant});
            } catch (error) {
                console.log(CNAME, error.message);
                return res.status(500).json({success: false, data: {}});
            }
        }
        // Group: async (req, res) => {
        //     try {
        //         res.render(VNAME + 'user/group', { layout: VLAYOUT });
        //     } catch (error) {}
        // },
    };
};

module.exports = userController;
