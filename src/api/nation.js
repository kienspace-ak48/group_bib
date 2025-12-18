const fs = require('fs')
const myPathConfig = require('../config/mypath.config');
const countries = JSON.parse(
    fs.readFileSync(myPathConfig.root+'/public/data/countries.json', 'utf-8')
)
const provinces = JSON.parse(
    fs.readFileSync(myPathConfig.root+'/public/data/provincec.json', 'utf-8')
)

function getProvince() {
    return provinces;
}
function getAllNational(){
    return countries;
}

module.exports ={getProvince, getAllNational}