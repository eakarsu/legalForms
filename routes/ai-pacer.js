// PACER / state-court filing integrations.
// TODO: configure credentials — PACER_USERNAME, PACER_PASSWORD, COURTLISTENER_API_KEY.
const express = require('express');
const axios = require('axios');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// CourtListener is an open API that wraps PACER content.
router.get('/cases', requireAuth, async (req, res) => {
  try {
    const { q = '', limit = 10 } = req.query;
    const headers = {};
    if (process.env.COURTLISTENER_API_KEY) headers.Authorization = `Token ${process.env.COURTLISTENER_API_KEY}`;
    const r = await axios.get(`https://www.courtlistener.com/api/rest/v3/search/?q=${encodeURIComponent(q)}&type=r&page_size=${limit}`,
      { headers, timeout: 30000 });
    res.json({ count: r.data?.count, results: r.data?.results || [] });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

router.get('/docket/:docketId', requireAuth, async (req, res) => {
  try {
    const headers = process.env.COURTLISTENER_API_KEY ? { Authorization: `Token ${process.env.COURTLISTENER_API_KEY}` } : {};
    const r = await axios.get(`https://www.courtlistener.com/api/rest/v3/dockets/${req.params.docketId}/`,
      { headers, timeout: 30000 });
    res.json(r.data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

router.post('/file', requireAuth, (req, res) => {
  if (!process.env.PACER_USERNAME) return res.status(503).json({ error: 'PACER credentials not configured' });
  // TODO: configure credentials — implement PACER ECF filing via state-specific portals.
  res.json({ status: 'queued', note: 'Implement court-specific filing client.' });
});

module.exports = router;
