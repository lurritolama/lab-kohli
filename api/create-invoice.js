/**
 * POST /api/create-invoice
 *
 * Creates a BTCPay Server invoice and returns the checkout URL.
 *
 * Body: { productId, productName, price, email, lang }
 *
 * Required env vars (set in Vercel dashboard):
 *   BTCPAY_URL        – e.g. https://btcpay.yourstore.com
 *   BTCPAY_STORE_ID   – Store ID from BTCPay → Settings → General
 *   BTCPAY_API_KEY    – API Key from BTCPay → Account → API Keys (permissions: btcpay.store.cancreateinvoice)
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { productId, productName, price, email, lang } = req.body;

  if (!productId || !price || !email) {
    return res.status(400).json({ error: 'Missing required fields: productId, price, email' });
  }

  const { BTCPAY_URL, BTCPAY_STORE_ID, BTCPAY_API_KEY } = process.env;

  if (!BTCPAY_URL || !BTCPAY_STORE_ID || !BTCPAY_API_KEY) {
    return res.status(500).json({ error: 'BTCPay Server not configured (missing env vars)' });
  }

  try {
    const invoicePayload = {
      amount: price,
      currency: 'CHF',
      metadata: {
        productId,
        productName,
        buyerEmail: email,
        lang: lang || 'de',
        orderId: `order-${productId}-${Date.now()}`,
      },
      checkout: {
        speedPolicy: 'LowSpeed',          // confirms after 1 Lightning confirmation
        defaultPaymentMethod: 'BTC_LightningLike',
        redirectURL: process.env.SITE_URL || 'https://creativelabkohli.vercel.app',
        redirectAutomatically: true,
      },
      receipt: {
        enabled: true,
        showQR: false,
      },
    };

    const btcpayRes = await fetch(
      `${BTCPAY_URL}/api/v1/stores/${BTCPAY_STORE_ID}/invoices`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `token ${BTCPAY_API_KEY}`,
        },
        body: JSON.stringify(invoicePayload),
      }
    );

    if (!btcpayRes.ok) {
      const errText = await btcpayRes.text();
      console.error('BTCPay error:', errText);
      return res.status(502).json({ error: 'BTCPay invoice creation failed', detail: errText });
    }

    const invoice = await btcpayRes.json();

    return res.status(200).json({
      invoiceId: invoice.id,
      checkoutUrl: invoice.checkoutLink,
    });
  } catch (err) {
    console.error('create-invoice error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
