const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

let isConnected = false;
async function connectDB() {
    if (isConnected) return;
    await mongoose.connect(MONGO_URI);
    isConnected = true;
}

const tokenSchema = new mongoose.Schema({
    token: String,
    userId: String,
    guildId: String,
    username: String,
    used: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, expires: 3600 }
});
const Token = mongoose.models.Token || mongoose.model('Token', tokenSchema);

module.exports = async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.redirect('/api/error?code=no_token');
    }

    await connectDB();
    const tokenDoc = await Token.findOne({ token });

    if (!tokenDoc) return res.redirect('/api/error?code=invalid_token');
    if (tokenDoc.used) return res.redirect('/api/error?code=used_token');

    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Weryfikacja - BotStation</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/fingerprintjs2/2.1.4/fingerprint2.min.js"></script>
<style>
  :root{--bg:#0d0e12;--bg2:#13151c;--border:rgba(255,255,255,0.07);--silver2:#8a94a8;--accent:#5b7fff;--accent2:#8fa3ff;--white:#eef0f5}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--white);font-family:'Space Grotesk',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem}
  .bg-glow{position:fixed;inset:0;background:radial-gradient(ellipse 60% 50% at 50% 0%,rgba(91,127,255,0.1) 0%,transparent 70%);pointer-events:none}
  .bg-grid{position:fixed;inset:0;background-image:linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px);background-size:60px 60px;mask-image:radial-gradient(ellipse 80% 80% at 50% 30%,black 0%,transparent 70%);pointer-events:none}
  .card{background:var(--bg2);border:1px solid var(--border);border-radius:20px;padding:2.5rem;max-width:440px;width:100%;text-align:center;position:relative;z-index:1;animation:fadeInUp 0.5s ease}
  @keyframes fadeInUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  .logo{font-size:.9rem;font-weight:700;letter-spacing:.15em;color:var(--silver2);font-family:'JetBrains Mono',monospace;margin-bottom:2rem}
  .shield{font-size:3rem;margin-bottom:1rem;display:block}
  h1{font-size:1.5rem;font-weight:700;margin-bottom:.5rem;letter-spacing:-.02em}
  .subtitle{font-size:.9rem;color:var(--silver2);line-height:1.6;margin-bottom:2rem}
  .info-box{background:rgba(91,127,255,.06);border:1px solid rgba(91,127,255,.15);border-radius:12px;padding:1rem 1.25rem;margin-bottom:2rem;font-size:.83rem;color:var(--silver2);line-height:1.6;text-align:left}
  .info-box strong{color:var(--accent2)}
  .btn{width:100%;background:var(--accent);color:#fff;border:none;border-radius:12px;padding:1rem;font-size:1rem;font-weight:700;font-family:'Space Grotesk',sans-serif;cursor:pointer;transition:all .2s;box-shadow:0 4px 30px rgba(91,127,255,.35);display:flex;align-items:center;justify-content:center;gap:.5rem}
  .btn:hover:not(:disabled){background:#6e8fff;transform:translateY(-2px)}
  .btn:disabled{opacity:.6;cursor:not-allowed;transform:none}
  .spinner{width:18px;height:18px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:none}
  @keyframes spin{to{transform:rotate(360deg)}}
  .state-success,.state-error{display:none}
  .big-icon{font-size:3.5rem;margin-bottom:1rem;display:block}
  .state-success h2{font-size:1.4rem;font-weight:700;margin-bottom:.5rem;color:#6ee7b7}
  .state-error h2{font-size:1.4rem;font-weight:700;margin-bottom:.5rem;color:#f87171}
  .state-success p,.state-error p{color:var(--silver2);font-size:.9rem;line-height:1.6}
  .err-msg{display:none;color:#f87171;font-size:.85rem;margin-top:1rem;padding:.75rem 1rem;background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.2);border-radius:8px}
  .footer-note{margin-top:1.5rem;font-size:.75rem;color:rgba(138,148,168,.5);line-height:1.5}
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
    <div class="info-box"><strong>Co sprawdzamy?</strong><br>Adres IP oraz identyfikator urzadzenia w celu wykrycia kont alt. Twoje dane sa poufne.</div>
    <button class="btn" id="btn" onclick="startVerify()">
      <span id="btnText">Zweryfikuj mnie</span>
      <div class="spinner" id="spinner"></div>
    </button>
    <div class="err-msg" id="errMsg"></div>
    <p class="footer-note">Klikajac akceptujesz zbieranie danych w celu weryfikacji tozsamosci.</p>
  </div>
  <div class="state-success" id="stateSuccess">
    <span class="big-icon">✅</span>
    <h2>Weryfikacja pomyslna!</h2>
    <p>Zostales zweryfikowany i masz dostep do kanalow. Sprawdz swoje PV.</p>
    <p class="footer-note" style="margin-top:1.5rem">Mozesz zamknac te strone i wrocic na serwer.</p>
  </div>
  <div class="state-error" id="stateError">
    <span class="big-icon">❌</span>
    <h2 id="errTitle">Weryfikacja nieudana</h2>
    <p id="errDesc">Wystapil problem podczas weryfikacji.</p>
    <p class="footer-note" style="margin-top:1.5rem">Skontaktuj sie z administracja serwera.</p>
  </div>
</div>
<script>
  const token = new URLSearchParams(window.location.search).get('token');
  function show(s){
    document.getElementById('stateDefault').style.display=s==='d'?'block':'none';
    document.getElementById('stateSuccess').style.display=s==='s'?'block':'none';
    document.getElementById('stateError').style.display=s==='e'?'block':'none';
  }
  async function startVerify(){
    const btn=document.getElementById('btn'),t=document.getElementById('btnText'),sp=document.getElementById('spinner'),em=document.getElementById('errMsg');
    btn.disabled=true;t.textContent='Weryfikowanie...';sp.style.display='block';em.style.display='none';
    let fp=null;
    try{fp=await new Promise(r=>{if(typeof Fingerprint2!=='undefined'){Fingerprint2.get(c=>r(Fingerprint2.x64hash128(c.map(x=>x.value).join(''),31)))}else r(null)})}catch(e){}
    try{
      const res=await fetch('/api/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,fingerprint:fp})});
      const data=await res.json();
      if(data.success){show('s')}
      else if(data.error==='alt_detected'){show('e');document.getElementById('errTitle').textContent='⚠️ Wykryto konto alt';document.getElementById('errDesc').textContent=data.message}
      else{btn.disabled=false;t.textContent='Zweryfikuj mnie';sp.style.display='none';em.textContent=data.error||'Cos poszlo nie tak.';em.style.display='block'}
    }catch(e){btn.disabled=false;t.textContent='Zweryfikuj mnie';sp.style.display='none';em.textContent='Blad polaczenia.';em.style.display='block'}
  }
</script>
</body>
</html>`);
};
