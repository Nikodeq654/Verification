require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========================
// KONFIGURACJA
// ========================
const VERIFIED_ROLE_ID = '1494970567806292109';
const LOG_CHANNEL_ID = '1494782542492991691';
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

// ========================
// BAZA DANYCH
// ========================
mongoose.connect(MONGO_URI).then(() => console.log('✅ MongoDB połączone'));

// Schema tokenu weryfikacyjnego
const tokenSchema = new mongoose.Schema({
    token: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    username: { type: String },
    used: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, expires: 3600 } // wygasa po 1h
});

// Schema zweryfikowanych użytkowników (IP + fingerprint)
const verifiedSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    ip: { type: String },
    fingerprint: { type: String },
    userAgent: { type: String },
    verifiedAt: { type: Date, default: Date.now }
});

// Schema blokad (IP/fingerprint już powiązane z innym kontem)
const blockSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    type: { type: String }, // 'ip' lub 'fingerprint'
    value: { type: String },
    linkedUserId: { type: String }, // pierwsze konto które to miało
    createdAt: { type: Date, default: Date.now }
});

const Token = mongoose.model('Token', tokenSchema);
const Verified = mongoose.model('Verified', verifiedSchema);
const Block = mongoose.model('Block', blockSchema);

// ========================
// HELPER - Discord API
// ========================
async function discordRequest(method, endpoint, data = null) {
    const config = {
        method,
        url: `https://discord.com/api/v10${endpoint}`,
        headers: {
            'Authorization': `Bot ${BOT_TOKEN}`,
            'Content-Type': 'application/json'
        }
    };
    if (data) config.data = data;
    return axios(config);
}

// Nadaj rolę
async function giveRole(guildId, userId, roleId) {
    await discordRequest('PUT', `/guilds/${guildId}/members/${userId}/roles/${roleId}`);
}

// Wyślij wiadomość na kanał
async function sendChannelMessage(channelId, payload) {
    await discordRequest('POST', `/channels/${channelId}/messages`, payload);
}

// Wyślij PV do użytkownika
async function sendDM(userId, payload) {
    const dmChannel = await discordRequest('POST', '/users/@me/channels', { recipient_id: userId });
    await discordRequest('POST', `/channels/${dmChannel.data.id}/messages`, payload);
}

