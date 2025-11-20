const EventService = require('../services/event.service');
const ImageService = require('../services/image.service');

const CANME = 'image.controller.js ';
const VNAME = 'admin/image/';
const VLAYOUT = 'layouts/adminLayout';
const myPath = require('../../../config/mypath.config');
const uploadPath = myPath.public;
const prefixUploadPath = 'uploads/images/'
const fs = require('fs');
const imageController = () => {
    return {
        Index: async (req, res) => {
            try {
                var imgs = await ImageService.GetAll();
                res.render(VNAME + 'index', { layout: VLAYOUT, files: imgs });
            } catch (error) {
                console.log(CANME, error.message);
                res.render(VNAME + 'index', { layout: VLAYOUT, files: [] });
            }
        },
        Upload: async(req, res)=>{
            try {
                const file = req.file;
                if(!file) return res.status(400).json({success: false, message: 'No file'});
                const result = await ImageService.Add(file);
                if(!result) {res.status(500).json({success: false, mess: 'save file failed'})}
                res.redirect('/admin/image');

            } catch (error) {
                console.log(CANME, error.message);
                res.redirect('/admin/image')
            }
        },
        Delete: async(req, res)=>{
            try {
                const name = req.params.name;
                if(!name) return res.redirect('/admin/image')
                const result = await ImageService.Delete(name)
                if(!result){
                    console.log('Delete failed')
                }
                res.redirect('/admin/image');
            } catch (error) {
                console.log(CANME, error.message);
                res.redirect('/admin/image');
            }
        }
        
    }
};

module.exports = imageController;
