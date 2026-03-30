// home.controller.js
const CNAME = 'home.controller.js ';
const EventService = require('../services/event.service');
const GroupService = require('../services/group.service');
const participantPreService = require('../services/participantPre.service');
const TicketService = require('../services/ticket.service');
const PageSettingEntity = require('../model/PageSetting');
const EventEntity = require('../model/Event');
const CertificatePositionEntity = require('../model/CertificatePosition');
const CertificateDataEntity = require('../model/CertificateData');
const myPathConfig = require('../config/mypath.config');
const path = require('path');
const fs= require('fs')
const sharp = require('sharp')
const TextToSVG = require("text-to-svg");
const participantService = require('../services/participant.service');

const VLAYOUT = 'layouts/main';

const homeController = () => {
    return {
        Index: async (req, res) => {
            try {
                const ps = await PageSettingEntity.findOne({ type: 'home_page' });
                const events = await EventEntity.find({})
                    .sort({ start_date: 1 })
                    .limit(50)
                    .lean();
                const monthMap = new Map();
                for (const e of events) {
                    if (!e.start_date) continue;
                    const d = new Date(e.start_date);
                    if (Number.isNaN(d.getTime())) continue;
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                    if (!monthMap.has(key)) monthMap.set(key, label);
                }
                const eventMonths = Array.from(monthMap.entries())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([key, label]) => ({ key, label }));
                res.render('home', { layout: VLAYOUT, hp: ps, events: events || [], eventMonths });
            } catch (error) {
                res.render('home', { layout: VLAYOUT, hp: {}, events: [], eventMonths: [] });
            }
        },
        Index0: async (req, res) => {
            const events = await EventService.GetAll();
            // console.log(events)
            res.render('index', { title: 'Home Page', layout: 'layouts/main', events });
        },
        EventDetail: async (req, res) => {
            try {
                const slug = req.params.slug;
                const event = await EventService.GetBySlug(slug);
                const ticket_types = await TicketService.GetsByEventId(event);
                // console.log(ticket_types)
                res.render('pages/eventDetail', { layout: VLAYOUT, event, slug, tickets: ticket_types || [] });
            } catch (error) {
                console.log(CNAME, error.message);
                res.render('pages/eventDetail', { layout: VLAYOUT, event: '', slug: '', tickets: [] });
            }
        },
        GroupBib: async (req, res) => {
            try {
                const eventId = req.params.slug;
                const result = await GroupService.GetByEventId(eventId);
                res.render('pages/groupBib', { layout: VLAYOUT, groups: result || [], slug: eventId || '' });
            } catch (error) {
                console.log(CNAME, error.message);
                res.render('pages/groupBib', { layout: VLAYOUT, groups: [], slug: '' });
            }
        },
        ParticipantPre: async (req, res) => {
            const eventSlug = req.params.event_slug;
            const groupId = req.params.group_id;
            try {
                const event = await EventService.GetBySlug(eventSlug);
                console.log('event co gi ', event);
                if (!event) return res.render(CNAME + 'user/orderPre', { layout: VLAYOUT });
                // const pp = await participantPreService.GetByEventIdAndGroup(event._id, groupId);
                const pp = await participantService.GetByEventIdAndGroup(event._id, groupId);
                console.log('pp co gi ', pp);
                res.render('pages/orderPre', { layout: VLAYOUT, pp: pp || [] });
            } catch (error) {
                console.log(CNAME, error.message);
                res.render('pages/orderPre', { layout: VLAYOUT, pp: [] });
            }
        },
        Ecert: async (req, res) => {
            // const certConfigs =await CertificateConfigEntity.find().lean();
            const certPositions = await CertificatePositionEntity.find({}, { _id: 0 }).sort({ updatedAt: -1 }).lean();
            // console.log(certPositions);
            res.render('ecert/index', {
                layout: VLAYOUT,
                title: 'E-Cert',
                cp: certPositions || [],
            });
        },
        ECetDetail: async (req, res) => {
            try {
                const slugId = req.params.slug || '';
                // console.log("id: ", slugId);
                if (!slugId) {
                    throw new Error("Don't have id");
                }
                const certPositions = await CertificatePositionEntity.findOne({ slug: slugId }, { _id: 0 }).lean();
                // console.log(certPositions);
                res.render('ecert/ecert_detail', {
                    layout: VLAYOUT,
                    title: 'E-Cert',
                    cp: certPositions || {},
                });
            } catch (error) {
                res.render('ecert/ecert_detail', {
                    layout: VLAYOUT,
                    title: 'E-Cert',
                    cp: {},
                });
            }
        },
        // ajax
        DataTable: async (req, res) => {
            try {
                const dc = req.body;
                // console.log(dc);
                const slug = req.params.slug;
                var cID = null;
                const result = await CertificatePositionEntity.findOne({
                    slug: slug,
                }).lean();
                if (result) {
                    cID = result._id;
                }
                console.log(cID);

                //
                const draw = dc.draw;
                const start = parseInt(dc.start) || 0;
                const length = parseInt(dc.length) || 10;
                const searchValue = dc.search?.value.trim() || '';
                const orderCol = dc.order?.[0]?.column || 0;
                const orderDir = dc.order?.[0]?.dir || 'asc';
                // const orderField = dc.columns?.[orderCol]?.dc || "name";
                const orderField = 'name';
                let query = {};
                if (cID) {
                    query.contest_ref = cID;
                }
                if (searchValue) {
                    query.$or = [
                        { name: { $regex: searchValue, $options: 'i' } },
                        { field_1: { $regex: searchValue, $options: 'i' } },
                    ];
                }
                const totalRecords = await CertificateDataEntity.estimatedDocumentCount();
                const filteredRecords = await CertificateDataEntity.countDocuments(query);
                console.log('data fillter ', filteredRecords);
                const dataRaw = await CertificateDataEntity.find(query)
                    .sort({ [orderField]: orderDir === 'asc' ? 1 : -1 })
                    .skip(start)
                    .limit(length);
                console.log(dataRaw);
                const data = dataRaw.map((item) => ({
                    ...item.toObject(),
                    // _id: item._id.toString(),
                    contest_ref: item.contest_ref.toString(), // hoặc populate name nếu muốn
                }));
                // console.log("data server tra ve ", data);
                res.json({
                    draw,
                    recordsTotal: totalRecords,
                    recordsFiltered: filteredRecords,
                    data,
                });
                // end
            } catch (error) {
                console.log(error);
                res.status(500).json({ err: error.message });
            }
        },
        //svg-to-text
    RenderCertificate: async (req, res) => {
      //Initial
      const idUser = req.query.uid;
      const idContest = req.query.cid;
      console.log(idUser, idContest);
      const certConfig = await CertificatePositionEntity.findOne({
        slug: idContest,
      }).lean();
      var isCamau = idContest ==="gia-lai-city-trail-2025-1763710004523"
      console.log('isCamau right: ', isCamau);
      // console.log(certConfig)
      const bgUrlImage = "public" + certConfig.img_path;
      const certUser = await CertificateDataEntity.findOne({
        _id: idUser,
      }).lean();
      // console.log(bgUrlImage, certUser)

      // 🔹 Load background
      // const bgPath = path.join(pathConfig.root, bgUrlImage);\
      const bgPath = myPathConfig.root + bgUrlImage;
      // 🔹 Load font
      // C:\Workspaces\Nodejs\access-race\src\public\font\blona\Blona-Regular.ttf
      //"src/public/font/AlexBrush-Regular.ttf",
      let fontPath =""
      if(isCamau){
        fontPath = path.join(
        myPathConfig.root,
        "public/font/BarlowCondensed-MediumItalic.ttf",
      );
      if (!fs.existsSync(fontPath)) {
        throw new Error("Font file not found: " + fontPath);
      }
      }else{
        fontPath = path.join(
        myPathConfig.root,
        "public/font/blona/Blona-Regular.ttf",
      );
      if (!fs.existsSync(fontPath)) {
        throw new Error("Font file not found: " + fontPath);
      }
      }
      
      //
      try {
        const fakeData = certUser;
        const fakePosition = certConfig.config;
        const bgImage = sharp(bgPath);
        const metadata = await bgImage.metadata();

        const textToSVG = TextToSVG.loadSync(fontPath);

        // 🔹 Dùng Sharp để composite SVG text lên background
        //===============NEW C2\
        const svgLayers = fakePosition.map((p) => {
          const val = fakeData[p.field] || "";

          // ✅ Lấy thông tin kích thước thật của text
          const metrics = textToSVG.getMetrics(val, {
            fontSize: p.fontSize,
            anchor: "top",
          });

          // ✅ Tính lại toạ độ căn giữa chính xác
          const textWidth = metrics.width;
          const textHeight = metrics.height;

          const top = p.y + (p.h - textHeight) / 2;
          // const left = p.x + (p.w - textWidth) / 2;
          // ✅ Căn ngang theo p.align
          let left;
          switch (p.align) {
            case "left":
              left = p.x; // bám sát lề trái
              break;
            case "right":
              left = p.x + p.w - textWidth; // bám sát lề phải
              break;
            default:
              // center (hoặc nếu không có align thì mặc định center)
              left = p.x + (p.w - textWidth) / 2;
              break;
          }

          const padding = 30;

          // Lấy path vector chữ
          const path = textToSVG.getPath(val, {
            fontSize: p.fontSize,
            anchor: "top",
          });
          // Tạo SVG bao ngoài có padding
          const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="${textWidth + padding * 2}" height="${textHeight + padding * 2}">
            <g transform="translate(${padding}, ${padding})" fill="${p.fill || "black"}">
              ${path}
            </g>
          </svg>
        `;
          // Dịch vị trí vẽ để không bị lệch do padding thêm
          return {
            input: Buffer.from(svg),
            top: Math.round(top - padding),
            left: Math.round(left - padding),
          };
        });
        const finalImage = await bgImage.composite(svgLayers).png().toBuffer();
        // 🔹 Gửi ảnh về client
        res.setHeader("Content-Type", "image/png");
        res.send(finalImage);
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, mess: err.message });
      }
    },
        Login: async (req, res) => {
            res.render('pages/login', { layout: false });
        },
    };
};

module.exports = homeController; //export function static
