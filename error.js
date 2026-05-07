module.exports = (req, res) => {
    const code = req.query.code || '';
    const msgs = {
        no_token: ['Brak tokenu', 'Link jest nieprawidlowy lub niekompletny.'],
        invalid_token: ['Niewazny link', 'Ten link wygasl lub nie istnieje. Linki sa wazne przez 1 godzine.'],
        used_token: ['Link juz uzyty', 'Ten link zostal juz wczesniej wykorzystany.']
    };
    const [title, desc] = msgs[code] || ['Blad weryfikacji', 'Wystapil nieznany problem.'];
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Blad - BotStation</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{--bg:#0d0e12;--bg2:#13151c;--border:rgba(255,255,255,0.07);--silver2:#8a94a8;--white:#eef0f5}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--white);font-family:'Space Grotesk',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem}
  .card{background:var(--bg2);border:1px solid var(--border);border-radius:20px;padding:2.5rem;max-width:420px;width:100%;text-align:center}
  .icon{font-size:3rem;margin-bottom:1rem;display:block}
  h1{font-size:1.4rem;font-weight:700;margin-bottom:.5rem;color:#f87171}
  p{color:var(--silver2);font-size:.9rem;line-height:1.6;margin-top:.5rem}
</style>
</head>
<body>
<div class="card">
  <span class="icon">❌</span>
  <h1>${title}</h1>
  <p>${desc}</p>
  <p style="margin-top:1.5rem;font-size:.78rem;color:rgba(138,148,168,.5)">Wróc na serwer i skontaktuj sie z administracja.</p>
</div>
</body>
</html>`);
};
