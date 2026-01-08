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
        checkin_status:{type: Boolean, default: false},
        event_id: String, //{type: mongoose.Schema.Types.ObjectId, ref: 'event'},
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
        nationlity: String,
        nation: String,
        city: String,
        patron_name: String,
        patron_phone: String,
        team: String,
        blood: String,
        medical: String,
        medicine: String,
        verify_by: { type: String, default: null },
        payment_status: { type: String, default: 'PENDING' },
    },
    { timestamps: true },
);

module.exports = mongoose.model('participant_checkin', ParticipantCheckinSchema);
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
