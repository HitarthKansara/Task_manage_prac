const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const moment = require('moment');

const app = express();
app.use(express.json());

require('./database').connectToDB();
const User = require('./models/user.model');
const Task = require('./models/task.model'); // Assuming you have a Task model
const { authenticate } = require('./authentication'); // Authentication middleware

require('./remainder.cron');


app.get('/', (req, res) => res.status(200).send({ message: 'Welcome to task manager' }))

// Secret key for JWT
const jwtSecretKey = 'I Love India';

// User Registration
app.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if the user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create a new user
        const newUser = new User({
            email,
            password: hashedPassword,
        });

        // Generate a JWT token
        const token = jwt.sign({ _id: newUser._id, email: email }, jwtSecretKey);
        newUser.auth_token = token;
        await newUser.save();

        await newUser.save();

        res.status(201).json({ message: 'Registration successful', data: newUser });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server error' });
    }
});

// User Login
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if the user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Check the password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate a JWT token
        const token = jwt.sign({ _id: user._id, email: user.email }, jwtSecretKey);
        user.auth_token = token;
        await user.save();

        res.status(200).json({ message: 'User logged in successfully', token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server error' });
    }
});




// Create a new task
app.post('/tasks', authenticate, async (req, res) => {
    try {
        const reqBody = req.body;

        if (!reqBody.name || !reqBody.category || !reqBody.priority || !reqBody.due_date) {
            return res.status(400).send({ message: 'All fields are required' });
        }

        reqBody.user_id = req.user._id;
        let taskCount = await Task.count({ user_id: req.user._id, is_completed: false });

        reqBody.task_order = taskCount;

        const task = new Task(reqBody);
        await task.save();
        res.status(201).json(task);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all tasks for a user
app.get('/tasks', authenticate, async (req, res) => {
    try {

        let { search, is_completed, category, priority } = req.query;

        let query = {
            $or: [{ user_id: req.user._id }, { shared_user: req.user._id }]
        };

        search = search || '';

        if (search) {
            query.$or.push(
                { name: new RegExp(search, 'i') },
                { category: new RegExp(search, 'i') }
            )
        }

        if (is_completed) {
            query.is_completed = is_completed;
        }

        if (category) {
            query.category = category;
        }

        if (priority) {
            query.priority = priority;
        }

        const tasks = await Task.find(query).sort({ task_order: 1 });

        if (!tasks.length) {
            return res.status(200).json({ message: 'Task data not found', data: [] });
        }

        res.status(200).json({ message: 'Get all tasks', data: tasks });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a specific task by ID
app.get('/tasks/:taskId', authenticate, async (req, res) => {
    try {
        const task = await Task.findOne({ _id: req.params.taskId, user_id: req.user._id });
        if (!task) {
            return res.status(404).json({ mesage: 'Task not found' });
        }
        res.status(200).json({ message: 'Task fetched successfully', data: task });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update a task by ID
app.put('/tasks/:taskId', authenticate, async (req, res) => {
    try {
        const reqBody = req.body;

        if (!reqBody.name || !reqBody.priority || !reqBody.due_date || !reqBody.category) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (reqBody?.is_completed) {
            reqBody.task_order = Math.pow(10, reqBody.due_date);
            reqBody.completed_at = moment().format('X');
        }

        if (reqBody?.shared_user) {
            let userData = await User.findOne({ _id: reqBody.shared_user });

            if (!userData) {
                return res.status(400).json({ message: 'User data not found to be shared this task with' })
            }
        }

        const task = await Task.findOneAndUpdate(
            { _id: req.params.taskId, user_id: req.user._id },
            reqBody,
            { new: true }
        );

        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        res.status(200).json({ message: 'Task updated successfully', data: task });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reorder a task by ID
app.put('/reorder/:taskId', authenticate, async (req, res) => {
    try {
        const reqBody = req.body;

        if (!reqBody.task_order) {
            return res.status(400).json({ message: 'Task order is required' });
        }

        const task = await Task.findOneAndUpdate(
            { _id: req.params.taskId, user_id: req.user._id },
            reqBody,
            { new: true }
        );

        await Task.updateMany({ user_id: req.user._id, is_completed: false, _id: { $ne: req.params.taskId } }, { $inc: { task_order: 1 } })

        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        res.status(200).json({ message: 'Task updated successfully', data: task });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a task by ID
app.delete('/tasks/:taskId', authenticate, async (req, res) => {
    try {
        const task = await Task.findOneAndRemove({ _id: req.params.taskId, user_id: req.user._id });
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.status(200).json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Protected Route
app.get('/dashboard', authenticate, async (req, res) => {

    let completedTaskPerWeek = await Task.count({
        is_completed: true,
        completed_at: {
            $gte: +moment().startOf('week').format('X'),
            $lte: +moment().endOf('week').format('X')
        }
    });

    res.status(200).json({ message: 'Welcome to the dashboard!', completed_task_this_week: completedTaskPerWeek });
});




const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
