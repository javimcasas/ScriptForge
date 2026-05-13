// ─── COPY ─────────────────────────────────────────────────────────────────────
document.getElementById('copyBtn').addEventListener('click', () => {
  const text = document.getElementById('scriptOutput').textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('Script copiado al portapapeles'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    showToast('Script copiado al portapapeles');
  }
});

// ─── DOWNLOAD ─────────────────────────────────────────────────────────────────
document.getElementById('downloadBtn').addEventListener('click', () => {
  const text = document.getElementById('scriptOutput').textContent;
  const name = (currentTemplate ? currentTemplate.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'script') + '.txt';
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
  showToast('Archivo descargado');
});

// ─── IMPORT ───────────────────────────────────────────────────────────────────
document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('cfgEditor').value = '';
  document.getElementById('importFilename').textContent = '';
  openModal('importModal');
});

document.getElementById('browseBtn').addEventListener('click', () => {
  document.getElementById('cfgFileInput').click();
});
document.getElementById('dropZone').addEventListener('click', (e) => {
  if (e.target.id !== 'browseBtn') document.getElementById('cfgFileInput').click();
});

document.getElementById('cfgFileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) loadCfgFile(file);
});

const dropZone = document.getElementById('dropZone');
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.cfg')) loadCfgFile(file);
  else showToast('Solo se admiten archivos .cfg', true);
});

function loadCfgFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('cfgEditor').value = e.target.result;
    document.getElementById('importFilename').textContent = file.name;
  };
  reader.readAsText(file);
}

// Tabs editor/ayuda (import modal)
document.querySelectorAll('.editor-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tabEditor').classList.toggle('hidden', tab.dataset.tab !== 'editor');
    document.getElementById('tabHelp').classList.toggle('hidden', tab.dataset.tab !== 'help');
  });
});

// Confirmar carga
document.getElementById('importConfirmBtn').addEventListener('click', async () => {
  const raw = document.getElementById('cfgEditor').value.trim();
  if (!raw) { showToast('El editor está vacío', true); return; }

  const parsed = parseCfg(raw, 'manual-' + Date.now() + '.cfg');
  if (!parsed) { showToast('Faltan metadatos: name y category son obligatorios', true); return; }

  const filenameBase = parsed.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const filename = `${parsed.category.toLowerCase()}-${filenameBase}.cfg`;

  try {
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content: raw })
    });
    const result = await res.json();
    if (!res.ok) { showToast(result.error || 'Error al guardar', true); return; }
  } catch {
    showToast('No se pudo conectar con el servidor', true); return;
  }

  templates.push(parsed);
  document.getElementById('cfgEditor').value = '';
  document.getElementById('importFilename').textContent = '';
  closeModal('importModal');
  updateCounts();
  renderGrid();
  showToast(`Template "${parsed.name}" guardado en /templates`);
});

// ─── GENERATE ─────────────────────────────────────────────────────────────────
document.getElementById('generateBtn').addEventListener('click', generateScript);
document.getElementById('formModalBody').addEventListener('keydown', e => {
  if (e.key === 'Enter') generateScript();
});

// ─── SEARCH ───────────────────────────────────────────────────────────────────
document.getElementById('globalSearch').addEventListener('input', e => {
  searchQuery = e.target.value.trim();
  renderGrid();
});

// ─── MODAL CLOSE (overlay click + Escape) ─────────────────────────────────────
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') return;
    document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
  }
});

// ─── EDIT MODAL TABS ──────────────────────────────────────────────────────────
document.querySelectorAll('[data-edit-tab]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('[data-edit-tab]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('editTabEditor').classList.toggle('hidden', tab.dataset.editTab !== 'editor');
    document.getElementById('editTabHelp').classList.toggle('hidden', tab.dataset.editTab !== 'help');
  });
});

// ─── EDIT SAVE ────────────────────────────────────────────────────────────────
document.getElementById('editSaveBtn').addEventListener('click', async () => {
  const raw = document.getElementById('cfgEditEditor').value.trim();
  if (!raw) { showToast('El editor está vacío', true); return; }

  const filename = document.getElementById('editFilename').textContent;
  const parsed = parseCfg(raw, filename);
  if (!parsed) { showToast('Faltan metadatos: name y category son obligatorios', true); return; }

  try {
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content: raw })
    });
    const result = await res.json();
    if (!res.ok) { showToast(result.error || 'Error al guardar', true); return; }
  } catch {
    showToast('No se pudo conectar con el servidor', true); return;
  }

  const idx = templates.findIndex(t => t.id === parsed.id);
  if (idx !== -1) templates[idx] = parsed;

  closeModal('editModal');
  updateCounts();
  renderGrid();
  showToast(`Template "${parsed.name}" actualizado`);
});

// ─── CATEGORY MODAL ───────────────────────────────────────────────────────────
// Estado del modal, vive fuera para que confirmCategoryBtn lo lea
let _selectedIcon  = 'folder';
let _selectedColor = COLOR_OPTIONS[0].id;

