/**
 * Express-Server für Creative Lab Kohli
 * ─────────────────────────────────────
 * Ersetzt server.ps1 — dient sowohl die Website als auch die API.
 *
 * Starten: node app.js
 * Öffnen:  http://localhost:3000
 */

require('dotenv').config();
const express        = require('express');
const path           = require('path');
const { processOrder } = require('./stl-agent');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── CORS (erlaubt Netlify-Frontend) ───────────────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname)));   // Serviert index.html, etc.

// ── API: STL per E-Mail senden ────────────────────────────────────────────────
app.post('/api/send-stl', async (req, res) => {
  const { productName, customerEmail, lang = 'de' } = req.body;

  if (!customerEmail || !customerEmail.includes('@')) {
    return res.status(400).json({ error: 'Ungültige E-Mail-Adresse.' });
  }
  if (!productName) {
    return res.status(400).json({ error: 'Produktname fehlt.' });
  }

  console.log(`\n📬 API-Anfrage: ${productName} → ${customerEmail}`);

  try {
    const result = await processOrder({ productName, customerEmail, lang });
    res.json(result);
  } catch (err) {
    console.error('Fehler:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Server starten ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ Server läuft auf http://localhost:${PORT}`);
  console.log(`📦 STL-Agent bereit`);
  console.log(`🔗 API: POST http://localhost:${PORT}/api/send-stl\n`);
});
