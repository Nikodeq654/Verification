require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(express.json());

const VERIFIED_ROLE_ID = '1494970567806292109';
const LOG_CHANNEL_ID = '1494782542492991691';
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI).then(() => console.log('MongoDB polaczone'));

const Token = mongoose.model('Token', new mongoose.Schema({
    token: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    username: { type: String },
    used: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, expires: 3600 }
}));

const Block = mongoose.model('Block', new mongoose.Schema({
    guildId: String,
    type: String,
    value: String,
    linkedUserId: String,
    createdAt: { type: Date, default: Date.now }
}));

const Verified = mongoose.model('Verified', new mongoose.Schema({
    userId: String,
    guildId: String,
    ip: String,
    fingerprint: String,
    verifiedAt: { type: Date, default: Date.now }
}));

async function discordRequest(method, endpoint, data = null) {
    const config = {
        method,
        url: `https://discord.com/api/v10${endpoint}`,
        headers: { 'Authorization': `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' }
    };
    if (data) config.data = data;
    return axios(config);
}

async function sendChannelMessage(channelId, payload) {
    await discordRequest('POST', `/channels/${channelId}/messages`, payload);
}

// ========================
// STRONA WERYFIKACJI
// ========================
app.get('/verify', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Weryfikacja - BotStation</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/fingerprintjs2/2.1.4/fingerprint2.min.js"></script>
<style>
  :root { --bg:#0d0e12; --bg2:#13151c; --border:rgba(255,255,255,0.07); --silver2:#8a94a8; --accent:#5b7fff; --accent2:#8fa3ff; --white:#eef0f5; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:var(--bg); color:var(--white); font-family:'Space Grotesk',sans-serif; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:2rem; }
  .bg-glow { position:fixed; inset:0; background:radial-gradient(ellipse 60% 50% at 50% 0%, rgba(91,127,255,0.1) 0%, transparent 70%); pointer-events:none; }
  .bg-grid { position:fixed; inset:0; background-image:linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px); background-size:60px 60px; mask-image:radial-gradient(ellipse 80% 80% at 50% 30%,black 0%,transparent 70%); pointer-events:none; }
  .card { background:var(--bg2); border:1px solid var(--border); border-radius:20px; padding:2.5rem; max-width:440px; width:100%; text-align:center; position:relative; z-index:1; animation:fadeInUp 0.5s ease; }
  @keyframes fadeInUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  .logo { font-size:0.9rem; font-weight:700; letter-spacing:0.15em; color:var(--silver2); font-family:'JetBrains Mono',monospace; margin-bottom:2rem; }
  .shield { font-size:3rem; margin-bottom:1rem; display:block; }
  h1 { font-size:1.5rem; font-weight:700; margin-bottom:0.5rem; letter-spacing:-0.02em; }
  .subtitle { font-size:0.9rem; color:var(--silver2); line-height:1.6; margin-bottom:2rem; }
  .info-box { background:rgba(91,127,255,0.06); border:1px solid rgba(91,127,255,0.15); border-radius:12px; padding:1rem 1.25rem; margin-bottom:2rem; font-size:0.83rem; color:var(--silver2); line-height:1.6; text-align:left; }
  .info-box strong { color:var(--accent2); }
  .btn-verify { width:100%; background:var(--accent); color:#fff; border:none; border-radius:12px; padding:1rem; font-size:1rem; font-weight:700; font-family:'Space Grotesk',sans-serif; cursor:pointer; transition:all 0.2s; box-shadow:0 4px 30px rgba(91,127,255,0.35); display:flex; align-items:center; justify-content:center; gap:0.5rem; }
  .btn-verify:hover:not(:disabled) { background:#6e8fff; transform:translateY(-2px); }
  .btn-verify:disabled { opacity:0.6; cursor:not-allowed; transform:none; }
  .spinner { width:18px; height:18px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 0.7s linear infinite; display:none; }
  @keyframes spin { to{transform:rotate(360deg)} }
  .state-success,.state-error { display:none; }
  .big-icon { font-size:3.5rem; margin-bottom:1rem; display:block; }
  .state-success h2 { font-size:1.4rem; font-weight:700; margin-bottom:0.5rem; color:#6ee7b7; }
  .state-error h2 { font-size:1.4rem; font-weight:700; margin-bottom:0.5rem; color:#f87171; }
  .state-success p, .state-error p { color:var(--silver2); font-size:0.9rem; line-height:1.6; }
  .error-msg { display:none; color:#f87171; font-size:0.85rem; margin-top:1rem; padding:0.75rem 1rem; background:rgba(248,113,113,0.08); border:1px solid rgba(248,113,113,0.2); border-radius:8px; }
  .footer-note { margin-top:1.5rem; font-size:0.75rem; color:rgba(138,148,168,0.5); line-height:1.5; }
</style>
</head>
<body>
<div class="bg-glow"></div>
<div class="bg-grid"></div>
<div class="card">
  <div id="stateDefault">
    <div class="logo">BOTSTATION</div>
    <span class="shield">🛡️</span>
    <h1>Weryfikacja konta</h1>
    <p class="subtitle">Ten serwer jest chroniony przez system weryfikacji BotStation. Kliknij przycisk ponizej, aby uzyskac dostep.</p>
    <div class="info-box"><strong>Co sprawdzamy?</strong><br>Adres IP oraz identyfikator urzadzenia, aby wykryc konta alt. Twoje dane sa traktowane poufnie.</div>
    <button class="btn-verify" id="btnVerify" onclick="startVerify()">
      <span id="btnText">Zweryfikuj mnie</span>
      <div class="spinner" id="btnSpinner"></div>
    </button>
    <div class="error-msg" id="errorMsg"></div>
    <p class="footer-note">Klikajac przycisk, akceptujesz zbieranie danych w celu weryfikacji tozsamosci.</p>
  </div>
  <div class="state-success" id="stateSuccess">
    <span class="big-icon">✅</span>
    <h2>Weryfikacja pomyslna!</h2>
    <p>Zostales zweryfikowany i masz teraz dostep do kanalow serwera. Sprawdz swoje PV.</p>
    <p class="footer-note" style="margin-top:1.5rem">Mozesz zamknac te strone i wrocic na serwer.</p>
  </div>
  <div class="state-error" id="stateError">
    <span class="big-icon">❌</span>
    <h2 id="errorTitle">Weryfikacja nieudana</h2>
    <p id="errorDesc">Wystapil problem podczas weryfikacji.</p>
    <p class="footer-note" style="margin-top:1.5rem">Jesli uwazasz, ze to blad - skontaktuj sie z administracja serwera.</p>
  </div>
</div>
<script>
  const token = new URLSearchParams(window.location.search).get('token');
  function showState(s) {
    document.getElementById('stateDefault').style.display = s==='default'?'block':'none';
    document.getElementById('stateSuccess').style.display = s==='success'?'block':'none';
    document.getElementById('stateError').style.display = s==='error'?'block':'none';
  }
  async function startVerify() {
    const btn = document.getElementById('btnVerify');
    const btnText = document.getElementById('btnText');
    const spinner = document.getElementById('btnSpinner');
    const errorMsg = document.getElementById('errorMsg');
    btn.disabled = true; btnText.textContent = 'Weryfikowanie...'; spinner.style.display = 'block'; errorMsg.style.display = 'none';
    let fingerprint = null;
    try {
      fingerprint = await new Promise(resolve => {
        if (typeof Fingerprint2 !== 'undefined') {
          Fingerprint2.get(c => resolve(Fingerprint2.x64hash128(c.map(x=>x.value).join(''), 31)));
        } else resolve(null);
      });
    } catch(e) { fingerprint = null; }
    try {
      const res = await fetch('/api/verify', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token, fingerprint}) });
      const data = await res.json();
      if (data.success) { showState('success'); }
      else if (data.error === 'alt_detected') { showState('error'); document.getElementById('errorTitle').textContent = '⚠️ Wykryto konto alt'; document.getElementById('errorDesc').textContent = data.message; }
      else { btn.disabled=false; btnText.textContent='Zweryfikuj mnie'; spinner.style.display='none'; errorMsg.textContent=data.error||'Cos poszlo nie tak.'; errorMsg.style.display='block'; }
    } catch(e) { btn.disabled=false; btnText.textContent='Zweryfikuj mnie'; spinner.style.display='none'; errorMsg.textContent='Blad polaczenia.'; errorMsg.style.display='block'; }
  }
</script>
</body>
</html>`);
});

