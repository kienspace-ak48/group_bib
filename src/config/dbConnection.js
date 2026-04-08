const mongoose = require('mongoose');
const { getMongoUri } = require('./mongoEnv');

const dbConnection = async () => {
    const uri = getMongoUri();
    if (!uri) {
        console.error(
            'Database connection failed 🔴 Thiếu MONGO_URI hoặc MONGODB_URI trong .env (chuỗi kết nối MongoDB).',
        );
        process.exit(1);
    }
    try {
        await mongoose.connect(uri);
        console.log('Database connected successfully 🟢');
    } catch (error) {
        console.log('Database connection failed 🔴', error);
        process.exit(1);
    }
};

module.exports = dbConnection;