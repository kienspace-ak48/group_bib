const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const TextToSVG = require("text-to-svg");

const CertificateDataEntity = require("../model/CertificateData");
const CertificatePositionEntity = require("../model/CertificatePosition");
const pathConfig = require("../config/path.config");
const CertificatePosition = require("../model/CertificatePosition");

const VNAME = "pages/ecert/";
const VLAYOUT = "layouts/main";
module.exports = () => {
  return {
    Index: async (req, res) => {
      // const certConfigs =await CertificateConfigEntity.find().lean();
      const certPositions = await CertificatePositionEntity.find({}, { _id: 0 })
        .sort({ updatedAt: -1 })
        .lean();
      // console.log(certPositions);
      res.render(VNAME + "index", {
        layout: VLAYOUT,
        title: "E-Cert",
        cp: certPositions || [],
      });
    },
    ECetDetail: async (req, res) => {
      try {
        const slugId = req.params.slug || "";
        // console.log("id: ", slugId);
        if (!slugId) {
          throw new Error("Don't have id");
        }
        const certPositions = await CertificatePositionEntity.findOne(
          { slug: slugId },
          { _id: 0 },
        ).lean();
        // console.log(certPositions);
        res.render(VNAME + "ecert_detail", {
          layout: VLAYOUT,
          title: "E-Cert",
          cp: certPositions || {},
        });
      } catch (error) {
        res.render(VNAME + "ecert_detail", {
          layout: VLAYOUT,
          title: "E-Cert",
          cp: {},
        });
      }
    },
    // ajax
    DataTable: async (req, res) => {
      try {
        const dc = req.body;
        console.log(dc);
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
        const searchValue = dc.search?.value.trim() || "";
        const orderCol = dc.order?.[0]?.column || 0;
        const orderDir = dc.order?.[0]?.dir || "asc";
        // const orderField = dc.columns?.[orderCol]?.dc || "name";
        const orderField = "name";

        // console.log(dc, cID);
        //tao query truy vam
        let query = {};
        if (cID) {
          query.contest_ref = cID;
        }
        if (searchValue) {
          query.$or = [
            { name: { $regex: searchValue, $options: "i" } },
            { field_1: { $regex: searchValue, $options: "i" } },
          ];
        }
        const totalRecords = await CertificateDataEntity.estimatedDocumentCount();
        const filteredRecords =
          await CertificateDataEntity.countDocuments(query);

        const dataRaw = await CertificateDataEntity.find(query)
          .sort({ [orderField]: orderDir === "asc" ? 1 : -1 })
          .skip(start)
          .limit(length);
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
      const bgUrlImage = "src/public" + certConfig.img_path;
      const certUser = await CertificateDataEntity.findOne({
        _id: idUser,
      }).lean();
      // console.log(bgUrlImage, certUser)

      // 🔹 Load background
      // const bgPath = path.join(pathConfig.root, bgUrlImage);\
      const bgPath = pathConfig.root + bgUrlImage;
      // 🔹 Load font
      // C:\Workspaces\Nodejs\access-race\src\public\font\blona\Blona-Regular.ttf
      //"src/public/font/AlexBrush-Regular.ttf",
      let fontPath =""
      if(isCamau){
        fontPath = path.join(
        pathConfig.root,
        "src/public/font/BarlowCondensed-MediumItalic.ttf",
      );
      if (!fs.existsSync(fontPath)) {
        throw new Error("Font file not found: " + fontPath);
      }
      }else{
        fontPath = path.join(
        pathConfig.root,
        "src/public/font/blona/Blona-Regular.ttf",
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
    LoadAllFont: async (req, res) => {
      const dir = pathConfig.root + "/src/public/font";
      const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".ttf") || f.endsWith(".otf"));
      const fonts = files.map((file) => ({
        name: path.basename(file, path.extname(file)),
        url: `font/${file}`,
      }));
      console.log(dir);
      console.log("-----");
      console.log(files);
      console.log("----");
      console.log(fonts);
      res.json(fonts);
    },
    //=================area admin
    ContestDetail: async (req, res)=> {
    try {
      const id = req.params.id;
      const contest = await CertificatePositionEntity.findById(id).lean();
      const cd = await CertDataHelper(id);
      if (!contest) {
        return res
          .status(404)
          .json({ success: false, mess: "ko tim thay contest" });
      }
      res.render(VNAME + "contestConfig", {
        layout: VLayout,
        title: "E-Cert",
        c: contest || {},
        ud: cd || [],
      });
    } catch (error) {
      console.log(CNAME, error);
      res.status(500).json({ success: false, mess: error.message });
    }
  }
  };
};
