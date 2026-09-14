const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { queryServer } = require('../services/serverQuery');
const slugify = require('slugify');

const MODS = ['Classic', 'Deathmatch', 'JailBreak', 'Zombie', 'Surf', 'Minigames', 'Bhop', 'KnifeFight', 'GunGame', 'ScoutKnives', 'BaseBuilder', 'Deathrun', 'Other'];

function buildSlug(name, ip) {
  const base = slugify(name, { lower: true, strict: true }).substring(0, 40);
  const suffix = ip.replace(/[.:]/g, '-').substring(0, 15);
  return `${base}-${suffix}`;
}

// Check server before adding (preview)
router.get('/check', async (req, res) => {
  const { ip, port = 27015 } = req.query;
  if (!ip) return res.status(400).json({ error: 'IP required' });
  const result = await queryServer(ip, parseInt(port), 4000);
  res.json(result);
});

// List / search servers
router.get('/', optionalAuth, (req, res) => {
  const { page = 1, limit = 20, q, mod, country, status, sort = 'votes', min_players, max_players } = req.query;
  const offset = (parseInt(page) - 1) * Math.min(parseInt(limit), 100);
  const lim = Math.min(parseInt(limit), 100);

  let where = ['s.is_active = 1'];
  const params = [];

  if (q) { where.push('(s.name LIKE ? OR s.description LIKE ? OR s.tags LIKE ?)'); const like = `%${q}%`; params.push(like, like, like); }
  if (mod) { where.push('s.mod = ?'); params.push(mod); }
  if (country) { where.push('s.country = ?'); params.push(country); }
  if (status) { where.push('s.status = ?'); params.push(status); }
  if (min_players) { where.push('s.current_players >= ?'); params.push(parseInt(min_players)); }
  if (max_players) { where.push('s.current_players <= ?'); params.push(parseInt(max_players)); }

  const orderMap = {
    votes: 's.vote_count DESC, s.boost_points DESC',
    players: 's.current_players DESC',
    ping: 'CASE WHEN s.ping > 0 THEN s.ping ELSE 9999 END ASC',
    newest: 's.created_at DESC',
    featured: 's.is_featured DESC, s.boost_points DESC',
    views: 's.view_count DESC',
  };
  const order = orderMap[sort] || orderMap.votes;

  const whereClause = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) as c FROM servers s WHERE ${whereClause}`).get(...params).c;
  const rows = db.prepare(`SELECT s.*, u.username as owner_username
    FROM servers s LEFT JOIN users u ON s.owner_id = u.id
    WHERE ${whereClause} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...params, lim, offset);

  res.json({ total, page: parseInt(page), limit: lim, servers: rows });
});

// Featured / top
router.get('/featured', (req, res) => {
  const featured = db.prepare(`SELECT s.*, u.username as owner_username FROM servers s LEFT JOIN users u ON s.owner_id = u.id WHERE s.is_active=1 AND s.is_featured=1 AND (s.featured_until IS NULL OR s.featured_until > datetime('now')) ORDER BY s.boost_points DESC LIMIT 6`).all();
  const topVoted = db.prepare(`SELECT s.*, u.username as owner_username FROM servers s LEFT JOIN users u ON s.owner_id = u.id WHERE s.is_active=1 ORDER BY s.vote_count DESC LIMIT 10`).all();
  const newest = db.prepare(`SELECT s.*, u.username as owner_username FROM servers s LEFT JOIN users u ON s.owner_id = u.id WHERE s.is_active=1 ORDER BY s.created_at DESC LIMIT 10`).all();
  const onlineCount = db.prepare(`SELECT SUM(current_players) as total FROM servers WHERE is_active=1 AND status='online'`).get();
  const serverCount = db.prepare(`SELECT COUNT(*) as c FROM servers WHERE is_active=1`).get();
  res.json({ featured, topVoted, newest, totalOnlinePlayers: onlineCount?.total || 0, totalServers: serverCount?.c || 0 });
});

// Single server
router.get('/:slug', optionalAuth, (req, res) => {
  const s = db.prepare(`SELECT s.*, u.username as owner_username FROM servers s LEFT JOIN users u ON s.owner_id = u.id WHERE (s.slug = ? OR s.id = ?) AND s.is_active=1`).get(req.params.slug, req.params.slug);
  if (!s) return res.status(404).json({ error: 'Server not found' });
  // View count
  db.prepare('UPDATE servers SET view_count = view_count + 1 WHERE id = ?').run(s.id);
  // Player history (last 24h)
  const history = db.prepare(`SELECT player_count, recorded_at FROM player_history WHERE server_id = ? ORDER BY recorded_at DESC LIMIT 288`).all(s.id);
  // Favorite status
  let isFavorited = false;
  if (req.user) isFavorited = !!db.prepare('SELECT id FROM favorites WHERE user_id = ? AND server_id = ?').get(req.user.id, s.id);
  res.json({ ...s, history, isFavorited });
});

