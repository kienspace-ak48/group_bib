const fs = require('fs');
const myPath = require('../../../config/mypath.config');

const ImageEntity = require('../model/Image');
const CNAME = 'image.service.js ';
const uploadPath = myPath.public;
const prefixUploadPath = 'uploads/images/';

class ImageService {
    constructor(parameters) {
        console.log('Initail image.service.js');
    }
    async GetAll() {
        try {
            const imgs = await ImageEntity.find({}).lean();
            return imgs;
        } catch (error) {
            console.log(CNAME, error.message);
            return [];
        }
    }
    async Add(file) {
        try {
            const fileName = Date.now() + '-' + file.originalname;
            const filePath = uploadPath + prefixUploadPath + fileName;
            // wite file to disk
            await fs.promises.writeFile(filePath, file.buffer);
            // save DB
            await ImageEntity.create({
                name: fileName,
                path: prefixUploadPath + fileName,
            });
            return true;
        } catch (error) {
            console.log(CNAME, error.message);
            return false;
        }
    }
    async Delete(name) {
        try {
            const filePath = uploadPath + prefixUploadPath + name;
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            const result =await ImageEntity.deleteOne({name:name });
            console.log(result);
            return true;
        } catch (error) {
            console.log(CNAME, error.message);
            return false;
        }
    }
    async Update() {}
    async GetById() {}
}

module.exports = new ImageService();
