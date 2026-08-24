import { DEFAULT_CATEGORIES, json } from "../../_utils.js";

export async function onRequestPost({ request, env }) {
  const data = await request.json();
  const order = data.order || [];

  const raw = await env.SCRIPTFORGE_KV.get("categories");
  const cats = raw ? JSON.parse(raw) : DEFAULT_CATEGORIES;
  const catMap = {};
  cats.forEach(c => { catMap[c.id] = c; });

  const reordered = order.filter(id => catMap[id]).map(id => catMap[id]);
  const seen = new Set(reordered.map(c => c.id));
  cats.forEach(c => { if (!seen.has(c.id)) reordered.push(c); });

  await env.SCRIPTFORGE_KV.put("categories", JSON.stringify(reordered));
  return json({ ok: true });
}