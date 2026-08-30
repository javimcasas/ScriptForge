// ─── VARIABLE PARSING (supports optional example: {VAR, example value}) ─────
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Parses {VARIABLE_NAME} or {VARIABLE_NAME, example value} occurrences.
// Returns an ordered, de-duplicated list of { name, example }. If the same
// variable appears more than once, only the FIRST definition (with or
// without an example) is kept — later ones are ignored to avoid conflicts.
function parseTemplateVariables(content) {
  const regex = /\{([^,}]+)(?:,([^}]*))?\}/g;
  const seen = new Map();
  let m;
  while ((m = regex.exec(content)) !== null) {
    const name = m[1].trim();
    if (!name || seen.has(name)) continue;
    const example = m[2] ? m[2].trim() : '';
    seen.set(name, example);
  }
  return [...seen.entries()].map(([name, example]) => ({ name, example }));
}

// Strips the ", example value" part from every {VAR, example} occurrence,
// leaving plain {VAR} placeholders — used when downloading a template for
// SmartConfigure, which doesn't understand the example-value syntax.
function stripVariableExamples(content) {
  return content.replace(/\{([^,}]+),([^}]*)\}/g, (_, name) => `{${name.trim()}}`);
}


// ─── RENDER SIDEBAR ─────────────────────────────────────────────────────────────
function renderSidebar() {
  const sidebar = document.getElementById('sidebar');

  const catItems = categories.map(cat => `
    <div class="sidebar-item" data-filter="${cat.id}" role="button" tabindex="0">
      <span class="sidebar-drag-handle" title="Drag to reorder">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="9"  cy="5"  r="1" fill="currentColor"/>
          <circle cx="9"  cy="12" r="1" fill="currentColor"/>
          <circle cx="9"  cy="19" r="1" fill="currentColor"/>
          <circle cx="15" cy="5"  r="1" fill="currentColor"/>
          <circle cx="15" cy="12" r="1" fill="currentColor"/>
          <circle cx="15" cy="19" r="1" fill="currentColor"/>
        </svg>
      </span>
      ${getCategoryIcon(cat.id)}
      <span class="sidebar-cat-label">${cat.id}</span>
      <span class="count" id="count-${cat.id}">0</span>
      <button class="sidebar-delete-cat" data-cat="${cat.id}" title="Delete category" aria-label="Delete ${cat.id}">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>
    </div>
  `).join('');

  sidebar.innerHTML = `
    <span class="sidebar-section-label">Views</span>
    <button class="sidebar-item ${currentFilter === 'all' && currentView === 'templates' ? 'active' : ''}" data-filter="all">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
      All templates
      <span class="count" id="count-all">0</span>
    </button>

    <button class="sidebar-item ${currentView === 'saved' ? 'active' : ''}" id="sidebarSavedBtn">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      Saved scripts
      <span class="count" id="count-saved">0</span>
    </button>

    <button class="sidebar-item ${currentView === 'community' ? 'active' : ''}" id="sidebarCommunityBtn">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="9" cy="7" r="4"/>
        <path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/>
        <circle cx="17" cy="7" r="3"/>
        <path d="M22 21v-2a3 3 0 0 0-2.5-2.96"/>
      </svg>
      Community
    </button>

    <button class="sidebar-item ${currentView === 'mine' ? 'active' : ''}" id="sidebarMineBtn">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      My uploads
    </button>

    <div class="sidebar-divider"></div>

    <div class="sidebar-section-header">
      <span class="sidebar-section-label">Categories</span>
      <button class="sidebar-add-cat" id="addCategoryBtn" title="New category" aria-label="Add category">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>

    ${catItems}
  `;

  // Re-bind filters
  sidebar.querySelectorAll('[data-filter]').forEach(el => {
    el.addEventListener('click', () => setFilter(el.dataset.filter));
    if (el.tagName === 'DIV') {
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') setFilter(el.dataset.filter);
      });
    }
  });

  // "Saved scripts" button
  document.getElementById('sidebarSavedBtn').addEventListener('click', () => setSavedView());

  // "Community" button
  document.getElementById('sidebarCommunityBtn').addEventListener('click', () => setCommunityView());

  // "My uploads" button
  document.getElementById('sidebarMineBtn').addEventListener('click', () => setMineView());

  // New category button
  document.getElementById('addCategoryBtn').addEventListener('click', () => {
    buildCategoryModal();
    openModal('categoryModal');
  });

  // Delete category buttons
  sidebar.querySelectorAll('.sidebar-delete-cat').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openDeleteCatModal(btn.dataset.cat);
    });
  });

  highlightActiveFilter();
  renderHelpCats();
  initSidebarDrag();
  updateCounts();
}


