const express = require('express');

const router = express.Router();

const retainers = [
  { id: 'TR-1001', client: 'Acme Holdings', retainer: 5000, earned: 1750, trustBalance: 3250, status: 'balanced' },
  { id: 'TR-1002', client: 'N. Walker', retainer: 2500, earned: 2200, trustBalance: 450, status: 'variance review' },
  { id: 'TR-1003', client: 'Estate of Rios', retainer: 7500, earned: 3100, trustBalance: 4400, status: 'balanced' },
];

router.get('/', (req, res) => {
  res.json({
    summary: {
      accounts: retainers.length,
      trustBalance: retainers.reduce((sum, item) => sum + item.trustBalance, 0),
      variances: retainers.filter((item) => item.status.includes('variance')).length,
    },
    retainers,
  });
});

router.post('/reconcile', (req, res) => {
  const item = retainers.find((entry) => entry.id === req.body?.id) || retainers[0];
  res.json({
    id: item.id,
    action: item.status === 'balanced' ? 'post reconciliation note' : 'review ledger variance before invoice transfer',
    documents: ['trust ledger', 'invoice detail', 'client retainer agreement'],
  });
});

module.exports = router;
