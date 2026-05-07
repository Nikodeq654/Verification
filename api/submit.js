const mongoose = require('mongoose');
const axios = require('axios');

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

const Block = mongoose.models.Block || mongoose.model('Block', new mongoose.Schema({
    guildId: String, type: String, value: String, linkedUserId: String
}));

const Verified = mongoose.models.Verified || mongoose.model('Verified', new mongoose.Schema({
    userId: String, guildId: String, ip: String, fingerprint: String,
    verifiedAt: { type: Date, default: Date.now }
}));

const VERIFIED_ROLE_ID = '1494970567806292109';
const LOG_CHANNEL_ID = '1494782542492991691';

async function discord(method, endpoint, data) {
    return axios({ method, url: `https://discord.com/api/v10${endpoint}`, headers: { Authorization: `Bot ${process.env.BOT_TOKEN}`, 'Content-Type': 'application/json' }, data });
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).end();

    const { token, fingerprint } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';

    if (!token) return res.json({ success: false, error: 'Brak tokenu' });

    await connectDB();

    const tokenDoc = await Token.findOne({ token });
    if (!tokenDoc) return res.json({ success: false, error: 'Niewazny token' });
    if (tokenDoc.used) return res.json({ success: false, error: 'Token juz uzyty' });

    const { userId, guildId, username } = tokenDoc;

    try {
        // Sprawdz IP
        const ipBlock = await Block.findOne({ guildId, type: 'ip', value: ip });
        if (ipBlock && ipBlock.linkedUserId !== userId) {
            await discord('POST', `/channels/${LOG_CHANNEL_ID}/messages`, { embeds: [{ title: '⚠️ Wykryto potencjalny alt', color: 0xff4444, fields: [{ name: 'Uzytkownik', value: `<@${userId}>`, inline: true }, { name: 'Powiazane konto', value: `<@${ipBlock.linkedUserId}>`, inline: true }, { name: 'Powod', value: 'Ten sam IP', inline: false }], timestamp: new Date().toISOString() }] }).catch(() => {});
            return res.json({ success: false, error: 'alt_detected', message: 'Twoje konto zostalo oznaczone jako potencjalny alt.' });
        }

        // Sprawdz fingerprint
        if (fingerprint) {
            const fpBlock = await Block.findOne({ guildId, type: 'fingerprint', value: fingerprint });
            if (fpBlock && fpBlock.linkedUserId !== userId) {
                await discord('POST', `/channels/${LOG_CHANNEL_ID}/messages`, { embeds: [{ title: '⚠️ Wykryto potencjalny alt', color: 0xff4444, fields: [{ name: 'Uzytkownik', value: `<@${userId}>`, inline: true }, { name: 'Powiazane konto', value: `<@${fpBlock.linkedUserId}>`, inline: true }, { name: 'Powod', value: 'Ten sam fingerprint', inline: false }], timestamp: new Date().toISOString() }] }).catch(() => {});
                return res.json({ success: false, error: 'alt_detected', message: 'Twoje konto zostalo oznaczone jako potencjalny alt.' });
            }
        }

        // Nadaj role
        await discord('PUT', `/guilds/${guildId}/members/${userId}/roles/${VERIFIED_ROLE_ID}`);
        await Token.updateOne({ token }, { used: true });
        await Verified.create({ userId, guildId, ip, fingerprint });
        await Block.findOneAndUpdate({ guildId, type: 'ip', value: ip }, { guildId, type: 'ip', value: ip, linkedUserId: userId }, { upsert: true });
        if (fingerprint) await Block.findOneAndUpdate({ guildId, type: 'fingerprint', value: fingerprint }, { guildId, type: 'fingerprint', value: fingerprint, linkedUserId: userId }, { upsert: true });

        // PV sukces
        const dm = await discord('POST', '/users/@me/channels', { recipient_id: userId });
        await discord('POST', `/channels/${dm.data.id}/messages`, { embeds: [{ title: '✅ Weryfikacja pomyslna!', description: 'Zostales zweryfikowany na **BotStation**. Masz teraz dostep do wszystkich kanalow!', color: 0x5b7fff, timestamp: new Date().toISOString(), footer: { text: 'BotStation Verify' } }] }).catch(() => {});

        // Log
        await discord('POST', `/channels/${LOG_CHANNEL_ID}/messages`, { embeds: [{ title: '✅ Weryfikacja pomyslna', color: 0x5b7fff, description: `<@${userId}> zostal zweryfikowany.`, fields: [{ name: 'Uzytkownik', value: `${username}`, inline: true }, { name: 'IP', value: `||${ip}||`, inline: true }], timestamp: new Date().toISOString(), footer: { text: 'BotStation Verify' } }] }).catch(() => {});

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        await discord('POST', `/channels/${LOG_CHANNEL_ID}/messages`, { embeds: [{ title: '❌ Blad weryfikacji', color: 0xff8800, fields: [{ name: 'Uzytkownik', value: `<@${userId}>`, inline: true }, { name: 'Blad', value: err.message || 'nieznany', inline: false }], timestamp: new Date().toISOString() }] }).catch(() => {});
        res.status(500).json({ success: false, error: 'Blad serwera, sprobuj ponownie.' });
    }
};
