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

// ─── Community: a shared, non-per-user KV namespace (community:*) so
// templates published here are visible to every account, unlike
// everything else in this file which is scoped under user:<id>:*.
function communityKey(key) {
  return `community:${key}`;
}
async function getCommunityIndex(env) {
  const raw = await env.SCRIPTFORGE_KV.get(communityKey("index"));
  return raw ? JSON.parse(raw) : [];
}
async function getCommunityLikes(env, userId) {
  const raw = await env.SCRIPTFORGE_KV.get(kvKey(userId, "community:liked"));
  return raw ? JSON.parse(raw) : [];
}

// ─── AI generation: reveal the user's own key from smartmatrix-auth via
// Service Binding (a plain fetch() to another *.workers.dev domain from
// inside a Worker is blocked by Cloudflare -- error 1042 -- so we bind the
// two Workers directly instead of going through public DNS), then call the
// chosen provider server-side and hand back plain .cfg text.
async function authFetch(env, path, rawToken) {
  const req = new Request(`https://smartmatrix-auth.internal${path}`, {
    headers: { Authorization: `Bearer ${rawToken}` }
  });
  return env.AUTH.fetch(req);
}

async function revealApiKey(env, provider, rawToken) {
  const res = await authFetch(env, `/api/me/keys/${provider}/reveal`, rawToken);
  if (!res.ok) return null;
  const data = await res.json();
  return data.apiKey || null;
}

