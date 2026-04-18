const { MongoClient } = require('mongodb');
const crypto = require('crypto');

function validateToken(token) {
    const validUsername = process.env.ADMIN_USERNAME;
    const validPassword = process.env.ADMIN_PASSWORD;
    if (!validUsername || !validPassword) return false;
    const expected = crypto
        .createHmac('sha256', validPassword)
        .update(validUsername)
        .digest('hex');
    return token === expected;
}

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token || !validateToken(token)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const client = new MongoClient(process.env.MONGODB_URI);

    try {
        await client.connect();
        const db = client.db('ram_rice');
        const orders = await db.collection('orders')
            .find({})
            .sort({ createdAt: -1 })
            .toArray();

        res.status(200).json({ orders });
    } catch (err) {
        console.error('MongoDB error:', err);
        res.status(500).json({ error: err.message || 'Failed to fetch orders' });
    } finally {
        await client.close();
    }
};
