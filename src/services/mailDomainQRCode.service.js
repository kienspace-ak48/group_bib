const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY_DOMAIN);

async function sendMailDomainQRCode(email, name, qrBase64) {
    const base64Data = qrBase64.replace(/^data:image\/png;base64,/, '');
    await sgMail.send({
        to: email,
        from: { email: process.env.SENDGRID_FROM_DOMAIN, name: 'AccessRace' },
        subject: 'Your OTP code',
        html: `
      <h3>Xin chào ${name}</h3>
      <p>Vui lòng dùng mã QR dưới đây để check-in</p>
      <img src="cid:qrcode" width="200" />
    `,
        attachments: [
            {
                content: base64Data,
                filename: 'qrcode.png',
                type: 'image/png',
                disposition: 'inline',
                content_id: 'qrcode',
            },
        ],
    });
}

module.exports = { sendMailDomainQRCode };
