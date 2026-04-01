/**
 * Một lần: đổi field Mongo distance → category trên participant_checkin_h.
 * Chạy: node scripts/migrate-participant-distance-to-category.js
 * Cần MONGO_URI trong .env (cùng thư mục gốc project).
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error('Thiếu MONGO_URI trong .env');
        process.exit(1);
    }
    await mongoose.connect(uri);
    const col = mongoose.connection.db.collection('participant_checkin_h');
    const res = await col.updateMany({ distance: { $exists: true } }, [
        { $set: { category: { $ifNull: ['$category', '$distance'] } } },
        { $unset: 'distance' },
    ]);
    console.log('participant_checkin_h: matched', res.matchedCount, 'modified', res.modifiedCount);
    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
