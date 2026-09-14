const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authMiddleware } = require('../middleware/auth');

// Profile
router.get('/profile', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, email, role, boost_points, invite_code, avatar, daily_login_streak, last_daily_claim, created_at FROM users WHERE id = ?').get(req.user.id);
  const servers = db.prepare('SELECT id, name, slug, status, vote_count, boost_points, is_featured, mod FROM servers WHERE owner_id = ? AND is_active = 1 ORDER BY vote_count DESC').all(req.user.id);
  const transactions = db.prepare('SELECT * FROM point_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 30').all(req.user.id);
  const activities = db.prepare('SELECT * FROM activities WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(req.user.id);
  const favorites = db.prepare(`SELECT s.id, s.name, s.slug, s.mod, s.status, s.current_players, s.max_players, s.vote_count FROM favorites f JOIN servers s ON f.server_id = s.id WHERE f.user_id = ? AND s.is_active = 1 ORDER BY f.created_at DESC`).all(req.user.id);
  res.json({ user, servers, transactions, activities, favorites });
});

// Update profile
router.put('/profile', authMiddleware, (req, res) => {
  const { username } = req.body;
  if (username) {
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return res.status(400).json({ error: 'Invalid username' });
    const taken = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.user.id);
    if (taken) return res.status(409).json({ error: 'Username taken' });
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, req.user.id);
  }
  res.json({ success: true });
});

// Favorites
router.post('/favorites/:serverId', authMiddleware, (req, res) => {
  const { v4: uuidv4 } = require('uuid');
  const s = db.prepare('SELECT id FROM servers WHERE (id=? OR slug=?) AND is_active=1').get(req.params.serverId, req.params.serverId);
  if (!s) return res.status(404).json({ error: 'Not found' });
  const exists = db.prepare('SELECT id FROM favorites WHERE user_id=? AND server_id=?').get(req.user.id, s.id);
  if (exists) {
    db.prepare('DELETE FROM favorites WHERE user_id=? AND server_id=?').run(req.user.id, s.id);
    return res.json({ favorited: false });
  }
  db.prepare('INSERT INTO favorites (id, user_id, server_id) VALUES (?,?,?)').run(uuidv4(), req.user.id, s.id);
  res.json({ favorited: true });
});

// Point history
router.get('/points', authMiddleware, (req, res) => {
  const { page = 1 } = req.query;
  const offset = (parseInt(page) - 1) * 20;
  const rows = db.prepare('SELECT * FROM point_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20 OFFSET ?').all(req.user.id, offset);
  const total = db.prepare('SELECT COUNT(*) as c FROM point_transactions WHERE user_id = ?').get(req.user.id).c;
  res.json({ total, page: parseInt(page), transactions: rows });
});

// Earn points tasks
router.get('/tasks', authMiddleware, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const user = db.prepare('SELECT last_daily_claim FROM users WHERE id = ?').get(req.user.id);
  const canClaimDaily = user.last_daily_claim !== today;
  const votedToday = db.prepare("SELECT COUNT(*) as c FROM votes WHERE user_id = ? AND created_at >= date('now')").get(req.user.id).c > 0;
  const hasServer = db.prepare('SELECT COUNT(*) as c FROM servers WHERE owner_id = ? AND is_active = 1').get(req.user.id).c > 0;

  res.json({
    tasks: [
      { id: 'daily_login', label: 'Daily Login', points: 10, done: !canClaimDaily },
      { id: 'vote_server', label: 'Vote for a Server', points: 5, done: votedToday },
      { id: 'add_server', label: 'Register a Server', points: 20, done: hasServer },
    ]
  });
});

module.exports = router;
