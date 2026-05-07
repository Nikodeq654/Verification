const mongoose = require('mongoose');
const crypto = require('crypto');

let isConnected = false;
async function connectDB() {
    if (isConnected) return;
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
}

const Token = mongoose.models.Token || mongoose.model('Token', new mongoose.Schema({
    token: String, userId: String, guildId: String, username: String,
    used: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, expires: 3600 }
}));

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).end();
    const { userId, guildId, username, secret } = req.body;
    if (secret !== process.env.INTERNAL_SECRET) return res.status(403).json({ error: 'Brak dostepu' });
    await connectDB();
    await Token.deleteMany({ userId, guildId });
    const token = crypto.randomBytes(32).toString('hex');
    await Token.create({ token, userId, guildId, username });
    res.json({ token });
};
