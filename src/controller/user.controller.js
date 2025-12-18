const CNAME = 'user.controller.js ';
const VNAME = 'pages/';
const VLAYOUT = 'layouts/main';
const GroupService = require('../services/group.service');
const UserService = require('../services/user.service');
const xlsx = require('xlsx');
const excelDateToJSDateUtil = require('../utils/excelDataToJSDate.util');
const EventService = require('../services/event.service');
const ParticipantService = require('../services/participant.service');
const { getAllNational, getProvince } = require('../api/nation');
const TicketService = require('../services/ticket.service');
const OrderService = require('../services/order.service');
const orderItemService = require('../services/orderItem.service');
const participantService = require('../services/participant.service');
const participantPreService = require('../services/participantPre.service');
const User = require('../model/User');
const { sendOtpMail } = require('../services/mail.service');
const jwt = require('jsonwebtoken');
const { sendMailDomain } = require('../services/mailDomain.service');
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
// function getAllCountries() {
//   return wc.map(c => {
//     const code = c.cca2;
//     const callingCode = cd[code]?.countryCallingCodes?.[0] || "";

//     return {
//       code,
//       name: c.name.common,
//       nationality: c.demonyms?.eng?.m || "",
//       flag: c.flags?.svg || "",
//       callingCode,
//       continent: c.region || ""
//     };
//   });
// }

