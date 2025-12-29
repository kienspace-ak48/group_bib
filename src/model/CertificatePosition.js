const mongoose = require('mongoose');
const slugify = require('slugify');

const CertificatePositionSchame = new mongoose.Schema({
    title: {type: String},
    slug: {type: String, unique:true},
    desc: {type: String},
    img_thumb: String,
    img_path: {type: String, default: '/path/img.jpeg'},
    config: []
},{timestamps: true, strict: false}) 
CertificatePositionSchame.pre('save', function(next){
    if(this.isModified('title')){
        this.slug = slugify(this.title+"-"+Date.now(),{
            lower: true, //chuyen sang chu thuong
            strict: true, //bo cac ly tu dac biet
            locale: 'vi' //ngon ngu tieng viet
        });
    }
    next();
})

module.exports = mongoose.model('CertificatePosition', CertificatePositionSchame);