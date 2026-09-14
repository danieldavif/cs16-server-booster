const express = require('express');
const router = express.Router();
const db = require('../models/db');

router.get('/global', (req, res) => {
  res.json({
    totalServers: db.prepare('SELECT COUNT(*) as c FROM servers WHERE is_active=1').get().c,
    onlineServers: db.prepare("SELECT COUNT(*) as c FROM servers WHERE status='online' AND is_active=1").get().c,
    totalPlayers: db.prepare("SELECT SUM(current_players) as s FROM servers WHERE status='online'").get().s || 0,
    totalVotes: db.prepare('SELECT COUNT(*) as c FROM votes').get().c,
    totalUsers: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    mods: db.prepare("SELECT mod, COUNT(*) as c FROM servers WHERE is_active=1 GROUP BY mod ORDER BY c DESC").all(),
    countries: db.prepare("SELECT country, COUNT(*) as c FROM servers WHERE is_active=1 AND country != '' GROUP BY country ORDER BY c DESC LIMIT 10").all(),
  });
});

module.exports = router;
