/**
 * POST /api/webhook
 *
 * Receives BTCPay Server payment notifications (InvoiceSettled).
 * On successful payment → sends STL download link via Resend email.
 *
 * Required env vars (set in Vercel dashboard):
 *   BTCPAY_WEBHOOK_SECRET  – Secret from BTCPay → Store → Webhooks → Secret
 *   RESEND_API_KEY         – API Key from resend.com → API Keys
 *   FROM_EMAIL             – Verified sender address, e.g. shop@creativelabkohli.ch
 *   SITE_URL               – Your Vercel URL, e.g. https://creativelabkohli.vercel.app
 *
 * STL_URLS is a JSON map of productId → download URL.
 * Store the actual STL files in Vercel Blob, Cloudflare R2, or any CDN.
 */

import crypto from 'crypto';
import { Resend } from 'resend';

// Map productId → STL download URL
// Replace these with your real hosted STL file URLs (Vercel Blob, R2, etc.)
const STL_URLS = {
  1: process.env.STL_URL_1 || 'https://creativelabkohli.vercel.app/stl/vk-brett.stl',
  2: process.env.STL_URL_2 || '',
  3: process.env.STL_URL_3 || '',
  4: process.env.STL_URL_4 || '',
  5: process.env.STL_URL_5 || '',
  6: process.env.STL_URL_6 || '',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- Verify BTCPay HMAC signature ---
  const secret = process.env.BTCPAY_WEBHOOK_SECRET;
  if (secret) {
    const sigHeader = req.headers['btcpay-sig256'];
    if (!sigHeader) {
      return res.status(401).json({ error: 'Missing BTCPay-Sig256 header' });
    }
    const rawBody = JSON.stringify(req.body); // Vercel parses JSON by default
    const expected = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    if (sigHeader !== expected) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  }

  const event = req.body;

  // Only act on settled invoices
  if (event.type !== 'InvoiceSettled') {
    return res.status(200).json({ ok: true, skipped: event.type });
  }

  const { metadata } = event;
  const productId = parseInt(metadata?.productId, 10);
  const email = metadata?.buyerEmail;
  const productName = metadata?.productName || `Produkt ${productId}`;
  const lang = metadata?.lang || 'de';
  const orderId = metadata?.orderId || event.invoiceId;

  if (!email) {
    console.error('No buyer email in invoice metadata');
    return res.status(200).json({ ok: true, warning: 'No email to send' });
  }

  const stlUrl = STL_URLS[productId];
  if (!stlUrl) {
    console.error(`No STL URL configured for productId ${productId}`);
    return res.status(200).json({ ok: true, warning: 'No STL URL for product' });
  }

  // --- Send email via Resend ---
  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.FROM_EMAIL || 'shop@creativelabkohli.ch';
  const siteUrl = process.env.SITE_URL || 'https://creativelabkohli.vercel.app';

  const isDE = lang === 'de';

  const subject = isDE
    ? `✅ Deine STL-Datei: ${productName}`
    : `✅ Your STL File: ${productName}`;

  const html = isDE
    ? `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0f1e;color:#e0e0e0;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#0a1628,#0d2137);padding:40px 32px;text-align:center;">
        <h1 style="color:#00f5ff;font-size:22px;margin:0 0 8px;letter-spacing:2px;">CREATIVE LAB KOHLI</h1>
        <p style="color:#a0b0c0;margin:0;font-size:13px;">3D Druck STL Shop</p>
      </div>
      <div style="padding:32px;">
        <h2 style="color:#00f5ff;font-size:18px;">⚡ Zahlung bestätigt!</h2>
        <p>Vielen Dank für deinen Kauf. Deine STL-Datei ist bereit zum Download.</p>
        <table style="width:100%;background:#0d1f35;border-radius:8px;padding:16px;margin:20px 0;">
          <tr><td style="color:#a0b0c0;padding:4px 0;">Produkt</td><td style="color:#fff;">${productName}</td></tr>
          <tr><td style="color:#a0b0c0;padding:4px 0;">Bestellnummer</td><td style="color:#fff;">${orderId}</td></tr>
        </table>
        <div style="text-align:center;margin:28px 0;">
          <a href="${stlUrl}" style="background:linear-gradient(135deg,#00f5ff,#0080ff);color:#000;font-weight:bold;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:15px;display:inline-block;">
            ⬇ STL-DATEI HERUNTERLADEN
          </a>
        </div>
        <p style="color:#a0b0c0;font-size:12px;">Der Download-Link ist 7 Tage gültig. Bei Fragen antworte auf diese E-Mail.</p>
      </div>
      <div style="background:#060c17;padding:20px 32px;text-align:center;">
        <a href="${siteUrl}" style="color:#00f5ff;font-size:12px;text-decoration:none;">${siteUrl.replace('https://','')}</a>
      </div>
    </div>`
    : `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0f1e;color:#e0e0e0;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#0a1628,#0d2137);padding:40px 32px;text-align:center;">
        <h1 style="color:#00f5ff;font-size:22px;margin:0 0 8px;letter-spacing:2px;">CREATIVE LAB KOHLI</h1>
        <p style="color:#a0b0c0;margin:0;font-size:13px;">3D Print STL Shop</p>
      </div>
      <div style="padding:32px;">
        <h2 style="color:#00f5ff;font-size:18px;">⚡ Payment Confirmed!</h2>
        <p>Thank you for your purchase. Your STL file is ready to download.</p>
        <table style="width:100%;background:#0d1f35;border-radius:8px;padding:16px;margin:20px 0;">
          <tr><td style="color:#a0b0c0;padding:4px 0;">Product</td><td style="color:#fff;">${productName}</td></tr>
          <tr><td style="color:#a0b0c0;padding:4px 0;">Order ID</td><td style="color:#fff;">${orderId}</td></tr>
        </table>
        <div style="text-align:center;margin:28px 0;">
          <a href="${stlUrl}" style="background:linear-gradient(135deg,#00f5ff,#0080ff);color:#000;font-weight:bold;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:15px;display:inline-block;">
            ⬇ DOWNLOAD STL FILE
          </a>
        </div>
        <p style="color:#a0b0c0;font-size:12px;">The download link is valid for 7 days. Reply to this email with any questions.</p>
      </div>
      <div style="background:#060c17;padding:20px 32px;text-align:center;">
        <a href="${siteUrl}" style="color:#00f5ff;font-size:12px;text-decoration:none;">${siteUrl.replace('https://','')}</a>
      </div>
    </div>`;

  try {
    const { error } = await resend.emails.send({
      from: `Creative Lab Kohli <${fromEmail}>`,
      to: [email],
      subject,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ error: 'Email send failed', detail: error });
    }

    console.log(`Email sent to ${email} for order ${orderId}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('webhook error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
