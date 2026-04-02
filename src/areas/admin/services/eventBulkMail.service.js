const fs = require('fs');
const path = require('path');
const sgMail = require('@sendgrid/mail');
const QRCode = require('qrcode');
const myPathConfig = require('../../../config/mypath.config');
const eventMailConfigService = require('./eventMailConfig.service');
const mongoose = require('mongoose');
const participantCheckinHService = require('./participantCheckinH.service');
const mailBulkJobService = require('./mailBulkJob.service');
const auditLogService = require('./auditLog.service');
const eventCheckinHService = require('./eventCheckinH.service');
const { resolvePickupRangeDisplay } = require('../../../utils/pickupTimeRange.util');
const { getPublicBaseUrl } = require('../../../utils/publicBaseUrl.util');

const BATCH_MAIL_BATCH = 50;
const BATCH_MAIL_CONCURRENCY = 4;

/** Email hợp lệ cho người nhận mail QR (VĐV hoặc người được ủy quyền). */
const QR_MAIL_EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function delegationEnabledForMail(p) {
    if (!p || p.delegation_enabled == null) return false;
    const v = p.delegation_enabled;
    return v === true || v === 'true' || v === 1 || v === '1';
}

function trimMailField(v) {
    if (v == null) return '';
    return String(v).trim();
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function sendGridSendWithRetry(msg) {
    let lastErr;
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            await sgMail.send(msg);
            return;
        } catch (e) {
            lastErr = e;
            if (isCreditsExceededError(e)) throw e;
            const status = e.response && e.response.statusCode;
            if (status === 429 || (typeof status === 'number' && status >= 500)) {
                await sleep(250 * Math.pow(2, attempt));
                continue;
            }
            throw e;
        }
    }
    throw lastErr;
}

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

/**
 * Cột Early BIB trong mail: `zone` === "earlybib" (không phân biệt hoa thường) → tick xanh;
 * tương thích dữ liệu cũ: "1" / 1 / true → tick xanh; mọi giá trị khác → X đỏ (HTML, không escape).
 */
