// ─── RENDER GRID ──────────────────────────────────────────────────────────────
function renderGrid() {
  const grid = document.getElementById('templatesGrid');
  let filtered = templates;
  if (currentFilter !== 'all') filtered = filtered.filter(t => t.category === currentFilter);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  }

  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>
        <h3>Sin templates</h3>
        <p>Importa un nuevo template usando el botón "Importar Template".</p>
      </div>`;
    return;
  }

  filtered.forEach(t => {
    const catClass = CATEGORY_CSS[t.category] || 'cat-otros';
    const vars = extractVars(t.content);
    const dots = vars.slice(0, 5).map(() => '<span class="var-dot"></span>').join('');
    const card = document.createElement('div');
    card.className = `template-card ${catClass}`;
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Usar template: ${t.name}`);
    card.innerHTML = `
    <div class="card-header">
            <div class="card-icon">${CATEGORY_ICONS[t.category] || CATEGORY_ICONS['Otros']}</div>
            <span class="card-badge">${t.category}</span>
            <button class="card-edit-btn" data-id="${t.id}" aria-label="Editar template" title="Editar">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
        </div>
        <div class="card-name">${t.name}</div>
        <div class="card-desc">${t.description}</div>
        <div class="card-footer">
            <div class="card-vars">
            ${dots}
            <span style="margin-left:4px">${vars.length} variable${vars.length !== 1 ? 's' : ''}</span>
            </div>
            <span class="card-arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </span>
    </div>`;
    card.addEventListener('click', () => openFormModal(t));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFormModal(t); } });
    card.querySelector('.card-edit-btn').addEventListener('click', e => {
        e.stopPropagation();
        openEditModal(t);
    });
    grid.appendChild(card);
  });
}

// ─── EXTRACT VARIABLES ────────────────────────────────────────────────────────
function extractVars(content) {
  const matches = content.match(/\{([A-Z0-9_]+)\}/g) || [];
  return [...new Set(matches.map(m => m.slice(1, -1)))];
}

// ─── OPEN FORM MODAL ──────────────────────────────────────────────────────────
function openFormModal(template) {
  currentTemplate = template;
  const vars = extractVars(template.content);
  const catClass = CATEGORY_CSS[template.category] || 'cat-otros';

  document.getElementById('formModalTitle').textContent = template.name;
  document.getElementById('formModalSubtitle').textContent = template.description;

  const iconEl = document.getElementById('formModalIcon');
  iconEl.innerHTML = CATEGORY_ICONS[template.category] || CATEGORY_ICONS['Otros'];
  iconEl.className = `modal-icon ${catClass}`;

  const body = document.getElementById('formModalBody');
  body.innerHTML = '';

  if (vars.length === 0) {
    body.innerHTML = '<p style="font-size:var(--text-xs);color:var(--color-text-muted);">Este template no tiene variables. El script se generará tal cual.</p>';
  } else {
    vars.forEach(v => {
      const field = document.createElement('div');
      field.className = 'form-field';
      field.innerHTML = `
        <label class="form-label" for="var_${v}">
          ${v.replace(/_/g, ' ')} <span class="label-required">*</span>
        </label>
        <input type="text" class="form-input" id="var_${v}" data-var="${v}" placeholder="${v}" autocomplete="off" spellcheck="false">`;
      body.appendChild(field);
    });
  }

  document.getElementById('outputModalTitle').textContent = `Script — ${template.name}`;
  openModal('formModal');

  setTimeout(() => {
    const first = body.querySelector('.form-input');
    if (first) first.focus();
  }, 220);
}

// ─── GENERATE SCRIPT ──────────────────────────────────────────────────────────
function generateScript() {
  if (!currentTemplate) return;
  const vars = extractVars(currentTemplate.content);
  const values = {};
  let valid = true;

  vars.forEach(v => {
    const el = document.getElementById(`var_${v}`);
    const val = el ? el.value.trim() : '';
    if (!val) {
      valid = false;
      if (el) { el.style.borderColor = 'var(--color-error)'; el.focus(); }
    } else {
      if (el) el.style.borderColor = '';
      values[v] = val;
    }
  });

  if (!valid) { showToast('Completa todos los campos requeridos', true); return; }

  let script = currentTemplate.content;
  vars.forEach(v => { script = script.split(`{${v}}`).join(values[v]); });

  document.getElementById('scriptOutput').textContent = script;
  closeModal('formModal');
  openModal('outputModal');
}

// ─── MODAL HELPERS ────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

// ─── FILTER LOGIC ─────────────────────────────────────────────────────────────
function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.sidebar-item[data-filter]').forEach(item => {
    item.classList.toggle('active', item.dataset.filter === filter);
  });
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.filter === filter);
  });
  const titles = { all: 'Todos los templates', VLAN: 'VLAN', AAA: 'AAA', NTP: 'NTP', SNMP: 'SNMP', Management: 'Management', Trunks: 'Trunks', Otros: 'Otros' };
  document.getElementById('pageTitle').textContent = titles[filter] || filter;
  renderGrid();
}

// ─── COUNTS ───────────────────────────────────────────────────────────────────
function updateCounts() {
  const cats = ['all', 'VLAN', 'AAA', 'NTP', 'SNMP', 'Management', 'Trunks', 'Otros'];
  cats.forEach(c => {
    const el = document.getElementById('count-' + c);
    if (el) el.textContent = c === 'all' ? templates.length : templates.filter(t => t.category === c).length;
  });
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  const dot = document.getElementById('toastDot');
  document.getElementById('toastMsg').textContent = msg;
  dot.className = 'toast-dot' + (isError ? ' error' : '');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

// ─── THEME TOGGLE ─────────────────────────────────────────────────────────────
(function () {
  const btn = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;
  let theme = root.getAttribute('data-theme') || 'dark';
  function setTheme(t) {
    theme = t;
    root.setAttribute('data-theme', t);
    if (btn) {
      btn.setAttribute('aria-label', 'Cambiar a modo ' + (t === 'dark' ? 'claro' : 'oscuro'));
      btn.innerHTML = t === 'dark'
        ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
        : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }
  }
  setTheme(theme);
  if (btn) btn.addEventListener('click', () => setTheme(theme === 'dark' ? 'light' : 'dark'));
})();

// ─── OPEN EDIT MODAL ──────────────────────────────────────────────────────────
function openEditModal(template) {
  const raw = buildRawCfg(template);
  document.getElementById('editModalSubtitle').textContent = template.id + '.cfg';
  document.getElementById('editFilename').textContent = template.id + '.cfg';
  document.getElementById('cfgEditEditor').value = raw;
  document.getElementById('editTabEditor').classList.remove('hidden');
  document.getElementById('editTabHelp').classList.add('hidden');
  document.querySelectorAll('[data-edit-tab]').forEach(t => t.classList.toggle('active', t.dataset.editTab === 'editor'));
  openModal('editModal');
  setTimeout(() => document.getElementById('cfgEditEditor').focus(), 220);
}

function buildRawCfg(template) {
  return `# name: ${template.name}\n# category: ${template.category}\n# description: ${template.description}\n\n${template.content}`;
}