async function callPerplexity(apiKey, prompt, model) {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 3000,
      temperature: 0.2
    })
  });
  if (!res.ok) throw new Error(`Perplexity ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callOpenAI(apiKey, prompt, model) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 3000,
      temperature: 0.2
    })
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callAnthropic(apiKey, prompt, model) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 3000,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.content[0].text;
}

async function callAI(provider, apiKey, prompt, model) {
  if (provider === "openai") return callOpenAI(apiKey, prompt, model);
  if (provider === "anthropic") return callAnthropic(apiKey, prompt, model);
  return callPerplexity(apiKey, prompt, model);
}

function sanitizeCfgOutput(text) {
  let out = text.trim();
  // Strip markdown code fences if the model added them despite instructions.
  out = out.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/i, "").trim();
  return out;
}

function buildTemplatePrompt(description, categoryIds) {
  return `You generate configuration script templates for the ScriptForge tool (network device config templates with placeholder variables).

TASK: Write ONE template for: "${description}"

OUTPUT FORMAT (this exact structure, nothing else, no markdown code fences, no explanations before or after):

# name: <short human-readable name for this template>
# category: <one of: ${categoryIds.join(", ")}>
# description: <one-sentence description of what this template configures>

<the actual configuration script, one command per line>

RULES:
1. Any value the user must supply per-device (hostname, IP, VLAN ID, interface name, password, etc.) MUST be written as a placeholder variable in UPPERCASE_SNAKE_CASE wrapped in curly braces, e.g. {HOSTNAME}, {VLAN_ID}, {INTERFACE_NAME}.
2. Reuse the SAME placeholder name every time the same value is needed again in the script.
3. Pick the category that best matches the request from the allowed list above. If none fit well, use "Otros".
4. Do not invent extra metadata lines beyond name/category/description.
5. Do not wrap the output in \`\`\` code fences or add any commentary -- respond with the raw template only.`;
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
    const rawToken = getCookie(request, "sf_session");

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

    // ─── Community: shared, searchable-by-frontend template library ──
    if (path === "/api/community/mine" && method === "GET") {
      const index = await getCommunityIndex(env);
      const mine = index.filter(i => i.uploadedById === userId || i.uploadedBy === user.email);
      return json({ items: mine });
    }
    if (path === "/api/community" && method === "GET") {
      const index = await getCommunityIndex(env);
      const sorted = [...index].sort((a, b) => (b.likes || 0) - (a.likes || 0));
      const likedIds = await getCommunityLikes(env, userId);
      return json({ items: sorted, likedIds });
    }
    if (path === "/api/community/upload" && method === "POST") {
      const data = await request.json();
      const content = (data.content || "").trim();
      if (!content) return json({ error: "content es obligatorio" }, 400);

      // Reuse the same "# name: / # category: / # description:" header the
      // rest of the app already relies on, so a community item round-trips
      // through the exact same parseCfg() the frontend uses everywhere else.
      const nameMatch = content.match(/^# name:\s*(.+)$/m);
      const categoryMatch = content.match(/^# category:\s*(.+)$/m);
      const descMatch = content.match(/^# description:\s*(.+)$/m);
      if (!nameMatch || !categoryMatch) {
        return json({ error: "El contenido no tiene los metadatos name/category" }, 400);
      }

      // ─── Anti-duplicados: compara por contenido normalizado (name+category+
      // cuerpo del script), no por texto exacto, para detectar el mismo
      // template aunque cambie la descripción o los espacios en blanco.
      const normalizedBody = content
        .split("\n")
        .filter(l => !l.match(/^# (name|category|description):/))
        .join("\n")
        .trim()
        .replace(/\s+/g, " ");
      const dupKey = `${nameMatch[1].trim().toLowerCase()}|${categoryMatch[1].trim().toLowerCase()}|${normalizedBody.toLowerCase()}`;
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(dupKey));
      const contentHash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");

      const index = await getCommunityIndex(env);
      if (index.some(i => i.contentHash === contentHash)) {
        return json({ error: "Este template ya está publicado en Community" }, 409);
      }

      const id = crypto.randomUUID();
      const entry = {
        id,
        name: nameMatch[1].trim(),
        category: categoryMatch[1].trim(),
        description: descMatch ? descMatch[1].trim() : "",
        uploadedBy: user.email,
        uploadedById: userId,
        uploadedAt: new Date().toISOString(),
        likes: 0,
        imports: 0,
        contentHash
      };

      await env.SCRIPTFORGE_KV.put(communityKey(`script:${id}`), content);
      index.unshift(entry);
      await env.SCRIPTFORGE_KV.put(communityKey("index"), JSON.stringify(index));
      return json({ ok: true, id });
    }
    if (path.startsWith("/api/community/") && path.endsWith("/like") && method === "POST") {
      const id = decodeURIComponent(path.replace("/api/community/", "").replace("/like", ""));
      const index = await getCommunityIndex(env);
      const entry = index.find(i => i.id === id);
      if (!entry) return json({ error: "Script de Community no encontrado" }, 404);

      const liked = await getCommunityLikes(env, userId);
      const alreadyLiked = liked.includes(id);
      entry.likes = Math.max(0, (entry.likes || 0) + (alreadyLiked ? -1 : 1));
      const newLiked = alreadyLiked ? liked.filter(x => x !== id) : [...liked, id];

      await env.SCRIPTFORGE_KV.put(kvKey(userId, "community:liked"), JSON.stringify(newLiked));
      await env.SCRIPTFORGE_KV.put(communityKey("index"), JSON.stringify(index));
      return json({ ok: true, likes: entry.likes, liked: !alreadyLiked });
    }
    if (path.startsWith("/api/community/") && path.endsWith("/import") && method === "POST") {
      const id = decodeURIComponent(path.replace("/api/community/", "").replace("/import", ""));
      const content = await env.SCRIPTFORGE_KV.get(communityKey(`script:${id}`));
      if (content === null) return json({ error: "Script de Community no encontrado" }, 404);

      const index = await getCommunityIndex(env);
      const entry = index.find(i => i.id === id);
      const baseName = (entry ? entry.category : "otros").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const nameSlug = (entry ? entry.name : "community").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      let filename = `${baseName}-${nameSlug}.cfg`;

      const myIndex = await getTemplatesIndex(env, userId);
      if (myIndex.includes(filename)) {
        filename = filename.replace(/\.cfg$/, `-${Date.now()}.cfg`);
      }

      await env.SCRIPTFORGE_KV.put(kvKey(userId, `template:${filename}`), content);
      myIndex.push(filename);
      await env.SCRIPTFORGE_KV.put(kvKey(userId, "templates:index"), JSON.stringify(myIndex));

      if (entry) {
        entry.imports = (entry.imports || 0) + 1;
        await env.SCRIPTFORGE_KV.put(communityKey("index"), JSON.stringify(index));
      }

      return json({ ok: true, filename });
    }
    if (path.startsWith("/api/community/") && method === "DELETE") {
      const id = decodeURIComponent(path.replace("/api/community/", ""));
      const index = await getCommunityIndex(env);
      const entry = index.find(i => i.id === id);
      if (!entry) return json({ error: "Script de Community no encontrado" }, 404);
      if (entry.uploadedById !== userId && entry.uploadedBy !== user.email) {
        return json({ error: "No puedes despublicar un template que no es tuyo" }, 403);
      }

      const newIndex = index.filter(i => i.id !== id);
      await env.SCRIPTFORGE_KV.put(communityKey("index"), JSON.stringify(newIndex));
      await env.SCRIPTFORGE_KV.delete(communityKey(`script:${id}`));
      return json({ ok: true });
    }
    if (path.startsWith("/api/community/") && method === "GET") {
      const id = decodeURIComponent(path.replace("/api/community/", ""));
      const content = await env.SCRIPTFORGE_KV.get(communityKey(`script:${id}`));
      if (content === null) return new Response("Not found", { status: 404 });
      return new Response(content, { headers: { "Content-Type": "text/plain" } });
    }

    // ─── AI: providers status + template generation ──────────────
    if (path === "/api/ai/providers" && method === "GET") {
      try {
        const res = await authFetch(env, "/api/me/keys", rawToken);
        const bodyText = await res.text();
        if (!res.ok) return json({ error: `smartmatrix-auth returned ${res.status}`, upstream_body: bodyText.slice(0, 500) }, 502);
        return json(JSON.parse(bodyText));
      } catch (e) {
        return json({ error: `Could not reach smartmatrix-auth: ${e.message}` }, 502);
      }
    }

    if (path === "/api/ai/generate-template" && method === "POST") {
      const { description, provider, model, categories: categoryIds } = await request.json();
      if (!description || !description.trim()) return json({ error: "description is required" }, 400);
      const chosenProvider = provider || "perplexity";

      const apiKey = await revealApiKey(env, chosenProvider, rawToken);
      if (!apiKey) {
        return json({ error: `No ${chosenProvider} API key configured. Add it in your SmartMatrix profile.` }, 400);
      }

      const cats = (categoryIds && categoryIds.length) ? categoryIds : (await getCategories(env, userId)).map(c => c.id);
      const prompt = buildTemplatePrompt(description.trim(), cats);

      try {
        const raw = await callAI(chosenProvider, apiKey, prompt, model);
        const content = sanitizeCfgOutput(raw);
        if (!content.startsWith("#")) {
          return json({ error: "The AI response didn't match the expected template format. Try again or rephrase your request." }, 502);
        }
        return json({ content });
      } catch (e) {
        return json({ error: `Generation failed: ${e.message}` }, 500);
      }
    }

    return json({ error: "Not found" }, 404);
  }
};
