const ParticipantCheckin = require('../model/ParticipantCheckin_h');
const EventCheckin = require('../model/EventCheckin_h');
const QRCode = require('qrcode');
const { getQrPlaintextPayloadForEmbedding } = require('../utils/checkinScanUrl.util');

/**
 * Trang công khai (không auth): mở từ email để xem lại mã QR VĐV — không gắn với /tool-checkin.
 */
async function showAthleteQr(req, res) {
    try {
        const raw = String(req.params.token || '').trim();
        if (!raw || raw.length > 256) {
            return res.status(404).render('pages/athlete_public_qr_error', {
                layout: false,
                message: 'Liên kết không hợp lệ.',
            });
        }
        const p = await ParticipantCheckin.findOne({ qr_scan_token: raw }).lean();
        if (!p) {
            return res.status(404).render('pages/athlete_public_qr_error', {
                layout: false,
                message: 'Không tìm thấy VĐV hoặc liên kết không còn hiệu lực.',
            });
        }
        const event = await EventCheckin.findById(p.event_id).select('name start_date').lean();
        const qrPlain = getQrPlaintextPayloadForEmbedding(raw);
        let qrDataUrl = '';
        if (qrPlain) {
            qrDataUrl = await QRCode.toDataURL(qrPlain, {
                margin: 1,
                width: 280,
                color: { dark: '#000000', light: '#ffffff' },
            });
        }
        return res.render('pages/athlete_public_qr', {
            layout: false,
            participant: p,
            event,
            qrDataUrl,
        });
    } catch (e) {
        console.error('athleteQrPublic.showAthleteQr', e);
        return res.status(500).render('pages/athlete_public_qr_error', {
            layout: false,
            message: 'Không tải được trang. Vui lòng thử lại sau.',
        });
    }
}

module.exports = { showAthleteQr };
