// Intake form builder with AI auto-parse from emails or call recordings.
const express = require('express');
const axios = require('axios');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

// In-memory form library.
const forms = new Map();

async function ai(messages, max = 1200) {
  if (!OPENROUTER_API_KEY) {
    const e = new Error('OPENROUTER_API_KEY not configured'); e.statusCode = 503; throw e;
  }
  const r = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
    model: OPENROUTER_MODEL, messages, max_tokens: max, temperature: 0.2
  }, { headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' } });
  return r.data.choices?.[0]?.message?.content || '';
}

router.post('/build', requireAuth, async (req, res) => {
  try {
    const { practiceArea, description } = req.body;
    if (!practiceArea || !description) return res.status(400).json({ error: 'practiceArea and description required' });
    const out = await ai([
      { role: 'system', content: 'Return a JSON intake form schema: {"fields":[{"name","label","type":"text|select|date","required":bool,"options":[string]}]}' },
      { role: 'user', content: `Practice area: ${practiceArea}\nDescription: ${description}` }
    ]);
    let schema;
    try { schema = JSON.parse(out.match(/\{[\s\S]*\}/)[0]); } catch { schema = { raw: out }; }
    const id = `form_${Date.now()}`;
    forms.set(id, { id, practiceArea, schema });
    res.json({ id, schema });
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

router.get('/:id', requireAuth, (req, res) => {
  const f = forms.get(req.params.id);
  if (!f) return res.status(404).json({ error: 'form not found' });
  res.json(f);
});

router.post('/parse-from-email', requireAuth, async (req, res) => {
  try {
    const { formId, emailText } = req.body;
    const f = forms.get(formId);
    if (!f) return res.status(404).json({ error: 'form not found' });
    const out = await ai([
      { role: 'system', content: `Extract the following fields from the email and return JSON. Fields: ${JSON.stringify(f.schema.fields || [])}` },
      { role: 'user', content: emailText.slice(0, 6000) }
    ]);
    let parsed;
    try { parsed = JSON.parse(out.match(/\{[\s\S]*\}/)[0]); } catch { parsed = { raw: out }; }
    res.json({ parsed });
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

module.exports = router;
