const sendGridMailEventService = require('../services/sendGridMailEvent.service');

/**
 * SendGrid Event Webhook — POST JSON array.
 * Bảo vệ bằng SENDGRID_WEBHOOK_SECRET: query ?key=... hoặc header X-Webhook-Key.
 */
async function ingest(req, res) {
    const secret = process.env.SENDGRID_WEBHOOK_SECRET;
    if (secret != null && String(secret).trim() !== '') {
        const q = req.query && req.query.key != null ? String(req.query.key) : '';
        const h = req.get('x-webhook-key') || req.get('X-Webhook-Key') || '';
        if (q !== String(secret).trim() && h !== String(secret).trim()) {
            return res.status(401).type('text/plain').send('Unauthorized');
        }
    }

    try {
        const body = req.body;
        const items = Array.isArray(body) ? body : body ? [body] : [];
        const n = await sendGridMailEventService.recordWebhookEvents(items);
        return res.status(200).type('text/plain').send(`OK ${n}`);
    } catch (e) {
        console.error('sendgridWebhook.ingest', e);
        return res.status(500).type('text/plain').send('Error');
    }
}

module.exports = {
    ingest,
};