function buildZoneIndicatorHtml(zoneVal) {
    const raw = String(zoneVal != null ? zoneVal : '').trim();
    const lower = raw.toLowerCase();
    const isEarlyBib =
        lower === 'earlybib' ||
        lower === '1' ||
        zoneVal === 1 ||
        zoneVal === true;
    if (isEarlyBib) {
        return '<span style="display:inline-block;border:2px solid #2e7d32;border-radius:4px;background:#e8f5e9;color:#2e7d32;font-size:15px;line-height:1;padding:3px 8px;font-weight:bold;">&#10003;</span>';
    }
    return '<span style="display:inline-block;border:2px solid #c62828;border-radius:4px;background:#ffebee;color:#c62828;font-size:15px;line-height:1;padding:3px 8px;font-weight:bold;">&#10007;</span>';
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

/** @deprecated Chỉ để tương thích event_old.controller — không còn ảnh cuối mail. */
function buildEndMailImageSection() {
    return '';
}

/** @deprecated */
function getEndMailImageAttachment() {
    return null;
}

function buildBannerHtml(showBanner, bannerText) {
    let bannerOrTextSection = '';
    if (showBanner) {
        bannerOrTextSection = `<tr>
                        <td align="center">
                            <img
                                src="cid:banner"
                                alt="Banner"
                                width="680"
                                style="display: block; 
                                    max-width: 680px; 
                                    width: 100%; 
                                    height: auto;
                                    -ms-interpolation-mode: bicubic;"  
                            />
                        </td>
                    </tr>`;
    } else {
        const t = escapeHtml(bannerText || '');
        bannerOrTextSection = `<tr>
                        <td align="left" style="padding: 0 16px; font-family: Arial, sans-serif; font-size: 12px; color: #333333">
                            <h1 style="margin:0;font-size:18px;line-height:1.25;font-weight:bold">${t}</h1>
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
function buildDelegationCtaBlock(event, participant) {
    if (!event || event.single_delegation_enabled === false) return '';
    const token = participant && participant.delegation_token;
    if (!token) return '';
    const hostBase = getPublicBaseUrl();
    const path = `/tool-checkin/delegate/${encodeURIComponent(String(token))}`;
    const fullUrl = hostBase ? `${hostBase}${path}` : path;
    const safeHref = String(fullUrl)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
    return `<table width="100%" cellpadding="0" cellspacing="0" style="margin: 14px 0; border: 1px solid #e0e0e0; border-radius: 8px; background: #f9fafb;"><tr><td style="padding: 10px 12px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #333;">
<p style="margin: 0 0 6px 0; font-weight: bold; font-size: 12px; line-height: 1.25;">Ủy quyền nhận hộ <span style="color:#555;font-weight:600;">· Pickup Authorization</span></p>
<p style="margin: 0 0 5px 0; font-size: 11px; line-height: 1.4; color: #444;">Nếu bạn nhờ người khác nhận BIB, vui lòng khai báo tại đây. Thực hiện <strong>một lần duy nhất</strong></p>
<p style="margin: 0 0 10px 0; font-size: 10px; line-height: 1.4; color: #666;">If someone is picking up your BIB on your behalf, please declare their information here. This is a <strong>one-time action</strong></p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;border-collapse:collapse;">
<tr><td align="center" bgcolor="#0d6efd" style="border-radius:6px;mso-padding-alt:8px 14px;">
<a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:8px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;line-height:1.2;color:#ffffff !important;text-decoration:none;-webkit-text-size-adjust:none;">Ủy quyền · Authorization</a>
</td></tr></table>
</td></tr></table>`;
}

/**
 * Người nhận mail QR: ưu tiên email người được ủy quyền khi bật ủy quyền và delegate_email hợp lệ.
 * `delegation_enabled` chuẩn hóa (true / 'true' / 1) để khớp dữ liệu từ form hoặc bản ghi cũ.
 */
function resolveQrMailRecipient(participant) {
    if (!participant) return null;
    const en = delegationEnabledForMail(participant);
    const de = trimMailField(participant.delegate_email);
    const ae = trimMailField(participant.email);
    if (en && de && QR_MAIL_EMAIL_OK.test(de)) {
        return {
            to: de,
            greetingName: trimMailField(participant.delegate_fullname) || 'Quý khách',
            isDelegate: true,
        };
    }
    if (ae && QR_MAIL_EMAIL_OK.test(ae)) {
        return {
            to: ae,
            greetingName: trimMailField(participant.fullname) || 'Quý khách',
            isDelegate: false,
        };
    }
    return null;
}

function buildPerAthleteDelegateToMailNotice(r) {
    const athleteName = escapeHtml(r.fullname || '');
    const bib = escapeHtml(r.bib != null ? String(r.bib) : '');
    return `<table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 14px 0; border: 1px solid #ff9800; border-radius: 8px; background: #fff8e1;">
<tr><td style="padding: 12px 14px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #333;">
<p style="margin: 0 0 6px 0; font-weight: bold; color: #e65100;">Nguời được ủy quyền · <span style="color:#bf360c;">Pickup representative</span></p>
<p style="margin: 0 0 6px 0; font-size: 11px; line-height: 1.45; color: #444;">Bạn nhận thư này để nhận đồ / check-in thay cho <strong>${athleteName}</strong> (mã <strong>${bib}</strong>). Mã QR dưới đây thuộc bản ghi người tham gia — dùng khi làm thủ tục tại sự kiện.</p>
<p style="margin: 0; font-size: 11px; line-height: 1.45; color: #666;">This message is for picking up materials or checking in on behalf of <strong>${athleteName}</strong> (code <strong>${bib}</strong>). The QR below belongs to that participant’s registration.</p>
</td></tr></table>`;
}

function buildTemplateVars(event, mailConfig, r) {
    const mc = mailConfig || {};
    const name = escapeHtml(r.fullname || '');
    return {
        event_name: escapeHtml(event.name || ''),
        location: escapeHtml(event.location || ''),
        fullname: name,
        greeting_name: name,
        gender: formatGenderLabel(r.gender),
        dob: formatDateVi(r.dob),
        bibname: escapeHtml(r.bib_name != null ? String(r.bib_name) : ''),
        email: r.email && String(r.email).trim() ? escapeHtml(String(r.email).trim()) : '—',
        phone: r.phone && String(r.phone).trim() ? escapeHtml(String(r.phone).trim()) : '—',
        pickup_range: escapeHtml(resolvePickupRangeDisplay(r.pickup_time_range)),
        zone_cell: escapeHtml(r.zone != null ? String(r.zone) : r.line),
        content_1: mc.content_1 == null ? '' : String(mc.content_1),
        content_2: mc.content_2 == null ? '' : String(mc.content_2),
        code: escapeHtml(r.bib != null ? String(r.bib) : ''),
        cccd: escapeHtml(r.cccd != null ? String(r.cccd) : ''),
        category: escapeHtml(r.category != null && String(r.category) !== '' ? String(r.category) : ''),
        tshirt_size: escapeHtml(r.item != null ? String(r.item) : '—'),
        start_date: formatDateVi(event.start_date),
        end_date: formatDateVi(event.end_date),
        footer_bg_color: escapeHtml(mc.footer_bg_color || '#f8f8f8'),
        footer_text_color: escapeHtml(mc.footer_text_color || '#666666'),
        footer_body: mc.footer_body == null ? '' : String(mc.footer_body),
        delegation_cta_block: buildDelegationCtaBlock(event, r),
        delegate_notice_block: '',
        qr_caption:
            '<p align="center" style="margin: 0 0 12px 0; font-size: 11px">Vui lòng mang mã QR này để check-in.</p>',
    };
}

/**
 * Biến template cho mail đại diện nhóm: cùng layout mail QR, bảng thông tin VĐV, QR = URL trang nhóm.
 */
function buildGroupDelegateTemplateVars(event, mailConfig, r, representative) {
    const base = buildTemplateVars(event, mailConfig, r);
    const repName = escapeHtml(representative.fullname || '');
    const athleteName = escapeHtml(r.fullname || '');
    const bib = escapeHtml(r.bib != null ? String(r.bib) : '');
    const notice = `<table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 14px 0; border: 1px solid #ff9800; border-radius: 8px; background: #fff8e1;">
<tr><td style="padding: 12px 14px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #333;">
<p style="margin: 0 0 6px 0; font-weight: bold; color: #e65100;">Thông báo: người nhận đồ hộ</p>
<p style="margin: 0; font-size: 11px; line-height: 1.45; color: #444;">Bạn nhận email này với tư cách <strong>người đại diện</strong> được VĐV <strong>${athleteName}</strong> (BIB <strong>${bib}</strong>) nhờ <strong>nhận BIB / kit thay</strong>. Dưới đây là thông tin VĐV và mã QR mở trang danh sách nhóm trong công cụ check-in (khác với mail QR cá nhân gửi đúng VĐV).</p>
</td></tr></table>`;
    const qrCaption = `<p align="center" style="margin: 0 0 12px 0; font-size: 11px; line-height: 1.45; color: #444;">Đây là <strong>mã QR</strong> mở trang <strong>danh sách nhóm</strong> trong công cụ check-in. Vui lòng mở bằng tài khoản check-in đã đăng nhập. Mã này khác mã QR cá nhân của VĐV.</p>`;
    return {
        ...base,
        greeting_name: repName,
        delegation_cta_block: '',
        delegate_notice_block: notice,
        qr_caption: qrCaption,
    };
}

/**
 * @param {string} toolFullUrl - URL tuyệt đối (https?://...) để nhúng QR
 */
async function buildGroupDelegateMailMessage(event, mailConfig, participant, representative, assets, fromEmail, toolFullUrl) {
    const qrPayload = String(toolFullUrl || '').trim();
    if (!qrPayload) {
        throw new Error('Thiếu URL đầy đủ cho mã QR nhóm.');
    }
    const qrBase64 = await QRCode.toDataURL(qrPayload, {
        margin: 1,
        width: 300,
        color: { dark: '#000000', light: '#ffffff' },
    });
    const base64Data = qrBase64.replace(/^data:image\/png;base64,/, '');

    let htmlTemplate = assets.templateRaw;
    const vars = buildGroupDelegateTemplateVars(event, mailConfig, participant, representative);
    htmlTemplate = applyTemplate(htmlTemplate, vars);
    htmlTemplate = htmlTemplate.replace('<!-- BANNER_OR_TEXT_PLACEHOLDER -->', assets.bannerOrTextSection);

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
    attachments.push({
        content: base64Data,
        filename: 'qrcode.png',
        type: 'image/png',
        disposition: 'inline',
        content_id: 'qrcode',
    });

    const bibStr = participant.bib != null ? String(participant.bib) : '';
    const subject = `[Ủy quyền nhận đồ] ${String(event.name || 'Sự kiện').slice(0, 120)} — BIB ${bibStr}`;

    return {
        to: String(representative.email).trim(),
        from: {
            email: fromEmail,
            name: (mailConfig.sender_name && String(mailConfig.sender_name).trim()) || 'BTC',
        },
        subject,
        html: htmlTemplate,
        attachments,
        substitutionWrappers: ['<<', '>>'],
        hideWarnings: true,
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
    return {
        templateRaw,
        showBanner,
        bannerBase64,
        bannerOrTextSection,
    };
}

/** Dữ liệu VĐV mẫu chỉ dùng cho xem trước HTML (không gửi mail). */
const SAMPLE_PREVIEW_PARTICIPANT = {
    _id: '000000000000000000000000',
    uid: 'preview_sample_uid',
    qr_code: 'preview_sample_uid',
    delegation_token: 'preview_token_sample',
    fullname: 'Nguyễn Văn A',
    bib: '1001',
    bib_name: 'VAN A - 21K',
    gender: true,
    dob: new Date('1990-05-15T00:00:00.000Z'),
    cccd: '034085001234',
    email: 'vdv.mau@example.com',
    phone: '0909123456',
    category: '21km',
    item: 'Áo size M',
    zone: 'earlybib',
    pickup_time_range: '08:00 - 10:00',
};

/**
 * HTML giống mail gửi thật nhưng thay cid QR/banner bằng data URL để mở trong trình duyệt.
 * @param {object} event
 * @param {object} mailConfig
 * @returns {Promise<string>} Đoạn bắt đầu bằng `<body`…`</body>`
 */
async function buildQrMailPreviewHtml(event, mailConfig) {
    const r = SAMPLE_PREVIEW_PARTICIPANT;
    const assets = loadQrMailAssets(mailConfig);
    const qrPayload = (r.qr_code && String(r.qr_code).trim()) || r.uid;
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
        margin: 1,
        width: 300,
        color: { dark: '#000000', light: '#ffffff' },
    });

    let htmlTemplate = assets.templateRaw;
    const vars = buildTemplateVars(event, mailConfig, r);
    htmlTemplate = applyTemplate(htmlTemplate, vars);
    htmlTemplate = htmlTemplate.replace('<!-- BANNER_OR_TEXT_PLACEHOLDER -->', assets.bannerOrTextSection);

    htmlTemplate = htmlTemplate.replace(/src="cid:qrcode"/g, `src="${qrDataUrl}"`);

    if (assets.showBanner && assets.bannerBase64) {
        const bannerDataUrl = `data:image/png;base64,${assets.bannerBase64}`;
        htmlTemplate = htmlTemplate.replace(/src="cid:banner"/g, `src="${bannerDataUrl}"`);
    }

    return htmlTemplate;
}

async function buildQrMailMessage(event, mailConfig, r, assets, fromEmail) {
    let rForMail = r;
    if (event && event.single_delegation_enabled !== false) {
        const tok = await participantCheckinHService.ensureDelegationToken(r._id);
        rForMail = { ...r, delegation_token: tok || r.delegation_token };
    }
    const rec = resolveQrMailRecipient(rForMail);
    if (!rec) {
        throw new Error('Không có email hợp lệ để gửi (VĐV hoặc người được ủy quyền).');
    }
    const qrPayload = (rForMail.qr_code && String(rForMail.qr_code).trim()) || rForMail.uid;
    const qrBase64 = await QRCode.toDataURL(qrPayload, {
        margin: 1,
        width: 300,
        color: { dark: '#000000', light: '#ffffff' },
    });
    const base64Data = qrBase64.replace(/^data:image\/png;base64,/, '');

    let htmlTemplate = assets.templateRaw;
    const vars = buildTemplateVars(event, mailConfig, rForMail);
    vars.greeting_name = escapeHtml(rec.greetingName);
    if (rec.isDelegate) {
        vars.delegation_cta_block = '';
        vars.delegate_notice_block = buildPerAthleteDelegateToMailNotice(rForMail);
        vars.qr_caption =
            '<p align="center" style="margin: 0 0 12px 0; font-size: 11px; line-height: 1.45; color: #444;">Mang mã QR khi nhận đồ thay người tham gia. / Bring this QR when collecting on behalf of the participant.</p>';
    }
    htmlTemplate = applyTemplate(htmlTemplate, vars);
    htmlTemplate = htmlTemplate.replace('<!-- BANNER_OR_TEXT_PLACEHOLDER -->', assets.bannerOrTextSection);

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
    attachments.push({
        content: base64Data,
        filename: 'qrcode.png',
        type: 'image/png',
        disposition: 'inline',
        content_id: 'qrcode',
    });

    return {
        to: String(rec.to).trim(),
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

/**
 * Gửi một email QR (cùng template với gửi hàng loạt). Dùng gửi lại / thủ công từng người.
 * @returns {{ to: string, recipientType: 'delegate'|'athlete' }}
 */
async function sendQrMailToParticipant(event, participant) {
    ensureSendGrid();
    const fromEmail = getFromEmail();
    if (!fromEmail) {
        throw new Error('Thiếu SENDGRID_FROM_EMAIL hoặc SENDGRID_FROM_DOMAIN (sender đã xác minh trên SendGrid).');
    }
    const rec = resolveQrMailRecipient(participant);
    if (!rec || !QR_MAIL_EMAIL_OK.test(rec.to)) {
        throw new Error(
            'Không gửi được: thiếu email hợp lệ (VĐV hoặc người được ủy quyền khi đã bật ủy quyền).',
        );
    }
    const mailConfig = await eventMailConfigService.findByEventId(event._id);
    if (!mailConfig || !String(mailConfig.title || '').trim()) {
        throw new Error('Chưa cấu hình mail (tiêu đề / nội dung). Lưu cấu hình ở bước 3 trước khi gửi.');
    }
    const assets = loadQrMailAssets(mailConfig);
    const msg = await buildQrMailMessage(event, mailConfig, participant, assets, fromEmail);
    await sgMail.send(msg);
    await participantCheckinHService.setQrMailSentAt(participant._id, event._id, new Date());
    return { to: rec.to, recipientType: rec.isDelegate ? 'delegate' : 'athlete' };
}

/**
 * Tạo job gửi mail QR hàng loạt (worker xử lý nền). Một sự kiện chỉ một job active.
 * @returns {{ ok: true, jobId: string, totalRecipients: number } | { ok: false, message: string }}
 */
async function enqueueBulkQrMailJob(event, createdByUserId) {
    ensureSendGrid();
    const fromEmail = getFromEmail();
    if (!fromEmail) {
        return { ok: false, message: 'Thiếu SENDGRID_FROM_EMAIL hoặc SENDGRID_FROM_DOMAIN (sender đã xác minh trên SendGrid).' };
    }

    const mailConfig = await eventMailConfigService.findByEventId(event._id);
    if (!mailConfig || !String(mailConfig.title || '').trim()) {
        return { ok: false, message: 'Chưa cấu hình mail (tiêu đề / nội dung). Lưu cấu hình trước khi gửi.' };
    }

    const active = await mailBulkJobService.findActiveJobForEvent(event._id);
    if (active) {
        return {
            ok: false,
            message: 'Đã có job gửi mail đang chạy hoặc chờ xử lý. Đợi hoàn tất hoặc tải lại trang để xem tiến độ.',
        };
    }

    const total = await participantCheckinHService.countWithValidEmailByEventId(event._id);
    if (total === 0) {
        return { ok: false, message: 'Không có người tham dự nào có email hợp lệ.' };
    }

    const actorId =
        createdByUserId && mongoose.Types.ObjectId.isValid(String(createdByUserId))
            ? new mongoose.Types.ObjectId(String(createdByUserId))
            : null;

    const job = await mailBulkJobService.createQueuedJob({
        event_id: event._id,
        total,
        created_by: actorId,
    });

    return { ok: true, jobId: String(job._id), totalRecipients: total };
}

async function processMailBulkWorkerTick() {
    const jobDoc = await mailBulkJobService.findNextPendingJob();
    if (!jobDoc) return;

    if (jobDoc.status === 'queued') {
        jobDoc.status = 'running';
        jobDoc.started_at = new Date();
        await jobDoc.save();
    }

    const event = await eventCheckinHService.getById(jobDoc.event_id);
    if (!event) {
        await mailBulkJobService.markJobFailed(jobDoc._id, 'Không tìm thấy sự kiện.');
        return;
    }

    const mailConfig = await eventMailConfigService.findByEventId(event._id);
    if (!mailConfig || !String(mailConfig.title || '').trim()) {
        await mailBulkJobService.markJobFailed(jobDoc._id, 'Chưa cấu hình mail (tiêu đề / nội dung).');
        return;
    }

    let assets;
    try {
        assets = loadQrMailAssets(mailConfig);
    } catch (e) {
        await mailBulkJobService.markJobFailed(jobDoc._id, e.message || 'Lỗi template mail.');
        return;
    }

    ensureSendGrid();
    const fromEmail = getFromEmail();
    if (!fromEmail) {
        await mailBulkJobService.markJobFailed(jobDoc._id, 'Thiếu SENDGRID_FROM_EMAIL.');
        return;
    }

    const lastId = jobDoc.last_participant_id || null;
    const batch = await participantCheckinHService.findNextBatchWithValidEmail(event._id, lastId, BATCH_MAIL_BATCH);

    if (batch.length === 0) {
        await mailBulkJobService.markJobCompleted(jobDoc._id);
        const j = await mailBulkJobService.getJobById(jobDoc._id);
        await auditLogService.write({
            actorId: j && j.created_by ? j.created_by : undefined,
            action: 'create',
            resource: 'mail_bulk',
            documentId: event._id,
            summary: `Gửi mail QR hàng loạt (job): ${j ? j.sent : 0}/${j ? j.total : 0} gửi, lỗi ${j ? j.failed : 0}`,
        });
        return;
    }

    let sentDelta = 0;
    let failedDelta = 0;
    const pushErrors = [];
    let stopCredits = false;

    for (let i = 0; i < batch.length; i += BATCH_MAIL_CONCURRENCY) {
        const chunk = batch.slice(i, i + BATCH_MAIL_CONCURRENCY);
        const results = await Promise.all(
            chunk.map(async (r) => {
                let msg;
                try {
                    msg = await buildQrMailMessage(event, mailConfig, r, assets, fromEmail);
                } catch (e) {
                    return { ok: false, err: `${r.email}: ${e.message}`, credits: false };
                }
                try {
                    await sendGridSendWithRetry(msg);
                    await participantCheckinHService.updateQrMailSentAtById(r._id, event._id, new Date());
                    return { ok: true };
                } catch (e) {
                    const label = typeof msg.to === 'string' ? msg.to : JSON.stringify(msg.to);
                    const detail = formatSendGridError(e);
                    if (isCreditsExceededError(e)) {
                        return { ok: false, err: `${label}: ${detail}`, credits: true };
                    }
                    return { ok: false, err: `${label}: ${detail}`, credits: false };
                }
            }),
        );

        for (const cr of results) {
            if (cr.ok) {
                sentDelta += 1;
            } else {
                failedDelta += 1;
                if (pushErrors.length < 30) pushErrors.push(cr.err);
                if (cr.credits) stopCredits = true;
            }
        }
        if (stopCredits) break;
    }

    if (stopCredits && pushErrors.length < 30) {
        pushErrors.push('(Đã dừng: SendGrid báo hết quota — các email còn lại chưa gửi.)');
    }

    const lastPid = batch[batch.length - 1]._id;
    await mailBulkJobService.applyBatchResult(jobDoc._id, {
        last_participant_id: lastPid,
        sentDelta,
        failedDelta,
        pushErrors,
    });

    if (stopCredits) {
        await mailBulkJobService.markJobCompleted(jobDoc._id);
        const j2 = await mailBulkJobService.getJobById(jobDoc._id);
        await auditLogService.write({
            actorId: j2 && j2.created_by ? j2.created_by : undefined,
            action: 'create',
            resource: 'mail_bulk',
            documentId: event._id,
            summary: `Gửi mail QR hàng loạt (job, hết quota): ${j2 ? j2.sent : 0}/${j2 ? j2.total : 0} gửi, lỗi ${j2 ? j2.failed : 0}`,
        });
    }
}

/**
 * Payload JSON cho GET status (EJS / poll).
 * @param {object} jobLean
 */
function serializeBulkJobForApi(jobLean) {
    if (!jobLean) return null;
    return {
        id: String(jobLean._id),
        status: jobLean.status,
        total: jobLean.total,
        sent: jobLean.sent,
        failed: jobLean.failed,
        started_at: jobLean.started_at,
        finished_at: jobLean.finished_at,
        errors_sample: jobLean.errors_sample || [],
        stop_reason: jobLean.stop_reason || null,
    };
}

/**
 * Mỗi lần gán VĐV vào nhóm ủy quyền: một email tới đại diện (nếu có email hợp lệ và SendGrid bật).
 * @param {object} params
 * @param {object} params.event - event_checkin_h
 * @param {object} params.representative - { fullname, email, ... }
 * @param {object} params.participant - participant_checkin_h
 * @param {string} params.toolFullUrl - URL tuyệt đối hoặc path (hiển thị + href)
 * @param {string} [params.toolPath] - path dự phòng (khi thiếu domain public)
 */
async function sendGroupDelegateNotificationMail({ event, representative, participant, toolFullUrl, toolPath }) {
    ensureSendGrid();
    const fromEmail = getFromEmail();
    if (!fromEmail) {
        throw new Error('Thiếu SENDGRID_FROM_EMAIL hoặc SENDGRID_FROM_DOMAIN (sender đã xác minh trên SendGrid).');
    }
    const to = String(representative.email || '').trim();
    if (!QR_MAIL_EMAIL_OK.test(to)) {
        throw new Error('Email đại diện không hợp lệ.');
    }
    const mailConfig = await eventMailConfigService.findByEventId(event._id);
    if (!mailConfig || !String(mailConfig.title || '').trim()) {
        throw new Error('Chưa cấu hình mail (tiêu đề / nội dung). Lưu cấu hình ở bước 3 trước khi gửi.');
    }
    let href = String(toolFullUrl || toolPath || '').trim();
    const hostBase = getPublicBaseUrl();
    if (href && href.startsWith('/') && hostBase) {
        href = `${String(hostBase).replace(/\/$/, '')}${href}`;
    }
    if (!href || !/^https?:\/\//i.test(href)) {
        throw new Error(
            'Thiếu URL đầy đủ công khai cho QR nhóm (đặt PUBLIC_BASE_URL trong .env — ví dụ http://localhost:8080).',
        );
    }
    const assets = loadQrMailAssets(mailConfig);
    const msg = await buildGroupDelegateMailMessage(
        event,
        mailConfig,
        participant,
        representative,
        assets,
        fromEmail,
        href,
    );
    await sendGridSendWithRetry(msg);
}

module.exports = {
    isSendGridConfigured,
    enqueueBulkQrMailJob,
    processMailBulkWorkerTick,
    serializeBulkJobForApi,
    sendQrMailToParticipant,
    sendGroupDelegateNotificationMail,
    getFromEmail,
    buildEndMailImageSection,
    getEndMailImageAttachment,
    buildQrMailPreviewHtml,
};
