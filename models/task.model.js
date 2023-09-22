const mongoose = require('mongoose');
// Define Task schema and model
const taskSchema = new mongoose.Schema({
    name: { type: String, required: true },
    priority: { type: String, enum: ['high', 'medium', 'low'], required: true },
    category: { type: String },
    shared_user: { type: mongoose.Types.ObjectId, ref: 'User' },
    user_id: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
    due_date: { type: Number, required: true },         // please enter timestamp 
    is_completed: { type: Boolean, default: false },
    task_order: { type: Number },
    completed_at: { type: Number }
});

const Task = mongoose.model('Task', taskSchema);
module.exports = Task;