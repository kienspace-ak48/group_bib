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

const BATCH_MAIL_BATCH = 50;
const BATCH_MAIL_CONCURRENCY = 4;

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

module.exports = {
    isSendGridConfigured,
    enqueueBulkQrMailJob,
    processMailBulkWorkerTick,
    serializeBulkJobForApi,
    sendQrMailToParticipant,
    getFromEmail,
    buildEndMailImageSection,
    getEndMailImageAttachment,
    buildQrMailPreviewHtml,
};