// ─── RENDER FILTER BAR ─────────────────────────────────────────────────────────────────
function renderFilterBar() {
  const bar = document.getElementById('filterBar');
  const chips = categories.map(cat =>
    `<button class="filter-chip" data-filter="${cat.id}">${cat.id}</button>`
  ).join('');

  bar.innerHTML = `
    <button class="filter-chip ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
    ${chips}
  `;

  bar.querySelectorAll('[data-filter]').forEach(el => {
    el.addEventListener('click', () => setFilter(el.dataset.filter));
  });
}


// ─── HIGHLIGHT ACTIVE FILTER ─────────────────────────────────────────────────────────
function highlightActiveFilter() {
  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.filter === currentFilter && currentView === 'templates');
  });
  const savedBtn = document.getElementById('sidebarSavedBtn');
  if (savedBtn) savedBtn.classList.toggle('active', currentView === 'saved');
  const communityBtn = document.getElementById('sidebarCommunityBtn');
  if (communityBtn) communityBtn.classList.toggle('active', currentView === 'community');
  const mineBtn = document.getElementById('sidebarMineBtn');
  if (mineBtn) mineBtn.classList.toggle('active', currentView === 'mine');

  document.querySelectorAll('.filter-chip').forEach(el => {
    el.classList.toggle('active', el.dataset.filter === currentFilter);
  });
}


// ─── SET FILTER (templates view) ───────────────────────────────────────────────────────
function setFilter(filter) {
  currentView   = 'templates';
  currentFilter = filter;
  highlightActiveFilter();

  document.getElementById('filterBar').classList.remove('hidden');
  document.getElementById('templatesGrid').classList.remove('hidden');
  document.getElementById('savedViewer').classList.add('hidden');
  ensureCommunityViewer();
  document.getElementById('communityViewer').classList.add('hidden');
  ensureMineViewer();
  document.getElementById('mineViewer').classList.add('hidden');

  const titles = { all: 'All templates' };
  document.getElementById('pageTitle').textContent = titles[filter] || filter;
  document.getElementById('pageSubtitle').textContent =
    filter === 'all'
      ? 'Pick a template to generate a configuration script'
      : `Templates in the ${filter} category`;

  renderGrid();
}


// ─── SET SAVED VIEW ─────────────────────────────────────────────────────────────────
function setSavedView() {
  currentView = 'saved';
  highlightActiveFilter();

  document.getElementById('filterBar').classList.add('hidden');
  document.getElementById('templatesGrid').classList.add('hidden');
  document.getElementById('savedViewer').classList.remove('hidden');
  ensureCommunityViewer();
  document.getElementById('communityViewer').classList.add('hidden');
  ensureMineViewer();
  document.getElementById('mineViewer').classList.add('hidden');

  document.getElementById('pageTitle').textContent    = 'Saved scripts';
  document.getElementById('pageSubtitle').textContent = 'Scripts generated and saved from templates';

  renderSavedViewer();
}


// ─── COMMUNITY VIEW ───────────────────────────────────────────────────────────────
// Community is a shared, non-per-user library of *templates* (not saved
// scripts): a template still has its {VARIABLE} placeholders, so it's
// actually reusable by whoever imports it, unlike an already-filled-in
// saved script which only makes sense for the one device it was made for.
let communityItems = [];
let communityCategoryQuery = '';
let communitySortBy = 'likes'; // 'likes' | 'imports'
let communityLikedIds = new Set();
const _communityCache = {};

