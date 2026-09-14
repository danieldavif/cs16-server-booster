require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');

async function seed() {
  const email = process.env.ADMIN_EMAIL || 'admin@cs16booster.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123456';
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) { console.log('Admin already exists:', email); return; }
  const hash = await bcrypt.hash(password, 10);
  const id = uuidv4();
  db.prepare('INSERT INTO users (id, username, email, password, role, invite_code, boost_points) VALUES (?,?,?,?,?,?,9999)').run(id, 'admin', email, hash, 'admin', 'ADMIN1');
  console.log(`✅ Admin created: ${email} / ${password}`);

  // Demo server
  const sid = uuidv4();
  db.prepare(`INSERT INTO servers (id, owner_id, name, ip, port, slug, description, country, mod, max_players, vote_count, boost_points, is_featured, is_verified, status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(sid, id, 'CS WaRzOnE Server', '143.14.179.187', 27015, 'cs-warzone-server', 'The original CS WaRzOnE BaseBuilder server.', 'BR', 'BaseBuilder', 32, 0, 100, 1, 1, 'checking');
  console.log('✅ Demo server seeded.');
}

seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
