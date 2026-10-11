// ─── Account deletion (ROADMAP-PLAY G5) ──────────────────────────────
// Everything under user:<id>:* goes (templates, saved scripts, categories,
// likes). The templates they published to Community go too, and their likes
// come off other people's templates. Copies others imported are in those
// people's libraries and stay. The Community index is written before the
// user's keys go, so a failed run still finds their likes on the retry.

const KV_LIST_LIMIT = 1000;

async function deletePrefix(kv, prefix) {
  let cursor;
  let removed = 0;
  do {
    const page = await kv.list({ prefix, cursor, limit: KV_LIST_LIMIT });
    await Promise.all(page.keys.map(k => kv.delete(k.name)));
    removed += page.keys.length;
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return removed;
}

export async function deleteAccount(env, userId, email = "") {
  const kv = env.SCRIPTFORGE_KV;
  const index = JSON.parse(await kv.get("community:index") || "[]");
  const liked = new Set(JSON.parse(await kv.get(`user:${userId}:community:liked`) || "[]"));
  const mine = entry => entry.uploadedById === userId || (!!email && String(entry.uploadedBy || "").toLowerCase() === email);
  const published = index.filter(mine);
  const others = index.filter(e => !mine(e));
  const likesWithdrawn = others.filter(e => liked.has(e.id)).length;
  if (published.length || likesWithdrawn) {
    const kept = others.map(e => liked.has(e.id) ? { ...e, likes: Math.max(0, (e.likes || 0) - 1) } : e);
    await kv.put("community:index", JSON.stringify(kept));
  }
  // Right away, so a retry can't take the same likes off twice.
  await kv.delete(`user:${userId}:community:liked`);
  await Promise.all(published.map(e => kv.delete(`community:script:${e.id}`)));
  const keys = await deletePrefix(kv, `user:${userId}:`);
  return { keys, community_unpublished: published.length, likes_withdrawn: likesWithdrawn };
}


// ─── Route: POST https://internal/internal/account/delete ───────────────
// Service binding only (the hostname is "internal"), called by
// smartmatrix-auth with { userId, email } when someone deletes their
// account, and again until it answers ok. Idempotent.
const USER_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export async function handleAccountDelete(request, env, url) {
  if (url.hostname !== "internal" || url.pathname !== "/internal/account/delete") return null;
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }
  const userId = typeof body?.userId === "string" ? body.userId : "";
  if (!USER_ID_RE.test(userId)) return Response.json({ error: "userId is required" }, { status: 400 });
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  try {
    return Response.json({ ok: true, deleted: await deleteAccount(env, userId, email) });
  } catch (e) {
    console.error("account delete failed:", e.message);
    return Response.json({ error: "Delete failed" }, { status: 500 });
  }
}
