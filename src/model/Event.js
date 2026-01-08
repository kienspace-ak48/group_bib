const mongoose = require('mongoose');
const slugify = require('slugify');

const eventSchema = new mongoose.Schema(
    {
        name: String,
        slug: String,
        short_id: String,
        desc: String,
        img_thumb: String,
        img_banner: String,
        location: String,
        start_date: Date,
        end_date: Date,
        isShow: { type: Boolean, default: false },
        status: String,
        race_function: {type: String, enum: ['checkin', 'ticket'], default: 'ticket'},
        race_type: String,
        organizer_name: String,
        organizer_web: String,
        organizer_fanpage: String,
        organizer_zalo: String,
    },
    { timestamps: true },
);

// pre save
eventSchema.pre('save', function (next) {
    if (!this.slug || this.slug.trim() === '') {
        this.slug = slugify(this.name + '-' + Date.now(), { lower: true, strict: true, locale: 'vi' });
    }
    next();
});

module.exports = mongoose.model('event', eventSchema);
