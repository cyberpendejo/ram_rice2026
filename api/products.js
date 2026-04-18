const { MongoClient } = require('mongodb');
const crypto = require('crypto');

const DEFAULT_PRODUCTS = [
    { id: 'maharlika',   name: 'Maharlika',   sackPrice: 1400, kiloPrice: 55, stockQty: 120 },
    { id: 'sinandomeng', name: 'Sinandomeng', sackPrice: 1300, kiloPrice: 52, stockQty: 100 },
    { id: 'jasmine',     name: 'Jasmine',     sackPrice: 1200, kiloPrice: 48, stockQty: 90  },
    { id: 'dinorado',    name: 'Dinorado',    sackPrice: 1100, kiloPrice: 50, stockQty: 80  },
    { id: 'kohaku',      name: 'Kohaku Rice', sackPrice: 1500, kiloPrice: 60, stockQty: 70  }
];

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
    const client = new MongoClient(process.env.MONGODB_URI);

    try {
        await client.connect();
        const db = client.db('ram_rice');
        const collection = db.collection('products');

        // GET — public, no auth needed
        if (req.method === 'GET') {
            let products = await collection.find({}, { projection: { _id: 0 } }).toArray();

            // auto-seed if collection is empty
            if (!products.length) {
                await collection.insertMany(DEFAULT_PRODUCTS);
                products = DEFAULT_PRODUCTS;
            }

            return res.status(200).json({ products });
        }

        // POST — add new product, admin only
        if (req.method === 'POST') {
            const authHeader = req.headers.authorization;
            const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

            if (!token || !validateToken(token)) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { name, sackPrice, kiloPrice, stockQty } = req.body;

            if (!name || sackPrice == null || kiloPrice == null || stockQty == null) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const id = name.toLowerCase().trim().replace(/\s+/g, '-');

            const existing = await collection.findOne({ id });
            if (existing) {
                return res.status(409).json({ error: `Product "${name}" already exists` });
            }

            await collection.insertOne({
                id,
                name: name.trim(),
                sackPrice: Number(sackPrice),
                kiloPrice: Number(kiloPrice),
                stockQty:  Number(stockQty)
            });

            return res.status(201).json({ success: true, id });
        }

        // PUT — update existing products, admin only
        if (req.method === 'PUT') {
            const authHeader = req.headers.authorization;
            const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

            if (!token || !validateToken(token)) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { products } = req.body;

            if (!Array.isArray(products) || !products.length) {
                return res.status(400).json({ error: 'Invalid products data' });
            }

            for (const product of products) {
                await collection.updateOne(
                    { id: product.id },
                    {
                        $set: {
                            sackPrice: Number(product.sackPrice),
                            kiloPrice: Number(product.kiloPrice),
                            stockQty:  Number(product.stockQty)
                        }
                    },
                    { upsert: true }
                );
            }

            return res.status(200).json({ success: true });
        }

        // DELETE — remove a product, admin only
        if (req.method === 'DELETE') {
            const authHeader = req.headers.authorization;
            const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

            if (!token || !validateToken(token)) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { id } = req.body;
            if (!id) {
                return res.status(400).json({ error: 'Missing product id' });
            }

            const result = await collection.deleteOne({ id });
            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Product not found' });
            }

            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (err) {
        console.error('Products API error:', err);
        return res.status(500).json({ error: err.message || 'Server error' });
    } finally {
        await client.close();
    }
};
