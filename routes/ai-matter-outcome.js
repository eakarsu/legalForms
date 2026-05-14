// Matter outcome prediction with calibrated confidence and citations.
const express = require('express');
const axios = require('axios');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

router.post('/predict', requireAuth, async (req, res) => {
  try {
    const { matter, similarMatters = [] } = req.body;
    if (!matter) return res.status(400).json({ error: 'matter required' });
    if (!OPENROUTER_API_KEY) return res.status(503).json({ error: 'OPENROUTER_API_KEY not configured' });

    const sys = `You are a litigation outcome predictor. Return JSON:
{"prediction":"win|settle|lose","confidence":0-1,"top_factors":[string],"citations":[{"matter":string,"summary":string}],"calibration_note":string}`;
    const cites = similarMatters.slice(0, 5).map((m, i) => `[${i + 1}] ${m.title || ''}: ${m.summary || ''}`).join('\n');
    const usr = `Matter:\n${JSON.stringify(matter)}\n\nSimilar past matters:\n${cites}`;

    const r = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: OPENROUTER_MODEL,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
      max_tokens: 900,
      temperature: 0.2
    }, { headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' } });

    let parsed;
    try { parsed = JSON.parse(r.data.choices[0].message.content.match(/\{[\s\S]*\}/)[0]); } catch { parsed = { raw: r.data.choices[0].message.content }; }
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