// Create server
router.post('/', authMiddleware, async (req, res) => {
  const { name, ip, port = 27015, description, country, city, mod = 'Classic', max_players = 32, website, discord, steam_group, tags, version = '1.6' } = req.body;
  if (!name || !ip) return res.status(400).json({ error: 'Name and IP required' });
  if (!MODS.includes(mod)) return res.status(400).json({ error: 'Invalid mod' });

  const count = db.prepare('SELECT COUNT(*) as c FROM servers WHERE owner_id = ? AND is_active = 1').get(req.user.id);
  if (count.c >= 10) return res.status(400).json({ error: 'Maximum 10 servers per user' });

  const exists = db.prepare('SELECT id FROM servers WHERE ip = ? AND port = ?').get(ip, parseInt(port));
  if (exists) return res.status(409).json({ error: 'Server with this IP:PORT already registered' });

  // Validate server is reachable
  const queryResult = await queryServer(ip, parseInt(port), 4000);

  const id = uuidv4();
  let slug = buildSlug(name, ip);
  // Ensure unique slug
  const slugExists = db.prepare('SELECT id FROM servers WHERE slug = ?').get(slug);
  if (slugExists) slug = `${slug}-${Date.now().toString(36)}`;

  db.prepare(`INSERT INTO servers (id, owner_id, name, ip, port, slug, description, country, city, mod, max_players, website, discord, steam_group, tags, version, status, current_players, current_map, ping)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, req.user.id, name, ip, parseInt(port), slug, description || '', country || '', city || '', mod, parseInt(max_players), website || '', discord || '', steam_group || '', tags || '', version,
      queryResult.online ? 'online' : 'offline', queryResult.players || 0, queryResult.map || '', queryResult.ping || 0);

  // Award points for registering
  db.prepare('UPDATE users SET boost_points = boost_points + 20 WHERE id = ?').run(req.user.id);
  db.prepare('INSERT INTO point_transactions (id, user_id, amount, type, description, reference_id) VALUES (?,?,?,?,?,?)').run(uuidv4(), req.user.id, 20, 'register_server', 'Registered a server', id);

  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(id);
  res.status(201).json(server);
});

// Update server
router.put('/:id', authMiddleware, async (req, res) => {
  const s = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  if (s.owner_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const { name, description, country, city, mod, max_players, website, discord, steam_group, tags } = req.body;
  db.prepare(`UPDATE servers SET name=COALESCE(?,name), description=COALESCE(?,description), country=COALESCE(?,country), city=COALESCE(?,city), mod=COALESCE(?,mod), max_players=COALESCE(?,max_players), website=COALESCE(?,website), discord=COALESCE(?,discord), steam_group=COALESCE(?,steam_group), tags=COALESCE(?,tags), updated_at=datetime('now') WHERE id=?`)
    .run(name, description, country, city, mod, max_players ? parseInt(max_players) : null, website, discord, steam_group, tags, s.id);

  res.json(db.prepare('SELECT * FROM servers WHERE id = ?').get(s.id));
});

// Refresh query
router.post('/:id/refresh', optionalAuth, async (req, res) => {
  const s = db.prepare('SELECT id, ip, port FROM servers WHERE id = ? OR slug = ?').get(req.params.id, req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  const result = await queryServer(s.ip, s.port, 4000);
  db.prepare(`UPDATE servers SET status=?, current_players=?, current_map=?, ping=?, last_queried=datetime('now') WHERE id=?`).run(result.online ? 'online' : 'offline', result.players || 0, result.map || '', result.ping || 0, s.id);
  res.json(result);
});

// Delete
router.delete('/:id', authMiddleware, (req, res) => {
  const s = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  if (s.owner_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('UPDATE servers SET is_active = 0 WHERE id = ?').run(s.id);
  res.json({ success: true });
});

// Ranking
router.get('/meta/ranking', (req, res) => {
  const { type = 'votes', country, mod, page = 1 } = req.query;
  const offset = (parseInt(page) - 1) * 50;
  let where = ['is_active = 1'];
  const params = [];
  if (country) { where.push('country = ?'); params.push(country); }
  if (mod) { where.push('mod = ?'); params.push(mod); }
  const w = where.join(' AND ');

  const orderMap = {
    votes: 'vote_count DESC, boost_points DESC',
    players: 'current_players DESC',
    ping: 'CASE WHEN ping > 0 THEN ping ELSE 9999 END ASC',
    popular: 'view_count DESC',
    newest: 'created_at DESC',
    featured: 'is_featured DESC, boost_points DESC',
  };
  const order = orderMap[type] || orderMap.votes;
  const rows = db.prepare(`SELECT *, ROW_NUMBER() OVER (ORDER BY ${order}) as rank FROM servers WHERE ${w} ORDER BY ${order} LIMIT 50 OFFSET ?`).all(...params, offset);
  const total = db.prepare(`SELECT COUNT(*) as c FROM servers WHERE ${w}`).get(...params).c;
  res.json({ total, page: parseInt(page), servers: rows });
});

// Report
router.post('/:id/report', optionalAuth, (req, res) => {
  const s = db.prepare('SELECT id FROM servers WHERE id = ? OR slug = ?').get(req.params.id, req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  const { reason, description } = req.body;
  if (!reason) return res.status(400).json({ error: 'Reason required' });
  db.prepare('INSERT INTO reports (id, server_id, reporter_id, reporter_ip, reason, description) VALUES (?,?,?,?,?,?)').run(uuidv4(), s.id, req.user?.id || null, req.ip, reason, description || '');
  res.json({ success: true });
});

module.exports = router;
