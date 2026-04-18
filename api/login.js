const crypto = require('crypto');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, password } = req.body;
    const validUsername = process.env.ADMIN_USERNAME;
    const validPassword = process.env.ADMIN_PASSWORD;

    if (!username || !password || username !== validUsername || password !== validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = crypto
        .createHmac('sha256', validPassword)
        .update(validUsername)
        .digest('hex');

    res.status(200).json({ token });
};
