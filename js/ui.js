// ─── RENDER SIDEBAR ───────────────────────────────────────────────────────────
function renderSidebar() {
  const sidebar = document.getElementById('sidebar');

  const catItems = categories.map(cat => `
    <div class="sidebar-item" data-filter="${cat.id}" role="button" tabindex="0">
      <span class="sidebar-drag-handle" title="Arrastrar para reordenar">
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
      <button class="sidebar-delete-cat" data-cat="${cat.id}" title="Eliminar categoría" aria-label="Eliminar ${cat.id}">
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
    <span class="sidebar-section-label">Vistas</span>
    <button class="sidebar-item ${currentFilter === 'all' && currentView === 'templates' ? 'active' : ''}" data-filter="all">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
      Todos los templates
      <span class="count" id="count-all">0</span>
    </button>

    <button class="sidebar-item ${currentView === 'saved' ? 'active' : ''}" id="sidebarSavedBtn">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      Scripts guardados
      <span class="count" id="count-saved">0</span>
    </button>

    <div class="sidebar-divider"></div>

    <div class="sidebar-section-header">
      <span class="sidebar-section-label">Categorías</span>
      <button class="sidebar-add-cat" id="addCategoryBtn" title="Nueva categoría" aria-label="Añadir categoría">
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

  // Botón "Scripts guardados"
  document.getElementById('sidebarSavedBtn').addEventListener('click', () => setSavedView());

  // Botón nueva categoría
  document.getElementById('addCategoryBtn').addEventListener('click', () => {
    buildCategoryModal();
    openModal('categoryModal');
  });

  // Botones borrar categoría
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


// ─── RENDER FILTER BAR ────────────────────────────────────────────────────────
function renderFilterBar() {
  const bar = document.getElementById('filterBar');
  const chips = categories.map(cat =>
    `<button class="filter-chip" data-filter="${cat.id}">${cat.id}</button>`
  ).join('');

  bar.innerHTML = `
    <button class="filter-chip ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">Todos</button>
    ${chips}
  `;

  bar.querySelectorAll('[data-filter]').forEach(el => {
    el.addEventListener('click', () => setFilter(el.dataset.filter));
  });
}


// ─── HIGHLIGHT ACTIVE FILTER ──────────────────────────────────────────────────
function highlightActiveFilter() {
  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.filter === currentFilter && currentView === 'templates');
  });
  const savedBtn = document.getElementById('sidebarSavedBtn');
  if (savedBtn) savedBtn.classList.toggle('active', currentView === 'saved');

  document.querySelectorAll('.filter-chip').forEach(el => {
    el.classList.toggle('active', el.dataset.filter === currentFilter);
  });
}


// ─── SET FILTER (vista templates) ─────────────────────────────────────────────
function setFilter(filter) {
  currentView   = 'templates';
  currentFilter = filter;
  highlightActiveFilter();

  document.getElementById('filterBar').classList.remove('hidden');
  document.getElementById('templatesGrid').classList.remove('hidden');
  document.getElementById('savedViewer').classList.add('hidden');

  const titles = { all: 'Todos los templates' };
  document.getElementById('pageTitle').textContent = titles[filter] || filter;
  document.getElementById('pageSubtitle').textContent =
    filter === 'all'
      ? 'Selecciona un template para generar el script de configuración'
      : `Templates de la categoría ${filter}`;

  renderGrid();
}


// ─── SET SAVED VIEW ───────────────────────────────────────────────────────────
function setSavedView() {
  currentView = 'saved';
  highlightActiveFilter();

  document.getElementById('filterBar').classList.add('hidden');
  document.getElementById('templatesGrid').classList.add('hidden');
  document.getElementById('savedViewer').classList.remove('hidden');

  document.getElementById('pageTitle').textContent    = 'Scripts guardados';
  document.getElementById('pageSubtitle').textContent = 'Scripts generados y guardados desde los templates';

  renderSavedViewer();
}


// ─── RENDER SAVED VIEWER ──────────────────────────────────────────────────────
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
          ? 'No hay resultados para esa búsqueda.'
          : 'Aún no has guardado ningún script. Genera uno desde un template y pulsa <strong>Guardar</strong>.'
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
            <span>${s.category || 'Sin categoría'}</span>
            <span class="meta-sep">·</span>
            <span>${s.savedAt}</span>
          </div>
        </div>
        <div class="saved-card-actions">
          <button class="saved-card-btn btn-copy-saved" title="Copiar script" aria-label="Copiar script">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button class="saved-card-btn btn-del" title="Eliminar script" aria-label="Eliminar script">
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
        <pre class="saved-card-script" id="script-${s.filename}">Cargando…</pre>
        <div class="saved-card-footer">
          <button class="btn-copy btn-copy-saved-footer">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copiar
          </button>
          <button class="btn-download btn-dl-saved">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Descargar .txt
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

    // Copiar desde header
    card.querySelector('.btn-copy-saved').addEventListener('click', async e => {
      e.stopPropagation();
      const content = await getSavedContent(s.filename);
      navigator.clipboard.writeText(content).then(() => showToast('Script copiado'));
    });

    // Eliminar
    card.querySelector('.btn-del').addEventListener('click', e => {
      e.stopPropagation();
      openDeleteSavedModal(s);
    });

    // Copiar desde footer
    card.querySelector('.btn-copy-saved-footer').addEventListener('click', () => {
      const pre = document.getElementById(`script-${s.filename}`);
      navigator.clipboard.writeText(pre.textContent).then(() => showToast('Script copiado'));
    });

    // Descargar — usa displayName para el nombre del archivo
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


// ─── LAZY LOAD SAVED CONTENT ──────────────────────────────────────────────────
const _savedCache = {};

async function getSavedContent(filename) {
  if (_savedCache[filename]) return _savedCache[filename];
  const res  = await fetch(`./saved/${filename}`);
  const text = await res.text();
  // Stripa la primera línea de metadatos (## template:… | …)
  const lines = text.split('\n');
  const content = lines[0].startsWith('##') ? lines.slice(1).join('\n').trimStart() : text;
  _savedCache[filename] = content;
  return content;
}

async function loadSavedContent(filename) {
  const pre = document.getElementById(`script-${filename}`);
  if (!pre || pre.textContent !== 'Cargando…') return;
  try {
    pre.textContent = await getSavedContent(filename);
  } catch {
    pre.textContent = '— Error al cargar el archivo —';
  }
}


// ─── UPDATE COUNTS ────────────────────────────────────────────────────────────
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


// ─── RENDER GRID ──────────────────────────────────────────────────────────────
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
        <h3>No hay templates</h3>
        <p>Importa un archivo .cfg o escribe uno nuevo desde el botón superior.</p>
      </div>`;
    return;
  }

  grid.innerHTML = '';
  filtered.forEach(t => {
    const vars  = [...new Set((t.content.match(/\{([^}]+)\}/g) || []))];
    const dots  = vars.slice(0, 5).map(() => `<span class="var-dot"></span>`).join('');
    const color = getCategoryColor(t.category);

    const card = document.createElement('div');
    card.className = 'template-card';
    card.style.setProperty('--card-accent',    color.accent);
    card.style.setProperty('--card-accent-bg', color.bg);
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Abrir template ${t.name}`);

    card.innerHTML = `
      <div class="card-header">
        <div class="card-icon">${getCategoryIcon(t.category)}</div>
        <span class="card-badge">${t.category}</span>
        <div class="card-actions">
          <button class="card-edit-btn" data-id="${t.id}" aria-label="Editar template" title="Editar">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="card-delete-btn" data-id="${t.id}" aria-label="Borrar template" title="Borrar">
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
    card.querySelector('.card-edit-btn').addEventListener('click', e => {
      e.stopPropagation(); openEditModal(t);
    });
    card.querySelector('.card-delete-btn').addEventListener('click', e => {
      e.stopPropagation(); openDeleteModal(t);
    });

    grid.appendChild(card);
  });
}


