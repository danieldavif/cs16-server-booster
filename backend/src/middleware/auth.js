const jwt = require('jsonwebtoken');
const db = require('../models/db');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare('SELECT id, username, email, role, boost_points, is_active, is_banned FROM users WHERE id = ?').get(payload.id);
    if (!user || !user.is_active || user.is_banned) return res.status(401).json({ error: 'Account unavailable' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) { req.user = null; return next(); }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = db.prepare('SELECT id, username, email, role, boost_points FROM users WHERE id = ?').get(payload.id) || null;
  } catch { req.user = null; }
  next();
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

module.exports = { authMiddleware, optionalAuth, adminOnly };
