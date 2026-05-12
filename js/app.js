// ─── APP STATE ────────────────────────────────────────────────────────────────
let templates  = [];
let categories = [];
let currentFilter   = 'all';
let currentTemplate = null;
let searchQuery     = '';

async function loadTemplates() {
  try {
    // Cargar categorías primero (las necesitan los templates al renderizar)
    const catRes = await fetch('/api/categories');
    const catData = await catRes.json();
    categories = catData.categories || [];

    // Cargar templates
    const tplRes = await fetch('/api/templates');
    const { files } = await tplRes.json();
    const results = await Promise.all(
      files.map(file =>
        fetch(`./templates/${file}`)
          .then(r => r.text())
          .then(text => parseCfg(text, file))
          .catch(() => null)
      )
    );
    templates = results.filter(Boolean);
  } catch (e) {
    console.error('Error cargando datos:', e);
    templates = []; categories = [];
  }

  renderHelpCats();
}

function parseCfg(text, filename) {
  const lines = text.replace(/\r/g, '').split('\n');
  const meta = {};
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

  // Normalizar categoría contra las existentes (case-insensitive)
  const matchedCat = categories.find(
    c => c.id.toLowerCase() === meta.category.toLowerCase()
  );
  const resolvedCategory = matchedCat ? matchedCat.id : meta.category;

  return {
    id: filename.replace('.cfg', ''),
    name: meta.name,
    category: resolvedCategory,
    description: meta.description || '',
    content: contentLines.join('\n').trim()
  };
}