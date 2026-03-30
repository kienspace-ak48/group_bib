const mongoose = require('mongoose');
const slugify = require('slugify');

const ParticipantCheckinSchema = new mongoose.Schema(
    {
        uid: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        checkin_status: { type: Boolean, default: false },
        /** FK tới sự kiện check-in (event_checkin_h) */
        event_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'event_checkin_h',
            required: true,
            index: true,
        },
        distance_name: String,
        order_item_id: String,
        order_id: String,
        fullname: { type: String, required: true },
        cccd: { type: String, required: true },
        bib: String,
        distance: String,
        tshirt_size: String,
        bib_name: String,
        email: String,
        phone: String,
        dob: Date,
        gender: Boolean,
        line: String,
        nationality: String,
        nationlity: String,
        nation: String,
        city: String,
        patron_name: String,
        patron_phone: String,
        team: String,
        blood: String,
        medical: String,
        medicine: String,
        /** Chip timing (hiển thị cột ChipId) */
        chip_id: { type: String, index: true },
        mail_status: String,
        group_checkin_status: String,
        authorization_status: String,
        waiver_status: String,
    },
    { timestamps: true },
);

module.exports = mongoose.model('participant_checkin_h', ParticipantCheckinSchema);
//
// payment_status: {
//   type: String,
//   enum: [
//     'PENDING',
//     'PROCESSING',
//     'PAID',
//     'FAILED',
//     'EXPIRED',
//     'REFUNDED'
//   ],
//   default: 'PENDING'
// }
