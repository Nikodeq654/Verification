const nodemailer = require('nodemailer');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;

async function discord(method, endpoint, data) {
    return axios({
        method,
        url: `https://discord.com/api/v10${endpoint}`,
        headers: { Authorization: `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
        data
    });
}

async function sendEmail(to, orderData) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: 'botstation47@gmail.com', pass: process.env.EMAIL_PASS }
    });

    await transporter.sendMail({
        from: '"BotStation" <botstation47@gmail.com>',
        to,
        subject: '✅ Przyjęliśmy Twoje zgłoszenie - BotStation',
        html: `
        <div style="max-width:600px;margin:0 auto;background:#13151c;padding:40px;border-radius:16px;font-family:sans-serif;color:#eef0f5;">
          <h1 style="color:#5b7fff;font-size:24px;margin-bottom:8px;">BOTSTATION</h1>
          <h2 style="font-size:20px;margin-bottom:16px;">Zgłoszenie przyjęte! ✅</h2>
          <p style="color:#8a94a8;line-height:1.6;margin-bottom:24px;">Dziękujemy za przesłanie zamówienia. Odezwiemy się wkrótce z wyceną i szczegółami. Zazwyczaj odpowiadamy w ciągu kilku godzin.</p>
          <div style="background:#1a1d26;border-radius:12px;padding:24px;margin-bottom:24px;">
            <p style="color:#5b7fff;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:16px;">Szczegóły zamówienia</p>
            <p style="margin:8px 0;color:#8a94a8;">Bot: <strong style="color:#fff;">${orderData.nazwa}</strong></p>
            <p style="margin:8px 0;color:#8a94a8;">Serwer: <strong style="color:#fff;">${orderData.serwer}</strong></p>
            <p style="margin:8px 0;color:#8a94a8;">Budżet: <strong style="color:#fff;">${orderData.budzet}</strong></p>
            <p style="margin:8px 0;color:#8a94a8;">Termin: <strong style="color:#fff;">${orderData.termin}</strong></p>
          </div>
          <p style="color:#8a94a8;font-size:13px;">W razie pytań: <a href="https://discord.com/channels/1494772280323080243/1501631817210531910" style="color:#5b7fff;">kanał wsparcia Discord</a></p>
          <p style="color:rgba(138,148,168,0.4);font-size:12px;margin-top:32px;">© 2026 BotStation | botstation.vercel.app</p>
        </div>`
    });
}

async function sendDiscordPV(discordTag, orderData) {
    try {
        const GUILD_ID = process.env.GUILD_ID;
        const members = await discord('GET', `/guilds/${GUILD_ID}/members?limit=1000`);
        const tag = discordTag.toLowerCase().replace('@', '').trim();
        const member = members.data.find(m =>
            m.user.username.toLowerCase() === tag ||
            `${m.user.username}#${m.user.discriminator}`.toLowerCase() === tag ||
            m.user.global_name?.toLowerCase() === tag
        );
        if (!member) return;
        const dm = await discord('POST', '/users/@me/channels', { recipient_id: member.user.id });
        await discord('POST', `/channels/${dm.data.id}/messages`, {
            embeds: [{
                title: '✅ Przyjęliśmy Twoje zgłoszenie!',
                description: `Cześć! Dziękujemy za przesłanie zamówienia na **BotStation**.\n\nOdezwiemy się wkrótce z wyceną. W razie pytań wejdź na <#1501631817210531910>`,
                color: 0x5b7fff,
                fields: [
                    { name: '🤖 Bot', value: orderData.nazwa, inline: true },
                    { name: '💰 Budżet', value: orderData.budzet, inline: true },
                    { name: '⏰ Termin', value: orderData.termin, inline: true },
                ],
                timestamp: new Date().toISOString(),
                footer: { text: 'BotStation - Formularz zamówienia' }
            }]
        });
    } catch (err) {
        console.error('Blad PV:', err.message);
    }
}

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).end();

    const { kontakt, nazwa, serwer, budzet, termin } = req.body;
    if (!kontakt) return res.status(400).json({ error: 'Brak kontaktu' });

    const orderData = { nazwa, serwer, budzet, termin };
    const isEmail = kontakt.includes('@') && kontakt.includes('.');

    try {
        if (isEmail) {
            await sendEmail(kontakt, orderData);
        } else {
            await sendDiscordPV(kontakt, orderData);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Blad send-confirmation:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};
