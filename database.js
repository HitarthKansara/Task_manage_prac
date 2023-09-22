const mongoose = require('mongoose');
// Database connection

async function connectToDB() {

    await mongoose.connect('mongodb://127.0.0.1:27017/task_manager_db');
}

module.exports = { connectToDB };

