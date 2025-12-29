const myPathConfig = require('../../../config/mypath.config');
const CertificatePositionEntity = require('../../../model/CertificatePosition');
const CertificateDataEntity = require('../../../model/CertificateData');
const CNAME = 'ecert.controller.js ';
const VNAME = 'admin/e_cert/';
const VLAYOUT = 'layouts/adminLayout';
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const mongoose = require('mongoose');
const sharp = require('sharp');
const TextToSVG = require('text-to-svg')

//
function mapRowByIndex(row, contestID, rowNumber) {
    let user = {
        contestId: contestID,
        name: String(row[0] || ''),
        field_1: row[1] || '',
        field_2: row[2] || '',
        field_3: row[3] || '',
        field_4: row[4] || '',
        field_5: row[5] || '',
        field_6: row[6] || '',
        field_7: row[7] || '',
        field_8: row[8] || '',
        field_9: row[9] || '',
        field_10: row[10] || '',
        field_11: row[11] || '',
    };
    //validate
    return user;
}
async function CertDataHelper(id) {
    const result = (await CertificateDataEntity.find({ contest_ref: id }).lean()) || [];
    return result;
}
function uploadEcertImage() {
    const uploadDir = myPathConfig.root + '/public/uploads/ecert';
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            // console.log(file);
            const uniqueName = Date.now() + '-' + file.originalname.toLowerCase();
            cb(null, uniqueName);
        },
    });
    const fileFilter = (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
            return cb(new Error('accept file (jpg, jpeg, png)'), false);
        }
        cb(null, true);
    };
    const upload = multer({ storage, fileFilter });
    return upload;
}
const ecertController = () => {
    return {
        async Index(req, res) {
            //
            try {
                const contests = await CertificatePositionEntity.find().lean();
                res.render(VNAME + 'index', {
                    layout: VLAYOUT,
                    title: 'E-Cert',
                    cl: contests,
                });
            } catch (error) {
                console.log(CNAME + error.message);
                res.render(VNAME + 'index', { layout: VLayout, title: 'E-Cert', cl: [] });
            }
        },
        async ContestDetail(req, res) {
            try {
                const id = req.params.id;
                const contest = await CertificatePositionEntity.findById(id).lean();
                const cd = await CertDataHelper(id);
                if (!contest) {
                    return res.status(404).json({ success: false, mess: 'ko tim thay contest' });
                }
                res.render(VNAME + 'contestConfig', {
                    layout: VLAYOUT,
                    title: 'E-Cert',
                    c: contest || {},
                    ud: cd || [],
                });
            } catch (error) {
                console.log(CNAME, error);
                res.status(500).json({ success: false, mess: error.message });
            }
        },
        async AddContest(req, res) {
            const upload = uploadEcertImage().single('image'); // Khởi tạo multer

            upload(req, res, async (err) => {
                if (err) {
                    return res.status(400).json({ success: false, mess: err.message });
                }

                try {
                    const { name, desc } = req.body;
                    const file = req.file;

                    console.log('🧩 file:', file);
                    console.log('🧩 name:', name);
                    console.log('🧩 desc:', desc);

                    if (!name || !desc) {
                        return res.status(400).json({ success: false, mess: 'Thiếu dữ liệu' });
                    }

                    const imgPath = file ? `/uploads/ecert/${file.filename}` : '';

                    const cp = new CertificatePositionEntity({
                        title: name,
                        desc: desc,
                        img_thumb: imgPath,
                    });

                    await cp.save();

                    res.json({ success: true, mess: 'Tạo contest thành công' });
                } catch (error) {
                    console.log(CNAME, error);
                    res.status(500).json({ success: false, mess: error.message });
                }
            });
        },
        async UploadImage2(req, res) {
            try {
                console.log('file: ', req.file);
                const id = req.body.id;
                if (!req.file) {
                    return res.status(400).json({ message: 'chua co file' });
                }

                // noi luu file
                const uploadDirEcert = myPathConfig.root + '/public/e-cert/adsys/';
                const pathSave = '/e-cert/adsys/';
                const fileName = Date.now() + '-' + req.file.originalname;
                const filePath = path.join(uploadDirEcert, fileName);
                const imgPathOld = await CertificatePositionEntity.findById(id);
                const storeImage = await CertificatePositionEntity.updateOne(
                    { _id: id },
                    { img_path: pathSave + fileName },
                );
                console.log(storeImage);
                if (imgPathOld) {
                    if (fs.existsSync(uploadDirEcert + imgPathOld.img_path)) {
                        fs.unlinkSync(uploadDirEcert + imgPathOld.img_path);
                    }
                }
                fs.writeFileSync(filePath, req.file.buffer);
                res.json({ success: true, path: filePath });
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, mess: error.message });
            }
        },
        async UploadImage(req, res) {
            try {
                console.log('A');
                const id = req.body.id;
                const file = req.file;
                if (!file) {
                    return res.status(400).json({ success: false, mess: 'ko co file anh' });
                }
                const imgPath = '/e-cert/adsys/' + file.filename;
                //   console.log("imgPath: ", imgPath);
                //xoa imgpath cu
                const imgPathOld = await CertificatePositionEntity.findById(id);
                if (!imgPathOld) {
                    return res.status(404).json({ success: false, mess: 'don/"/t find img_path ' });
                }
                if (imgPathOld.img_path) {
                    const oldPath = path.join(myPathConfig.root, 'src', 'public', imgPathOld.img_path);
                    if (fs.existsSync(oldPath)) {
                        fs.unlinkSync(oldPath);
                        //   console.log("da xoa file cu");
                    }
                }
                //update db
                const update = await CertificatePositionEntity.updateOne({ _id: id }, { img_path: imgPath });
                res.json({ success: true, file: imgPath });
            } catch (error) {
                console.log(CNAME + error);
                res.status(500).json({ success: false, mess: 'Lỗi server' });
            }
        },
        //ajax
        async UploadExcel(req, res) {
            try {
                const contest_id = req.params.id;
                const file = req.file;
                if (!file) {
                    return res.status(400).json({ success: false, mess: 'No file uploaded' });
                }
                //read file
                const workbook = xlsx.read(file.buffer, { type: 'buffer' });
                //lay sheet theo ten: ecert-data
                const _sheetName = 'ecert-data';
                if (!workbook.SheetNames.includes(_sheetName)) {
                    return res.status(400).json({ success: false, mess: `sheet ${_sheetName} not found` });
                }
                const worksheet = workbook.Sheets[_sheetName];
                //convert sheet sang JSON
                const jsonData = xlsx.utils.sheet_to_json(worksheet, {
                    header: 1, //lay raw dang manh, ko dua theo header
                    defval: '', //giu cacs gia tri trong
                });
                if (jsonData.length <= 1) {
                    return res.status(400).json({ sucess: false, mess: 'File excel ko co data' });
                }
                //
                const ecertDatas = [];
                jsonData.slice(1).forEach((row, i) => {
                    let rowNumber = i;
                    ecertDatas.push(mapRowByIndex(row, contest_id, rowNumber));
                });
                //bulkOps //nen ket hop them mot field de tranh trung key khi import
                const bulkOps = ecertDatas.map((data) => {
                    const { _id, ...rest } = data;
                    return {
                        updateOne: {
                            filter: {
                                contest_ref: new mongoose.Types.ObjectId(data.contestId),
                                name: data.name,
                                field_1: data.field_1,
                            },
                            update: { $set: rest },
                            upsert: true,
                        },
                    };
                });
                const result = await CertificateDataEntity.bulkWrite(bulkOps, {
                    ordered: false,
                });
                console.log(result);
                // console.log(jsonData);
                res.json({ success: true, mess: 'import data success' });
            } catch (error) {
                console.log(CNAME, error);
                res.status(500).json({ success: false, mess: error.message });
            }
        },
        async SavePosition(req, res) {
            try {
                const data = req.body;
                // console.log("data", data);
                const id = req.params.id;
                // console.log("id: ", id);
                if (!id) {
                    return res.status(400).json({ success: false, mess: 'Thiếu id' });
                }
                const cf = await CertificatePositionEntity.findOneAndUpdate(
                    { _id: id },
                    { config: data },
                    { new: true },
                );
                // console.log(cf);

                // 🔹 Nếu có slug thì update, nếu chưa có thì insert mới
                // await CerttificatePositionEntity.updateOne(
                //   { slug: slug }, // tìm theo slug
                //   { $set: cp }, // cập nhật nội dung
                //   { upsert: true }, // nếu chưa có thì tạo mới
                // );
                res.json({ success: true, message: 'Lưu hoặc cập nhật thành công' });
            } catch (error) {
                console.error(error);
                res.json({ success: false, mess: error.message });
            }
        },
        async DataTable(req, res) {
            try {
                const dc = req.body;
                const cID = req.params.cid;
                console.log('data check');
                console.log(dc);
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

                //tao query truy vam
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
                const totalRecords = await CertificateDataEntity.countDocuments();
                const filteredRecords = await CertificateDataEntity.countDocuments(query);

                const dataRaw = await CertificateDataEntity.find(query)
                    .sort({ [orderField]: orderDir === 'asc' ? 1 : -1 })
                    .skip(start)
                    .limit(length);
                const data = dataRaw.map((item) => ({
                    ...item.toObject(),
                    // _id: item._id.toString(),
                    contest_ref: item.contest_ref.toString(), // hoặc populate name nếu muốn
                }));
                // console.log('data server tra ve ',data)
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
        async RenderCertificate(req, res) {
            //Initial
            const idUser = req.query.uid;
            const idContest = req.query.cid;
            console.log(idUser, idContest);
            const certConfig = await CertificatePositionEntity.findOne({
                _id: idContest,
            }).lean();
            // console.log(certConfig)
            const bgUrlImage = 'public' + certConfig.img_path;
            const certUser = await CertificateDataEntity.findOne({
                _id: idUser,
            }).lean();
            // console.log(bgUrlImage, certUser)

            // 🔹 Load background
            const bgPath = path.join(myPathConfig.root, bgUrlImage);
            // 🔹 Load font
            const fontPath = path.join(myPathConfig.root, 'public/font/AlexBrush-Regular.ttf');
            if (!fs.existsSync(fontPath)) {
                throw new Error('Font file not found: ' + fontPath);
            }
            //
            try {
                // 🔹 Fake data
                // const fakeData = {
                //   name: "Vũ Văn Kiên",
                //   field_1: "Staff",
                //   dob: "20/11/2002",
                //   address: "Ha Noi",
                //   email: "test@gmail.com",
                //   role: "Staff",
                // };

                const fakeData = certUser;
                const fakePosition = certConfig.config;

                const bgImage = sharp(bgPath);
                const metadata = await bgImage.metadata();

                const textToSVG = TextToSVG.loadSync(fontPath);

                // 🔹 Dùng Sharp để composite SVG text lên background
                //===============NEW C2\
                const svgLayers = fakePosition.map((p) => {
                    const val = fakeData[p.field] || '';

                    // ✅ Lấy thông tin kích thước thật của text
                    const metrics = textToSVG.getMetrics(val, {
                        fontSize: p.fontSize,
                        anchor: 'top',
                    });

                    // ✅ Tính lại toạ độ căn giữa chính xác
                    const textWidth = metrics.width;
                    const textHeight = metrics.height;

                    const top = p.y + (p.h - textHeight) / 2;
                    // const left = p.x + (p.w - textWidth) / 2;
                    // ✅ Căn ngang theo p.align
                    let left;
                    switch (p.align) {
                        case 'left':
                            left = p.x; // bám sát lề trái
                            break;
                        case 'right':
                            left = p.x + p.w - textWidth; // bám sát lề phải
                            break;
                        default:
                            // center (hoặc nếu không có align thì mặc định center)
                            left = p.x + (p.w - textWidth) / 2;
                            break;
                    }
                    // const padding = 20;
                    // const svg = textToSVG.getSVG(val, {
                    //   x: 0,
                    //   y: 0,
                    //   fontSize: p.fontSize,
                    //   anchor: "top",
                    //   attributes: { fill: p.fill || "black" },
                    // });

                    // return {
                    //   input: Buffer.from(svg),
                    //   top: Math.round(top),
                    //   left: Math.round(left),
                    // };
                    // cach mới
                    // Thêm padding an toàn (2 bên và trên dưới)
                    const padding = 30;

                    // Lấy path vector chữ
                    const path = textToSVG.getPath(val, {
                        fontSize: p.fontSize,
                        anchor: 'top',
                    });
                    // Tạo SVG bao ngoài có padding
                    const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="${textWidth + padding * 2}" height="${
                        textHeight + padding * 2
                    }">
            <g transform="translate(${padding}, ${padding})" fill="${p.fill || 'black'}">
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
                res.setHeader('Content-Type', 'image/png');
                res.send(finalImage);
            } catch (err) {
                console.error(err);
                res.status(500).json({ message: 'Error rendering font', error: err.message });
            }
        },
    };
};

module.exports = ecertController;
