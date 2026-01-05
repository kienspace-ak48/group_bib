const EventService = require('../services/event.service');
const stringValue = require('../../../config/stringvalue.config');
const CNAME = 'event.controller.js ';
const VLAYOUT = stringValue.adminLayout;
const VNAME = 'admin/event/';
const xlsx = require('xlsx');
const crypto = require('crypto');

const Participant = require('../../../model/Participant');
const excelDateToJSDateUti = require('../../../utils/excelDataToJSDate.util');
const ParticipantService = require('../../../services/participant.service');
const GroupService = require('../services/group.service')

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
function generateUID(eventId) {
  const randomPart = crypto.randomBytes(5).toString('hex');
  return `${eventId}_${randomPart}`;
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
                    desc: data.description,
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
                console.log('A');
                const slug = req.params.slug;
                console.log(slug);
                const data = req.body;
                const eventDTO = {
                    name: data.name,
                    // slug: data.slug,
                    desc: data.description,
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
                if (!result) return res.json({ success: false, mess: 'update failed' });
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
                // const runners = ParticipantService.get
                const groups = await GroupService.GetsBySlug(_eventSlug);
                console.log(groups)
                res.render(VNAME + 'runnerData', { layout: VLAYOUT, groups: groups, event_slug : _eventSlug});
            } catch (error) {
                console.log(CNAME, error.message);
                res.render(VNAME+'runnerData', {layout: VLAYOUT, groups:[], event_slug : _eventSlug})
            }
        },
        //ajax 
        RunnerDataWithGroup: async(req, res)=>{
            try {
                const _eventId ='event_test';
                const _groupId ='group_admin';
                const participant= await ParticipantService.GetByEventIdAndGroup(_eventId, _groupId);
                console.log(participant)
                res.json({success: true, data: participant});
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({success: false, mess: error.message});
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
                        uid: generateUID(_eventId)
                    }
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
                res.json({ success: true,total: runners.length, inserted: insertedCount, data: runners });
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, mess: error.message });
            }
        },
    };
};

module.exports = eventController;