// ========================
// STRONA BLEDU
// ========================
app.get('/error', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Blad - BotStation Verify</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root { --bg:#0d0e12; --bg2:#13151c; --border:rgba(255,255,255,0.07); --silver2:#8a94a8; --white:#eef0f5; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:var(--bg); color:var(--white); font-family:'Space Grotesk',sans-serif; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:2rem; }
  .card { background:var(--bg2); border:1px solid var(--border); border-radius:20px; padding:2.5rem; max-width:420px; width:100%; text-align:center; }
  .icon { font-size:3rem; margin-bottom:1rem; display:block; }
  h1 { font-size:1.4rem; font-weight:700; margin-bottom:0.5rem; color:#f87171; }
  p { color:var(--silver2); font-size:0.9rem; line-height:1.6; margin-top:0.5rem; }
</style>
</head>
<body>
<div class="card">
  <span class="icon">❌</span>
  <h1 id="title">Blad weryfikacji</h1>
  <p id="desc">Wystapil problem z linkiem weryfikacyjnym.</p>
  <p style="margin-top:1.5rem;font-size:0.78rem;color:rgba(138,148,168,0.5)">Wróc na serwer i poczekaj na nowy link lub skontaktuj sie z administracja.</p>
</div>
<script>
  const code = new URLSearchParams(window.location.search).get('code');
  const msgs = { no_token:['Brak tokenu','Link jest nieprawidlowy.'], invalid_token:['Niewazny link','Ten link wygasl lub nie istnieje. Linki sa wazne przez 1 godzine.'], used_token:['Link juz uzyty','Ten link zostal juz wczesniej wykorzystany.'] };
  if (code && msgs[code]) { document.getElementById('title').textContent=msgs[code][0]; document.getElementById('desc').textContent=msgs[code][1]; }
</script>
</body>
</html>`);
});

// ========================
// API - generowanie tokenu
// ========================
app.post('/api/create-token', async (req, res) => {
    const { userId, guildId, username, secret } = req.body;
    if (secret !== process.env.INTERNAL_SECRET) return res.status(403).json({ error: 'Brak dostepu' });
    try {
        await Token.deleteMany({ userId, guildId });
        const token = crypto.randomBytes(32).toString('hex');
        await Token.create({ token, userId, guildId, username });
        res.json({ token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Blad serwera' });
    }
});

// ========================
// API - weryfikacja
// ========================
app.post('/api/verify', async (req, res) => {
    const { token, fingerprint } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

    if (!token) return res.status(400).json({ success: false, error: 'Brak tokenu' });

    const tokenDoc = await Token.findOne({ token });
    if (!tokenDoc) return res.status(400).json({ success: false, error: 'Niewazny token' });
    if (tokenDoc.used) return res.status(400).json({ success: false, error: 'Token juz uzyty' });

    const { userId, guildId, username } = tokenDoc;

    try {
        const ipBlock = await Block.findOne({ guildId, type: 'ip', value: ip });
        if (ipBlock && ipBlock.linkedUserId !== userId) {
            await sendChannelMessage(LOG_CHANNEL_ID, { embeds: [{ title: '⚠️ Wykryto potencjalny alt account', color: 0xff4444, fields: [{ name: 'Uzytkownik', value: `<@${userId}> (${username})`, inline: true }, { name: 'Powiazane konto', value: `<@${ipBlock.linkedUserId}>`, inline: true }, { name: 'Powod', value: 'Ten sam adres IP', inline: false }], timestamp: new Date().toISOString(), footer: { text: 'BotStation Verify' } }] }).catch(() => {});
            return res.json({ success: false, error: 'alt_detected', message: 'Twoje konto zostalo oznaczone jako potencjalny alt.' });
        }

        if (fingerprint) {
            const fpBlock = await Block.findOne({ guildId, type: 'fingerprint', value: fingerprint });
            if (fpBlock && fpBlock.linkedUserId !== userId) {
                await sendChannelMessage(LOG_CHANNEL_ID, { embeds: [{ title: '⚠️ Wykryto potencjalny alt account', color: 0xff4444, fields: [{ name: 'Uzytkownik', value: `<@${userId}> (${username})`, inline: true }, { name: 'Powiazane konto', value: `<@${fpBlock.linkedUserId}>`, inline: true }, { name: 'Powod', value: 'Ten sam fingerprint urzadzenia', inline: false }], timestamp: new Date().toISOString(), footer: { text: 'BotStation Verify' } }] }).catch(() => {});
                return res.json({ success: false, error: 'alt_detected', message: 'Twoje konto zostalo oznaczone jako potencjalny alt.' });
            }
        }

        // Nadaj role
        await discordRequest('PUT', `/guilds/${guildId}/members/${userId}/roles/${VERIFIED_ROLE_ID}`);
        await Token.updateOne({ token }, { used: true });
        await Verified.create({ userId, guildId, ip, fingerprint });

        await Block.findOneAndUpdate({ guildId, type: 'ip', value: ip }, { guildId, type: 'ip', value: ip, linkedUserId: userId }, { upsert: true });
        if (fingerprint) await Block.findOneAndUpdate({ guildId, type: 'fingerprint', value: fingerprint }, { guildId, type: 'fingerprint', value: fingerprint, linkedUserId: userId }, { upsert: true });

        // PV sukces
        const dmChannel = await discordRequest('POST', '/users/@me/channels', { recipient_id: userId });
        await discordRequest('POST', `/channels/${dmChannel.data.id}/messages`, { embeds: [{ title: '✅ Weryfikacja pomyslna!', description: 'Zostales pomyslnie zweryfikowany na serwerze **BotStation**.\nMasz teraz dostep do wszystkich kanalow. Witamy!', color: 0x5b7fff, timestamp: new Date().toISOString(), footer: { text: 'BotStation Verify' } }] }).catch(() => {});

        // Log sukces
        await sendChannelMessage(LOG_CHANNEL_ID, { embeds: [{ title: '✅ Weryfikacja pomyslna', color: 0x5b7fff, description: `<@${userId}> zostal zweryfikowany i kanaly zostaly mu odblokowane.`, fields: [{ name: 'Uzytkownik', value: `<@${userId}> (${username})`, inline: true }, { name: 'IP', value: `||${ip}||`, inline: true }], timestamp: new Date().toISOString(), footer: { text: 'BotStation Verify' } }] }).catch(() => {});

        res.json({ success: true });

    } catch (err) {
        console.error('Blad weryfikacji:', err);
        await sendChannelMessage(LOG_CHANNEL_ID, { embeds: [{ title: '❌ Blad weryfikacji', color: 0xff8800, fields: [{ name: 'Uzytkownik', value: `<@${userId}> (${username})`, inline: true }, { name: 'Blad', value: err.message || 'Nieznany blad', inline: false }], timestamp: new Date().toISOString(), footer: { text: 'BotStation Verify' } }] }).catch(() => {});
        res.status(500).json({ success: false, error: 'Blad serwera, sprobuj ponownie.' });
    }
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Serwer dziala na porcie ${PORT}`));
}

module.exports = app;
