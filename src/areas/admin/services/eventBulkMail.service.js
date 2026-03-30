const fs = require('fs');
const path = require('path');
const sgMail = require('@sendgrid/mail');
const QRCode = require('qrcode');
const myPathConfig = require('../../../config/mypath.config');
const eventMailConfigService = require('./eventMailConfig.service');
const participantCheckinHService = require('./participantCheckinH.service');

const CNAME = 'eventBulkMail.service.js ';
const TEMPLATE_REL = path.join('src', 'views', 'mail_template', 'template_one.html');

function getApiKey() {
    const k =
        process.env.SENDGRID_API_KEY ||
        process.env.SENDGRID_API_KEY_DOMAIN ||
        process.env.SENDGRID_KEY;
    return (k && String(k).trim()) || '';
}

/** Địa chỉ From đã verify trên SendGrid (cùng style với mail.service / event_old) */
function getFromEmail() {
    const e =
        process.env.SENDGRID_FROM_EMAIL ||
        process.env.SENDGRID_FROM_DOMAIN ||
        process.env.SENDGRID_FROM;
    return (e && String(e).trim()) || '';
}

function formatSendGridError(err) {
    if (!err) return 'Unknown error';
    if (err.response && err.response.body !== undefined) {
        const b = err.response.body;
        if (typeof b === 'string') return b;
        if (b && typeof b === 'object' && Array.isArray(b.errors) && b.errors.length) {
            const first = b.errors[0];
            const m = first && first.message ? String(first.message) : '';
            /** Phổ biến trên gói Free / khi hết hạn mức tháng */
            if (m.includes('Maximum credits exceeded')) {
                return 'SendGrid: hết quota gửi (Maximum credits exceeded). Nâng gói, mua thêm credit hoặc đợi reset chu kỳ — xem Usage & Billing trên https://app.sendgrid.com/';
            }
            if (m) return m;
        }
        try {
            return JSON.stringify(b);
        } catch (e) {
            return String(b);
        }
    }
    return err.message || String(err);
}

function isCreditsExceededError(err) {
    try {
        const b = err.response && err.response.body;
        if (!b || typeof b !== 'object') return false;
        const arr = b.errors;
        if (!Array.isArray(arr)) return false;
        return arr.some((x) => x && String(x.message).includes('Maximum credits exceeded'));
    } catch (e) {
        return false;
    }
}

function isSendGridConfigured() {
    return !!(getApiKey() && getFromEmail());
}

function ensureSendGrid() {
    const k = getApiKey();
    if (!k) throw new Error('Thiếu biến môi trường SENDGRID_API_KEY (hoặc SENDGRID_API_KEY_DOMAIN).');
    sgMail.setApiKey(k);
}

function formatDateVi(d) {
    if (!d) return '—';
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return '—';
    return x.toLocaleDateString('vi-VN');
}