// ─── OPEN FORM MODAL ──────────────────────────────────────────────────────────
function openFormModal(template) {
  currentTemplate = template;
  const vars = [...new Set((template.content.match(/\{([^}]+)\}/g) || []))]
    .map(v => v.slice(1, -1));
  const color = getCategoryColor(template.category);

  document.getElementById('formModalIcon').style.background = color.bg;
  document.getElementById('formModalIcon').style.color      = color.accent;
  document.getElementById('formModalIcon').innerHTML        = getCategoryIcon(template.category);
  document.getElementById('formModalTitle').textContent     = template.name;
  document.getElementById('formModalSubtitle').textContent  = template.description;

  const body = document.getElementById('formModalBody');
  if (!vars.length) {
    body.innerHTML = `<p style="color:var(--color-text-muted);font-size:var(--text-xs)">Este template no tiene variables. Se generará tal cual.</p>`;
  } else {
    body.innerHTML = vars.map(v => `
      <div class="form-field">
        <label class="form-label" for="var-${v}">
          ${v.replace(/_/g, ' ')}
          <span class="label-required">*</span>
        </label>
        <input class="form-input" id="var-${v}" data-var="${v}" placeholder="${v}" autocomplete="off">
      </div>`).join('');
    setTimeout(() => body.querySelector('.form-input')?.focus(), 220);
  }

  openModal('formModal');
}


// ─── GENERATE SCRIPT ──────────────────────────────────────────────────────────
function generateScript() {
  if (!currentTemplate) return;
  let output = currentTemplate.content;
  document.querySelectorAll('#formModalBody .form-input').forEach(input => {
    const val = input.value.trim() || `{${input.dataset.var}}`;
    output = output.replaceAll(`{${input.dataset.var}}`, val);
  });

  document.getElementById('outputModalTitle').textContent = currentTemplate.name;
  document.getElementById('scriptOutput').textContent     = output;
  closeModal('formModal');
  openModal('outputModal');
}


// ─── OPEN EDIT MODAL ──────────────────────────────────────────────────────────
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


// ─── DELETE SAVED MODAL ───────────────────────────────────────────────────────
function openDeleteSavedModal(saved) {
  const displayName = saved.customName || saved.templateName;
  document.getElementById('deleteSavedModalName').textContent = displayName;
  document.getElementById('confirmDeleteSavedBtn').onclick = async () => {
    try {
      const res    = await fetch(`/api/saved/${encodeURIComponent(saved.filename)}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) { showToast(result.error || 'Error al borrar', true); return; }
    } catch {
      showToast('No se pudo conectar con el servidor', true); return;
    }
    delete _savedCache[saved.filename];
    savedScripts = savedScripts.filter(s => s.filename !== saved.filename);
    closeModal('deleteSavedModal');
    updateCounts();
    renderSavedViewer();
    showToast(`Script "${displayName}" eliminado`);
  };
  openModal('deleteSavedModal');
}


// ─── MODAL HELPERS ────────────────────────────────────────────────────────────
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
      if (!res.ok) { showToast(result.error || 'Error al borrar', true); return; }
    } catch {
      showToast('No se pudo conectar con el servidor', true); return;
    }
    templates = templates.filter(t => t.id !== template.id);
    closeModal('deleteModal');
    updateCounts();
    renderGrid();
    showToast(`Template "${template.name}" eliminado`);
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