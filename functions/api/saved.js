import { json } from "../_utils.js";

async function getIndex(env) {
  const raw = await env.SCRIPTFORGE_KV.get("saved:index");
  return raw ? JSON.parse(raw) : [];
}

export async function onRequestGet({ env }) {
  const index = await getIndex(env);
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

export async function onRequestPost({ request, env }) {
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

  const index = await getIndex(env);
  index.unshift(filename);
  await env.SCRIPTFORGE_KV.put("saved:index", JSON.stringify(index));

  return json({ ok: true, filename });
}