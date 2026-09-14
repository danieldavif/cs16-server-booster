const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');
const { authMiddleware } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

function makeInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function sign(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

// Register
router.post('/register', authLimiter, async (req, res) => {
  const { username, email, password, invite_code } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return res.status(400).json({ error: 'Username must be 3-20 alphanumeric chars' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email.toLowerCase(), username);
  if (exists) return res.status(409).json({ error: 'Email or username already taken' });

  let invitedBy = null;
  if (invite_code) {
    const inviter = db.prepare('SELECT id FROM users WHERE invite_code = ?').get(invite_code.toUpperCase());
    if (inviter) {
      invitedBy = inviter.id;
      // Award points to inviter
      db.prepare('UPDATE users SET boost_points = boost_points + 15 WHERE id = ?').run(inviter.id);
      db.prepare('INSERT INTO point_transactions (id, user_id, amount, type, description, reference_id) VALUES (?,?,?,?,?,?)').run(uuidv4(), inviter.id, 15, 'invite_friend', 'Invited a new user', null);
    }
  }

  const hash = await bcrypt.hash(password, 10);
  const id = uuidv4();
  const myInviteCode = makeInviteCode();
  db.prepare('INSERT INTO users (id, username, email, password, invite_code, invited_by, boost_points) VALUES (?,?,?,?,?,?,20)').run(id, username, email.toLowerCase(), hash, myInviteCode, invitedBy);
  db.prepare('INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?,?,?,?,?)').run(uuidv4(), id, 20, 'register', 'Welcome bonus');

  const user = db.prepare('SELECT id, username, email, role, boost_points, invite_code FROM users WHERE id = ?').get(id);
  res.status(201).json({ token: sign(user), user });
});

// Login
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.is_banned) return res.status(403).json({ error: 'Account banned: ' + (user.ban_reason || '') });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  // Daily login points
  const today = new Date().toISOString().split('T')[0];
  if (user.last_daily_claim !== today) {
    const streak = (user.last_login_date === new Date(Date.now() - 86400000).toISOString().split('T')[0]) ? (user.daily_login_streak + 1) : 1;
    const pts = 10 + Math.min(streak * 2, 20);
    db.prepare('UPDATE users SET boost_points = boost_points + ?, daily_login_streak = ?, last_daily_claim = ?, last_login_date = ? WHERE id = ?').run(pts, streak, today, today, user.id);
    db.prepare('INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?,?,?,?,?)').run(uuidv4(), user.id, pts, 'daily_login', `Daily login (streak ${streak})`);
  } else {
    db.prepare('UPDATE users SET last_login_date = ? WHERE id = ?').run(today, user.id);
  }

  const fresh = db.prepare('SELECT id, username, email, role, boost_points, invite_code, avatar FROM users WHERE id = ?').get(user.id);
  res.json({ token: sign(fresh), user: fresh });
});

// Me
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, email, role, boost_points, invite_code, avatar, daily_login_streak, last_daily_claim, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// Change password
router.put('/password', authMiddleware, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Missing fields' });
  if (new_password.length < 6) return res.status(400).json({ error: 'Password too short' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const ok = await bcrypt.compare(current_password, user.password);
  if (!ok) return res.status(401).json({ error: 'Wrong current password' });
  const hash = await bcrypt.hash(new_password, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ success: true });
});

module.exports = router;