function ensureCommunityViewer() {
  if (document.getElementById('communityViewer')) return;
  const el = document.createElement('div');
  el.id = 'communityViewer';
  el.className = 'saved-viewer hidden';
  document.getElementById('savedViewer').insertAdjacentElement('afterend', el);
}

async function loadCommunity() {
  try {
    const res = await fetch('/api/community');
    const data = await res.json();
    communityItems = data.items || [];
    communityLikedIds = new Set(data.likedIds || []);
  } catch {
    communityItems = [];
    communityLikedIds = new Set();
  }
  updateCounts();
}

async function setCommunityView() {
  currentView = 'community';
  ensureCommunityViewer();
  ensureMineViewer();
  highlightActiveFilter();

  document.getElementById('filterBar').classList.add('hidden');
  document.getElementById('templatesGrid').classList.add('hidden');
  document.getElementById('savedViewer').classList.add('hidden');
  document.getElementById('mineViewer').classList.add('hidden');
  document.getElementById('communityViewer').classList.remove('hidden');

  document.getElementById('pageTitle').textContent    = 'Community';
  document.getElementById('pageSubtitle').textContent = 'Templates shared by other users';

  await loadCommunity();
  renderCommunityViewer();
}

async function getCommunityContent(id) {
  if (_communityCache[id]) return _communityCache[id];
  const res = await fetch(`/api/community/${encodeURIComponent(id)}`);
  const text = await res.text();
  const lines = text.split('\n');
  let i = 0;
  // Skip the metadata lines (# name / # category / # description) and the following blank line.
  while (i < lines.length && (lines[i].startsWith('#') || lines[i].trim() === '')) i++;
  const content = lines.slice(i).join('\n').trimEnd();
  _communityCache[id] = content;
  return content;
}

async function loadCommunityContent(id) {
  const pre = document.getElementById(`community-script-${id}`);
  if (!pre || pre.textContent !== 'Loading…') return;
  try {
    pre.textContent = await getCommunityContent(id);
  } catch {
    pre.textContent = '— Error loading the script —';
  }
}

async function toggleCommunityLike(id) {
  try {
    const res = await fetch(`/api/community/${encodeURIComponent(id)}/like`, { method: 'POST' });
    const result = await res.json();
    if (!res.ok) { showToast(result.error || 'Error liking this template', true); return; }
    const item = communityItems.find(i => i.id === id);
    if (item) item.likes = result.likes;
    if (result.liked) communityLikedIds.add(id);
    else communityLikedIds.delete(id);
    renderCommunityList();
  } catch {
    showToast('Could not connect to the server', true);
  }
}

// Fixed structure (category filter + sort toggle + list container) so
// typing in the filter never loses focus on re-render: only #communityList
// gets rebuilt.
function renderCommunityViewer() {
  ensureCommunityViewer();
  const viewer = document.getElementById('communityViewer');

  viewer.innerHTML = `
    <div class="community-toolbar">
      <div class="community-cat-filter">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" id="communityCatInput" placeholder="Filter by category… (e.g. VLAN, AAA)" autocomplete="off">
      </div>
      <div class="community-sort-toggle">
        <button class="sort-btn ${communitySortBy === 'likes' ? 'active' : ''}" data-sort="likes">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>
          </svg>
          Most liked
        </button>
        <button class="sort-btn ${communitySortBy === 'imports' ? 'active' : ''}" data-sort="imports">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Most downloaded
        </button>
      </div>
    </div>
    <div id="communityList"></div>
  `;

  const input = document.getElementById('communityCatInput');
  input.value = communityCategoryQuery;
  input.addEventListener('input', e => {
    communityCategoryQuery = e.target.value;
    renderCommunityList();
  });

  viewer.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      communitySortBy = btn.dataset.sort;
      viewer.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderCommunityList();
    });
  });

  renderCommunityList();
}

