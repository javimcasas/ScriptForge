// ─── APP STATE ────────────────────────────────────────────────────────────────
let templates = [];
let currentFilter = 'all';
let currentTemplate = null;
let searchQuery = '';

async function loadTemplates() {
  try {
    const res = await fetch('/api/templates');
    const { files } = await res.json();

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
    console.error('Error cargando templates:', e);
    templates = [];
  }
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

  return {
    id: filename.replace('.cfg', ''),
    name: meta.name,
    category: meta.category,
    description: meta.description || '',
    content: contentLines.join('\n').trim()
  };
}