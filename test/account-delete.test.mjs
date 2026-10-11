// node --test test/*.mjs — account deletion in ScriptForge (ROADMAP-PLAY
// G5): user:<id>:* goes, their Community templates go, their likes come off.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deleteAccount } from "../src/account-delete.js";

function memoryKv(entries) {
  const store = new Map(Object.entries(entries));
  return {
    store,
    get: async k => store.get(k) ?? null,
    put: async (k, v) => { store.set(k, v); },
    delete: async k => { store.delete(k); },
    list: async ({ prefix }) => ({ keys: [...store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true })
  };
}

function seed() {
  return memoryKv({
    "community:index": JSON.stringify([
      { id: "a", uploadedById: "u1", uploadedBy: "u1@x", likes: 3 },
      { id: "b", uploadedById: "u2", uploadedBy: "u2@x", likes: 2 },
      { id: "c", uploadedBy: "u1@x", likes: 0 }, // older entry, no id stored
      { id: "d", uploadedById: "u2", uploadedBy: "u2@x", likes: 1 }
    ]),
    "community:script:a": "x", "community:script:b": "x", "community:script:c": "x", "community:script:d": "x",
    "user:u1:categories": "[]", "user:u1:template:a.cfg": "x", "user:u1:community:liked": JSON.stringify(["b"]),
    "user:u10:categories": "[]", "user:u2:template:a.cfg": "x"
  });
}

test("their keys and Community templates go; their likes come off; others' stay", async () => {
  const kv = seed();
  const out = await deleteAccount({ SCRIPTFORGE_KV: kv }, "u1", "u1@x");
  assert.deepEqual(out, { keys: 2, community_unpublished: 2, likes_withdrawn: 1 });
  assert.deepEqual(JSON.parse(kv.store.get("community:index")).map(e => [e.id, e.likes]), [["b", 1], ["d", 1]]);
  assert.deepEqual([...kv.store.keys()].sort(), ["community:index", "community:script:b", "community:script:d", "user:u10:categories", "user:u2:template:a.cfg"]);
});

test("idempotent: a second run takes nothing more off", async () => {
  const kv = seed();
  await deleteAccount({ SCRIPTFORGE_KV: kv }, "u1", "u1@x");
  const again = await deleteAccount({ SCRIPTFORGE_KV: kv }, "u1", "u1@x");
  assert.deepEqual(again, { keys: 0, community_unpublished: 0, likes_withdrawn: 0 });
  assert.equal(JSON.parse(kv.store.get("community:index"))[0].likes, 1);
});