function renderCommunityList() {
  ensureCommunityViewer();
  const list = document.getElementById('communityList');
  if (!list) return;

  let filtered = communityItems;
  if (communityCategoryQuery.trim()) {
    const q = communityCategoryQuery.trim().toLowerCase();
    filtered = filtered.filter(i => i.category.toLowerCase().includes(q));
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(i =>
      i.name.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q) ||
      (i.description || '').toLowerCase().includes(q)
    );
  }
  const sortKey = communitySortBy === 'imports' ? 'imports' : 'likes';
  filtered = [...filtered].sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));

  if (!filtered.length) {
    list.innerHTML = `
      <div class="saved-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/>
          <circle cx="17" cy="7" r="3"/><path d="M22 21v-2a3 3 0 0 0-2.5-2.96"/>
        </svg>
        <p>${communityItems.length
          ? 'No results for that filter.'
          : 'No one has uploaded a template to Community yet. Upload one from the ↑ icon on any card.'
        }</p>
      </div>`;
  } else {
    const cards = filtered.map(item => {
      const color = getCategoryColor(item.category);
      const date = item.uploadedAt ? new Date(item.uploadedAt).toLocaleDateString() : '';
      const liked = communityLikedIds.has(item.id);
      return `
        <div class="saved-card" data-community-id="${item.id}">
          <div class="saved-card-header">
            <div class="saved-card-icon" style="background:${color.bg}; color:${color.accent}">
              ${getCategoryIcon(item.category)}
            </div>
            <div class="saved-card-info">
              <div class="saved-card-name">${item.name}</div>
              <div class="saved-card-meta">
                <span class="saved-card-template-tag">${item.category}</span>
                <span class="meta-sep">·</span>
                <span>${item.uploadedBy || 'anonymous'}</span>
                <span class="meta-sep">·</span>
                <span>${date}</span>
              </div>
            </div>
            <div class="saved-card-actions">
              <button class="community-like-btn ${liked ? 'liked' : ''}" title="${liked ? 'Unlike' : 'Like'}" aria-label="Like">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>
                </svg>
                <span class="like-count">${item.likes || 0}</span>
              </button>
              <span class="mine-stat" title="Times downloaded">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                ${item.imports || 0}
              </span>
              <button class="saved-card-btn btn-import-community" title="Add to my templates" aria-label="Add to my templates">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
              <svg class="saved-card-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>
          <div class="saved-card-preview">
            <p>${item.description || 'No description'}</p>
          </div>
          <div class="saved-card-body">
            <pre class="saved-card-script" id="community-script-${item.id}">Loading…</pre>
          </div>
        </div>`;
    }).join('');
    list.innerHTML = `<div class="saved-list">${cards}</div>`;
  }

  // Click on the card (outside buttons) expands it and shows the template's commands.
  list.querySelectorAll('[data-community-id]').forEach(card => {
    const id = card.dataset.communityId;
    card.querySelector('.saved-card-header').addEventListener('click', async e => {
      if (e.target.closest('button')) return;
      const isExpanded = card.classList.contains('expanded');
      card.classList.toggle('expanded', !isExpanded);
      if (!isExpanded) await loadCommunityContent(id);
    });
  });

  list.querySelectorAll('.community-like-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const card = btn.closest('[data-community-id]');
      await toggleCommunityLike(card.dataset.communityId);
    });
  });

  list.querySelectorAll('.btn-import-community').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const card = btn.closest('[data-community-id]');
      await importCommunityItem(card.dataset.communityId);
    });
  });
}

async function uploadToCommunity(template) {
  const raw = buildRawCfg(template);
  try {
    const res = await fetch('/api/community/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: raw })
    });
    const result = await res.json();
    if (!res.ok) { showToast(result.error || 'Error publishing this template', true); return; }
    showToast(`"${template.name}" published to Community`);
  } catch {
    showToast('Could not connect to the server', true);
  }
}

async function importCommunityItem(id) {
  try {
    const res = await fetch(`/api/community/${encodeURIComponent(id)}/import`, { method: 'POST' });
    const result = await res.json();
    if (!res.ok) { showToast(result.error || 'Error importing this template', true); return; }
    showToast('Added to your templates');
    await loadTemplates();
    if (currentView === 'templates') renderGrid();
    updateCounts();
  } catch {
    showToast('Could not connect to the server', true);
  }
}


// ─── MY UPLOADS ─────────────────────────────────────────────────────
// Templates the current user has uploaded to Community: here they can see
// how many likes/downloads each one has and unpublish them.
let myCommunityItems = [];

