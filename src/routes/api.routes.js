const express = require('express');
const router = express.Router();

const categories = ['electronics', 'fashion', 'food', 'books', 'tools'];

router.get('/api/hi', (req, res) => {
    res.json({ success: 'ok', mess: 'hello' });
});
router.get('/api/category/get-all', (req, res) => {
    const result = categories;
    res.json({ success: true, data: result });
});


module.exports = router;
