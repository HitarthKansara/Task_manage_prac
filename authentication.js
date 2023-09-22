const User = require('./models/user.model.js');
const jwt = require('jsonwebtoken');


// authenticate user
exports.authenticate = async (req, res, next) => {
    try {

        if (!req.header('Authorization')) return res.status(400).send({ message: 'Authorization is required' });

        const token = req.header('Authorization')?.toString().replace('Bearer ', '');
        if (!token) return res.status(400).send({ message: 'Unauthorized, please login' });

        const decoded = jwt.verify(token, 'I Love India');
        const user = await User.findOne({ _id: decoded._id, auth_token: token }).lean();

        if (!user) return res.status(400).send({ message: 'Unauthorized, please login' });

        req.token = token;
        req.user = user;

        next();
    } catch (err) {
        console.log('Error(authenticate): ', err);

        if (err.message == 'jwt expired' || err.message == 'jwt malformed') {
            return res.status(400).send({ message: 'Unauthorized, please login' });
        }

        return res.status(500).send({ message: 'Server error' });
    }
}