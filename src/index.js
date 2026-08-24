const DEFAULT_CATEGORIES = [
  { id: "VLAN", icon: "network" },
  { id: "AAA", icon: "shield" },
  { id: "NTP", icon: "clock" },
  { id: "SNMP", icon: "activity" },
  { id: "Management", icon: "settings" },
  { id: "Trunks", icon: "list" },
  { id: "Otros", icon: "more-horizontal" }
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function getCategories(env) {
  const raw = await env.SCRIPTFORGE_KV.get("categories");
  return raw ? JSON.parse(raw) : DEFAULT_CATEGORIES;
}
async function getTemplatesIndex(env) {
  const raw = await env.SCRIPTFORGE_KV.get("templates:index");
  return raw ? JSON.parse(raw) : [];
}
async function getSavedIndex(env) {
  const raw = await env.SCRIPTFORGE_KV.get("saved:index");
  return raw ? JSON.parse(raw) : [];
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (!path.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    // /api/categories
    if (path === "/api/categories" && method === "GET") {
      return json({ categories: await getCategories(env) });
    }
    if (path === "/api/categories" && method === "POST") {
      const data = await request.json();
      const name = (data.id || "").trim();
      const icon = (data.icon || "folder").trim();
      const color = (data.color || "").trim();
      if (!name) return json({ error: "El nombre es obligatorio" }, 400);
      const cats = await getCategories(env);
      if (cats.some(c => c.id.toLowerCase() === name.toLowerCase())) {
        return json({ error: "Ya existe esa categoría" }, 409);
      }
      cats.push({ id: name, icon, color });
      await env.SCRIPTFORGE_KV.put("categories", JSON.stringify(cats));
      return json({ ok: true, category: { id: name, icon, color } });
    }
    if (path === "/api/categories/reorder" && method === "POST") {
      const data = await request.json();
      const order = data.order || [];
      const cats = await getCategories(env);
      const catMap = {};
      cats.forEach(c => { catMap[c.id] = c; });
      const reordered = order.filter(id => catMap[id]).map(id => catMap[id]);
      const seen = new Set(reordered.map(c => c.id));
      cats.forEach(c => { if (!seen.has(c.id)) reordered.push(c); });
      await env.SCRIPTFORGE_KV.put("categories", JSON.stringify(reordered));
      return json({ ok: true });
    }
    if (path.startsWith("/api/categories/") && method === "DELETE") {
      const catId = decodeURIComponent(path.replace("/api/categories/", ""));
      let cats = await getCategories(env);
      if (!cats.some(c => c.id === catId)) {
        return json({ error: `Categoría no encontrada: ${catId}` }, 404);
      }
      cats = cats.filter(c => c.id !== catId);
      await env.SCRIPTFORGE_KV.put("categories", JSON.stringify(cats));
      return json({ ok: true });
    }

    // /api/templates
    if (path === "/api/templates" && method === "GET") {
      return json({ files: await getTemplatesIndex(env) });
    }
    if (path === "/api/templates" && method === "POST") {
      const data = await request.json();
      let filename = (data.filename || "").trim();
      const content = (data.content || "").trim();
      if (!filename || !content) {
        return json({ error: "filename y content son obligatorios" }, 400);
      }
      if (!filename.endsWith(".cfg")) filename += ".cfg";
      filename = filename.replace(/[\/\\]/g, "");
      await env.SCRIPTFORGE_KV.put(`template:${filename}`, content);
      const index = await getTemplatesIndex(env);
      if (!index.includes(filename)) index.push(filename);
      await env.SCRIPTFORGE_KV.put("templates:index", JSON.stringify(index));
      return json({ ok: true, filename });
    }
    if (path.startsWith("/api/templates/") && method === "GET") {
      const filename = decodeURIComponent(path.replace("/api/templates/", ""));
      const content = await env.SCRIPTFORGE_KV.get(`template:${filename}`);
      if (content === null) return new Response("Not found", { status: 404 });
      return new Response(content, { headers: { "Content-Type": "text/plain" } });
    }
    if (path.startsWith("/api/templates/") && method === "DELETE") {
      const filename = decodeURIComponent(path.replace("/api/templates/", ""));
      const exists = await env.SCRIPTFORGE_KV.get(`template:${filename}`);
      if (exists === null) return json({ error: `Archivo no encontrado: ${filename}` }, 404);
      await env.SCRIPTFORGE_KV.delete(`template:${filename}`);
      const index = (await getTemplatesIndex(env)).filter(f => f !== filename);
      await env.SCRIPTFORGE_KV.put("templates:index", JSON.stringify(index));
      return json({ ok: true });
    }

    // /api/saved
    if (path === "/api/saved" && method === "GET") {
      const index = await getSavedIndex(env);
      const result = [];
      for (const filename of index) {
        const content = await env.SCRIPTFORGE_KV.get(`saved:${filename}`);
        if (content === null) continue;
        const firstLine = content.split("\n")[0];
        const meta = {};
        if (firstLine.startsWith("##")) {
          firstLine.slice(2).split("|").forEach(part => {
            const [k, v] = part.split(":");
            if (k) meta[k.trim()] = (v || "").trim();
          });
        }
        result.push({
          filename,
          templateName: meta.template || filename.replace(".txt", ""),
          category: meta.category || "",
          savedAt: meta.savedAt || "",
          customName: meta.customName || ""
        });
      }
      return json({ saved: result });
    }
    if (path === "/api/saved" && method === "POST") {
      const data = await request.json();
      const templateName = (data.templateName || "").trim();
      const category = (data.category || "").trim();
      const content = (data.content || "").trim();
      const savedAt = (data.savedAt || "").trim();
      const customName = (data.customName || "").trim();
      let filename = (data.filename || "").trim();
      if (!templateName || !content || !filename) {
        return json({ error: "templateName, filename y content son obligatorios" }, 400);
      }
      if (!filename.endsWith(".txt")) filename += ".txt";
      filename = filename.replace(/[\/\\]/g, "");
      const metaLine = `## template:${templateName} | category:${category} | savedAt:${savedAt} | customName:${customName}\n`;
      await env.SCRIPTFORGE_KV.put(`saved:${filename}`, metaLine + content);
      const index = await getSavedIndex(env);
      index.unshift(filename);
      await env.SCRIPTFORGE_KV.put("saved:index", JSON.stringify(index));
      return json({ ok: true, filename });
    }
    if (path.startsWith("/api/saved/") && method === "DELETE") {
      const filename = decodeURIComponent(path.replace("/api/saved/", ""));
      const exists = await env.SCRIPTFORGE_KV.get(`saved:${filename}`);
      if (exists === null) return json({ error: `Archivo no encontrado: ${filename}` }, 404);
      await env.SCRIPTFORGE_KV.delete(`saved:${filename}`);
      const index = (await getSavedIndex(env)).filter(f => f !== filename);
      await env.SCRIPTFORGE_KV.put("saved:index", JSON.stringify(index));
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  }
};