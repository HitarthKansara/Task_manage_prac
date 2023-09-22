require('./database').connectToDB();

const cron = require('node-cron');
const nodemailer = require('nodemailer');
const moment = require('moment');

const Task = require('./models/task.model');

// Configure Nodemailer for sending emails
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'hitarth@yopmail.com',
        pass: 'password',
    },
});

// Function to send task due date reminders
async function sendTaskReminders() {
    const startDate = +moment().add(1, 'day').startOf('day').format('X');
    const endDate = +moment().add(1, 'day').endOf('day').format('X');

    try {
        const tasks = await Task.find({
            due_date: { $gte: startDate, $lt: endDate }, is_completed: false
        }).populate({ path: 'user_id', select: 'email' });

        for (const task of tasks) {

            const mailOptions = {
                from: 'hitarth@yopmail.com',
                to: task?.user_id?.email,
                subject: 'Task Due Date Reminder',
                text: `Task "${task.name}" is due tomorrow. Due Date: ${moment(task.due_date, 'X').format('DD-MM-YYYY HH:mm:ss a')}`,
            };

            await transporter.sendMail(mailOptions);
            console.log(`Reminder email sent for task "${task.name}"`);
        }
    } catch (error) {
        console.error('Error sending reminders:', error);
    }
}

// Schedule the cron job to run daily at a specific time (adjust as needed)
cron.schedule('0 8 * * *', () => {
    sendTaskReminders();
    console.log('Task reminders sent!');
});
