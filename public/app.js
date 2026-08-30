// Global State Management
let currentScreen = 'login';
let currentSection = 'overview';
let currentVizSubTab = 'grid';

let currentUser = null;
let allTables = [];
let selectedTable = 'users';
let currentPage = 1;
let currentSearch = '';
let sidebarDrawerOpen = false;

// DOM Content Loaded Initializer
document.addEventListener('DOMContentLoaded', () => {
  checkSessionStatus();
  checkDbHealth();
  loadRecentUsers();
  loadTablesList();

  setInterval(checkDbHealth, 15000);
});

// Toast Notification System
function showToast(message, type = 'success', duration = 4000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  } else {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  }

  toast.innerHTML = `${iconSvg}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// 1. Session Status & View Router
async function checkSessionStatus() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();

    if (data.authenticated && data.user) {
      currentUser = data.user;
      updateSidebarUserProfile(data.user);
      showScreen('dashboard');
    } else {
      currentUser = null;
      showScreen('login');
    }
  } catch (err) {
    currentUser = null;
    showScreen('login');
  }
}

function updateSidebarUserProfile(user) {
  const nameEl = document.getElementById('sidebar-user-name');
  const roleEl = document.getElementById('sidebar-user-role');
  const avatarEl = document.getElementById('sidebar-avatar');

  if (nameEl) nameEl.textContent = user.fullName || user.username;
  if (roleEl) roleEl.textContent = user.role || 'User';
  if (avatarEl) {
    const initials = (user.fullName || user.username || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    avatarEl.textContent = initials;
  }
}

function showScreen(screen) {
  currentScreen = screen;
  document.querySelectorAll('.screen-view').forEach(s => s.classList.remove('active'));

  const activeScreen = document.getElementById(`screen-${screen}`);
  if (activeScreen) activeScreen.classList.add('active');

  if (screen === 'dashboard') {
    switchSection(currentSection);
  }
}

function switchToRegisterScreen() {
  showScreen('dashboard');
  switchSection('register');
}

// 2. Dashboard Section Router
function switchSection(sec) {
  currentSection = sec;

  // Sidebar Menu items
  document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
  const sideItem = document.getElementById(`side-nav-${sec}`);
  if (sideItem) sideItem.classList.add('active');

  // Mobile bottom nav items
  document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));
  const mobItem = document.getElementById(`mob-nav-${sec}`);
  if (mobItem) mobItem.classList.add('active');

  // Workspace Content Sections
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  const activeSec = document.getElementById(`sec-${sec}`);
  if (activeSec) activeSec.classList.add('active');

  // Section Title
  const titles = {
    overview: 'Overview Dashboard',
    register: 'User Registration',
    explorer: 'Database Explorer',
    sql: 'SQL Console'
  };
  const titleEl = document.getElementById('page-section-title');
  if (titleEl) titleEl.textContent = titles[sec] || 'Dashboard';

  // Close mobile drawer if open
  if (sidebarDrawerOpen) toggleSidebarDrawer();

  if (sec === 'explorer') {
    loadTablesList();
  }
}

function toggleSidebarDrawer() {
  const drawer = document.getElementById('sidebar-drawer');
  sidebarDrawerOpen = !sidebarDrawerOpen;
  if (sidebarDrawerOpen) {
    drawer.classList.add('active-drawer');
  } else {
    drawer.classList.remove('active-drawer');
  }
}

// 3. Login & Logout Handlers
async function handleLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  const btnSubmit = document.getElementById('btn-login-submit');
  const btnText = document.getElementById('btn-login-text');
  const btnSpinner = document.getElementById('btn-login-spinner');

  btnSubmit.disabled = true;
  btnText.textContent = 'Signing in...';
  btnSpinner.classList.remove('hidden');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Login failed.');

    currentUser = data.user;
    updateSidebarUserProfile(data.user);
    showToast(`Welcome back, ${data.user.fullName || data.user.username}!`, 'success');
    showScreen('dashboard');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btnSubmit.disabled = false;
    btnText.textContent = 'Sign In';
    btnSpinner.classList.add('hidden');
  }
}

async function handleLogout() {
  try {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (res.ok) {
      currentUser = null;
      showToast('Logged out successfully.', 'info');
      showScreen('login');
    }
  } catch (err) {
    showToast('Logout failed.', 'error');
  }
}

// 4. Health Check
async function checkDbHealth() {
  const badge = document.getElementById('db-health-badge');
  const statusText = document.getElementById('db-status-text');
  const metricDbname = document.getElementById('metric-dbname');
  const metricLatency = document.getElementById('metric-latency');

  try {
    const res = await fetch('/api/health');
    const data = await res.json();

    if (res.ok && data.status === 'connected') {
      badge.className = 'db-badge connected';
      statusText.textContent = `${data.latencyMs}ms`;
      if (metricDbname) metricDbname.textContent = data.database || 'mydata';
      if (metricLatency) metricLatency.textContent = `${data.latencyMs} ms`;
    } else {
      badge.className = 'db-badge disconnected';
      statusText.textContent = 'Disconnected';
      if (metricLatency) metricLatency.textContent = 'Offline';
    }
  } catch (err) {
    badge.className = 'db-badge disconnected';
    statusText.textContent = 'Offline';
    if (metricLatency) metricLatency.textContent = 'Offline';
  }
}

// 5. User Registration Handler
async function handleRegister(e) {
  e.preventDefault();

  const fullName = document.getElementById('full_name').value.trim();
  const email = document.getElementById('email').value.trim();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const role = document.getElementById('role').value;
  const bio = document.getElementById('bio').value.trim();

  const btnSubmit = document.getElementById('btn-submit-reg');
  const btnText = document.getElementById('btn-submit-text');
  const btnSpinner = document.getElementById('btn-submit-spinner');

  btnSubmit.disabled = true;
  btnText.textContent = 'Saving...';
  btnSpinner.classList.remove('hidden');

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, email, username, password, role, bio })
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to register user.');

    showToast(`User ${data.user.full_name} registered successfully!`, 'success');
    document.getElementById('registration-form').reset();
    
    checkSessionStatus();
    loadRecentUsers();
    loadTablesList();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btnSubmit.disabled = false;
    btnText.textContent = 'Register User';
    btnSpinner.classList.add('hidden');
  }
}

// 6. Recent Users Activity Stream
async function loadRecentUsers() {
  const container = document.getElementById('recent-users-list');
  if (!container) return;

  try {
    const res = await fetch('/api/tables/users?limit=10');
    const data = await res.json();

    if (!res.ok || !data.rows) {
      container.innerHTML = `<div class="empty-state">No users registered yet.</div>`;
      const userCountEl = document.getElementById('metric-users-count');
      if (userCountEl) userCountEl.textContent = '0';
      return;
    }

    const userCountEl = document.getElementById('metric-users-count');
    if (userCountEl) userCountEl.textContent = data.pagination.totalRows || data.rows.length;

    if (data.rows.length === 0) {
      container.innerHTML = `<div class="empty-state">No users registered yet. Fill out the form to add one!</div>`;
      return;
    }

    container.innerHTML = data.rows.map(user => {
      const initials = (user.full_name || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const createdAt = user.created_at ? new Date(user.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : 'Recently';

      return `
        <div class="user-feed-card">
          <div class="user-avatar">${initials}</div>
          <div class="user-info">
            <div class="user-name">
              ${escapeHtml(user.full_name)}
              <span class="badge badge-role">${escapeHtml(user.role || 'User')}</span>
            </div>
            <div class="user-meta">
              <span>@${escapeHtml(user.username)}</span>
              <span>•</span>
              <span>${escapeHtml(user.email)}</span>
            </div>
          </div>
          <div style="text-align: right;">
            <span class="badge badge-active">${escapeHtml(user.status || 'Active')}</span>
            <div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 4px;">${createdAt}</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Failed to connect to PostgreSQL users table.</div>`;
  }
}

