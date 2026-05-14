// E-discovery review with vector search and privilege detection.
const express = require('express');
const axios = require('axios');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

// In-memory corpus; replace with pgvector when migration permitted.
const corpus = [];

function tokens(s) { return (s || '').toLowerCase().match(/[a-z0-9]+/g) || []; }

router.post('/ingest', requireAuth, (req, res) => {
  const { docs } = req.body;
  if (!Array.isArray(docs)) return res.status(400).json({ error: 'docs[] required' });
  for (const d of docs) {
    corpus.push({ id: d.id || `d_${corpus.length + 1}`, title: d.title, text: d.text, tokens: tokens(d.text) });
  }
  res.json({ ok: true, total: corpus.length });
});

router.post('/search', requireAuth, async (req, res) => {
  try {
    const { query, topK = 5 } = req.body;
    if (!query) return res.status(400).json({ error: 'query required' });
    const qt = new Set(tokens(query));
    const scored = corpus.map(d => {
      let s = 0;
      for (const t of d.tokens) if (qt.has(t)) s++;
      return { id: d.id, title: d.title, score: s, snippet: d.text?.slice(0, 200) };
    }).sort((a, b) => b.score - a.score).slice(0, topK);

    let analysis = '';
    if (OPENROUTER_API_KEY && scored.length) {
      const r = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: 'For each doc, decide if it appears privileged (attorney-client / work product). Return JSON [{"id","privileged":bool,"reason"}].' },
          { role: 'user', content: scored.map(s => `[${s.id}] ${s.snippet}`).join('\n\n') }
        ],
        max_tokens: 600
      }, { headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' } }).catch(e => ({ data: { error: e.message } }));
      analysis = r.data.choices?.[0]?.message?.content || r.data.error?.message || '';
    }
    res.json({ query, results: scored, privilegeAnalysis: analysis });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
