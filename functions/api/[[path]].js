// Sync API for Knit Row Tracker (Cloudflare Pages Function).
//
// Needs three settings on the Pages project:
//   DB             D1 database binding (patterns and projects)
//   FILES          KV namespace binding (pattern PDFs)
//   SYNC_PASSWORD  secret; the app sends it in the X-Sync-Key header
//
// Routes:
//   GET    /api/ping                 check the password
//   GET    /api/docs?since=<ms>      documents changed after a server time
//   POST   /api/docs  {docs: [...]}  store documents (the newer edit wins)
//   GET    /api/files/<id>           download a stored PDF
//   PUT    /api/files/<id>           upload a PDF
//   DELETE /api/files/<id>           remove a PDF

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function sameSecret(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

const KINDS = new Set(["patterns", "projects"]);
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

let tableReady = false;
async function ensureTable(db) {
  if (tableReady) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS docs (kind TEXT NOT NULL, id TEXT NOT NULL, t INTEGER NOT NULL, st INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, data TEXT, PRIMARY KEY (kind, id))"),
    db.prepare("CREATE INDEX IF NOT EXISTS docs_st ON docs (st)")
  ]);
  tableReady = true;
}

export async function onRequest({ request, env, params }) {
  if (!env.DB || !env.FILES || !env.SYNC_PASSWORD) {
    return json({ error: "not_configured", missing: ["DB", "FILES", "SYNC_PASSWORD"].filter((k) => !env[k]) }, 503);
  }
  if (!(await sameSecret(request.headers.get("x-sync-key") || "", env.SYNC_PASSWORD))) return json({ error: "wrong_password" }, 401);

  const parts = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const route = parts[0] || "";
  const method = request.method;

  if (route === "ping") return json({ ok: true });

  if (route === "docs") {
    await ensureTable(env.DB);

    if (method === "GET") {
      const since = Number(new URL(request.url).searchParams.get("since")) || 0;
      // step back a little so writes landing in the same instant are never skipped; re-sent docs are harmless
      const now = Date.now() - 2000;
      const { results } = await env.DB.prepare("SELECT kind, id, t, deleted, data FROM docs WHERE st > ?").bind(since).all();
      const docs = results.map((r) => ({ kind: r.kind, id: r.id, t: r.t, deleted: !!r.deleted, data: r.data ? JSON.parse(r.data) : null }));
      return json({ docs, now });
    }

    if (method === "POST") {
      let body;
      try { body = await request.json(); } catch (e) { return json({ error: "bad_json" }, 400); }
      const docs = (Array.isArray(body && body.docs) ? body.docs : []).filter((d) => d && KINDS.has(d.kind) && ID_RE.test(d.id || ""));
      if (!docs.length) return json({ ok: true, stored: 0 });
      const now = Date.now();
      const upsert = env.DB.prepare(
        "INSERT INTO docs (kind, id, t, st, deleted, data) VALUES (?1, ?2, ?3, ?4, ?5, ?6) " +
        "ON CONFLICT (kind, id) DO UPDATE SET t = excluded.t, st = excluded.st, deleted = excluded.deleted, data = excluded.data " +
        "WHERE excluded.t >= docs.t"
      );
      await env.DB.batch(docs.map((d) =>
        upsert.bind(d.kind, d.id, Number(d.t) || 0, now, d.deleted ? 1 : 0, d.deleted ? null : JSON.stringify(d.data || {}))
      ));
      return json({ ok: true, stored: docs.length });
    }
  }

  if (route === "files" && ID_RE.test(parts[1] || "")) {
    const name = "file:" + parts[1];
    if (method === "GET") {
      const buf = await env.FILES.get(name, "arrayBuffer");
      if (!buf) return json({ error: "not_found" }, 404);
      return new Response(buf, { headers: { "content-type": "application/pdf", "cache-control": "no-store" } });
    }
    if (method === "PUT") {
      const buf = await request.arrayBuffer();
      if (!buf.byteLength) return json({ error: "empty" }, 400);
      if (buf.byteLength > 25 * 1024 * 1024) return json({ error: "too_large" }, 413);
      await env.FILES.put(name, buf);
      return json({ ok: true });
    }
    if (method === "DELETE") {
      await env.FILES.delete(name);
      return json({ ok: true });
    }
  }

  return json({ error: "not_found" }, 404);
}
