const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './data/booster.db';
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      avatar TEXT,
      boost_points INTEGER DEFAULT 0,
      invited_by TEXT,
      invite_code TEXT UNIQUE,
      daily_login_streak INTEGER DEFAULT 0,
      last_login_date TEXT,
      last_daily_claim TEXT,
      is_active INTEGER DEFAULT 1,
      is_banned INTEGER DEFAULT 0,
      ban_reason TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      ip TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 27015,
      slug TEXT UNIQUE,
      description TEXT,
      country TEXT,
      city TEXT,
      mod TEXT DEFAULT 'Classic',
      version TEXT DEFAULT '1.6',
      max_players INTEGER DEFAULT 32,
      website TEXT,
      discord TEXT,
      steam_group TEXT,
      tags TEXT,
      logo TEXT,
      banner TEXT,
      is_active INTEGER DEFAULT 1,
      is_verified INTEGER DEFAULT 0,
      is_featured INTEGER DEFAULT 0,
      featured_until TEXT,
      boost_points INTEGER DEFAULT 0,
      vote_count INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'checking',
      current_players INTEGER DEFAULT 0,
      current_map TEXT DEFAULT '',
      ping INTEGER DEFAULT 0,
      online_since TEXT,
      last_queried TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      user_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (server_id) REFERENCES servers(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      server_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, server_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (server_id) REFERENCES servers(id)
    );

    CREATE TABLE IF NOT EXISTS player_history (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      player_count INTEGER DEFAULT 0,
      recorded_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (server_id) REFERENCES servers(id)
    );

    CREATE TABLE IF NOT EXISTS boost_history (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      boost_type TEXT NOT NULL,
      points_spent INTEGER DEFAULT 0,
      duration_hours INTEGER DEFAULT 0,
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (server_id) REFERENCES servers(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS point_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      reference_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      reporter_id TEXT,
      reporter_ip TEXT,
      reason TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      resolved_by TEXT,
      resolved_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (server_id) REFERENCES servers(id)
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      meta TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);
    CREATE INDEX IF NOT EXISTS idx_servers_mod ON servers(mod);
    CREATE INDEX IF NOT EXISTS idx_servers_country ON servers(country);
    CREATE INDEX IF NOT EXISTS idx_servers_votes ON servers(vote_count DESC);
    CREATE INDEX IF NOT EXISTS idx_votes_server ON votes(server_id);
    CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id);
    CREATE INDEX IF NOT EXISTS idx_player_history_server ON player_history(server_id, recorded_at);
    CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id, created_at);
  `);

  // Default settings
  const defaults = [
    ['site_name', 'CS 1.6 Server Booster'],
    ['vote_cooldown_hours', '24'],
    ['max_servers_per_user', '10'],
    ['points_per_vote', '5'],
    ['points_daily_login', '10'],
    ['points_register_server', '20'],
    ['points_invite_friend', '15'],
    ['featured_cost_24h', '100'],
    ['featured_cost_72h', '250'],
    ['featured_cost_7d', '500'],
  ];
  const insertSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
  defaults.forEach(([k, v]) => insertSetting.run(k, v));
}

init();
module.exports = db;
