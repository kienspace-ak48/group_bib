const mongoose = require('mongoose');
const slugify = require('slugify');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema(
    {
        fullname: { type: String, length: 50 },
        username: { type: String, length: 50 },
        password: { type: String, length: 200 },
        email: { type: String, length: 100 },
        phone: { type: String, length: 20 },
        role_id: { type: String, default: 'user' },
        avatar: String,
        is_verified: {type: Boolean, default: false},
        verify_expires_at: {type: Date, default: new Date()},
        code: {type: String, default:''},
        

        // provider
        providers: [
            {
                name: String, //google, facebook, github,...
                id: String,
                email: String,
                avatar: String,
            },
        ],
    },
    { timestamps: true },
);

//pre save
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});
// func compare
UserSchema.methods.comparePassword = function (password) {
    return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', UserSchema);
