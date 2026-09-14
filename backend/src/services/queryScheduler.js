const db = require('../models/db');
const { queryServer } = require('./serverQuery');
const { v4: uuidv4 } = require('uuid');

const INTERVAL_MS = (parseInt(process.env.QUERY_INTERVAL_MINUTES) || 5) * 60 * 1000;

async function queryAll() {
  const servers = db.prepare('SELECT id, ip, port FROM servers WHERE is_active = 1').all();
  console.log(`[Scheduler] Querying ${servers.length} servers...`);
  for (const s of servers) {
    try {
      const result = await queryServer(s.ip, s.port, 3000);
      db.prepare(`UPDATE servers SET
        status = ?, current_players = ?, current_map = ?, ping = ?, last_queried = datetime('now'),
        online_since = CASE WHEN status != 'online' AND ? = 'online' THEN datetime('now') ELSE online_since END
        WHERE id = ?`).run(
        result.online ? 'online' : 'offline',
        result.players || 0,
        result.map || '',
        result.ping || 0,
        result.online ? 'online' : 'offline',
        s.id
      );
      // Record player history every cycle
      db.prepare('INSERT INTO player_history (id, server_id, player_count) VALUES (?,?,?)').run(uuidv4(), s.id, result.players || 0);
      // Keep only last 500 records per server
      db.prepare('DELETE FROM player_history WHERE server_id = ? AND id NOT IN (SELECT id FROM player_history WHERE server_id = ? ORDER BY recorded_at DESC LIMIT 500)').run(s.id, s.id);
    } catch (e) {
      console.error(`[Scheduler] Error querying ${s.ip}:${s.port}:`, e.message);
    }
  }
}

function start() {
  // Run once immediately
  setTimeout(queryAll, 5000);
  // Then on interval
  setInterval(queryAll, INTERVAL_MS);
  console.log(`[Scheduler] Server query scheduler started (every ${INTERVAL_MS / 60000} min)`);
}

module.exports = { start, queryAll };
