require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

// Init DB first
require('./models/db');

// Auto-seed admin on startup (fixes Railway ephemeral filesystem)
(async () => {
  try {
    const bcrypt = require('bcryptjs');
    const { v4: uuidv4 } = require('uuid');
    const db = require('./models/db');
    const email = process.env.ADMIN_EMAIL || 'admin@cs16booster.com';
    const password = process.env.ADMIN_PASSWORD || 'Admin123';
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!exists) {
      const hash = await bcrypt.hash(password, 10);
      const id = uuidv4();
      db.prepare('INSERT INTO users (id, username, email, password, role, invite_code, boost_points) VALUES (?,?,?,?,?,?,9999)')
        .run(id, 'admin', email, hash, 'admin', 'ADMIN1');
      console.log(`[Auto-seed] Admin criado: ${email}`);
    }
  } catch(e) { console.error('[Auto-seed] Erro:', e.message); }
})();

const app = express();
const PORT = process.env.PORT || 8080;

// Security headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS
app.use(cors({
  origin: true, // allow all origins
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/servers', require('./routes/servers'));
app.use('/api/votes', require('./routes/votes'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/boost', require('./routes/boost'));
app.use('/api/stats', require('./routes/stats'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🎮 CS 1.6 Server Booster API running on http://localhost:${PORT}`);
  // Start server query scheduler
  require('./services/queryScheduler').start();
});

module.exports = app;
