const path = require('path');

const myPathConfig ={
    root: path.join(__dirname, '../../'),
    public: path.join(__dirname, '../../public/'),
    uploadImage: path.join(__dirname, '../../public/uploads/image/')
}

module.exports = myPathConfig;