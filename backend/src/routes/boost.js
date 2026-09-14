const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');
const { authMiddleware } = require('../middleware/auth');

const BOOST_PRICES = {
  daily_free: { points: 0, duration_h: 24, label: 'Free Daily Boost' },
  featured_24h: { points: 100, duration_h: 24, label: '24h Featured' },
  featured_72h: { points: 250, duration_h: 72, label: '3-Day Featured' },
  featured_7d: { points: 500, duration_h: 168, label: '7-Day Featured' },
};

// Activate boost
router.post('/activate', authMiddleware, (req, res) => {
  const { server_id, boost_type } = req.body;
  const plan = BOOST_PRICES[boost_type];
  if (!plan) return res.status(400).json({ error: 'Invalid boost type' });

  const server = db.prepare('SELECT * FROM servers WHERE id = ? AND owner_id = ? AND is_active = 1').get(server_id, req.user.id);
  if (!server) return res.status(404).json({ error: 'Server not found or not yours' });

  // Daily free boost: once per server per day
  if (boost_type === 'daily_free') {
    const today = new Date().toISOString().split('T')[0];
    const used = db.prepare("SELECT id FROM boost_history WHERE server_id = ? AND boost_type = 'daily_free' AND created_at >= date('now')").get(server_id);
    if (used) return res.status(429).json({ error: 'Daily free boost already used today' });
  } else {
    const user = db.prepare('SELECT boost_points FROM users WHERE id = ?').get(req.user.id);
    if (user.boost_points < plan.points) return res.status(400).json({ error: `Not enough Boost Points. Need ${plan.points}, have ${user.boost_points}` });
    db.prepare('UPDATE users SET boost_points = boost_points - ? WHERE id = ?').run(plan.points, req.user.id);
    db.prepare('INSERT INTO point_transactions (id, user_id, amount, type, description, reference_id) VALUES (?,?,?,?,?,?)').run(uuidv4(), req.user.id, -plan.points, 'boost_spent', plan.label, server_id);
  }

  const expiresAt = new Date(Date.now() + plan.duration_h * 3600000).toISOString();
  db.prepare('INSERT INTO boost_history (id, server_id, user_id, boost_type, points_spent, duration_hours, expires_at) VALUES (?,?,?,?,?,?,?)').run(uuidv4(), server_id, req.user.id, boost_type, plan.points, plan.duration_h, expiresAt);

  const boostPoints = plan.boost_type === 'daily_free' ? 10 : plan.points / 10;
  db.prepare('UPDATE servers SET boost_points = boost_points + ?, is_featured = ?, featured_until = ? WHERE id = ?').run(
    boostPoints,
    boost_type !== 'daily_free' ? 1 : server.is_featured,
    boost_type !== 'daily_free' ? expiresAt : server.featured_until,
    server_id
  );

  res.json({ success: true, expiresAt, label: plan.label });
});

// Boost history for a server
router.get('/history/:serverId', authMiddleware, (req, res) => {
  const s = db.prepare('SELECT id FROM servers WHERE id = ? AND owner_id = ?').get(req.params.serverId, req.user.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  const rows = db.prepare('SELECT * FROM boost_history WHERE server_id = ? ORDER BY created_at DESC LIMIT 50').all(s.id);
  res.json(rows);
});

// Plans info
router.get('/plans', (req, res) => res.json(BOOST_PRICES));

module.exports = router;
