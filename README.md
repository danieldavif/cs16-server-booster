# 🎮 CS 1.6 Server Booster

A full-stack platform to list, rank, boost and discover Counter-Strike 1.6 servers. **100% free** — no paid services required.

---

## 📦 Features

- 🖥 **Server Listing** — browse all CS 1.6 servers with filters by mod, country, status
- 📊 **Real-time Stats** — live player count via CS 1.6 UDP A2S_INFO protocol (queried every 5 min)
- 🏆 **Ranking System** — top by votes, players, ping, views, newest, featured
- ⚡ **Boost System** — free daily boost + Boost Points currency
- 🗳 **Anti-abuse Voting** — IP + user cooldown, rate limiting
- 📈 **Player History Charts** — 24h player graph per server
- 👤 **User Accounts** — register, login, profile, favorites, invite code
- 📊 **Owner Dashboard** — stats, boost, banner generator, edit server
- 🔑 **Admin Panel** — manage users, servers, reports, logs
- 🌙 **Dark/Light Theme**
- 📱 **Fully Responsive**
- 🔍 **SEO Ready** — meta tags, Open Graph, sitemap

---

## 🚀 Local Setup

### Requirements
- **Node.js** ≥ 18: https://nodejs.org
- No database install needed (SQLite runs embedded)

### 1. Install backend dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

Edit `backend/.env` (already pre-configured for local dev):
```env
PORT=3000
JWT_SECRET=change_this_in_production
ADMIN_EMAIL=admin@cs16booster.com
ADMIN_PASSWORD=Admin@123456
```

### 3. Seed admin user

```bash
cd backend
npm run seed
```

### 4. Start backend

```bash
npm run dev   # with auto-reload
# or
npm start     # production
```

API running at: **http://localhost:3000**

### 5. Serve frontend

Open `frontend/public/index.html` in a browser, OR serve with any static server:

```bash
# Python
cd frontend/public
python -m http.server 5500

# Node.js
npx serve frontend/public -p 5500

# VS Code: Install "Live Server" extension, right-click index.html → Open with Live Server
```

Frontend at: **http://localhost:5500**

### 6. Login as admin

- Email: `admin@cs16booster.com`
- Password: `Admin@123456`
- Access admin panel at: `/admin.html`

---

## 📁 Project Structure

```
cs16-server-booster/
├── backend/
│   ├── src/
│   │   ├── index.js              # Express entry point
│   │   ├── models/db.js          # SQLite schema + init
│   │   ├── routes/
│   │   │   ├── auth.js           # Register, Login, Me
│   │   │   ├── servers.js        # CRUD + ranking + search
│   │   │   ├── votes.js          # Vote + cooldown check
│   │   │   ├── users.js          # Profile, favorites, points
│   │   │   ├── boost.js          # Boost activation + plans
│   │   │   ├── admin.js          # Admin CRUD
│   │   │   └── stats.js          # Global stats
│   │   ├── services/
│   │   │   ├── serverQuery.js    # CS 1.6 UDP A2S_INFO query
│   │   │   └── queryScheduler.js # Auto-query every 5 min
│   │   ├── middleware/
│   │   │   ├── auth.js           # JWT middleware
│   │   │   └── rateLimiter.js    # Express rate limit
│   │   └── utils/seed.js         # Admin seeder
│   ├── .env
│   └── package.json
│
└── frontend/public/
    ├── index.html                # Homepage
    ├── servers.html              # Browse / search
    ├── server.html               # Single server page
    ├── add-server.html           # Add server form
    ├── ranking.html              # Ranking table
    ├── dashboard.html            # Owner dashboard
    ├── admin.html                # Admin panel
    ├── earn-points.html          # Points guide
    ├── faq.html                  # FAQ
    ├── sitemap.xml
    ├── robots.txt
    ├── css/style.css             # Full CSS theme
    └── js/app.js                 # Core JS (api, auth, ui)
```

---

## 🌐 Deploy for FREE

### Option 1: Railway.app (Recommended — Node.js + SQLite)

1. Create account at https://railway.app
2. New project → Deploy from GitHub
3. Set environment variables from `.env`
4. Railway auto-detects Node.js and runs `npm start`
5. Get free `*.railway.app` domain

For the frontend: deploy `frontend/public/` to **Vercel** or **Netlify** (drag & drop).

### Option 2: Render.com

1. https://render.com → New Web Service
2. Connect GitHub repo, root: `backend/`
3. Build: `npm install`, Start: `node src/index.js`
4. Free tier: 750h/month (may spin down after inactivity)
5. Add environment variables in dashboard

### Option 3: Glitch.com (Easiest)

1. https://glitch.com → Import from GitHub
2. Configure `.env` in Glitch's secrets panel
3. Free permanent hosting (sleeps after 5min idle)

### Frontend on Netlify/Vercel

1. Drag & drop `frontend/public/` to https://netlify.com/drop
2. Or `npx vercel frontend/public`
3. Update `API_URL` in `js/app.js` to your backend URL

### Free Domain Options

- **Freenom** — .tk / .ml / .ga / .cf / .gq (free)
- **js.org** — free subdomain for GitHub Pages
- **is-a.dev** — free .is-a.dev subdomain (GitHub PR)
- **Railway / Render / Glitch** give free subdomains automatically

---

## 🔧 Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | API port |
| `JWT_SECRET` | — | **Change in production!** |
| `VOTE_COOLDOWN_HOURS` | 24 | Hours between votes per IP |
| `QUERY_INTERVAL_MINUTES` | 5 | How often servers are queried |
| `MAX_SERVERS_PER_USER` | 10 | Server limit per account |

---

## 🛡 Security

- bcrypt password hashing
- JWT authentication
- Express rate limiting on all sensitive endpoints
- Helmet.js security headers
- IP + user-based vote anti-abuse
- CORS restricted to frontend origin
- SQLite WAL mode for concurrent reads

---

## 📡 CS 1.6 Query Protocol

Uses the **GoldSrc A2S_INFO** UDP protocol (same as Source query but older format).
- Port: same as game port (default 27015)
- Returns: server name, map, player count, max players
- Timeout: 3 seconds per query
- No external dependencies needed (raw UDP sockets)

---

## 📄 License

MIT — Free for personal and commercial use.
