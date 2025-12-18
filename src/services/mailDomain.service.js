const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY_DOMAIN);

async function sendMailDomain(email, otp) {
    await sgMail.send({
        to: email,
        from: {email: process.env.SENDGRID_FROM_DOMAIN, name: 'AccessRace'},
        subject: 'Your OTP code',
        html: `
            <h2>Email Verification</h2>
            <p>Your OTP code:</p>
            <h1>${otp}</h1>
            <p>Expire in 5 minutes</p>
        `
    });
}

module.exports = { sendMailDomain };
