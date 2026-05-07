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
        auth: {
            user: 'botstation47@gmail.com',
            pass: process.env.EMAIL_PASS
        }
    });

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { margin:0; padding:0; background:#0d0e12; font-family:'Segoe UI',sans-serif; }
  .wrap { max-width:600px; margin:0 auto; background:#13151c; border-radius:16px; overflow:hidden; }
  .header { background:linear-gradient(135deg,#1a1d26,#0d0e12); padding:40px 40px 32px; text-align:center; border-bottom:1px solid rgba(91,127,255,0.15); }
  .logo { font-size:28px; font-weight:800; letter-spacing:0.15em; color:#fff; }
  .logo span { color:#5b7fff; }
  .body { padding:40px; }
  .title { font-size:22px; font-weight:700; color:#eef0f5; margin-bottom:8px; }
  .sub { font-size:15px; color:#8a94a8; line-height:1.6; margin-bottom:32px; }
  .card { background:#1a1d26; border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:24px; margin-bottom:24px; }
  .card-title { font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#5b7fff; margin-bottom:16px; font-family:monospace; }
  .row { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; gap:16px; }
  .row:last-child { margin-bottom:0; }
  .label { font-size:13px; color:#8a94a8; font-weight:500; flex-shrink:0; }
  .value { font-size:13px; color:#eef0f5; font-weight:600; text-align:right; }
  .divider { height:1px; background:rgba(255,255,255,0.06); margin:24px 0; }
  .info-box { background:rgba(91,127,255,0.08); border:1px solid rgba(91,127,255,0.2); border-radius:10px; padding:20px 24px; margin-bottom:24px; }
  .info-box p { font-size:14px; color:#8fa3ff; line-height:1.6; margin:0; }
  .footer { padding:24px 40px; border-top:1px solid rgba(255,255,255,0.06); text-align:center; }
  .footer p { font-size:12px; color:rgba(138,148,168,0.5); margin:0; }
  .footer a { color:#5b7fff; text-decoration:none; }
</style>
</head>
<body>
<div style="padding:32px 16px;background:#0d0e12;">
<div class="wrap">
  <div class="header">
    <div class="logo">BOT<span>STATION</span></div>
    <p style="font-size:13px;color:#8a94a8;margin:8px 0 0;">Profesjonalne boty Discord</p>
  </div>
  <div class="body">
    <div class="title">Zgłoszenie przyjęte! ✅</div>
    <p class="sub">Dziękujemy za przesłanie zamówienia. Odezwiemy się do Ciebie wkrótce z wyceną i szczegółami realizacji. Zazwyczaj odpowiadamy w ciągu kilku godzin.</p>
    <div class="card">
      <div class="card-title">Szczegóły zamówienia</div>
      <div class="row"><span class="label">Bot</span><span class="value">${orderData.nazwa}</span></div>
      <div class="row"><span class="label">Serwer</span><span class="value">${orderData.serwer}</span></div>
      <div class="row"><span class="label">Budżet</span><span class="value">${orderData.budzet}</span></div>
      <div class="row"><span class="label">Termin</span><span class="value">${orderData.termin}</span></div>
    </div>
    <div class="info-box">
      <p>💬 W razie pytań lub pilnej sprawy skontaktuj się z nami na kanale wsparcia:<br>
      <a href="https://discord.com/channels/1494772280323080243/1501631817210531910" style="color:#8fa3ff;">Kanał wsparcia Discord</a></p>
    </div>
    <p style="font-size:13px;color:#8a94a8;line-height:1.6;margin:0;">Wkrótce się z Tobą skontaktujemy. Dziękujemy za zaufanie!</p>
  </div>
  <div class="footer">
    <p>© 2026 BotStation | <a href="https://botstation.vercel.app">botstation.vercel.app</a></p>
  </div>
</div>
</div>
</body>
</html>`;

    await transporter.sendMail({
        from: '"BotStation" <botstation47@gmail.com>',
        to,
        subject: '✅ Przyjęliśmy Twoje zgłoszenie - BotStation',
        html
    });
}

async function sendDiscordPV(discordTag, orderData) {
    // Szukaj uzytkownika po username
    try {
        // Pobierz liste czlonkow serwera i znajdz po username
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
                description: `Cześć! Dziękujemy za przesłanie zamówienia na **BotStation**.\n\nOdezwiemy się do Ciebie wkrótce z wyceną. Zazwyczaj odpowiadamy w ciągu kilku godzin.\n\nW razie pytań wejdź na kanał wsparcia: <#1501631817210531910>`,
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
        console.error('Blad wysylania PV:', err.message);
    }
}

module.exports = async (req, res) => {
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