function ensureMineViewer() {
  if (document.getElementById('mineViewer')) return;
  ensureCommunityViewer();
  const el = document.createElement('div');
  el.id = 'mineViewer';
  el.className = 'saved-viewer hidden';
  document.getElementById('communityViewer').insertAdjacentElement('afterend', el);
}

async function loadMyCommunity() {
  try {
    const res = await fetch('/api/community/mine');
    const data = await res.json();
    myCommunityItems = data.items || [];
  } catch {
    myCommunityItems = [];
  }
}

async function setMineView() {
  currentView = 'mine';
  ensureMineViewer();
  highlightActiveFilter();

  document.getElementById('filterBar').classList.add('hidden');
  document.getElementById('templatesGrid').classList.add('hidden');
  document.getElementById('savedViewer').classList.add('hidden');
  ensureCommunityViewer();
  document.getElementById('communityViewer').classList.add('hidden');
  document.getElementById('mineViewer').classList.remove('hidden');

  document.getElementById('pageTitle').textContent    = 'My uploads';
  document.getElementById('pageSubtitle').textContent = 'Templates you have published to Community';

  await loadMyCommunity();
  renderMineViewer();
}

function renderMineViewer() {
  ensureMineViewer();
  const viewer = document.getElementById('mineViewer');

  if (!myCommunityItems.length) {
    viewer.innerHTML = `
      <div class="saved-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p>You haven't published any templates to Community yet. Upload one from the ↑ icon on any card in "All templates".</p>
      </div>`;
    return;
  }

  const cards = myCommunityItems.map(item => {
    const color = getCategoryColor(item.category);
    const date = item.uploadedAt ? new Date(item.uploadedAt).toLocaleDateString() : '';
    return `
      <div class="saved-card" data-mine-id="${item.id}">
        <div class="saved-card-header" style="cursor:default">
          <div class="saved-card-icon" style="background:${color.bg}; color:${color.accent}">
            ${getCategoryIcon(item.category)}
          </div>
          <div class="saved-card-info">
            <div class="saved-card-name">${item.name}</div>
            <div class="saved-card-meta">
              <span class="saved-card-template-tag">${item.category}</span>
              <span class="meta-sep">·</span>
              <span>${date}</span>
            </div>
          </div>
          <div class="saved-card-actions">
            <span class="mine-stat" title="Likes received">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>
              </svg>
              ${item.likes || 0}
            </span>
            <span class="mine-stat" title="Times downloaded">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              ${item.imports || 0}
            </span>
            <button class="saved-card-btn btn-del btn-unpublish" title="Unpublish from Community" aria-label="Unpublish from Community">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="saved-card-preview">
          <p>${item.description || 'No description'}</p>
        </div>
      </div>`;
  }).join('');
  viewer.innerHTML = `<div class="saved-list">${cards}</div>`;

  viewer.querySelectorAll('.btn-unpublish').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const card = btn.closest('[data-mine-id]');
      const item = myCommunityItems.find(i => i.id === card.dataset.mineId);
      if (item) openUnpublishModal(item);
    });
  });
}

