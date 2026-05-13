// ─── APP STATE ────────────────────────────────────────────────────────────────
let templates    = [];
let categories   = [];
let savedScripts = [];
let currentFilter   = 'all';
let currentTemplate = null;
let currentView     = 'templates'; // 'templates' | 'saved'
let searchQuery     = '';


async function loadTemplates() {
  try {
    const catRes  = await fetch('/api/categories');
    const catData = await catRes.json();
    categories = catData.categories || [];

    const tplRes    = await fetch('/api/templates');
    const { files } = await tplRes.json();
    const results   = await Promise.all(
      files.map(file =>
        fetch(`./templates/${file}`)
          .then(r => r.text())
          .then(text => parseCfg(text, file))
          .catch(() => null)
      )
    );
    templates = results.filter(Boolean);

    const savedRes  = await fetch('/api/saved');
    const savedData = await savedRes.json();
    savedScripts = savedData.saved || [];

  } catch (e) {
    console.error('Error cargando datos:', e);
    templates = []; categories = []; savedScripts = [];
  }

  renderHelpCats();
}


function parseCfg(text, filename) {
  const lines = text.replace(/\r/g, '').split('\n');
  const meta  = {};
  const contentLines = [];
  let inContent = false;

  for (const line of lines) {
    if (!inContent && line.startsWith('# ')) {
      const match = line.match(/^# (\w+):\s*(.+)/);
      if (match) meta[match[1]] = match[2].trim();
    } else if (line.trim() !== '' || inContent) {
      inContent = true;
      contentLines.push(line);
    }
  }

  if (!meta.name || !meta.category) return null;

  const matchedCat = categories.find(
    c => c.id.toLowerCase() === meta.category.toLowerCase()
  );
  const resolvedCategory = matchedCat ? matchedCat.id : meta.category;

  return {
    id:          filename.replace('.cfg', ''),
    name:        meta.name,
    category:    resolvedCategory,
    description: meta.description || '',
    content:     contentLines.join('\n').trim()
  };
}


async function saveScript(templateName, category, content, customName) {
  const savedAt  = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const base     = (customName || templateName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const filename = `${base}-${Date.now()}.txt`;

  try {
    const res = await fetch('/api/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, templateName, category, content, savedAt, customName })
    });
    const result = await res.json();
    if (!res.ok) { showToast(result.error || 'Error al guardar', true); return false; }
  } catch {
    showToast('No se pudo conectar con el servidor', true); return false;
  }

  savedScripts.unshift({ filename, templateName, category, savedAt, customName });
  return true;
}