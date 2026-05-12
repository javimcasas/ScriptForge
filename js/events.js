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
document.getElementById('importBtn').addEventListener('click', () => openModal('importModal'));

document.getElementById('saveImportBtn').addEventListener('click', () => {
  const name     = document.getElementById('importName').value.trim();
  const desc     = document.getElementById('importDesc').value.trim();
  const category = document.getElementById('importCategory').value;
  const content  = document.getElementById('importContent').value.trim();

  if (!name)    { showToast('El nombre es obligatorio', true); return; }
  if (!content) { showToast('El contenido del script es obligatorio', true); return; }

  templates.push({ id: 't' + Date.now(), name, description: desc || 'Sin descripción', category, content });

  document.getElementById('importName').value    = '';
  document.getElementById('importDesc').value    = '';
  document.getElementById('importContent').value = '';

  closeModal('importModal');
  updateCounts();
  renderGrid();
  showToast(`Template "${name}" importado correctamente`);
});

// ─── GENERATE ─────────────────────────────────────────────────────────────────
document.getElementById('generateBtn').addEventListener('click', generateScript);
document.getElementById('formModalBody').addEventListener('keydown', e => {
  if (e.key === 'Enter') generateScript();
});

// ─── FILTERS ──────────────────────────────────────────────────────────────────
document.querySelectorAll('[data-filter]').forEach(el => {
  el.addEventListener('click', () => setFilter(el.dataset.filter));
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
    document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
  }
});