// 7. Database Explorer & Tables List
async function loadTablesList() {
  const container = document.getElementById('tables-list-container');
  const metricTablesCount = document.getElementById('metric-tables-count');
  if (!container) return;

  try {
    const res = await fetch('/api/tables');
    const data = await res.json();

    if (!res.ok || !data.tables) {
      container.innerHTML = `<li class="empty-list">Could not load tables</li>`;
      return;
    }

    allTables = data.tables;
    if (metricTablesCount) metricTablesCount.textContent = allTables.length;

    if (allTables.length === 0) {
      container.innerHTML = `<li class="empty-list">No tables found. Click "Re-Verify Database Schema"!</li>`;
      return;
    }

    renderTablesList(allTables);

    if (!selectedTable || !allTables.some(t => t.table_name === selectedTable)) {
      selectedTable = allTables.some(t => t.table_name === 'users') ? 'users' : allTables[0].table_name;
    }

    selectTable(selectedTable);
  } catch (err) {
    container.innerHTML = `<li class="empty-list">Error loading tables list</li>`;
  }
}

function renderTablesList(tables) {
  const container = document.getElementById('tables-list-container');
  container.innerHTML = tables.map(t => `
    <li class="table-item ${t.table_name === selectedTable ? 'active' : ''}" id="table-item-${t.table_name}" onclick="selectTable('${t.table_name}')">
      <span>📄 ${escapeHtml(t.table_name)}</span>
      <span class="table-row-badge">${t.row_count} rows</span>
    </li>
  `).join('');
}

