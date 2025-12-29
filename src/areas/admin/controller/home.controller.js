// areas/ home.controller.js
const stringValue = require('../../../config/stringvalue.config');
const PageSettingEntity = require('../../../model/PageSetting');
const VNAME = 'admin/home/';
const VLAYOUT = 'layouts/adminLayout';

const homeController = ()=>{
    return {
        Index: (req, res)=>{
            // res.json({success: true, mess: 'from admin controller',})
            res.render(VNAME+'index', {layout: VLAYOUT, title: 'admin dashboard'})
        },
        PageSetting: async (req, res)=>{
            try {
                const ps = await PageSettingEntity.findOne({type: "home_page"})
                res.render('admin/page_setting/homepage', {layout: VLAYOUT, cf: ps})
                
            } catch (error) {
                
                res.render('admin/page_setting/homepage', {layout: VLAYOUT})
            }
        },
        ConfigHomePage:async (req, res)=>{
            try {
                var data = req.body;
                // console.log(data)
                var isExit =(await PageSettingEntity.find({type: "home_page"})).length;
                if(isExit === 0){
                    // create
                    var hpConfig = new PageSettingEntity({
                    type: "home_page",
                    hero_title: data.hero_title,
                    hero_desc: data.hero_desc,
                    about_title: data.about_title,
                    about_desc: data.about_desc,
                    f_desc: data.f_desc
                    })
                    await hpConfig.save();
                }else{
                    var hpConfig = new PageSettingEntity({
                    type: "home_page",
                    hero_title: data.hero_title,
                    hero_desc: data.hero_desc,
                    about_title: data.about_title,
                    about_desc: data.about_desc,
                    f_desc: data.f_desc
                    })
                    const updateData = hpConfig.toObject();
                    delete updateData._id
                    
                    await PageSettingEntity.findOneAndUpdate(
                        {type: "home_page"},
                        {$set: updateData},
                        {new: false}
                    )
                }
                console.log("count "+isExit)
                var hp_cf =await PageSettingEntity.findOne({type: "home_page"})

                res.json({success: true, pf: hp_cf})

            } catch (error) {
                console.log("PSet_C",error)
                res.json({success: false})
            }
        }
    }
}

module.exports = homeController;