// ========================
// ENDPOINT - generowanie tokenu (wywołuje bot)
// ========================
app.post('/api/create-token', async (req, res) => {
    const { userId, guildId, username, secret } = req.body;

    // Prosty secret żeby tylko bot mógł tworzyć tokeny
    if (secret !== process.env.INTERNAL_SECRET) {
        return res.status(403).json({ error: 'Brak dostępu' });
    }

    try {
        // Usuń stare tokeny tego użytkownika
        await Token.deleteMany({ userId, guildId });

        const token = crypto.randomBytes(32).toString('hex');
        await Token.create({ token, userId, guildId, username });

        res.json({ token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// ========================
// ENDPOINT - strona weryfikacji
// ========================
app.get('/verify', async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.redirect('/error?code=no_token');
    }

    const tokenDoc = await Token.findOne({ token });

    if (!tokenDoc) {
        return res.redirect('/error?code=invalid_token');
    }

    if (tokenDoc.used) {
        return res.redirect('/error?code=used_token');
    }

    // Podaj stronę weryfikacyjną (HTML)
    res.sendFile(path.join(__dirname, 'public', 'verify.html'));
});

// ========================
// ENDPOINT - submit weryfikacji (wywołuje strona)
// ========================
app.post('/api/verify', async (req, res) => {
    const { token, fingerprint } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';

    if (!token) return res.status(400).json({ success: false, error: 'Brak tokenu' });

    const tokenDoc = await Token.findOne({ token });
    if (!tokenDoc) return res.status(400).json({ success: false, error: 'Nieważny token' });
    if (tokenDoc.used) return res.status(400).json({ success: false, error: 'Token już użyty' });

    const { userId, guildId, username } = tokenDoc;

    try {
        // Sprawdz czy IP jest już powiązane z innym kontem
        const ipBlock = await Block.findOne({ guildId, type: 'ip', value: ip });
        if (ipBlock && ipBlock.linkedUserId !== userId) {
            // Log na kanał
            await sendChannelMessage(LOG_CHANNEL_ID, {
                embeds: [{
                    title: '⚠️ Wykryto potencjalny alt account',
                    color: 0xff4444,
                    fields: [
                        { name: 'Użytkownik', value: `<@${userId}> (${username})`, inline: true },
                        { name: 'Powiązane konto', value: `<@${ipBlock.linkedUserId}>`, inline: true },
                        { name: 'Powód', value: 'Ten sam adres IP', inline: false },
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: 'BotStation Verify' }
                }]
            }).catch(() => {});

            return res.json({ success: false, error: 'alt_detected', message: 'Twoje konto zostało oznaczone jako potencjalny alt.' });
        }

        // Sprawdz fingerprint
        if (fingerprint) {
            const fpBlock = await Block.findOne({ guildId, type: 'fingerprint', value: fingerprint });
            if (fpBlock && fpBlock.linkedUserId !== userId) {
                await sendChannelMessage(LOG_CHANNEL_ID, {
                    embeds: [{
                        title: '⚠️ Wykryto potencjalny alt account',
                        color: 0xff4444,
                        fields: [
                            { name: 'Użytkownik', value: `<@${userId}> (${username})`, inline: true },
                            { name: 'Powiązane konto', value: `<@${fpBlock.linkedUserId}>`, inline: true },
                            { name: 'Powód', value: 'Ten sam fingerprint urządzenia', inline: false },
                        ],
                        timestamp: new Date().toISOString(),
                        footer: { text: 'BotStation Verify' }
                    }]
                }).catch(() => {});

                return res.json({ success: false, error: 'alt_detected', message: 'Twoje konto zostało oznaczone jako potencjalny alt.' });
            }
        }

        // Wszystko ok - nadaj rolę
        await giveRole(guildId, userId, VERIFIED_ROLE_ID);

        // Oznacz token jako użyty
        await Token.updateOne({ token }, { used: true });

        // Zapisz dane weryfikacji
        await Verified.create({ userId, guildId, ip, fingerprint, userAgent });

        // Zapisz IP i fingerprint w blokadach (dla przyszłych weryfikacji)
        await Block.findOneAndUpdate(
            { guildId, type: 'ip', value: ip },
            { guildId, type: 'ip', value: ip, linkedUserId: userId },
            { upsert: true }
        );

        if (fingerprint) {
            await Block.findOneAndUpdate(
                { guildId, type: 'fingerprint', value: fingerprint },
                { guildId, type: 'fingerprint', value: fingerprint, linkedUserId: userId },
                { upsert: true }
            );
        }

        // Wyślij PV - sukces
        await sendDM(userId, {
            embeds: [{
                title: '✅ Weryfikacja pomyślna!',
                description: 'Zostałeś pomyślnie zweryfikowany na serwerze **BotStation**.\nMasz teraz dostęp do wszystkich kanałów. Witamy!',
                color: 0x5b7fff,
                thumbnail: { url: 'https://i.imgur.com/8p6H3kZ.png' },
                timestamp: new Date().toISOString(),
                footer: { text: 'BotStation Verify' }
            }]
        }).catch(() => {}); // ignoruj blad jesli ma zamkniete PV

        // Log na kanał - sukces
        await sendChannelMessage(LOG_CHANNEL_ID, {
            embeds: [{
                title: '✅ Weryfikacja pomyślna',
                color: 0x5b7fff,
                description: `<@${userId}> został zweryfikowany i kanały zostały mu odblokowane.`,
                fields: [
                    { name: 'Użytkownik', value: `<@${userId}> (${username})`, inline: true },
                    { name: 'IP', value: `||${ip}||`, inline: true },
                ],
                timestamp: new Date().toISOString(),
                footer: { text: 'BotStation Verify' }
            }]
        }).catch(() => {});

        res.json({ success: true });

    } catch (err) {
        console.error('Błąd weryfikacji:', err);

        // Log błędu
        await sendChannelMessage(LOG_CHANNEL_ID, {
            embeds: [{
                title: '❌ Błąd weryfikacji',
                color: 0xff8800,
                fields: [
                    { name: 'Użytkownik', value: `<@${userId}> (${username})`, inline: true },
                    { name: 'Błąd', value: err.message || 'Nieznany błąd', inline: false },
                ],
                timestamp: new Date().toISOString(),
                footer: { text: 'BotStation Verify' }
            }]
        }).catch(() => {});

        res.status(500).json({ success: false, error: 'Błąd serwera, spróbuj ponownie.' });
    }
});

// ========================
// START
// ========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Serwer działa na porcie ${PORT}`));
