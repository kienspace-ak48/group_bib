const EventService = require('../services/event.service');
const stringValue = require('../../../config/stringvalue.config');
const CNAME = 'event.controller.js ';
const VLAYOUT = stringValue.adminLayout;
const VNAME = 'admin/event/';
const xlsx = require('xlsx');
const crypto = require('crypto');
const sgMail = require('@sendgrid/mail');
const QRCode = require('qrcode');
const myPathConfig = require('../../../config/mypath.config');
const fs = require('fs');

sgMail.setApiKey(process.env.SENDGRID_API_KEY_DOMAIN);

const excelDateToJSDateUti = require('../../../utils/excelDataToJSDate.util');
const Participant = require('../../../model/Participant');
const ParticipantService = require('../../../services/participant.service');
const GroupService = require('../services/group.service');
// const ParticipantEntity = require('../../../model/ParticipantCheckin');
const ParticipantCheckin = require('../../../model/ParticipantCheckin');
const eventService = require('../services/event.service');
const participantCheckinService = require('../services/participantCheckin.service');
const MailConfig = require('../../../model/MailConfig');

//function helper
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
const formatDate = (date) => {
    return new Date(date).toLocaleDateString('vi-VN');
};
async function sendMailDomainQRCode(data, subject, name) {
    const messages = data.map((e) => ({}));
    //
    const base64Data = qrBase64.replace(/^data:image\/png;base64,/, '');
    await sgMail.send({
        from: { email: process.env.SENDGRID_FROM_DOMAIN, name: 'BTC AccessRace' },
        to: email,
        // personalizations: emails,
        subject: subject,
        html: `
<div style="font-family: Arial, sans-serif; background: #f0f8ff;">

  <div style="margin: auto; background: #fff; border-radius: 12px; box-shadow: 0 3px 8px rgba(0,0,0,0.1); overflow: hidden;">

    <!-- Banner -->
    <div style="background: linear-gradient(90deg, #2196f3, #ff9800); color: #fff; padding: 25px; text-align: center;">
      <h2 style="margin: 0; font-size: 24px;">Giải Chạy XYZ 2026</h2>
      <p style="margin: 5px 0 0; font-size: 15px;">Location: Quan 1, HCMC</p>
    </div>

    <!-- QR Code -->
    <div style="padding: 25px; text-align: center;">
      <img 
        src="cid:qrcode"
        alt="QR Code"
        width="220"
        style="max-width: 220px; border: 3px solid #2196f3; border-radius: 12px; padding: 6px; background: #fff;"
      />
      <p style="margin-top: 10px; font-size: 14px; color: #444;">
        Quét QR để check thông tin
      </p>
    </div>

    <!-- Thông tin VĐV -->
    <div style="padding: 20px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
        <tr style="background: #f9f9f9;">
          <td style="padding: 10px; border: 1px solid #ddd;"><b>Họ và tên</b></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${data.name}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><b>Mã số</b></td>
          <td style="padding: 10px; border: 1px solid #ddd; color: #e65100; font-weight: bold;">${'21000'}</td>
        </tr>
        <tr style="background: #f9f9f9;">
          <td style="padding: 10px; border: 1px solid #ddd;"><b>CCCD</b></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${'12345678910'}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><b>Category</b></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${data.category}</td>
        </tr>
        <tr style="background: #f9f9f9;">
          <td style="padding: 10px; border: 1px solid #ddd;"><b>📅 Ngày sự kiện</b></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${'01/01/2026'}</td>
        </tr>
      </table>
    </div>

    <!-- Link dự phòng -->
    <div style="text-align: center; padding: 15px;">
      <p style="font-size: 14px;">
        Nếu bạn không thấy QR code:<br>
        <a href="${'/'}" style="color: #2196f3; font-weight: bold; text-decoration: none;">
          👉 Nhấn vào đây / Click here
        </a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background: #fafafa; padding: 15px; text-align: center; font-size: 13px; color: #666;">
      © 2025 Giải Chạy XYZ · 
      <a href="mailto:support@race.com" style="color: #2196f3;">support@race.com</a>
    </div>

  </div>
</div>
`,
        attachments: [
            {
                content: base64Data,
                filename: 'qrcode.png',
                type: 'image/png',
                disposition: 'inline',
                content_id: 'qrcode',
            },
        ],
    });
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
        dob: excelDateToJSDateUti(dobExcel), // YYYY-MM-DD
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
function convertRowCheckin(row, event_id) {
    const dobExcel = row['dob(mm/dd/yyyy)'];
    const dob = new Date(Math.round((dobExcel - 25569) * 86400 * 1000)); // Excel serial → Date
    return {
        // group_id: groupId,
        event_id: event_id,
        // leader_id: captain_id,
        cccd: row.cccd,
        bib: row.bib,
        fullname: row.fullname,
        distance: row.distance,
        tshirt_size: row.tshirt_size,
        bib_name: row.bib_name,
        email: row.email,
        phone: row.phone,
        dob: excelDateToJSDateUti(dobExcel), // YYYY-MM-DD
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
function generateUID(prefix) {
    const randomPart = crypto.randomBytes(5).toString('hex');
    return `${prefix}_${randomPart}`;
}
//
const eventController = () => {
    return {
        Index: async (req, res) => {
            try {
                const events = await EventService.GetAll();
                res.render(VNAME + 'index', { layout: VLAYOUT, events });
            } catch (error) {
                console.log(CNAME, error.message);
                res.render(VNAME + 'index', { layout: VLAYOUT, events: [] });
            }
        },
        EventTicket: async (req, res) => {
            try {
                const eventTicket = await EventService.GetByEventTicket();
                return res.render(VNAME + 'index', { layout: VLAYOUT, events: eventTicket });
            } catch (error) {
                console.log(CNAME, error.message);
                res.render(VNAME + 'index', { layout: VLAYOUT, events: [] });
            }
        },
        EventCheckin: async (req, res) => {
            try {
                const eventCheckins = await EventService.GetByEventCheckin();
                res.render(VNAME + 'checkinList', { layout: VLAYOUT, events: eventCheckins });
            } catch (error) {
                console.log(CNAME, error.message);
                res.render(VNAME + 'checkinList', { layout: VLAYOUT, events: [] });
            }
        },
        FormAdd: async (req, res) => {
            try {
                res.render(VNAME + 'form', { layout: VLAYOUT });
            } catch (error) {
                console.log(CNAME, error.message);
                res.render(VNAME + 'form', { layout: VLAYOUT });
            }
        },
        FormEdit: async (req, res) => {
            try {
                const slug = req.params.slug;
                console.log(slug);
                const event = await EventService.GetBySlug(slug);
                res.render(VNAME + 'formEdit', { layout: VLAYOUT, event: event || {}, slug });
            } catch (error) {
                console.log(CNAME, error.message);
                res.render(VNAME + 'formEdit', { layout: VLAYOUT, event: {} });
            }
        },
        AddEvent: async (req, res) => {
            try {
                const data = req.body;
                console.log(data);
                const eventDTO = {
                    name: data.name,
                    race_function: data.race_function,
                    short_id: data.short_id,
                    desc: data.desc,
                    img_banner: data.img_banner,
                    img_thumb: data.img_thumb,
                    race_type: data.race_type,
                    location: data.location,
                    isShow: data.is_show,
                    start_date: data.start_date,
                    end_date: data.end_date,
                    status: data.status,
                    organizer_name: data.organizer_name,
                    organizer_web: data.organizer_web,
                    organizer_fanpage: data.organizer_fanpage,
                    organizer_zalo: data.organizer_zalo,
                };
                const result = await EventService.Create(eventDTO);
                if (!result) return res.json({ success: true, mess: 'add failed' });
                return res.json({ success: true });
            } catch (error) {
                console.log(CNAME, error.message);
                return res.json({ success: false, mess: error.message });
            }
        },
        UpdateEvent: async (req, res) => {
            try {
                const slug = req.params.slug;
                console.log(slug);
                const data = req.body;
                const eventDTO = {
                    name: data.name,
                    // slug: data.slug,
                    short_id: data.short_id,
                    desc: data.desc,
                    img_banner: data.img_banner,
                    img_thumb: data.img_thumb,
                    race_type: data.race_type,
                    location: data.location,
                    isShow: data.is_show,
                    start_date: data.start_date,
                    end_date: data.end_date,
                    status: data.status,
                    organizer_name: data.organizer_name,
                    organizer_web: data.organizer_web,
                    organizer_fanpage: data.organizer_fanpage,
                    organizer_zalo: data.organizer_zalo,
                };
                // console.log(eventDTO);
                const result = await EventService.UpdateBySlug(slug, eventDTO);
                if (!result) return res.status(500).json({ success: false, mess: 'update failed' });
                return res.json({ success: true, redirect: '/admin/event' });
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, mess: error.message });
            }
        },
        DeleteEvent: async (req, res) => {
            try {
                const id = req.params.id;
                const result = await EventService.Delete(id);
                if (!result) {
                    return res.json({ success: false });
                }
                res.json({ success: true });
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, mess: error.message });
            }
        },
        RunnerData: async (req, res) => {
            try {
                const _eventSlug = req.params.slug;
                const event = await EventService.GetBySlug(_eventSlug);
                const groups = await GroupService.GetsBySlug(_eventSlug);
                console.log(groups);
                res.render(VNAME + 'runnerData', { layout: VLAYOUT, groups: groups, event, event_slug: _eventSlug });
            } catch (error) {
                console.log(CNAME, error.message);
                res.render(VNAME + 'runnerData', { layout: VLAYOUT, groups: [], event: {}, event_slug: _eventSlug });
            }
        },
        RunnerCheckinData: async (req, res) => {
            try {
                const _eventSlug = req.params.slug;
                // const runners = ParticipantService.get
                const event = await EventService.GetBySlug(_eventSlug);
                const groups = await GroupService.GetsBySlug(_eventSlug);
                console.log(groups);
                res.render(VNAME + 'runnerCheckinData', {
                    layout: VLAYOUT,
                    groups: groups,
                    event,
                    event_slug: _eventSlug,
                });
            } catch (error) {
                console.log(CNAME, error.message);
                res.render(VNAME + 'runnerCheckinData', {
                    layout: VLAYOUT,
                    groups: [],
                    event: {},
                    event_slug: _eventSlug,
                });
            }
        },
        //ajax
        RunnerDataWithGroup: async (req, res) => {
            try {
                const _eventId = 'event_test';
                const _groupId = 'group_admin';
                const participant = await ParticipantService.GetByEventIdAndGroup(_eventId, _groupId);
                console.log(participant);
                res.json({ success: true, data: participant });
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, mess: error.message });
            }
        },
        //ajax
        RunnerDataCheckin: async (req, res) => {
            try {
                // const _eventId ='event_test';
                // const _groupId ='group_admin';
                const _eventSlug = req.params.slug;
                const event = await EventService.GetBySlug(_eventSlug);
                const eventId = event._id;
                console.log('event slug: ', _eventSlug);

                const participant = await ParticipantCheckin.find({ event_id: eventId });
                console.log(participant);
                res.json({ success: true, data: participant });
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, mess: error.message });
            }
        },
        CheckinAddPerson: async (req, res) => {
            const slug = req.params.slug;
            try {
                const event = await EventService.GetBySlug(slug);
                const eventId = event._id;
                const data = req.body;
                const uid = generateUID(event.short_id);
                const cDTO = {
                    uid: uid,
                    event_id: eventId,
                    checkin_status: data.daCheckin,
                    // left
                    distance: data.category,
                    // chipId,
                    fullname: data.name,
                    phone: data.phone,
                    email: data.email,
                    cccd: data.cccd,
                    team: data.team,
                    bib_name: data.nickname,

                    // right
                    bib: data.bibCode,
                    // epc,
                    gender: data.gender === 'true', // "true" | "false"
                    blood: data.blood,
                    dob: data.dob,
                    medical: data.medical,
                    nation: data.nation,
                    tshirt_size: data.size,
                    patron_name: data.patronName,
                    patron_phone: data.patronPhone,
                };
                console.log(cDTO);
                const result = await participantCheckinService.Add(cDTO, slug);
                if (!result) return res.status(500).json({ success: true, mess: 'Save process error' });
                res.json({ success: true });
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, mess: error.message });
            }
        },
        CheckinDeletePerson: async (req, res) => {
            try {
                const _id = req.params.id;
                console.log('id truyen vao', _id);
                const result = await participantCheckinService.Delete(_id);
                if (!result) return res.status(500).json({ success: false, mess: 'delete process failed' });
                res.json({ success: true });
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: true, mess: error.message });
            }
        },
        CheckinEditPerson: async (req, res) => {
            try {
                const _id = req.params.id;
                console.log('Id ', _id);
                const person = await participantCheckinService.GetById(_id);
                res.json({ success: true, data: person });
            } catch (error) {
                console.log(CNAME, error.message);
                res.stauts(500).json({ success: false, mess: error.message });
            }
        },
        CheckinUpdatePerson: async (req, res) => {
            const _id = req.params.id;
            console.log(_id)
            const _slug = req.params.slug;
            try {
                const data = req.body;
                const pcDTO = {
                    checkin_status: data.checkin_status,
                    fullname: data.fullname,
                    phone: data.phone,
                    email: data.email,
                    cccd: data.cccd,
                    distance: data.distance,
                    bib: data.bib,
                    bib_name: data.bib_name,
                    gender: data.gender,
                    blood: data.blood,
                    dob: data.dob,
                    medical: data.medical,
                    nation: data.nation,
                    tshirt_size: data.tshirt_size,
                    patron_name: data.patron_name,
                    patron_phone: data.patron_phone,
                    team: data.team
                }
                const result =await participantCheckinService.Update(pcDTO, _id);
                if(!result) return res.status(500).json({success: false, mess: 'update process failed'})
                res.json({success: true})
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({success: false, mess: error.message})
            }
        },
        CheckinMailConfigSave: async(req, res)=>{
            try {
                const data = req.body;
                const _eventSlug = req.params.slug;
                const event =await EventService.GetBySlug(_eventSlug);
                const _eventId = event._id;
                console.log(data);
                console.log(_eventId)
                const mailDTO = new MailConfig({
                    sender_name: data.sender_name,
                    title: data.title,
                    banner_img: data.banner_img,
                    banner_text: data.banner_text,
                    banner_option: data.banner_option,
                    content_1: data.content_1,
                    content_2: data.content_2,
                    event_id: _eventId,
                }) ;
                // await mailDTO.save();
                res.json({success: true})
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({success: false, mess: error.message})
            }
        },
        SendMailCheckin: async (req, res) => {
            const _eventSlug = req.params.slug;
            const event = await EventService.GetBySlug(_eventSlug);
            const _eventId = event._id;
            console.log('a ',_eventId.toString())
            const mailConfig =await MailConfig.findOne({event_id: _eventId});
            console.log(mailConfig)
            try {
                const event = await EventService.GetBySlug(_eventSlug);
                res.render(VNAME + 'sendmail', { layout: VLAYOUT, event, event_slug: _eventSlug, mc: mailConfig });
            } catch (error) {
                console.log(CNAME, error.message);
                res.render(VNAME + 'sendmail', { layout: VLAYOUT, event: {}, event_slug: _eventSlug, mc:{} });
            }
        },
        //ajax
        SendMail: async (req, res) => {
            const _eventSlug = req.params.slug;
            console.log('even slug ', _eventSlug);
            try {
                const templatePath = myPathConfig.root + '/src/views/mail_template/template_one.html';
                const bannerBase64 = fs.readFileSync(
                    myPathConfig.root + '/public/email_img/banner.jpg', //C:\Workspaces\my_projects\group_bib\public\email_img\banner.jpg
                    { encoding: 'base64' },
                );
                const event = await EventService.GetBySlug(_eventSlug);
                if (!event) {
                    return res.status(404).json({ success: false, message: 'Event not found' });
                }
                const _eventName = event.name;
                const _eventLocation = event.location;
                const _eventStart = formatDate(event.start_date);
                const _eventEnd = formatDate(event.end_date);
                const mailConfig = await MailConfig.findOne({event_id: event._id});
                console.log('check mail ',mailConfig)
                //
                const runners = await ParticipantCheckin.find({ event_id: event._id });

                // Chuẩn hóa data
                const emails = runners.filter((r) => r.email);

                // Build messages (PHẢI dùng Promise.all)
                const messages = await Promise.all(
                    emails.map(async (r) => {
                        const qrBase64 = await QRCode.toDataURL(r.uid);
                        const base64Data = qrBase64.replace(/^data:image\/png;base64,/, '');
                        //
                        let htmlTemplate = fs.readFileSync(templatePath, 'utf8');
                        // Replace dynamic data
                        htmlTemplate = htmlTemplate
                            .replace('{{fullname}}', r.fullname)
                            .replace('{{distance}}', r.distance)
                            .replace('{{category}}', r.distance)
                            .replace('{{cccd}}', r.cccd)
                            .replace('{{code}}', r.bib)
                            .replace('{{tshirt_size}}', r.tshirt_size)
                            .replace('{{event_name}}', _eventName)
                            .replace('{{location}}', _eventLocation)
                            .replace('{{start_date}}', _eventStart)
                            .replace('{{end_date}}', _eventEnd)
                            .replace('{{banner_text}}', mailConfig.banner_text)
                            .replace('{{content_1}}', mailConfig.content_1)
                            .replace('{{content_2}}', mailConfig.content_2)
                        //
                        //
                        return {
                            to: r.email.trim(),
                            from: {
                                email: 'no-reply@accessrace.asia',
                                name: mailConfig.sender_name,
                            },
                            subject: mailConfig.title,
                            html: htmlTemplate,
                            attachments: [
                                {
                                    content: bannerBase64,
                                    filename: 'banner.png',
                                    type: 'image/png',
                                    disposition: 'inline',
                                    content_id: 'banner',
                                },
                                {
                                    content: base64Data,
                                    filename: 'qrcode.png',
                                    type: 'image/png',
                                    disposition: 'inline',
                                    content_id: 'qrcode',
                                },
                            ],
                        };
                    }),
                );

                // Gửi mail hàng loạt
                await sgMail.send(messages);

                res.json({
                    success: true,
                    sent: messages.length,
                });
            } catch (error) {
                if (error.response) {
                    console.error('SendGrid error:', JSON.stringify(error.response.body, null, 2));
                } else {
                    console.error(error);
                }

                res.status(500).json({
                    success: false,
                    error: 'SendGrid error',
                });
            }
        },
        //ajax
        RunnerImport: async (req, res) => {
            const BATCH_SIZE = 1000;
            try {
                const _groupId = 'group_admin';
                const _eventId = 'event_test';
                const _captainId = 'admin';

                if (!req.file) return res.status(400).json({ success: false, mess: 'Ko co file dc gui len!' });
                const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                // lay sheet theo ten
                const worksheet = workbook.Sheets[sheetName];
                // 2. Convert sheet -> JSON
                const excelData = xlsx.utils.sheet_to_json(worksheet, { defval: null, raw: false });

                if (excelData.length === 0) {
                    return res.status(400).json({ success: false, mess: 'File rong!' });
                }
                //3. map du lieu xlcel ->schame
                const runners = excelData.map((row, index) => {
                    return {
                        ...convertRow(row, _groupId, _eventId, _captainId),
                        uid: generateUID(_eventId),
                    };
                });
                //4. insert theo batch (rat quan trong)
                let insertedCount = 0;
                for (let i = 0; i < runners.length; i += BATCH_SIZE) {
                    const batch = runners.slice(i, i + BATCH_SIZE);
                    await Participant.insertMany(batch, {
                        ordered: false, //bo qua record loi, ko crash
                    });
                    insertedCount += batch.length;
                }
                console.log(runners);
                //                 //
                res.json({ success: true, total: runners.length, inserted: insertedCount, data: runners });
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, mess: error.message });
            }
        },
        //ajax
        RunnerCheckinImport: async (req, res) => {
            const BATCH_SIZE = 1000;
            try {
                const slug = req.params.slug;
                console.log('slug event,', slug);
                const event = await eventService.GetBySlug(slug);
                const eventId = event._id;
                const uId = event.short_id;

                if (!req.file) return res.status(400).json({ success: false, mess: 'Ko co file dc gui len!' });
                const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                // lay sheet theo ten
                const worksheet = workbook.Sheets[sheetName];
                // 2. Convert sheet -> JSON
                const excelData = xlsx.utils.sheet_to_json(worksheet, { defval: null, raw: false });

                if (excelData.length === 0) {
                    return res.status(400).json({ success: false, mess: 'File rong!' });
                }
                //3. map du lieu xlcel ->schame
                const runners = excelData.map((row, index) => {
                    return {
                        ...convertRowCheckin(row, eventId),
                        uid: generateUID(uId),
                    };
                });
                //4. insert theo batch (rat quan trong)
                let insertedCount = 0;
                for (let i = 0; i < runners.length; i += BATCH_SIZE) {
                    const batch = runners.slice(i, i + BATCH_SIZE);
                    await ParticipantCheckin.insertMany(batch, {
                        ordered: false, //bo qua record loi, ko crash
                    });
                    insertedCount += batch.length;
                }
                console.log(runners);
                //                 //
                res.json({ success: true, total: runners.length, inserted: insertedCount, data: runners });
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, mess: error.message });
            }
        },
        AddGroup: async (req, res) => {
            const user = req.user;
            console.log('chekc thon gtin user: ', user._id, user.email);
            const captainId = req.user._id;
            let unique = '';
            if (!captainId) return res.json({ success: false, mess: 'Login :))' });
            try {
                const data = req.body;
                const slug = data.slug_hidden;
                console.log('image', req.file);
                console.log(slug);
                const dirPath = path.join(myPathConfig.root + '/public/uploads/qr/');
                if (req.file) {
                    const fileName = req.file.originalname;
                    unique = Math.round(Math.random() * 1e9) + '-' + fileName;
                    const savePath = dirPath + unique;
                    fs.writeFileSync(savePath, req.file.buffer);
                }
                // chua co id cua user login

                var groupDTO = {
                    facebook_link: data.facebook_link,
                    zalo_link: data.zalo_link,
                    discount_percent: Number.parseInt(data.discount_percent),
                    bank_owner: data.bank_account_name,
                    bank_name: data.bank_name,
                    bank_number: data.bank_account_number,
                    bank_transfer_code: data.bank_transfer_fix,
                    event_id: slug, //69143093e41d85097255e609
                    captain_id: captainId,
                    qr_image: '/uploads/qr/' + unique,
                    leader_name: data.leader_name,
                    hotline: data.leader_phone,
                    cccd: data.leader_identity,
                    dob: data.leader_dob,
                    email: data.leader_email,
                    expiry_date: data.expiry_date,
                    expiry_time: data.expiry_time,
                    group_name: data.group_name,
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

module.exports = eventController;