function filterTablesList() {
  const term = document.getElementById('table-search-input').value.toLowerCase().trim();
  const filtered = allTables.filter(t => t.table_name.toLowerCase().includes(term));
  renderTablesList(filtered);
}

function selectTable(tableName) {
  selectedTable = tableName;
  currentPage = 1;
  currentSearch = '';
  const searchEl = document.getElementById('grid-search');
  if (searchEl) searchEl.value = '';

  document.querySelectorAll('.table-item').forEach(el => el.classList.remove('active'));
  const activeEl = document.getElementById(`table-item-${tableName}`);
  if (activeEl) activeEl.classList.add('active');

  const titleEl = document.getElementById('schema-table-title');
  if (titleEl) titleEl.textContent = tableName;

  loadSelectedTableData();
}

async function loadSelectedTableData() {
  if (!selectedTable) return;

  const gridHead = document.getElementById('data-grid-head');
  const gridBody = document.getElementById('data-grid-body');
  const schemaBody = document.getElementById('schema-table-body');
  const pageDisplay = document.getElementById('page-num-display');
  const pagInfo = document.getElementById('pagination-info');

  if (gridBody) gridBody.innerHTML = `<tr><td class="empty-cell">Loading data for '${selectedTable}'...</td></tr>`;

  try {
    const url = `/api/tables/${selectedTable}?page=${currentPage}&limit=25&search=${encodeURIComponent(currentSearch)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to fetch table contents.');

    const { columns, primaryKeys, rows, pagination } = data;

    if (schemaBody) {
      schemaBody.innerHTML = columns.map(c => `
        <tr>
          <td style="font-weight: 700; color: var(--text-main); font-family: var(--font-mono);">${escapeHtml(c.column_name)}</td>
          <td><span class="highlight-text">${escapeHtml(c.data_type)}</span> ${c.character_maximum_length ? `(${c.character_maximum_length})` : ''}</td>
          <td>${c.is_nullable === 'YES' ? 'YES' : '<span style="color:var(--amber);">NO</span>'}</td>
          <td>${primaryKeys.includes(c.column_name) ? '<span class="pk-badge">PRIMARY KEY</span>' : '—'}</td>
          <td style="color: var(--text-dim); font-family: var(--font-mono);">${escapeHtml(c.column_default || 'NULL')}</td>
        </tr>
      `).join('');
    }

    if (gridHead) {
      gridHead.innerHTML = `
        <tr>
          ${columns.map(c => `<th>${escapeHtml(c.column_name)} ${primaryKeys.includes(c.column_name) ? '🔑' : ''}</th>`).join('')}
        </tr>
      `;
    }

    if (gridBody) {
      if (rows.length === 0) {
        gridBody.innerHTML = `<tr><td colspan="${columns.length}" class="empty-cell">No records found in table '${selectedTable}'.</td></tr>`;
      } else {
        gridBody.innerHTML = rows.map(r => `
          <tr>
            ${columns.map(c => {
              const val = r[c.column_name];
              if (val === null || val === undefined) return `<td><span class="null-val">null</span></td>`;
              if (typeof val === 'object') return `<td><code>${escapeHtml(JSON.stringify(val))}</code></td>`;
              return `<td>${escapeHtml(String(val))}</td>`;
            }).join('')}
          </tr>
        `).join('');
      }
    }

    if (pageDisplay) pageDisplay.textContent = `Page ${pagination.page} of ${pagination.totalPages}`;
    if (pagInfo) pagInfo.textContent = `Showing ${rows.length} of ${pagination.totalRows} total rows`;

    const prevBtn = document.getElementById('btn-prev-page');
    const nextBtn = document.getElementById('btn-next-page');
    if (prevBtn) prevBtn.disabled = pagination.page <= 1;
    if (nextBtn) nextBtn.disabled = pagination.page >= pagination.totalPages;

  } catch (err) {
    if (gridBody) gridBody.innerHTML = `<tr><td class="empty-cell" style="color: var(--rose);">${escapeHtml(err.message)}</td></tr>`;
    if (schemaBody) schemaBody.innerHTML = `<tr><td colspan="5" class="empty-cell">${escapeHtml(err.message)}</td></tr>`;
  }
}

function switchVizSubTab(subTab) {
  currentVizSubTab = subTab;
  document.querySelectorAll('.viz-subtab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.subview-content').forEach(v => v.classList.remove('active'));

  const tabEl = document.getElementById(`subtab-${subTab}`);
  const viewEl = document.getElementById(`subview-${subTab}`);
  if (tabEl) tabEl.classList.add('active');
  if (viewEl) viewEl.classList.add('active');

  const gridToolbar = document.getElementById('grid-toolbar');
  if (gridToolbar) {
    gridToolbar.style.display = (subTab === 'grid') ? 'flex' : 'none';
  }
}

function handleGridSearch(e) {
  if (e.key === 'Enter') {
    currentSearch = document.getElementById('grid-search').value;
    currentPage = 1;
    loadSelectedTableData();
  }
}

function changePage(delta) {
  currentPage += delta;
  if (currentPage < 1) currentPage = 1;
  loadSelectedTableData();
}

function setSqlQuery(sql) {
  document.getElementById('sql-editor').value = sql;
}

async function executeCustomSql() {
  const sql = document.getElementById('sql-editor').value.trim();
  if (!sql) {
    showToast('Please enter an SQL query first.', 'warning');
    return;
  }

  const container = document.getElementById('sql-result-container');
  const meta = document.getElementById('sql-meta');

  meta.textContent = 'Executing...';
  container.innerHTML = `<div class="empty-state">Running query...</div>`;

  try {
    const res = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'SQL Execution error');

    meta.textContent = `Command: ${data.command || 'SELECT'} | Rows: ${data.rowCount || data.rows.length} | Time: ${data.executionTimeMs} ms`;

    if (!data.rows || data.rows.length === 0) {
      container.innerHTML = `<div class="empty-state">Query executed successfully. ${data.rowCount ? `${data.rowCount} rows affected.` : 'No rows returned.'}</div>`;
      return;
    }

    const fields = data.fields.length > 0 ? data.fields.map(f => f.name) : Object.keys(data.rows[0]);

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>${fields.map(f => `<th>${escapeHtml(f)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${data.rows.map(r => `
            <tr>
              ${fields.map(f => {
                const val = r[f];
                if (val === null || val === undefined) return `<td><span class="null-val">null</span></td>`;
                if (typeof val === 'object') return `<td><code>${escapeHtml(JSON.stringify(val))}</code></td>`;
                return `<td>${escapeHtml(String(val))}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    loadTablesList();
  } catch (err) {
    meta.textContent = 'Execution Failed';
    container.innerHTML = `<div class="empty-state" style="color: var(--rose); font-family: var(--font-mono); text-align: left; padding: 1rem;">⚠️ ${escapeHtml(err.message)}</div>`;
  }
}

async function initSampleDatabase() {
  try {
    const res = await fetch('/api/init-db', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      showToast('Schema verified in PostgreSQL!', 'success');
      loadTablesList();
    } else {
      showToast(data.error, 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