const userController = () => {
    return {
        Index: async () => {},
        RegisterOrLogin: async () => {
            res.render(VNAME + '/login', { layout: VLAYOUT });
        },
        //
        ReSendCode: async(req, res)=>{
            // console.log('aaa',req.body)
            const {email}  = req.body;
            try {
                const exist = await User.findOne({
                    email: email,
                    is_verified: false
                })
                const random = Math.random();
                console.log("random: ", random)
                if(!exist) return res.status(400).json({success: false, mess:' Email ont exist'});
                const OTP = Math.floor(10000+random*900000).toString();
                exist.code =OTP;
                exist.verify_expires_at= new Date();
                await sendOtpMail(email, OTP);
                await sendMailDomain(email, OTP);
                await exist.save();
                
                res.json({success: false, mess: 'Check hom thuw'})
            } catch (error) {
                console.log(CNAME, error.message)
                res.json({success: false, mess: error.message|| 'Server error'});
                
            }
        },
        // ajax
        Register: async (req, res) => {
            try {
                const data = req.body;
                // console.log(data);
                if (!data.fullname || !data.email || !data.phone || !data.password) {
                    return res.status(400).json({ success: false, mess: 'Pls fill in your information' });
                }
                // const result = await UserService.Add(data);
                const exist = await User.findOne({ email: data.email });
                if (exist) return res.status(400).json({ success: false, mess: 'Email existed' });
                const OTP = Math.floor(100000 + Math.random() * 900000).toString();
                const user = new User({
                    fullname: data.fullname,
                    email: data.email,
                    phone: data.phone,
                    password: data.password,
                    code: OTP,
                    verify_expires_at: new Date()

                });
                await user.save();
                await sendOtpMail(user.email, OTP);
                await sendMailDomain(user.email, OTP);
                console.log(OTP); //cmt som
                res.json({ success: true, redirect: `/user/email-verify` });
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, mess: error.message });
            }
        },
        Login: async (req, res) => {
            try {
                const { l_username, l_password } = req.body;
                // handle login
                if (!l_username || !l_password)
                    return res.render(VNAME+'/login', {layout: false, err: 'Enter username and password'});
                const result = await UserService.GetByConditionEmailOrName(l_username);

                if (!result) return res.render(VNAME+'/login', {layout: false, err: 'Account not exist'});
                if(!result.is_verified)  return res.render(VNAME+'/login', {layout: false, err: 'Account not verified!'});
                const isMatch =await result.comparePassword(l_password);
                if (!isMatch) return res.render(VNAME+'/login', {layout: false, err: 'user or password wrong'});
                //cap token cho client
                const token = jwt.sign(
                    {
                        _id: result._id,
                        email: result.email,
                        user: result.avatar,
                        name: result.fullname,
                    },
                    process.env.JWT_SECRET,
                    {
                        expiresIn: '30m',
                    },
                );
                res.cookie('token', token, {
                    httpOnly: true,
                    secure: false, // true nếu dùng HTTPS
                    sameSite: 'lax', // 'lax' cho phép cookie được gửi trong redirect từ external domain
                    maxAge: 30 * 60 * 1000,
                });
                res.redirect('/user/profile');
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, mess: error.message });
            }
        },
        FormEmailVerify: async (req, res) => {
            res.render(VNAME + 'emailVerified', { layout: false });
        },
        EmailVerify: async (req, res) => {
            try {
                const now = new Date();
                const { email, code } = req.body;
                if (!email || !code) {
                    return res.status(400).json({
                        success: false,
                        mess: 'Missing email or OTP',
                        verify_expires_at: now,
                    });
                }
                const user = await User.findOne({
                    email: email,
                    code: code,

                });
                if (!user) {
                    return res.status(400).json({
                        success: false,
                        mess: 'Invalid OTP',
                    });
                }
                const diffMinutes = (now - user.verify_expires_at)/(1000*60);
                //cau hinh 2p
                console.log('time now ',diffMinutes)
                if(diffMinutes>1){
                    res.status(500).json({ success: false, mess: 'Code expiried' });
                    return 
                }
                user.code = null;
                user.is_verified = true;
                await user.save();
                res.status(200).json({ success: true });
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, mess: 'Server error' });
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
                if (!captainId) return res.redirect('/login');
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
                const runners = await ParticipantService.GetAll(captain_id, event_id, groupId);

                // console.log(typeof runners, runners)
                res.render(VNAME + 'user/groupDetail', {
                    layout: VLAYOUT,
                    group: group,
                    runners: runners.runners || [],
                    count: runners.count,
                });
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
        GetRunnerById: async (req, res) => {
            try {
                const runnerId = req.params.runner_id;
                if (!runnerId) return res.json({ success: false, mess: 'param ko hop le' });
                const participant = await ParticipantService.GetById(runnerId);
                res.json({ success: true, data: participant });
            } catch (error) {
                console.log(CNAME, error.message);
                return res.status(500).json({ success: false, data: {} });
            }
        },
        Checkout: async (req, res) => {
            const _countries = getAllNational();
            const _provinces = getProvince();
            const slug = req.params.slug;
            let groupView = [];
            try {
                const data = req.query.cart;
                const carts = JSON.parse(data);
                const group = await GroupService.GetListByEventSlug(slug);
                group.forEach((g, i) => {
                    groupView.push({ id: g._id, name: g.group_name });
                });
                console.log('group log', group);
                let cartView = [];
                carts.forEach((v, i) => {
                    cartView.push({ id: v._id, qty: v.qty, name: v.name, price: v.price });
                });
                const _countries = getAllNational();
                const _provinces = getProvince();
                console.log(cartView);
                res.render(VNAME + 'user/checkout', {
                    layout: VLAYOUT,
                    slug,
                    provinces: _provinces,
                    countries: _countries,
                    carts: cartView || [],
                    groups: groupView,
                });
            } catch (error) {
                res.render(VNAME + 'user/checkout', {
                    layout: VLAYOUT,
                    slug,
                    provinces: _provinces,
                    countries: _countries,
                    carts: [],
                    groups: [],
                });
            }

            // const data =JSON.parse(req.body.cart);
            // Lưu session
            // req.session.cart = data;
            // res.redirect(`/user/event-detail/${slug}/payment`)
        },
        Payment: async (req, res) => {
            let total = 0;
            try {
                const data = req.body;
                console.log(data);
                const event_slug = req.params.slug;
                const group_id = data.buyer.group_id;
                const user_id = req.user._id;
                const cartClient = data.buyer.cart.filter((item) => item.qty > 0);
                //  1.lay event +ticket
                const event = await EventService.GetBySlug(event_slug);
                // console.log('eventId', event._id);
                const tickets = await TicketService.GetByEventSlug(event_slug);
                // console.log('tickets', tickets);
                const isValid = cartClient.every((item) => tickets.some((t) => t._id.toString() === item.id));
                if (!isValid) {
                    return res.json({ success: false, mess: 'data bib ko hop le' });
                }
                // 2. tinh tong
                total = cartClient.reduce((sum, item) => {
                    const ticket = tickets.find((t) => t._id.toString() === item.id);
                    return sum + ticket.price * item.qty;
                }, 0);
                const orderDTO = {
                    event_id: event._id,
                    user_id: user_id,
                    group_id: group_id,
                    amount: total,
                    buyer_name: data.buyer_name,
                    buyer_email: data.buyer_email,
                    buyer_phone: data.buyer_phone,
                };
                console.log('total: ', total);
                // 3. tao Order
                const result = await OrderService.Add(orderDTO);
                // let orderItemDTO = [];
                if (!result.success) {
                    return res.json({ success: false, mess: 'Tao order that bai' });
                }
                const orderId = result.data._id;
                //4. tao mang Order Item
                const orderItemDTO = cartClient.map((item) => ({
                    order_id: orderId,
                    ticket_id: item.id,
                    price: item.price,
                    qty: item.qty,
                }));
                // console.log('orderItemDTO to insert:', JSON.stringify(orderItemDTO, null, 2));
                const oiResult = await orderItemService.Add(orderItemDTO);
                //
                if (!oiResult.success) {
                    return res.json({ success: false, mess: 'Tao order item that bai' });
                }

                const createOrderItems = oiResult.data; //<- list order items co _id
                //b5 tao paricipant
                let index = 0;
                const dataRunner = data.runner.map((d) => ({
                    ...d,
                    event_id: event._id,
                    group_id: group_id,
                }));
                console.log('data runner', data.runner);
                const pResult = await participantPreService.AddByRunner(dataRunner);
                console.log('pResult ', pResult);
                if (pResult.success) {
                }

                // for(const item of createOrderItems){
                // for(let i =0; i<item.qty; i++){

                // }
                // }
                // console.log('hop le ko', isValid)

                // console.log(req.user)
                // console.log(user_id)
                res.json({ success: true, data });
            } catch (error) {
                console.log(CNAME, error.message);
            }
        },
        testGetAllCountry: (req, res) => {
            // res.json(getAllCountries())
            res.json(countries);
        },
        OrderPre: async (req, res) => {
            // const eventSlug = req.params.slug;
            // const groupId = req.params.groupId;
            const groupId = req.params.id;
            if (!groupId) return res.render(VNAME + 'user/orderPre', { layout: VLAYOUT, group: null, pp: [] });
            const group = await GroupService.GetById(groupId);
            if (!group) return res.render(VNAME + 'user/orderPre', { layout: VLAYOUT, group: null, pp: [] });
            try {
                // console.log('co chay dc vao day ko ');
                // console.log(group._id, groupId)
                // if(!group) return res.render(CNAME+'user/orderPre', {layout: VLAYOUT});
                const pp = await participantPreService.GetByEventIdAndGroup(group.event_id, groupId);

                res.render(VNAME + 'user/orderPre', { layout: VLAYOUT, group: group, pp: pp || [] });
            } catch (error) {
                console.log(CNAME, error.message);
                res.render(VNAME + 'user/orderPre', { layout: VLAYOUT, group: null, pp: [] });
            }
        },
        AddMember: async (req, res) => {
            const slug = req.params.slug;
            const dataId = req.body.ids;
            // const user = req.user;
            let _usertId = req.user._id;
            console.log(_usertId);
            // console.log('1 ',dataId)
            if (!slug) return res.json({ success: false, data: 'no slug' });
            try {
                // const data = req.body;
                // console.log(data);
                const pp = await participantPreService.GetByIdList(dataId);
                if (!pp) {
                    console.log('runner add failed ');
                    return res.json({ success: false, mess: 'process failed' });
                }
                // const {..._id} =pp;
                const deleteParticipant = await participantPreService.DeleteByIdList(dataId);
                if (!deleteParticipant) return res.status(500).json({ success: false, mess: 'process failed' });
                const cleanData = pp.map((item) => {
                    const { _id, ...rest } = item.toObject ? item.toObject() : item;
                    return {
                        user_id: _usertId,
                        ...rest,
                    };
                });
                const p = await participantService.AddByRunner(cleanData);
                console.log(pp);
                res.json({ success: true, data: dataId });
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, message: 'add failed' });
            }
        },
        // PaymentCheckout: async(req, res)=>{
        //     try {
        //         const slug = req.params.slug;
        //         const cart = req.session.cart;
        //         if(!cart) return res.redirect(`/user/event-detail/${slug}/payment`)
        //         console.log('cart ',cart)
        //         res.render(VNAME + 'user/payment', { layout: VLAYOUT });
        //     } catch (error) {
        //         console.log(CNAME, error.message);
        //         res.render(VNAME + 'user/payment', { layout: VLAYOUT });
        //     }
        // }

        // Group: async (req, res) => {
        //     try {
        //         res.render(VNAME + 'user/group', { layout: VLAYOUT });
        //     } catch (error) {}
        // },
    };
};

module.exports = userController;
