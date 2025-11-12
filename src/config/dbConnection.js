const mongoose = require('mongoose');
const dbConnection = async ()=>{
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Database connected successfully 🟢');
    } catch (error) {
        console.log('Database connection failed 🔴', error);
        process.exit(1);
    }
}

module.exports = dbConnection;