/** Ngày giờ (checkin_time, v.v.) */
function formatDateTimeVi(d) {
    if (!d) return '—';
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return '—';
    return x.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Giờ 24h (pickup từ Excel Time / HH:mm) */
function formatTime24hVi(d) {
    if (!d) return '—';
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return '—';
    return x.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

function buildPickupRangeString(start, end) {
    const a = start ? formatTime24hVi(start) : '—';
    const b = end ? formatTime24hVi(end) : '—';
    return `${a} - ${b}`;
}

/** `zone` là "1" hoặc số 1 → tick xanh trong ô; ngược lại → X đỏ (HTML, không escape) */
function buildZoneIndicatorHtml(zoneVal) {
    const isOne =
        zoneVal === 1 ||
        zoneVal === true ||
        String(zoneVal != null ? zoneVal : '')
            .trim() === '1';
    if (isOne) {
        return '<span style="display:inline-block;border:2px solid #2e7d32;border-radius:4px;background:#e8f5e9;color:#2e7d32;font-size:18px;line-height:1;padding:4px 10px;font-weight:bold;">&#10003;</span>';
    }
    return '<span style="display:inline-block;border:2px solid #c62828;border-radius:4px;background:#ffebee;color:#c62828;font-size:18px;line-height:1;padding:4px 10px;font-weight:bold;">&#10007;</span>';
}

function formatGenderLabel(g) {
    if (g === true || g === 1) return 'Nam';
    if (g === false || g === 0) return 'Nữ';
    return '—';
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function htmlFromPlain(s) {
    return escapeHtml(s || '').replace(/\n/g, '<br>');
}

function buildEndMailImageSection(mailConfig) {
    const mc = mailConfig || {};
    if (!mc.end_mail_img) return '';
    const rel = String(mc.end_mail_img).replace(/^\//, '');
    const abs = path.join(myPathConfig.root, 'public', rel);
    if (!fs.existsSync(abs)) return '';
    return `<tr>
                        <td align="center" style="padding: 16px 20px 0; font-family: Arial, sans-serif;">
                            <img src="cid:endmail" alt="" width="560" style="display: block; max-width: 100%; height: auto; border: 0" />
                        </td>
                    </tr>`;
}

/** @returns {{ content: string, type: string, filename: string } | null} */
function getEndMailImageAttachment(mailConfig) {
    const mc = mailConfig || {};
    if (!mc.end_mail_img) return null;
    const rel = String(mc.end_mail_img).replace(/^\//, '');
    const abs = path.join(myPathConfig.root, 'public', rel);
    if (!fs.existsSync(abs)) return null;
    const ext = path.extname(abs).toLowerCase();
    const type =
        ext === '.png'
            ? 'image/png'
            : ext === '.gif'
              ? 'image/gif'
              : ext === '.webp'
                ? 'image/webp'
                : 'image/jpeg';
    return {
        content: fs.readFileSync(abs, { encoding: 'base64' }),
        type,
        filename: 'end-mail' + (ext || '.jpg'),
    };
}

function buildBannerHtml(showBanner, bannerText) {
    let bannerOrTextSection = '';
    if (showBanner) {
        bannerOrTextSection = `<tr>
                        <td align="center">
                            <img
                                src="cid:banner"
                                alt="Banner"
                                width="600"
                                style="display: block; 
                                    max-width: 600px; 
                                    width: 100%; 
                                    height: auto;
                                    -ms-interpolation-mode: bicubic;"  
                            />
                        </td>
                    </tr>`;
    } else {
        const t = escapeHtml(bannerText || '');
        bannerOrTextSection = `<tr>
                        <td align="left" style="padding: 0 20px; font-family: Arial, sans-serif; font-size: 14px; color: #333333">
                            <h1>${t}</h1>
                        </td>
                     </tr>`;
    }
    return bannerOrTextSection;
}

/**
 * @param {object} event - event_checkin_h
 * @param {object} mailConfig - mail_config
 * @param {object} r - participant_checkin_h
 */
function buildTemplateVars(event, mailConfig, r) {
    const mc = mailConfig || {};
    const name = escapeHtml(r.fullname || '');
    return {
        event_name: escapeHtml(event.name || ''),
        location: escapeHtml(event.location || ''),
        fullname: name,
        gender: formatGenderLabel(r.gender),
        dob: formatDateVi(r.dob),
        bibname: escapeHtml(r.bib_name != null ? String(r.bib_name) : ''),
        email: r.email && String(r.email).trim() ? escapeHtml(String(r.email).trim()) : '—',
        phone: r.phone && String(r.phone).trim() ? escapeHtml(String(r.phone).trim()) : '—',
        pickup_range: buildPickupRangeString(r.pickup_start, r.pickup_end),
        zone_cell: buildZoneIndicatorHtml(r.zone != null ? r.zone : r.line),
        content_1: mc.content_1 == null ? '' : String(mc.content_1),
        content_2: mc.content_2 == null ? '' : String(mc.content_2),
        code: escapeHtml(r.bib != null ? String(r.bib) : ''),
        cccd: escapeHtml(r.cccd != null ? String(r.cccd) : ''),
        category: escapeHtml(r.distance != null ? String(r.distance) : ''),
        tshirt_size: escapeHtml(r.item != null ? String(r.item) : '—'),
        start_date: formatDateVi(event.start_date),
        end_date: formatDateVi(event.end_date),
        footer_bg_color: escapeHtml(mc.footer_bg_color || '#f8f8f8'),
        footer_border_color: escapeHtml(mc.footer_border_color || '#e0e0e0'),
        footer_text_color: escapeHtml(mc.footer_text_color || '#666666'),
        footer_link_color: escapeHtml(mc.footer_link_color || '#0066cc'),
        footer_email: escapeHtml(mc.footer_email || 'support@example.com'),
        footer_hotline: escapeHtml(mc.footer_hotline || '—'),
        footer_company_vi: escapeHtml(mc.footer_company_vi || ''),
        footer_company_en: escapeHtml(mc.footer_company_en || ''),
    };
}

function applyTemplate(html, vars) {
    let out = html;
    for (const [k, v] of Object.entries(vars)) {
        const token = `{{${k}}}`;
        const parts = out.split(token);
        out = parts.join(v == null ? '' : String(v));
    }
    return out;
}

function loadQrMailAssets(mailConfig) {
    const templatePath = path.join(myPathConfig.root, TEMPLATE_REL);
    if (!fs.existsSync(templatePath)) {
        throw new Error('Không tìm thấy file template: ' + templatePath);
    }
    const templateRaw = fs.readFileSync(templatePath, 'utf8');
    const showBanner = !!mailConfig.banner_option;
    let bannerBase64 = '';
    if (showBanner && mailConfig.banner_img) {
        const abs = path.join(myPathConfig.root, 'public', mailConfig.banner_img.replace(/^\//, ''));
        if (fs.existsSync(abs)) {
            bannerBase64 = fs.readFileSync(abs, { encoding: 'base64' });
        }
    }
    const bannerOrTextSection = buildBannerHtml(showBanner, mailConfig.banner_text);
    const endMailImageSection = buildEndMailImageSection(mailConfig);
    const endMailAttach = getEndMailImageAttachment(mailConfig);
    return {
        templateRaw,
        showBanner,
        bannerBase64,
        bannerOrTextSection,
        endMailImageSection,
        endMailAttach,
    };
}

async function buildQrMailMessage(event, mailConfig, r, assets, fromEmail) {
    const qrPayload = (r.qr_code && String(r.qr_code).trim()) || r.uid;
    const qrBase64 = await QRCode.toDataURL(qrPayload, {
        margin: 1,
        width: 300,
        color: { dark: '#000000', light: '#ffffff' },
    });
    const base64Data = qrBase64.replace(/^data:image\/png;base64,/, '');

    let htmlTemplate = assets.templateRaw;
    const vars = buildTemplateVars(event, mailConfig, r);
    htmlTemplate = applyTemplate(htmlTemplate, vars);
    htmlTemplate = htmlTemplate.replace('<!-- BANNER_OR_TEXT_PLACEHOLDER -->', assets.bannerOrTextSection);
    htmlTemplate = htmlTemplate.replace('<!-- END_MAIL_IMAGE_PLACEHOLDER -->', assets.endMailImageSection);

    const attachments = [];
    if (assets.showBanner && assets.bannerBase64) {
        attachments.push({
            content: assets.bannerBase64,
            filename: 'banner.png',
            type: 'image/png',
            disposition: 'inline',
            content_id: 'banner',
        });
    }
    if (assets.endMailAttach) {
        attachments.push({
            content: assets.endMailAttach.content,
            filename: assets.endMailAttach.filename,
            type: assets.endMailAttach.type,
            disposition: 'inline',
            content_id: 'endmail',
        });
    }
    attachments.push({
        content: base64Data,
        filename: 'qrcode.png',
        type: 'image/png',
        disposition: 'inline',
        content_id: 'qrcode',
    });

    return {
        to: String(r.email).trim(),
        from: {
            email: fromEmail,
            name: (mailConfig.sender_name && String(mailConfig.sender_name).trim()) || 'BTC',
        },
        subject: mailConfig.title,
        html: htmlTemplate,
        attachments,
        substitutionWrappers: ['<<', '>>'],
        hideWarnings: true,
    };
}

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

/**
 * Gửi một email QR (cùng template với gửi hàng loạt). Dùng gửi lại / thủ công từng người.
 */
async function sendQrMailToParticipant(event, participant) {
    ensureSendGrid();
    const fromEmail = getFromEmail();
    if (!fromEmail) {
        throw new Error('Thiếu SENDGRID_FROM_EMAIL hoặc SENDGRID_FROM_DOMAIN (sender đã xác minh trên SendGrid).');
    }
    const em = participant && participant.email && String(participant.email).trim();
    if (!em || !EMAIL_OK.test(em)) {
        throw new Error('Người này không có email hợp lệ.');
    }
    const mailConfig = await eventMailConfigService.findByEventId(event._id);
    if (!mailConfig || !String(mailConfig.title || '').trim()) {
        throw new Error('Chưa cấu hình mail (tiêu đề / nội dung). Lưu cấu hình ở bước 3 trước khi gửi.');
    }
    const assets = loadQrMailAssets(mailConfig);
    const msg = await buildQrMailMessage(event, mailConfig, participant, assets, fromEmail);
    await sgMail.send(msg);
    await participantCheckinHService.setQrMailSentAt(participant._id, event._id, new Date());
    return { to: em };
}

/**
 * Gửi email QR cho toàn bộ người tham dự có email hợp lệ.
 * @returns {{ sent: number, skipped: number, errors: string[] }}
 */
async function sendBulkQrMail(event) {
    ensureSendGrid();
    const fromEmail = getFromEmail();
    if (!fromEmail) throw new Error('Thiếu SENDGRID_FROM_EMAIL hoặc SENDGRID_FROM_DOMAIN (sender đã xác minh trên SendGrid).');

    const mailConfig = await eventMailConfigService.findByEventId(event._id);
    if (!mailConfig || !String(mailConfig.title || '').trim()) {
        throw new Error('Chưa cấu hình mail (tiêu đề / nội dung). Lưu cấu hình trước khi gửi.');
    }

    const participants = await participantCheckinHService.findByEventIdWithValidEmail(event._id);
    if (!participants.length) {
        return { sent: 0, totalRecipients: 0, errors: ['Không có người tham dự nào có email hợp lệ.'] };
    }

    const assets = loadQrMailAssets(mailConfig);

    const errors = [];

    /** Gửi từng mail và ghi nhận qr_mail_sent_at theo đúng người nhận */
    let sent = 0;
    for (const r of participants) {
        let msg;
        try {
            msg = await buildQrMailMessage(event, mailConfig, r, assets, fromEmail);
        } catch (e) {
            errors.push(`${r.email}: ${e.message}`);
            continue;
        }
        try {
            await sgMail.send(msg);
            sent += 1;
            await participantCheckinHService.setQrMailSentAt(r._id, event._id, new Date());
        } catch (e) {
            const label = typeof msg.to === 'string' ? msg.to : JSON.stringify(msg.to);
            const detail = formatSendGridError(e);
            errors.push(`${label}: ${detail}`);
            console.error(CNAME, 'SendGrid send error', label, detail);

            if (isCreditsExceededError(e)) {
                const idx = participants.findIndex((x) => String(x._id) === String(r._id));
                const remaining = idx >= 0 ? participants.length - idx - 1 : 0;
                if (remaining > 0) {
                    errors.push(
                        `(Đã dừng: còn ${remaining} email chưa gửi — SendGrid báo hết quota. Không lặp lại lỗi từng địa chỉ.)`,
                    );
                    console.error(
                        CNAME,
                        `Dừng gửi hàng loạt: hết quota SendGrid. Đã gửi thành công ${sent} trước đó; bỏ qua ${remaining} email.`,
                    );
                }
                break;
            }
        }
    }

    return {
        sent,
        totalRecipients: participants.length,
        errors,
    };
}

module.exports = {
    isSendGridConfigured,
    sendBulkQrMail,
    sendQrMailToParticipant,
    getFromEmail,
    buildEndMailImageSection,
    getEndMailImageAttachment,
};
