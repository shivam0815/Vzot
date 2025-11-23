import express from 'express';

const router = express.Router();


router.get('/config', async (req, res) => {
  try {
    const config = {
      channels: {
        email: true,
        phone: true,
        whatsapp: true,
        chat: false,
      },
      email: {
        address: process.env.SUPPORT_EMAIL || 'support@nakodamobile.in',
        responseTimeHours: Number(process.env.SUPPORT_RESP_HOURS || 24),
      },
      phone: {
        number: process.env.SUPPORT_PHONE || '+91-99999-99999',
        hours: process.env.SUPPORT_HOURS || 'Mon–Sat 10:00–19:00 IST',
      },
      whatsapp: {
        number: process.env.SUPPORT_WHATSAPP || '+91-99999-99999',
        link:
          process.env.SUPPORT_WHATSAPP_LINK ||
          'https://wa.me/919999999999?text=Hi%20Nakoda%20Mobile%20Support',
      },
      faq: {
        enabled: true,
        url: process.env.SUPPORT_FAQ_URL || 'https://nakodamobile.in/faq',
      },
      lastUpdated: new Date().toISOString(),
    };

    return res.json({ success: true, config });
  } catch (err: any) {
    console.error('❌ support/config error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load support config' });
  }
});

export default router;
