const mongoose = require('mongoose');
const SendGridMailEvent = require('../model/SendGridMailEvent');

function extractReason(ev) {
    if (!ev || typeof ev !== 'object') return '';
    if (ev.reason != null && String(ev.reason).trim()) return String(ev.reason).trim().slice(0, 1000);
    if (ev.status != null && String(ev.status).trim()) return String(ev.status).trim().slice(0, 500);
    if (ev.bounce_classification) return String(ev.bounce_classification).slice(0, 500);
    if (ev.dropped_reason) return String(ev.dropped_reason).slice(0, 500);
    return '';
}

/**
 * @param {object[]} items - mảng JSON từ SendGrid Event Webhook
 */
async function recordWebhookEvents(items) {
    const arr = Array.isArray(items) ? items : [];
    let n = 0;
    for (const ev of arr) {
        if (!ev || typeof ev !== 'object') continue;
        const sgEventId = ev.sg_event_id != null ? String(ev.sg_event_id).trim() : '';
        if (!sgEventId) continue;

        const gbEid = ev.gb_eid;
        let eventId = null;
        if (gbEid != null && String(gbEid).trim() && mongoose.Types.ObjectId.isValid(String(gbEid))) {
            eventId = new mongoose.Types.ObjectId(String(gbEid).trim());
        }

        const gbPid = ev.gb_pid;
        let participantId = null;
        if (gbPid != null && String(gbPid).trim() && mongoose.Types.ObjectId.isValid(String(gbPid))) {
            participantId = new mongoose.Types.ObjectId(String(gbPid).trim());
        }

        const toEmail = ev.email != null ? String(ev.email).trim().toLowerCase() : '';
        const sgMessageId = ev['sg_message_id'] != null ? String(ev['sg_message_id']).trim() : '';
        const eventType = ev.event != null ? String(ev.event).trim() : '';
        const mailKind = ev.gb_kind != null ? String(ev.gb_kind).trim() : '';
        const ts =
            typeof ev.timestamp === 'number' && ev.timestamp > 0
                ? new Date(ev.timestamp * 1000)
                : new Date();

        const doc = {
            sg_event_id: sgEventId,
            event_id: eventId,
            participant_id: participantId,
            to_email: toEmail,
            sg_message_id: sgMessageId,
            event_type: eventType,
            mail_kind: mailKind,
            reason: extractReason(ev),
            ts,
        };

        try {
            await SendGridMailEvent.updateOne({ sg_event_id: sgEventId }, { $setOnInsert: doc }, { upsert: true });
            n += 1;
        } catch (e) {
            console.error('sendGridMailEvent.recordWebhookEvents', e.message || e);
        }
    }
    return n;
}

async function listByEventId(eventId, { page = 1, limit = 30 } = {}) {
    if (!mongoose.Types.ObjectId.isValid(String(eventId))) {
        return { items: [], total: 0, page: 1, limit };
    }
    const eid = new mongoose.Types.ObjectId(String(eventId));
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
    const pg = Math.max(1, parseInt(page, 10) || 1);
    const skip = (pg - 1) * lim;

    const [items, total] = await Promise.all([
        SendGridMailEvent.find({ event_id: eid })
            .sort({ ts: -1 })
            .skip(skip)
            .limit(lim)
            .lean(),
        SendGridMailEvent.countDocuments({ event_id: eid }),
    ]);

    return {
        items: items.map((r) => ({
            id: String(r._id),
            to_email: r.to_email || '',
            event_type: r.event_type || '',
            mail_kind: r.mail_kind || '',
            sg_message_id: r.sg_message_id || '',
            reason: r.reason || '',
            ts: r.ts,
            participant_id: r.participant_id ? String(r.participant_id) : '',
        })),
        total,
        page: pg,
        limit: lim,
    };
}

module.exports = {
    recordWebhookEvents,
    listByEventId,
};
