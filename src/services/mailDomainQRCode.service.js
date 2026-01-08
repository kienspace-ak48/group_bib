const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY_DOMAIN);
//

async function sendMailDomainQRCode(email, name, qrBase64) {
    const base64Data = qrBase64.replace(/^data:image\/png;base64,/, '');
    await sgMail.send({
        to: email,
        from: { email: process.env.SENDGRID_FROM_DOMAIN, name: 'AccessRace' },
        subject: 'Your OTP code',
        html: `
<div style="font-family: Arial, sans-serif; background: #f0f8ff;">

  <div style="margin: auto; background: #fff; border-radius: 12px; box-shadow: 0 3px 8px rgba(0,0,0,0.1); overflow: hidden;">

    <!-- Banner -->
    <div style="background: linear-gradient(90deg, #2196f3, #ff9800); color: #fff; padding: 25px; text-align: center;">
      <h2 style="margin: 0; font-size: 24px;">Giải Chạy XYZ 2026</h2>
      <p style="margin: 5px 0 0; font-size: 15px;">Location: Quan 1, HCMC</p>
    </div>

    <!-- QR Code -->
    <div style="padding: 25px; text-align: center;">
      <img 
        src="cid:qrcode"
        alt="QR Code"
        width="220"
        style="max-width: 220px; border: 3px solid #2196f3; border-radius: 12px; padding: 6px; background: #fff;"
      />
      <p style="margin-top: 10px; font-size: 14px; color: #444;">
        Quét QR để check thông tin
      </p>
    </div>

    <!-- Thông tin VĐV -->
    <div style="padding: 20px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
        <tr style="background: #f9f9f9;">
          <td style="padding: 10px; border: 1px solid #ddd;"><b>Họ và tên</b></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${name}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><b>Mã số</b></td>
          <td style="padding: 10px; border: 1px solid #ddd; color: #e65100; font-weight: bold;">${'21000'}</td>
        </tr>
        <tr style="background: #f9f9f9;">
          <td style="padding: 10px; border: 1px solid #ddd;"><b>CCCD</b></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${'12345678910'}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><b>Đơn vị</b></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${'21KM'}</td>
        </tr>
        <tr style="background: #f9f9f9;">
          <td style="padding: 10px; border: 1px solid #ddd;"><b>📅 Ngày sự kiện</b></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${'01/01/2026'}</td>
        </tr>
      </table>
    </div>

    <!-- Link dự phòng -->
    <div style="text-align: center; padding: 15px;">
      <p style="font-size: 14px;">
        Nếu bạn không thấy QR code:<br>
        <a href="${'/'}" style="color: #2196f3; font-weight: bold; text-decoration: none;">
          👉 Nhấn vào đây / Click here
        </a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background: #fafafa; padding: 15px; text-align: center; font-size: 13px; color: #666;">
      © 2025 Giải Chạy XYZ · 
      <a href="mailto:support@race.com" style="color: #2196f3;">support@race.com</a>
    </div>

  </div>
</div>
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
