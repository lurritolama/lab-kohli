/**
 * STL-Agent — Proof of Concept v2
 * ─────────────────────────────────────────────────────────────────────────────
 * Ein Claude-Agent, der bei eingehender Bestellung:
 *  1. Den STL-Ordner nach passenden Dateien durchsucht
 *  2. Die richtige STL-Datei dem Produkt zuordnet
 *  3. Die Datei per E-Mail (Brevo HTTP API) an den Kunden sendet
 *
 * Verwendung:
 *   node stl-agent.js
 *
 * Oder programmatisch:
 *   const { processOrder } = require('./stl-agent');
 *   await processOrder({ productName: 'VK-Brett', customerEmail: 'kunde@example.com' });
 * ─────────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const Anthropic   = require('@anthropic-ai/sdk');
const fs          = require('fs');
const path        = require('path');

// ── Clients ──────────────────────────────────────────────────────────────────
const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

// Debug: Env-Variablen beim Start prüfen
console.log('🔑 ANTHROPIC_API_KEY vorhanden:', !!process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_API_KEY ? '('+process.env.ANTHROPIC_API_KEY.substring(0,10)+'...)' : 'FEHLT!');
console.log('📧 BREVO_API_KEY vorhanden:', !!process.env.BREVO_API_KEY);
console.log('📧 BREVO_SENDER_EMAIL:', process.env.BREVO_SENDER_EMAIL || 'FEHLT!');

// Brevo HTTP API E-Mail senden
async function sendBrevoEmail({ to, subject, htmlContent, attachmentBuffer, attachmentName }) {
  const body = {
    sender: { name: 'Creative Lab Kohli', email: process.env.BREVO_SENDER_EMAIL },
    to: [{ email: to }],
    subject,
    htmlContent,
    attachment: [
      {
        content: attachmentBuffer.toString('base64'),
        name: attachmentName,
      },
    ],
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Brevo API Fehler ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

const STL_DIR   = path.join(__dirname, 'stl');

// ── Tool-Definitionen ─────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'list_stl_files',
    description:
      'Listet alle verfügbaren STL-Dateien im STL-Ordner auf. ' +
      'Verwende dieses Tool zuerst, um zu sehen welche Dateien vorhanden sind.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'send_stl_email',
    description:
      'Sendet eine STL-Datei als E-Mail-Anhang an den Kunden. ' +
      'Verwende den genauen Dateinamen aus list_stl_files.',
    input_schema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'E-Mail-Adresse des Kunden',
        },
        stl_filename: {
          type: 'string',
          description: 'Dateiname der STL-Datei (z.B. "VK-Brett.stl")',
        },
        product_name: {
          type: 'string',
          description: 'Produktname für die E-Mail-Betreffzeile',
        },
        lang: {
          type: 'string',
          enum: ['de', 'en'],
          description: 'Sprache der E-Mail (de oder en)',
        },
      },
      required: ['to', 'stl_filename', 'product_name'],
    },
  },
];

// ── Tool-Ausführung ───────────────────────────────────────────────────────────
async function executeTool(name, input) {
  console.log(`\n🔧 Tool: ${name}`, input);

  if (name === 'list_stl_files') {
    if (!fs.existsSync(STL_DIR)) {
      return JSON.stringify({ error: 'STL-Ordner nicht gefunden: ' + STL_DIR });
    }
    const files = fs
      .readdirSync(STL_DIR)
      .filter(f => f.toLowerCase().endsWith('.stl'));

    console.log(`   → ${files.length} Datei(en) gefunden:`, files);
    return JSON.stringify({ files, folder: STL_DIR });
  }

  if (name === 'send_stl_email') {
    const { to, stl_filename, product_name, lang = 'de' } = input;
    const filePath = path.join(STL_DIR, stl_filename);

    // Sicherheitscheck: kein Path Traversal
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(STL_DIR))) {
      return JSON.stringify({ error: 'Ungültiger Dateipfad.' });
    }

    if (!fs.existsSync(filePath)) {
      return JSON.stringify({ error: `Datei nicht gefunden: ${stl_filename}` });
    }

    if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
      return JSON.stringify({ error: 'BREVO_API_KEY oder BREVO_SENDER_EMAIL fehlt' });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const isDE = lang !== 'en';

    const htmlContent = isDE
      ? `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#00f5ff">Deine STL-Datei ist da! 🎉</h2>
          <p>Vielen Dank für deine Bestellung bei <strong>Creative Lab Kohli</strong>.</p>
          <p>Im Anhang findest du deine STL-Datei: <strong>${product_name}</strong></p>
          <p style="color:#888;font-size:12px">Viel Spaß beim Drucken!</p>
          <hr style="border-color:#333">
          <p style="color:#888;font-size:11px">Creative Lab Kohli · creativelabkohli.ch</p>
        </div>`
      : `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#00f5ff">Your STL file is here! 🎉</h2>
          <p>Thank you for your order at <strong>Creative Lab Kohli</strong>.</p>
          <p>Please find your STL file attached: <strong>${product_name}</strong></p>
          <p style="color:#888;font-size:12px">Happy printing!</p>
          <hr style="border-color:#333">
          <p style="color:#888;font-size:11px">Creative Lab Kohli · creativelabkohli.ch</p>
        </div>`;

    const subject = isDE
      ? `Deine STL-Datei: ${product_name} — Creative Lab Kohli`
      : `Your STL File: ${product_name} — Creative Lab Kohli`;

    try {
      const result = await sendBrevoEmail({
        to,
        subject,
        htmlContent,
        attachmentBuffer: fileBuffer,
        attachmentName: stl_filename,
      });
      console.log(`   ✓ E-Mail gesendet an ${to} (ID: ${result.messageId})`);
      return JSON.stringify({ success: true, email_id: result.messageId, sent_to: to });
    } catch (err) {
      console.error('   ✗ Brevo Fehler:', err.message);
      return JSON.stringify({ error: err.message });
    }
  }

  return JSON.stringify({ error: `Unbekanntes Tool: ${name}` });
}

// ── Hauptfunktion: Bestellung verarbeiten ─────────────────────────────────────
async function processOrder(order) {
  const { productName, customerEmail, lang = 'de' } = order;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 Neue Bestellung:');
  console.log(`   Produkt:  ${productName}`);
  console.log(`   E-Mail:   ${customerEmail}`);
  console.log(`   Sprache:  ${lang}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const systemPrompt = `Du bist der Bestell-Agent von Creative Lab Kohli, einem 3D-Druck-Shop.
Deine Aufgabe: Bei jeder Bestellung die passende STL-Datei finden und per E-Mail an den Kunden senden.

Vorgehen:
1. Rufe list_stl_files auf, um die verfügbaren Dateien zu sehen
2. Wähle die Datei, die am besten zum bestellten Produkt passt (Namensähnlichkeit)
3. Sende die Datei mit send_stl_email an den Kunden
4. Bestätige kurz was du getan hast

Sei präzise und führe die Aufgabe ohne Rückfragen durch.`;

  const userMessage = `Bestellung eingegangen:
- Produkt: ${productName}
- Kunden-E-Mail: ${customerEmail}
- Sprache: ${lang}

Bitte verarbeite diese Bestellung jetzt.`;

  let messages = [{ role: 'user', content: userMessage }];

  // ── Agentic Loop ──────────────────────────────────────────────────────────
  let turns = 0;
  const MAX_TURNS = 5;

  while (turns < MAX_TURNS) {
    turns++;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    });

    console.log(`\n🤖 Claude (turn ${turns}, stop: ${response.stop_reason}):`);

    // Textausgabe anzeigen
    for (const block of response.content) {
      if (block.type === 'text' && block.text.trim()) {
        console.log('  ', block.text);
      }
    }

    // Fertig?
    if (response.stop_reason === 'end_turn') {
      const finalText = response.content.find(b => b.type === 'text');
      console.log('\n✅ Fertig!\n');
      return { success: true, message: finalText?.text || 'Bestellung verarbeitet.' };
    }

    // Tool-Aufrufe verarbeiten
    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });

      const toolResults = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await executeTool(block.name, block.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    // Unerwarteter Stop
    break;
  }

  return { success: false, message: 'Agent hat max. Turns erreicht.' };
}

// ── CLI-Test ──────────────────────────────────────────────────────────────────
if (require.main === module) {
  // Prüfe ob alle nötigen Env-Vars gesetzt sind
  const missing = ['ANTHROPIC_API_KEY', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL'].filter(
    k => !process.env[k]
  );
  if (missing.length > 0) {
    console.error('❌ Fehlende Umgebungsvariablen:', missing.join(', '));
    console.error('   Kopiere .env.example → .env und fülle die Werte aus.');
    process.exit(1);
  }

  // Test-Bestellung
  processOrder({
    productName: 'VK-Brett / Verteilerkasten',
    customerEmail: process.argv[2] || 'test@example.com',
    lang: 'de',
  })
    .then(result => {
      console.log('Ergebnis:', result);
    })
    .catch(err => {
      console.error('Fehler:', err.message);
      process.exit(1);
    });
}

module.exports = { processOrder };
