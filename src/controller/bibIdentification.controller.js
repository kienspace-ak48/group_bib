const Tesseract = require('tesseract.js');
const PaddleOCR = require("paddleocr");
const Jimp = require('jimp');
const mypath = require('../config/mypath.config');

const bibIdentification = () => {
    return {
        Index: async (req, res) => {
            try {
                const img = mypath.root + '/public/uploads/timeslice/1.png';
                const processed = mypath.root + '/public/uploads/timeslice/processed.png';

                console.log("=== Preprocessing Image ===");

                let image = await Jimp.read(img);
                const w = image.bitmap.width;
                const h = image.bitmap.height;

                // ------------------------------------
                // 🎯 CROP VÙNG CHỨA SỐ BIB
                // ------------------------------------
                const cropLeft = w * 0.10;
                const cropTop  = h * 0.42;
                const cropW    = w * 0.80;
                const cropH    = h * 0.45;

                const bibRegion = image.clone().crop(cropLeft, cropTop, cropW, cropH);

                // Debug file để xem crop có đúng không
                const cropDebugPath = mypath.root + '/public/uploads/timeslice/crop-debug.png';
                await bibRegion.writeAsync(cropDebugPath);
                console.log("Đã xuất crop-debug.png để kiểm tra crop!");

                // ------------------------------------
                // 🎯 TỐI ƯU ẢNH CHO OCR
                // ------------------------------------
                await bibRegion
                    .resize(cropW * 2, cropH * 2)     // phóng lớn 2X
                    .grayscale()                      // trắng đen
                    .contrast(1)                      // tăng tương phản mạnh
                    .normalize()                      // làm rõ các vùng tối/sáng
                    .gaussian(1)                      // giảm noise
                    .threshold({ max: 180 })          // tách chữ trắng khỏi nền vàng
                    .writeAsync(processed);

                console.log("=== OCR Running... ===");
                // 
                await bibRegion.writeAsync(mypath.root + '/public/uploads/timeslice/crop-debug.png'); console.log("Đã lưu crop-debug.png để kiểm tra crop!");
                // ------------------------------------
                // 🎯 TESSERACT OCR (chỉ cho phép số)
                // ------------------------------------
                const result = await Tesseract.recognize(
                    processed,
                    'eng',
                    {
                        logger: m => console.log(m),
                        config: {
                            tessedit_char_whitelist: '0123456789'
                        }
                    }
                );

                // Lấy số sạch
                let text = result.data.text.replace(/[^0-9]/g, "").trim();

                // Fallback nếu chưa đọc được
                if (!text) {
                    const match = result.data.text.match(/\d+/);
                    text = match ? match[0] : "";
                }

                console.log("\n========= RESULT =========");
                console.log("BIB:", text);
                console.log("==========================\n");

                return res.json({ success: true, result: text });

            } catch (error) {
                console.log("Err:", error);
                return res.status(500).json({
                    success: false,
                    mess: error.message
                });
            }
        },

        Checkin: async (req, res) => {}
    };
};

module.exports = bibIdentification;
