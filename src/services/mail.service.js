const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
// console.log(process.env.SENDGRID_API_KEY, process.env.SENDGRID_FROM )

async function sendOtpMail(email, otp) {
    await sgMail.send({
        to: email,
        from: process.env.SENDGRID_FROM,
        subject: 'Your OTP code',
        html: `
            <h2>Email Verification</h2>
            <p>Your OTP code:</p>
            <h1>${otp}</h1>
            <p>Expire in 5 minutes</p>
        `
    });
}

module.exports = { sendOtpMail };
