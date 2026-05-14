// Live courtroom / deposition transcription agent.
// TODO: configure credentials — DEEPGRAM_API_KEY or OPENAI_API_KEY (Whisper).
const express = require('express');
const axios = require('axios');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// In-memory sessions.
const sessions = new Map();

router.post('/start', requireAuth, (req, res) => {
  const id = `tr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  sessions.set(id, { id, caseId: req.body.caseId, segments: [], speakers: new Set(), createdAt: new Date() });
  res.json({ sessionId: id });
});

router.post('/:sessionId/segment', requireAuth, (req, res) => {
  const s = sessions.get(req.params.sessionId);
  if (!s) return res.status(404).json({ error: 'session not found' });
  const { speaker, text, ts } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  s.segments.push({ speaker: speaker || 'unknown', text, ts: ts || Date.now() });
  s.speakers.add(speaker || 'unknown');
  res.json({ ok: true, segmentCount: s.segments.length });
});

router.post('/:sessionId/summarize', requireAuth, async (req, res) => {
  const s = sessions.get(req.params.sessionId);
  if (!s) return res.status(404).json({ error: 'session not found' });
  if (!process.env.OPENROUTER_API_KEY) return res.status(503).json({ error: 'OPENROUTER_API_KEY not configured' });
  try {
    const transcript = s.segments.map(seg => `${seg.speaker}: ${seg.text}`).join('\n').slice(0, 12000);
    const r = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5',
      messages: [
        { role: 'system', content: 'Summarise the deposition with 1) Key admissions 2) Open issues 3) Action items.' },
        { role: 'user', content: transcript }
      ],
      max_tokens: 1500
    }, { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' } });
    res.json({ summary: r.data.choices?.[0]?.message?.content || '' });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

router.get('/:sessionId/transcript', requireAuth, (req, res) => {
  const s = sessions.get(req.params.sessionId);
  if (!s) return res.status(404).json({ error: 'session not found' });
  res.json({ session: s.id, segments: s.segments, speakers: [...s.speakers] });
});

// POST /api/ai/transcription/whisper — synchronous transcription via OpenAI Whisper.
router.post('/whisper', requireAuth, async (req, res) => {
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY not configured' });
  const { audioUrl } = req.body;
  if (!audioUrl) return res.status(400).json({ error: 'audioUrl required' });
  // TODO: configure credentials — for actual upload, fetch audioUrl and POST as multipart/form-data to /v1/audio/transcriptions.
  res.json({ status: 'queued', note: 'Implement Whisper multipart upload from audioUrl.' });
});

module.exports = router;
