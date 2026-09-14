const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');
const { optionalAuth } = require('../middleware/auth');
const { voteLimiter } = require('../middleware/rateLimiter');

const COOLDOWN_H = parseInt(process.env.VOTE_COOLDOWN_HOURS) || 24;

router.post('/:serverId', voteLimiter, optionalAuth, (req, res) => {
  const s = db.prepare('SELECT id FROM servers WHERE (id=? OR slug=?) AND is_active=1').get(req.params.serverId, req.params.serverId);
  if (!s) return res.status(404).json({ error: 'Server not found' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  const userId = req.user?.id || null;
  const cutoff = new Date(Date.now() - COOLDOWN_H * 3600000).toISOString();

  // Anti-abuse: check by user OR IP
  const existingByIp = db.prepare('SELECT id FROM votes WHERE server_id=? AND ip_address=? AND created_at > ?').get(s.id, ip, cutoff);
  if (existingByIp) return res.status(429).json({ error: `You already voted. Try again in ${COOLDOWN_H}h.`, cooldown: true });
  if (userId) {
    const existingByUser = db.prepare('SELECT id FROM votes WHERE server_id=? AND user_id=? AND created_at > ?').get(s.id, userId, cutoff);
    if (existingByUser) return res.status(429).json({ error: `You already voted. Try again in ${COOLDOWN_H}h.`, cooldown: true });
  }

  db.prepare('INSERT INTO votes (id, server_id, user_id, ip_address, user_agent) VALUES (?,?,?,?,?)').run(uuidv4(), s.id, userId, ip, req.headers['user-agent'] || '');
  db.prepare('UPDATE servers SET vote_count = vote_count + 1, boost_points = boost_points + 1 WHERE id = ?').run(s.id);

  // Award points to voter
  if (userId) {
    db.prepare('UPDATE users SET boost_points = boost_points + 5 WHERE id = ?').run(userId);
    db.prepare('INSERT INTO point_transactions (id, user_id, amount, type, description, reference_id) VALUES (?,?,?,?,?,?)').run(uuidv4(), userId, 5, 'vote', 'Voted for a server', s.id);
  }

  const updated = db.prepare('SELECT vote_count FROM servers WHERE id = ?').get(s.id);
  res.json({ success: true, vote_count: updated.vote_count });
});

// Check cooldown
router.get('/:serverId/status', optionalAuth, (req, res) => {
  const s = db.prepare('SELECT id FROM servers WHERE (id=? OR slug=?) AND is_active=1').get(req.params.serverId, req.params.serverId);
  if (!s) return res.status(404).json({ error: 'Not found' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  const userId = req.user?.id || null;
  const cutoff = new Date(Date.now() - parseInt(process.env.VOTE_COOLDOWN_HOURS || 24) * 3600000).toISOString();

  const existingByIp = db.prepare('SELECT created_at FROM votes WHERE server_id=? AND ip_address=? AND created_at > ? ORDER BY created_at DESC LIMIT 1').get(s.id, ip, cutoff);
  let canVote = !existingByIp;
  let nextVoteAt = null;
  if (existingByIp) {
    nextVoteAt = new Date(new Date(existingByIp.created_at).getTime() + parseInt(process.env.VOTE_COOLDOWN_HOURS || 24) * 3600000).toISOString();
  }
  res.json({ canVote, nextVoteAt });
});

module.exports = router;