function openUnpublishModal(item) {
  document.getElementById('deleteSavedModalName').textContent = item.name;
  document.getElementById('confirmDeleteSavedBtn').onclick = async () => {
    try {
      const res    = await fetch(`/api/community/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) { showToast(result.error || 'Error unpublishing', true); return; }
    } catch {
      showToast('Could not connect to the server', true); return;
    }
    myCommunityItems = myCommunityItems.filter(i => i.id !== item.id);
    closeModal('deleteSavedModal');
    renderMineViewer();
    showToast(`"${item.name}" unpublished from Community`);
  };
  openModal('deleteSavedModal');
}


// ─── RENDER SAVED VIEWER ─────────────────────────────────────────────────────────────────
function renderSavedViewer() {
  const viewer = document.getElementById('savedViewer');

  let filtered = savedScripts;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(s =>
      (s.customName   || '').toLowerCase().includes(q) ||
      (s.templateName || '').toLowerCase().includes(q) ||
      (s.category     || '').toLowerCase().includes(q)
    );
  }

  if (!filtered.length) {
    viewer.innerHTML = `
      <div class="saved-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        <p>${savedScripts.length
          ? 'No results for that search.'
          : 'You haven\'t saved any scripts yet. Generate one from a template and click <strong>Save</strong>.'
        }</p>
      </div>`;
    return;
  }

  viewer.innerHTML = `<div class="saved-list" id="savedList"></div>`;
  const list = document.getElementById('savedList');

  filtered.forEach(s => {
    const card        = document.createElement('div');
    card.className    = 'saved-card';
    card.dataset.filename = s.filename;

    const color       = getCategoryColor(s.category);
    const displayName = s.customName || s.templateName;

    card.innerHTML = `
      <div class="saved-card-header">
        <div class="saved-card-icon" style="background:${color.bg}; color:${color.accent}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
          </svg>
        </div>
        <div class="saved-card-info">
          <div class="saved-card-name">${displayName}</div>
          <div class="saved-card-meta">
            <span class="saved-card-template-tag">${s.templateName}</span>
            <span class="meta-sep">·</span>
            <span>${s.category || 'No category'}</span>
            <span class="meta-sep">·</span>
            <span>${s.savedAt}</span>
          </div>
        </div>
        <div class="saved-card-actions">
          <button class="saved-card-btn btn-copy-saved" title="Copy script" aria-label="Copy script">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button class="saved-card-btn btn-del" title="Delete script" aria-label="Delete script">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
          </button>
          <svg class="saved-card-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>
      <div class="saved-card-body">
        <pre class="saved-card-script" id="script-${s.filename}">Loading…</pre>
        <div class="saved-card-footer">
          <button class="btn-copy btn-copy-saved-footer">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy
          </button>
          <button class="btn-download btn-dl-saved">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download .txt
          </button>
        </div>
      </div>`;

    // Toggle expand + lazy load
    card.querySelector('.saved-card-header').addEventListener('click', async e => {
      if (e.target.closest('button')) return;
      const isExpanded = card.classList.contains('expanded');
      card.classList.toggle('expanded', !isExpanded);
      if (!isExpanded) await loadSavedContent(s.filename);
    });

    // Copy from header
    card.querySelector('.btn-copy-saved').addEventListener('click', async e => {
      e.stopPropagation();
      const content = await getSavedContent(s.filename);
      navigator.clipboard.writeText(content).then(() => showToast('Script copied'));
    });

    // Delete
    card.querySelector('.btn-del').addEventListener('click', e => {
      e.stopPropagation();
      openDeleteSavedModal(s);
    });

    // Copy from footer
    card.querySelector('.btn-copy-saved-footer').addEventListener('click', () => {
      const pre = document.getElementById(`script-${s.filename}`);
      navigator.clipboard.writeText(pre.textContent).then(() => showToast('Script copied'));
    });

    // Download — uses displayName for the file name
    card.querySelector('.btn-dl-saved').addEventListener('click', () => {
      const pre  = document.getElementById(`script-${s.filename}`);
      const blob = new Blob([pre.textContent], { type: 'text/plain' });
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = displayName.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.txt';
      a.click();
    });

    list.appendChild(card);
  });
}


// ─── LAZY LOAD SAVED CONTENT ─────────────────────────────────────────────────────────
const _savedCache = {};

async function getSavedContent(filename) {
  if (_savedCache[filename]) return _savedCache[filename];
  const res  = await fetch(`./saved/${filename}`);
  const text = await res.text();
  // Strip the first metadata line (## template:… | …)
  const lines = text.split('\n');
  const content = lines[0].startsWith('##') ? lines.slice(1).join('\n').trimStart() : text;
  _savedCache[filename] = content;
  return content;
}

async function loadSavedContent(filename) {
  const pre = document.getElementById(`script-${filename}`);
  if (!pre || pre.textContent !== 'Loading…') return;
  try {
    pre.textContent = await getSavedContent(filename);
  } catch {
    pre.textContent = '— Error loading the file —';
  }
}


// ─── UPDATE COUNTS ─────────────────────────────────────────────────────────────────
function updateCounts() {
  const countAll = document.getElementById('count-all');
  if (countAll) countAll.textContent = templates.length;

  const countSaved = document.getElementById('count-saved');
  if (countSaved) countSaved.textContent = savedScripts.length;

  categories.forEach(cat => {
    const el = document.getElementById(`count-${cat.id}`);
    if (el) el.textContent = templates.filter(t => t.category === cat.id).length;
  });
}


// ─── RENDER GRID ───────────────────────────────────────────────────────────────
function renderGrid() {
  const grid = document.getElementById('templatesGrid');
  let filtered = templates;

  if (currentFilter !== 'all') {
    filtered = filtered.filter(t => t.category === currentFilter);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    );
  }

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
            <polyline points="13 2 13 9 20 9"/>
          </svg>
        </div>
        <h3>No templates</h3>
        <p>Import a .cfg file or write a new one from the button above.</p>
      </div>`;
    return;
  }

  grid.innerHTML = '';
  filtered.forEach(t => {
    const vars  = parseTemplateVariables(t.content);
    const dots  = vars.slice(0, 5).map(() => `<span class="var-dot"></span>`).join('');
    const color = getCategoryColor(t.category);

    const card = document.createElement('div');
    card.className = 'template-card';
    card.style.setProperty('--card-accent',    color.accent);
    card.style.setProperty('--card-accent-bg', color.bg);
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Open template ${t.name}`);

    card.innerHTML = `
      <div class="card-header">
        <div class="card-icon">${getCategoryIcon(t.category)}</div>
        <span class="card-badge">${t.category}</span>
        <div class="card-actions">
          <button class="card-download-btn" data-id="${t.id}" aria-label="Download for SmartConfigure" title="Download for SmartConfigure">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button class="card-upload-btn" data-id="${t.id}" aria-label="Upload to Community" title="Upload to Community">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </button>
          <button class="card-edit-btn" data-id="${t.id}" aria-label="Edit template" title="Edit">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="card-delete-btn" data-id="${t.id}" aria-label="Delete template" title="Delete">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="card-name">${t.name}</div>
      <div class="card-desc">${t.description}</div>
      <div class="card-footer">
        <div class="card-vars">
          ${dots}
          <span style="margin-left:4px">${vars.length} variable${vars.length !== 1 ? 's' : ''}</span>
        </div>
        <span class="card-arrow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </span>
      </div>`;

    card.addEventListener('click', () => openFormModal(t));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openFormModal(t); });
    card.querySelector('.card-download-btn').addEventListener('click', e => {
      e.stopPropagation();
      const blob = new Blob([stripVariableExamples(t.content)], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = t.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.txt';
      a.click();
      URL.revokeObjectURL(a.href);
      showToast('Template downloaded — ready to import into SmartConfigure');
    });
    card.querySelector('.card-upload-btn').addEventListener('click', e => {
      e.stopPropagation();
      uploadToCommunity(t);
    });
    card.querySelector('.card-edit-btn').addEventListener('click', e => {
      e.stopPropagation(); openEditModal(t);
    });
    card.querySelector('.card-delete-btn').addEventListener('click', e => {
      e.stopPropagation(); openDeleteModal(t);
    });

    grid.appendChild(card);
  });
}


// ─── OPEN FORM MODAL ────────────────────────────────────────────────────────────────
function openFormModal(template) {
  currentTemplate = template;
  const vars = parseTemplateVariables(template.content);
  const color = getCategoryColor(template.category);

  document.getElementById('formModalIcon').style.background = color.bg;
  document.getElementById('formModalIcon').style.color      = color.accent;
  document.getElementById('formModalIcon').innerHTML        = getCategoryIcon(template.category);
  document.getElementById('formModalTitle').textContent     = template.name;
  document.getElementById('formModalSubtitle').textContent  = template.description;

  const body = document.getElementById('formModalBody');
  if (!vars.length) {
    body.innerHTML = `<p style="color:var(--color-text-muted);font-size:var(--text-xs)">This template has no variables. It will be generated as-is.</p>`;
  } else {
    body.innerHTML = vars.map(v => `
      <div class="form-field">
        <label class="form-label" for="var-${v.name}">
          ${v.name.replace(/_/g, ' ')}
          <span class="label-required">*</span>
        </label>
        <input class="form-input" id="var-${v.name}" data-var="${v.name}" placeholder="${v.example || v.name}" autocomplete="off">
      </div>`).join('');
    setTimeout(() => body.querySelector('.form-input')?.focus(), 220);
  }

  openModal('formModal');
}


// ─── GENERATE SCRIPT ────────────────────────────────────────────────────────────────
function generateScript() {
  if (!currentTemplate) return;
  let output = currentTemplate.content;
  const vars = parseTemplateVariables(currentTemplate.content);
  vars.forEach(v => {
    const input = document.getElementById(`var-${v.name}`);
    const val = (input && input.value.trim()) || `{${v.name}}`;
    const pattern = new RegExp(`\\{\\s*${escapeRegExp(v.name)}\\s*(?:,[^}]*)?\\}`, 'g');
    output = output.replace(pattern, val);
  });

  document.getElementById('outputModalTitle').textContent = currentTemplate.name;
  document.getElementById('scriptOutput').textContent     = output;
  closeModal('formModal');
  openModal('outputModal');
}


// ─── OPEN EDIT MODAL ────────────────────────────────────────────────────────────────
function openEditModal(template) {
  const raw = buildRawCfg(template);
  document.getElementById('editModalSubtitle').textContent = template.id + '.cfg';
  document.getElementById('editFilename').textContent      = template.id + '.cfg';
  document.getElementById('cfgEditEditor').value           = raw;
  document.getElementById('editTabEditor').classList.remove('hidden');
  document.getElementById('editTabHelp').classList.add('hidden');
  document.querySelectorAll('[data-edit-tab]').forEach(t =>
    t.classList.toggle('active', t.dataset.editTab === 'editor')
  );
  openModal('editModal');
  setTimeout(() => document.getElementById('cfgEditEditor').focus(), 220);
}

function buildRawCfg(template) {
  return `# name: ${template.name}\n# category: ${template.category}\n# description: ${template.description}\n\n${template.content}`;
}


// ─── DELETE SAVED MODAL ─────────────────────────────────────────────────────────────
function openDeleteSavedModal(saved) {
  const displayName = saved.customName || saved.templateName;
  document.getElementById('deleteSavedModalName').textContent = displayName;
  document.getElementById('confirmDeleteSavedBtn').onclick = async () => {
    try {
      const res    = await fetch(`/api/saved/${encodeURIComponent(saved.filename)}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) { showToast(result.error || 'Error deleting', true); return; }
    } catch {
      showToast('Could not connect to the server', true); return;
    }
    delete _savedCache[saved.filename];
    savedScripts = savedScripts.filter(s => s.filename !== saved.filename);
    closeModal('deleteSavedModal');
    updateCounts();
    renderSavedViewer();
    showToast(`Script "${displayName}" deleted`);
  };
  openModal('deleteSavedModal');
}


// ─── MODAL HELPERS ─────────────────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  const dot   = document.getElementById('toastDot');
  document.getElementById('toastMsg').textContent = msg;
  dot.classList.toggle('error', isError);
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function openDeleteModal(template) {
  document.getElementById('deleteModalName').textContent = template.name;
  document.getElementById('confirmDeleteBtn').onclick = async () => {
    try {
      const res    = await fetch(`/api/templates/${encodeURIComponent(template.id + '.cfg')}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) { showToast(result.error || 'Error deleting', true); return; }
    } catch {
      showToast('Could not connect to the server', true); return;
    }
    templates = templates.filter(t => t.id !== template.id);
    closeModal('deleteModal');
    updateCounts();
    renderGrid();
    showToast(`Template "${template.name}" deleted`);
  };
  openModal('deleteModal');
}

function renderHelpCats() {
  document.querySelectorAll('.help-cats').forEach(container => {
    container.innerHTML = categories.map(cat => {
      const color = getCategoryColor(cat.id);
      return `<span class="cat-chip" style="background:${color.bg}; color:${color.accent}">${cat.id}</span>`;
    }).join('');
  });
}
