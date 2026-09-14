const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.use(authMiddleware, adminOnly);

// Dashboard stats
router.get('/stats', (req, res) => {
  res.json({
    users: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    servers: db.prepare('SELECT COUNT(*) as c FROM servers WHERE is_active=1').get().c,
    votes: db.prepare('SELECT COUNT(*) as c FROM votes').get().c,
    onlineServers: db.prepare("SELECT COUNT(*) as c FROM servers WHERE status='online' AND is_active=1").get().c,
    onlinePlayers: db.prepare("SELECT SUM(current_players) as s FROM servers WHERE status='online' AND is_active=1").get().s || 0,
    pendingReports: db.prepare("SELECT COUNT(*) as c FROM reports WHERE status='pending'").get().c,
  });
});

// Users
router.get('/users', (req, res) => {
  const { page = 1, q } = req.query;
  const offset = (parseInt(page) - 1) * 30;
  let where = '1=1', params = [];
  if (q) { where = '(username LIKE ? OR email LIKE ?)'; params = [`%${q}%`, `%${q}%`]; }
  const total = db.prepare(`SELECT COUNT(*) as c FROM users WHERE ${where}`).get(...params).c;
  const rows = db.prepare(`SELECT id, username, email, role, boost_points, is_active, is_banned, created_at FROM users WHERE ${where} ORDER BY created_at DESC LIMIT 30 OFFSET ?`).all(...params, offset);
  res.json({ total, page: parseInt(page), users: rows });
});

router.put('/users/:id/ban', (req, res) => {
  const { reason } = req.body;
  db.prepare('UPDATE users SET is_banned=1, ban_reason=? WHERE id=?').run(reason || 'Banned by admin', req.params.id);
  res.json({ success: true });
});

router.put('/users/:id/unban', (req, res) => {
  db.prepare('UPDATE users SET is_banned=0, ban_reason=NULL WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

router.put('/users/:id/role', (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  db.prepare('UPDATE users SET role=? WHERE id=?').run(role, req.params.id);
  res.json({ success: true });
});

// Servers
router.get('/servers', (req, res) => {
  const { page = 1, q, status } = req.query;
  const offset = (parseInt(page) - 1) * 30;
  let where = [], params = [];
  if (q) { where.push('(s.name LIKE ? OR s.ip LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (status) { where.push('s.status = ?'); params.push(status); }
  const w = where.length ? where.join(' AND ') : '1=1';
  const total = db.prepare(`SELECT COUNT(*) as c FROM servers s WHERE ${w}`).get(...params).c;
  const rows = db.prepare(`SELECT s.*, u.username as owner_username FROM servers s LEFT JOIN users u ON s.owner_id=u.id WHERE ${w} ORDER BY s.created_at DESC LIMIT 30 OFFSET ?`).all(...params, offset);
  res.json({ total, page: parseInt(page), servers: rows });
});

router.put('/servers/:id/approve', (req, res) => {
  db.prepare('UPDATE servers SET is_active=1, is_verified=1 WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

router.put('/servers/:id/block', (req, res) => {
  db.prepare('UPDATE servers SET is_active=0 WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

router.put('/servers/:id/feature', (req, res) => {
  const { hours = 24 } = req.body;
  const until = new Date(Date.now() + parseInt(hours) * 3600000).toISOString();
  db.prepare('UPDATE servers SET is_featured=1, featured_until=? WHERE id=?').run(until, req.params.id);
  res.json({ success: true, featured_until: until });
});

// Reports
router.get('/reports', (req, res) => {
  const rows = db.prepare(`SELECT r.*, s.name as server_name, u.username as reporter_name FROM reports r LEFT JOIN servers s ON r.server_id=s.id LEFT JOIN users u ON r.reporter_id=u.id WHERE r.status='pending' ORDER BY r.created_at DESC LIMIT 50`).all();
  res.json(rows);
});

router.put('/reports/:id/resolve', (req, res) => {
  db.prepare("UPDATE reports SET status='resolved', resolved_by=?, resolved_at=datetime('now') WHERE id=?").run(req.user.id, req.params.id);
  res.json({ success: true });
});

// Logs
router.get('/logs', (req, res) => {
  const rows = db.prepare('SELECT * FROM activities ORDER BY created_at DESC LIMIT 100').all();
  res.json(rows);
});

// Settings
router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  res.json(rows);
});

router.put('/settings', (req, res) => {
  const { key, value } = req.body;
  db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')").run(key, value);
  res.json({ success: true });
});

module.exports = router;