// Se llama desde renderSidebar() al hacer click en el botón +
function buildCategoryModal() {
  _selectedIcon  = 'folder';
  _selectedColor = COLOR_OPTIONS[0].id;
  document.getElementById('catNameInput').value = '';

  // ── Icon picker ──────────────────────────────────────────────────────────
  const iconPicker = document.getElementById('iconPicker');
  iconPicker.innerHTML = '';

  Object.entries(ICON_SVG).forEach(([key, svg]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-picker-btn';
    btn.dataset.icon = key;
    btn.title = key;
    btn.innerHTML = svg.replace('width="13" height="13"', 'width="16" height="16"');
    if (key === _selectedIcon) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      iconPicker.querySelectorAll('.icon-picker-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      _selectedIcon = key;
    });
    iconPicker.appendChild(btn);
  });

  // ── Color picker ─────────────────────────────────────────────────────────
  const colorPicker = document.getElementById('colorPicker');
  colorPicker.innerHTML = '';

  COLOR_OPTIONS.forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'color-picker-btn';
    btn.dataset.color = opt.id;
    btn.title = opt.label;
    btn.style.setProperty('--swatch-color', opt.accent);
    if (opt.id === _selectedColor) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      colorPicker.querySelectorAll('.color-picker-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      _selectedColor = opt.id;
    });
    colorPicker.appendChild(btn);
  });
}

// ─── CONFIRM CATEGORY ─────────────────────────────────────────────────────────
document.getElementById('confirmCategoryBtn').addEventListener('click', async () => {
  const name = document.getElementById('catNameInput').value.trim();
  if (!name) { showToast('El nombre es obligatorio', true); return; }

  try {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: name, icon: _selectedIcon, color: _selectedColor })
    });
    const result = await res.json();
    if (!res.ok) { showToast(result.error || 'Error al crear categoría', true); return; }
  } catch {
    showToast('No se pudo conectar con el servidor', true); return;
  }

  categories.push({ id: name, icon: _selectedIcon, color: _selectedColor });
  closeModal('categoryModal');
  renderSidebar();
  renderFilterBar();
  updateCounts();
  showToast(`Categoría "${name}" creada`);
});

function openDeleteCatModal(catId) {
  document.getElementById('deleteCatModalName').textContent = catId;
  document.getElementById('confirmDeleteCatBtn').onclick = async () => {
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(catId)}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) { showToast(result.error || 'Error al borrar', true); return; }
    } catch {
      showToast('No se pudo conectar con el servidor', true); return;
    }
    categories = categories.filter(c => c.id !== catId);
    if (currentFilter === catId) currentFilter = 'all';
    closeModal('deleteCatModal');
    renderSidebar();
    renderFilterBar();
    updateCounts();
    renderGrid();
    showToast(`Categoría "${catId}" eliminada`);
  };
  openModal('deleteCatModal');
}

// ─── THEME TOGGLE ─────────────────────────────────────────────────────────────
(function () {
  const btn = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;
  let dark = root.getAttribute('data-theme') === 'dark';

  function applyTheme() {
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    btn.innerHTML = dark
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
      : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
    btn.setAttribute('aria-label', dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  }

  applyTheme(); // estado inicial

  btn.addEventListener('click', () => {
    dark = !dark;
    applyTheme();
  });
})();

function initSidebarDrag() {
  const items = [...document.querySelectorAll('.sidebar-item[data-filter]:not([data-filter="all"])')];
  let dragSrc = null;

  items.forEach(item => {
    const handle = item.querySelector('.sidebar-drag-handle');

    // Solo el handle activa el drag
    handle.addEventListener('mousedown', () => { item.draggable = true; });
    handle.addEventListener('mouseleave', () => {
      if (dragSrc !== item) item.draggable = false;
    });

    item.addEventListener('dragstart', e => {
      dragSrc = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.filter);
    });

    item.addEventListener('dragend', () => {
      item.draggable = false;
      item.classList.remove('dragging');
      document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('drag-over'));
      dragSrc = null;
      // Persiste el nuevo orden en el servidor
      saveCategoryOrder();
    });

    item.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (item !== dragSrc) {
        document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('drag-over'));
        item.classList.add('drag-over');
      }
    });

    item.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragSrc || dragSrc === item) return;

    const srcCat = dragSrc.dataset.filter;
    const tgtCat = item.dataset.filter;
    const srcIdx = categories.findIndex(c => c.id === srcCat);
    const tgtIdx = categories.findIndex(c => c.id === tgtCat);

    const [moved] = categories.splice(srcIdx, 1);
    categories.splice(tgtIdx, 0, moved);

    renderSidebar();
    renderFilterBar();
    updateCounts();   // ← esto faltaba
    });
  });
}

async function saveCategoryOrder() {
  try {
    await fetch('/api/categories/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: categories.map(c => c.id) })
    });
  } catch {
    // Fallo silencioso — el orden en memoria ya es correcto
  }
}

// ─── EXPORT ZIP ───────────────────────────────────────────────────────────────
document.getElementById('exportBtn').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/export');
    if (!res.ok) { showToast('Error al generar el ZIP', true); return; }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `scriptforge-export-${new Date().toISOString().slice(0,10)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`ZIP exportado con ${templates.length} templates`);
  } catch {
    showToast('No se pudo conectar con el servidor', true);
  }
});