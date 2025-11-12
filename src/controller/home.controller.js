// home.controller.js

const homeController = () => {
    return {
        Index: (req, res) => {
            res.render('index', {title: 'Home Page', layout: 'layouts/main'});
        },
    };
};

module.exports = homeController; //export function static
