const { MongoClient } = require('mongodb');
const nodemailer = require('nodemailer');

const uri = process.env.MONGODB_URI;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

async function sendConfirmationEmail({ to, firstName, lastName, orderId, product, quantity, unit, totalPrice }) {
    const mailOptions = {
        from: `"RAM Rice" <${process.env.GMAIL_USER}>`,
        to,
        subject: `Order Confirmation - ${orderId}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <img src="./img/ramrice.png" alt="RAM Rice" style="height: 50px; margin-bottom: 16px;" />
                <h2 style="color: #2e7d32;">Order Placed Successfully!</h2>
                <p>Hi <strong>${firstName} ${lastName}</strong>, thank you for your order.</p>
                <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
                    <tr style="background-color: #f5f5f5;">
                        <td style="padding: 8px 12px; font-weight: bold;">Order ID</td>
                        <td style="padding: 8px 12px;">${orderId}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 12px; font-weight: bold;">Product</td>
                        <td style="padding: 8px 12px;">${product}</td>
                    </tr>
                    <tr style="background-color: #f5f5f5;">
                        <td style="padding: 8px 12px; font-weight: bold;">Quantity</td>
                        <td style="padding: 8px 12px;">${quantity} ${unit}(s)</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 12px; font-weight: bold;">Total Price</td>
                        <td style="padding: 8px 12px;">₱${totalPrice}</td>
                    </tr>
                </table>
                <p style="margin-top: 24px; color: #555;">We will process your order shortly. For inquiries, please reply to this email.</p>
                <p style="color: #555;">— RAM Rice Team</p>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { orderId, firstName, lastName, email, contactNumber, product, quantity, unit, unitPrice, totalPrice } = req.body;

    if (!orderId || !firstName || !lastName || !email || !product || !quantity || !unit) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('ram_rice');
        await db.collection('orders').insertOne({
            orderId,
            firstName,
            lastName,
            email,
            contactNumber,
            product,
            quantity: Number(quantity),
            unit,
            unitPrice,
            totalPrice,
            createdAt: new Date()
        });

        await sendConfirmationEmail({
            to: email,
            firstName,
            lastName,
            orderId,
            product,
            quantity,
            unit,
            totalPrice
        });

        res.status(200).json({ success: true, orderId });
    } catch (err) {
        console.error('Order error:', err);
        res.status(500).json({ error: err.message || 'Failed to save order' });
    } finally {
        await client.close();
    }
};
