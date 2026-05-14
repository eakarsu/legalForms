// Consolidated AI capability catalog under /api/ai/*.
const express = require('express');
const router = express.Router();

const capabilities = [
  { id: 'drafting', method: 'POST', path: '/api/ai/drafting/draft' },
  { id: 'billing', method: 'POST', path: '/api/ai/billing/suggest' },
  { id: 'conflicts', method: 'POST', path: '/api/ai/conflicts/check' },
  { id: 'predictions', method: 'POST', path: '/api/ai/predictions/outcome' },
  { id: 'calendar', method: 'POST', path: '/api/ai/calendar/suggest' },
  { id: 'communications', method: 'POST', path: '/api/ai/communications/compose' },
  { id: 'intake', method: 'POST', path: '/api/ai/intake/parse' },
  { id: 'ediscovery', method: 'POST', path: '/api/ai/ediscovery/search' },
  { id: 'pacer', method: 'GET', path: '/api/ai/pacer/cases' },
  { id: 'intake-builder', method: 'POST', path: '/api/ai/intake-builder/build' },
  { id: 'matter-outcome', method: 'POST', path: '/api/ai/matter-outcome/predict' },
  { id: 'transcription', method: 'POST', path: '/api/ai/transcription/start' }
];

router.get('/', (_req, res) => res.json({ capabilities }));
router.get('/:id', (req, res) => {
  const c = capabilities.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'unknown capability' });
  res.json(c);
});

module.exports = router;
