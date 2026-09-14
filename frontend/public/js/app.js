/* ===== CS 1.6 Server Booster — App Core ===== */
'use strict';

const API_URL = 'http://localhost:3000/api';

/* ---- API ---- */
const api = {
  _token: () => localStorage.getItem('token'),
  async request(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const t = this._token();
    if (t) opts.headers['Authorization'] = `Bearer ${t}`;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API_URL + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { status: res.status, message: data.error || 'Error' };
    return data;
  },
  get: (path) => api.request('GET', path),
  post: (path, body) => api.request('POST', path, body),
  put: (path, body) => api.request('PUT', path, body),
  del: (path) => api.request('DELETE', path),
};

/* ---- Auth Store ---- */
const auth = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  setAuth(token, user) { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); this.user = user; },
  logout() { localStorage.removeItem('token'); localStorage.removeItem('user'); this.user = null; window.location.href = '/'; },
  isLoggedIn: () => !!localStorage.getItem('token'),
};

/* ---- Toast ---- */
const toast = (() => {
  const container = (() => { const d = document.createElement('div'); d.className = 'toast-container'; document.body.appendChild(d); return d; })();
  return (msg, type = 'info', ms = 3500) => {
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type]||'•'}</span><span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(110%)'; el.style.transition = '.3s'; setTimeout(() => el.remove(), 300); }, ms);
  };
})();

/* ---- Navbar ---- */
function renderNavUser() {
  const actionsEl = document.getElementById('navActions');
  if (!actionsEl) return;
  if (auth.isLoggedIn() && auth.user) {
    actionsEl.innerHTML = `
      <a href="/dashboard.html" class="btn btn-secondary btn-sm">📊 Dashboard</a>
      ${auth.user.role === 'admin' ? '<a href="/admin.html" class="btn btn-sm" style="background:var(--accent-gold);color:#000">⚡ Admin</a>' : ''}
      <div class="nav-user-menu" style="position:relative">
        <button class="btn btn-secondary btn-sm" id="userMenuBtn">👤 ${auth.user.username} <span style="color:var(--accent-gold)">★${auth.user.boost_points}</span></button>
        <div id="userDropdown" style="display:none;position:absolute;right:0;top:110%;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);min-width:160px;z-index:500;padding:.5rem 0;">
          <a href="/dashboard.html" style="display:block;padding:.5rem 1rem;color:var(--text-primary);font-size:.88rem;">📊 Dashboard</a>
          <a href="/earn-points.html" style="display:block;padding:.5rem 1rem;color:var(--text-primary);font-size:.88rem;">⚡ Earn Points</a>
          <button onclick="auth.logout()" style="width:100%;text-align:left;padding:.5rem 1rem;background:none;color:var(--offline);font-size:.88rem;">🚪 Logout</button>
        </div>
      </div>`;
    document.getElementById('userMenuBtn')?.addEventListener('click', () => {
      const d = document.getElementById('userDropdown');
      d.style.display = d.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('#userMenuBtn')) document.getElementById('userDropdown')?.style && (document.getElementById('userDropdown').style.display = 'none');
    });
  } else {
    actionsEl.innerHTML = `<button onclick="openModal('loginModal')" class="btn btn-secondary btn-sm">Login</button><button onclick="openModal('registerModal')" class="btn btn-primary btn-sm">Register</button>`;
  }
}

/* ---- Theme ---- */
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = saved === 'dark' ? '☀️' : '🌙';
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
}

/* ---- Modal ---- */
function openModal(id) { document.getElementById(id)?.classList.add('active'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }
document.addEventListener('click', e => { if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('active'); });

/* ---- Clipboard ---- */
function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    toast('Copied to clipboard!', 'success', 2000);
    if (btn) { btn.classList.add('copied'); setTimeout(() => btn.classList.remove('copied'), 2000); }
  });
}

/* ---- Server Card ---- */
function buildServerCard(s, rank) {
  const fill = s.max_players > 0 ? Math.min((s.current_players / s.max_players) * 100, 100) : 0;
  const online = s.status === 'online';
  return `
    <div class="card server-card ${s.is_featured ? 'card-featured' : ''}">
      ${rank ? `<span class="server-rank">#${rank}</span>` : ''}
      <div class="server-card-header">
        <div class="server-logo">${s.logo ? `<img src="${API_URL}/../uploads/${s.logo}" alt="">` : '🖥️'}</div>
        <div>
          <div class="server-name">${escHtml(s.name)}</div>
          <div class="server-ip">${escHtml(s.ip)}:${s.port}</div>
        </div>
      </div>
      <div class="server-badges">
        <span class="badge ${online ? 'badge-online' : 'badge-offline'}"><span class="status-dot ${online?'online':'offline'}"></span>${online ? 'Online' : 'Offline'}</span>
        <span class="badge badge-mod">${escHtml(s.mod)}</span>
        ${s.is_featured ? '<span class="badge badge-featured">⭐ Featured</span>' : ''}
        ${s.is_verified ? '<span class="badge badge-verified">✔ Verified</span>' : ''}
        ${s.country ? `<span class="badge badge-mod">${countryFlag(s.country)} ${escHtml(s.country)}</span>` : ''}
      </div>
      <div class="server-meta">
        <span>👥 ${s.current_players}/${s.max_players}</span>
        <span>🗺 ${escHtml(s.current_map || '—')}</span>
        <span>📊 ${s.vote_count} votes</span>
      </div>
      <div class="server-players-bar"><div class="server-players-fill" style="width:${fill}%"></div></div>
      <div class="server-actions" style="margin-top:.75rem">
        <a href="/server.html?s=${s.slug}" class="btn btn-primary btn-sm" style="flex:1">View Server</a>
        <button class="btn btn-icon btn-sm" title="Copy IP" onclick="copyToClipboard('${escHtml(s.ip)}:${s.port}', this)">📋</button>
        <a href="steam://connect/${s.ip}:${s.port}" class="btn btn-secondary btn-sm" title="Connect">🎮</a>
      </div>
    </div>`;
}

/* ---- Helpers ---- */
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function countryFlag(code) { if (!code || code.length !== 2) return '🌐'; try { return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0))); } catch { return '🌐'; } }
function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

/* ---- Hamburger ---- */
document.getElementById('hamburger')?.addEventListener('click', () => {
  const nav = document.querySelector('.navbar-nav');
  if (nav) nav.style.display = nav.style.display === 'flex' ? '' : 'flex';
});

/* ---- Auth modal logic ---- */
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  try {
    const data = await api.post('/auth/login', { email, password });
    auth.setAuth(data.token, data.user);
    closeModal('loginModal');
    toast(`Welcome back, ${data.user.username}!`, 'success');
    setTimeout(() => location.reload(), 800);
  } catch(err) { toast(err.message, 'error'); }
}

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('regUsername').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const invite_code = document.getElementById('regInvite')?.value || '';
  try {
    const data = await api.post('/auth/register', { username, email, password, invite_code });
    auth.setAuth(data.token, data.user);
    closeModal('registerModal');
    toast(`Welcome, ${data.user.username}! +20 Boost Points`, 'success');
    setTimeout(() => location.reload(), 800);
  } catch(err) { toast(err.message, 'error'); }
}

/* ---- Tabs ---- */
function initTabs(containerSel) {
  document.querySelectorAll(containerSel + ' .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.closest(containerSel);
      parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      parent.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const pane = parent.querySelector(`#${btn.dataset.tab}`);
      if (pane) pane.classList.add('active');
    });
  });
}

/* ---- Init ---- */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  renderNavUser();
  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
  initTabs('.tabs-container');
});
