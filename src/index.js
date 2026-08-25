const DEFAULT_CATEGORIES = [
  { id: "VLAN", icon: "network" },
  { id: "AAA", icon: "shield" },
  { id: "NTP", icon: "clock" },
  { id: "SNMP", icon: "activity" },
  { id: "Management", icon: "settings" },
  { id: "Trunks", icon: "list" },
  { id: "Otros", icon: "more-horizontal" }
];

function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function signToken(payload, secret) {
  const enc = new TextEncoder();
  const payloadB64 = b64url(enc.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));
  return `${payloadB64}.${b64url(sig)}`;
}

async function verifyToken(token, secret) {
  if (!token) return null;
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("HMAC", key, b64urlDecode(sigB64), enc.encode(payloadB64));
  if (!valid) return null;
  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
  if (payload.exp && Date.now() > payload.exp) return null;
  return payload;
}

function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : null;
}

async function getUserFromCookie(request, env) {
  const cookieToken = getCookie(request, "sf_session");
  return verifyToken(cookieToken, env.SSO_SECRET);
}

function kvKey(userId, key) {
  return `user:${userId}:${key}`;
}

async function getCategories(env, userId) {
  const raw = await env.SCRIPTFORGE_KV.get(kvKey(userId, "categories"));
  return raw ? JSON.parse(raw) : DEFAULT_CATEGORIES;
}
async function getTemplatesIndex(env, userId) {
  const raw = await env.SCRIPTFORGE_KV.get(kvKey(userId, "templates:index"));
  return raw ? JSON.parse(raw) : [];
}
async function getSavedIndex(env, userId) {
  const raw = await env.SCRIPTFORGE_KV.get(kvKey(userId, "saved:index"));
  return raw ? JSON.parse(raw) : [];
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 1. Handoff de sesión desde SmartMatrix (?sso=...)
    const ssoParam = url.searchParams.get("sso");
    if (ssoParam) {
      const payload = await verifyToken(ssoParam, env.SSO_SECRET);
      if (!payload) {
        return new Response("Token de sesión inválido o caducado", { status: 401 });
      }
      const sessionToken = await signToken(
        { userId: payload.userId, email: payload.email, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 },
        env.SSO_SECRET
      );
      url.searchParams.delete("sso");
      return new Response(null, {
        status: 302,
        headers: {
          "Location": url.pathname + (url.search || ""),
          "Set-Cookie": `sf_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
        }
      });
    }

    // 2. Identificar usuario por cookie local
    const user = await getUserFromCookie(request, env);

    if (!user) {
      if (path.startsWith("/api/")) return json({ error: "No autenticado" }, 401);
      return Response.redirect("https://smartmatrix.javimcasas.workers.dev/", 302);
    }

    if (!path.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    const userId = user.userId;

    if (path === "/api/categories" && method === "GET") {
      return json({ categories: await getCategories(env, userId) });
    }
    if (path === "/api/categories" && method === "POST") {
      const data = await request.json();
      const name = (data.id || "").trim();
      const icon = (data.icon || "folder").trim();
      const color = (data.color || "").trim();
      if (!name) return json({ error: "El nombre es obligatorio" }, 400);
      const cats = await getCategories(env, userId);
      if (cats.some(c => c.id.toLowerCase() === name.toLowerCase())) {
        return json({ error: "Ya existe esa categoría" }, 409);
      }
      cats.push({ id: name, icon, color });
      await env.SCRIPTFORGE_KV.put(kvKey(userId, "categories"), JSON.stringify(cats));
      return json({ ok: true, category: { id: name, icon, color } });
    }
    if (path === "/api/categories/reorder" && method === "POST") {
      const data = await request.json();
      const order = data.order || [];
      const cats = await getCategories(env, userId);
      const catMap = {};
      cats.forEach(c => { catMap[c.id] = c; });
      const reordered = order.filter(id => catMap[id]).map(id => catMap[id]);
      const seen = new Set(reordered.map(c => c.id));
      cats.forEach(c => { if (!seen.has(c.id)) reordered.push(c); });
      await env.SCRIPTFORGE_KV.put(kvKey(userId, "categories"), JSON.stringify(reordered));
      return json({ ok: true });
    }
    if (path.startsWith("/api/categories/") && method === "DELETE") {
      const catId = decodeURIComponent(path.replace("/api/categories/", ""));
      let cats = await getCategories(env, userId);
      if (!cats.some(c => c.id === catId)) {
        return json({ error: `Categoría no encontrada: ${catId}` }, 404);
      }
      cats = cats.filter(c => c.id !== catId);
      await env.SCRIPTFORGE_KV.put(kvKey(userId, "categories"), JSON.stringify(cats));
      return json({ ok: true });
    }

    if (path === "/api/templates" && method === "GET") {
      return json({ files: await getTemplatesIndex(env, userId) });
    }
    if (path === "/api/templates" && method === "POST") {
      const data = await request.json();
      let filename = (data.filename || "").trim();
      const content = (data.content || "").trim();
      if (!filename || !content) return json({ error: "filename y content son obligatorios" }, 400);
      if (!filename.endsWith(".cfg")) filename += ".cfg";
      filename = filename.replace(/[\/\\]/g, "");
      await env.SCRIPTFORGE_KV.put(kvKey(userId, `template:${filename}`), content);
      const index = await getTemplatesIndex(env, userId);
      if (!index.includes(filename)) index.push(filename);
      await env.SCRIPTFORGE_KV.put(kvKey(userId, "templates:index"), JSON.stringify(index));
      return json({ ok: true, filename });
    }
    if (path.startsWith("/api/templates/") && method === "GET") {
      const filename = decodeURIComponent(path.replace("/api/templates/", ""));
      const content = await env.SCRIPTFORGE_KV.get(kvKey(userId, `template:${filename}`));
      if (content === null) return new Response("Not found", { status: 404 });
      return new Response(content, { headers: { "Content-Type": "text/plain" } });
    }
    if (path.startsWith("/api/templates/") && method === "DELETE") {
      const filename = decodeURIComponent(path.replace("/api/templates/", ""));
      const exists = await env.SCRIPTFORGE_KV.get(kvKey(userId, `template:${filename}`));
      if (exists === null) return json({ error: `Archivo no encontrado: ${filename}` }, 404);
      await env.SCRIPTFORGE_KV.delete(kvKey(userId, `template:${filename}`));
      const index = (await getTemplatesIndex(env, userId)).filter(f => f !== filename);
      await env.SCRIPTFORGE_KV.put(kvKey(userId, "templates:index"), JSON.stringify(index));
      return json({ ok: true });
    }

    if (path === "/api/saved" && method === "GET") {
      const index = await getSavedIndex(env, userId);
      const result = [];
      for (const filename of index) {
        const content = await env.SCRIPTFORGE_KV.get(kvKey(userId, `saved:${filename}`));
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
      await env.SCRIPTFORGE_KV.put(kvKey(userId, `saved:${filename}`), metaLine + content);
      const index = await getSavedIndex(env, userId);
      index.unshift(filename);
      await env.SCRIPTFORGE_KV.put(kvKey(userId, "saved:index"), JSON.stringify(index));
      return json({ ok: true, filename });
    }
    if (path.startsWith("/api/saved/") && method === "DELETE") {
      const filename = decodeURIComponent(path.replace("/api/saved/", ""));
      const exists = await env.SCRIPTFORGE_KV.get(kvKey(userId, `saved:${filename}`));
      if (exists === null) return json({ error: `Archivo no encontrado: ${filename}` }, 404);
      await env.SCRIPTFORGE_KV.delete(kvKey(userId, `saved:${filename}`));
      const index = (await getSavedIndex(env, userId)).filter(f => f !== filename);
      await env.SCRIPTFORGE_KV.put(kvKey(userId, "saved:index"), JSON.stringify(index));
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  }
};