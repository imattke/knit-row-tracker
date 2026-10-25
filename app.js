"use strict";

/* ============================================================
   Built-in pattern: the original 8-row repeat, in the same
   guide format Claude produces for PDF patterns.
   ============================================================ */
const BUILTIN_ROWS = [
  { side: "RS", steps: ["Knit until the first marker.", "m1R.", "Slip the first marker.", "Knit 1.", "Slip the next marker.", "m1L.", "Knit until 2 stitches remain.", "Knit 2in1.", "Knit 2in1."] },
  { side: "WS", steps: ["Knit until the first marker.", "Slip the first marker.", "Knit 1.", "Slip the next marker.", "Knit until 2 stitches remain.", "Knit 2in1.", "Knit 2in1."] },
  { side: "RS", steps: ["Knit until the first marker.", "Slip the first marker.", "Knit 1.", "Slip the next marker.", "Knit until 2 stitches remain.", "Knit 2in1.", "Knit 2in1."] },
  { side: "WS", steps: ["Knit until the first marker.", "Slip the first marker.", "Knit 1.", "Slip the next marker.", "Knit until 2 stitches remain.", "Knit 2in1.", "Knit 2in1."] },
  { side: "RS", steps: ["Knit until the first marker.", "Slip the first marker.", "Knit 1.", "Slip the next marker.", "Knit until 2 stitches remain.", "Knit 2in1.", "Knit 2in1."] },
  { side: "WS", steps: ["Knit 2.", "Work *knit 1, purl 1* until the first marker.", "Slip the first marker.", "Purl 1.", "Slip the next marker.", "Work *knit 1, purl 1* until 2 stitches remain.", "Knit 2in1.", "Knit 2in1."] },
  { side: "RS", steps: ["Knit 2.", "Work *purl 1, knit 1* until the first marker.", "m1R.", "Slip the first marker.", "Knit 1.", "Slip the next marker.", "m1L.", "Work *purl 1, knit 1* until 2 stitches remain.", "Knit 2in1.", "Knit 2in1."] },
  { side: "WS", steps: ["Knit 2.", "Work *knit 1, purl 1* until the first marker.", "Slip the first marker.", "Purl 1.", "Slip the next marker.", "Work *purl 1, knit 1* until 2 stitches remain.", "Knit 2in1.", "Knit 2in1."] }
];
const BUILTIN_GUIDE = {
  title: "8-row repeat",
  overview: "",
  sections: [{
    title: "8-row repeat",
    repeat_type: "until",
    repeat_times: 0,
    repeat_until: "the piece is the size you want",
    rows: BUILTIN_ROWS.map((r, i) => ({ label: "Row " + (i + 1), side: r.side, steps: r.steps }))
  }],
  techniques: [
    { term: "m1R", name: "Right leaning increase (m1R)", how: "From the right side of the work, insert the left needle under the thread between two stitches from behind and knit it." },
    { term: "m1L", name: "Left leaning increase (m1L)", how: "From the right side of the work, insert the left needle under the thread between two stitches from the front and knit through the back loop." },
    { term: "Knit 2in1", name: "Knit 2in1", how: "Knit 1 stitch without letting the stitch off your left needle. Then, in the same stitch, knit 1 stitch through the back loop. Let the stitch off the needle." }
  ]
};
const BUILTIN_ID = "pat-8row";

/* ============================================================
   Helpers
   ============================================================ */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const newId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = (n) => String(n).padStart(2, "0");
const isoDate = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const today = () => isoDate(new Date());
function fmtDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
const fmtSize = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
const reRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

/* tap once to arm, again within 3 s to confirm */
function armed(btn, action) {
  const label = btn.textContent;
  let on = false, timer;
  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    if (!on) {
      on = true; btn.textContent = "Tap again to confirm";
      timer = setTimeout(() => { on = false; btn.textContent = label; }, 3000);
      return;
    }
    clearTimeout(timer); on = false; btn.textContent = label;
    action();
  });
}

/* ============================================================
   Storage: IndexedDB on this device
   ============================================================ */
const DB = (() => {
  let opening;
  const open = () => opening || (opening = new Promise((res, rej) => {
    const r = indexedDB.open("knit-row-tracker", 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      ["patterns", "projects", "files"].forEach((s) => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: "id" }); });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  async function run(store, mode, fn) {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => res(req ? req.result : undefined);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }
  return {
    all: (s) => run(s, "readonly", (st) => st.getAll()),
    get: (s, id) => run(s, "readonly", (st) => st.get(id)),
    put: (s, v) => run(s, "readwrite", (st) => st.put(v)),
    del: (s, id) => run(s, "readwrite", (st) => st.delete(id))
  };
})();

const S = { patterns: {}, projects: {} };
// opts.keepT keeps the object's own timestamp; opts.local skips syncing
function save(kind, obj, opts) {
  opts = opts || {};
  if (!opts.keepT) obj.t = Date.now();
  S[kind][obj.id] = obj;
  DB.put(kind, JSON.parse(JSON.stringify(obj))).catch((e) => toast("Couldn't save: " + (e && e.message ? e.message : "storage error")));
  if (!opts.local) Sync.mark(kind, obj.id, false);
}
function remove(kind, id) {
  delete S[kind][id];
  DB.del(kind, id).catch(() => {});
  Sync.mark(kind, id, true);
}

/* ============================================================
   Sync between devices through the Cloudflare /api functions
   ============================================================ */
const Sync = {
  state: "off", code: "", timer: null, running: false, again: false,
  pass() { return lsGet("knit-sync-pass") || ""; },
  readMap(k) { try { return JSON.parse(lsGet(k) || "{}"); } catch (e) { return {}; } },
  dirty() { return this.readMap("knit-dirty"); },
  dirtyFiles() { return this.readMap("knit-dirty-files"); },
  mark(kind, id, deleted) {
    const d = this.dirty();
    d[kind + ":" + id] = { deleted: !!deleted, t: Date.now() };
    lsSet("knit-dirty", JSON.stringify(d));
    this.soon();
  },
  markFile(id) {
    const f = this.dirtyFiles();
    f[id] = 1;
    lsSet("knit-dirty-files", JSON.stringify(f));
    this.soon();
  },
  markAll() {
    Object.values(S.patterns).forEach((p) => { if (p.t !== 1) this.mark("patterns", p.id, false); });
    Object.values(S.projects).forEach((p) => { if (p.t !== 1) this.mark("projects", p.id, false); });
  },
  soon(ms) {
    if (!this.pass()) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.run(), ms == null ? 2000 : ms);
  },
  async api(path, opts, pass) {
    opts = opts || {};
    const res = await fetch("api/" + path, { ...opts, cache: "no-store", headers: { ...(opts.headers || {}), "x-sync-key": pass || this.pass() } });
    if (!res.ok) {
      let body = {};
      try { body = await res.json(); } catch (e) {}
      const err = new Error(body.error || "HTTP " + res.status);
      err.status = res.status; err.code = body.error || ""; err.missing = body.missing;
      throw err;
    }
    return res;
  },
  set(state, code) { this.state = state; this.code = code || ""; renderSyncState(); },
  async run() {
    if (!this.pass()) { this.set("off"); return; }
    if (this.running) { this.again = true; return; }
    this.running = true;
    clearTimeout(this.timer);
    this.set("syncing");
    try {
      if (!lsGet("knit-synced-once")) {
        await this.pull(true);
        this.markAll();
        const files = await DB.all("files");
        files.forEach((f) => this.markFile(f.id));
        clearTimeout(this.timer);
      }
      await this.push();
      await this.pull(false);
      lsSet("knit-synced-once", "1");
      this.set("ok");
    } catch (e) {
      this.set(e && e.status ? "error" : "offline", e && e.code);
    } finally {
      this.running = false;
      if (this.again) { this.again = false; this.soon(300); }
    }
  },
  async push() {
    const d = this.dirty(), keys = Object.keys(d);
    if (keys.length) {
      const docs = keys.map((k) => {
        const i = k.indexOf(":"), kind = k.slice(0, i), id = k.slice(i + 1);
        const obj = S[kind] && S[kind][id];
        return d[k].deleted || !obj ? { kind, id, t: d[k].t, deleted: true } : { kind, id, t: obj.t || 0, data: obj };
      });
      await this.api("docs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ docs }) });
      const later = this.dirty();
      keys.forEach((k) => { if (later[k] && later[k].t === d[k].t) delete later[k]; });
      lsSet("knit-dirty", JSON.stringify(later));
    }
    for (const id of Object.keys(this.dirtyFiles())) {
      const f = await DB.get("files", id);
      if (f) {
        const base = "files/" + encodeURIComponent(id) + "/";
        const n = Math.max(1, Math.ceil(f.data.byteLength / FILE_PART));
        for (let i = 0; i < n; i++) {
          await this.api(base + i, { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: f.data.slice(i * FILE_PART, (i + 1) * FILE_PART) });
        }
        // the piece count goes last, so a device never sees a half-uploaded file
        await this.api(base + "meta", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ parts: n, size: f.data.byteLength }) });
      }
      const later = this.dirtyFiles();
      delete later[id];
      lsSet("knit-dirty-files", JSON.stringify(later));
    }
  },
  async pull(full) {
    const since = full ? 0 : Number(lsGet("knit-pulled")) || 0;
    const res = await this.api("docs?since=" + since);
    const { docs, now } = await res.json();
    let changed = false;
    for (const d of docs) {
      if (!S[d.kind]) continue;
      const local = S[d.kind][d.id];
      if (d.deleted) {
        if (local && (local.t || 0) <= d.t) { delete S[d.kind][d.id]; await DB.del(d.kind, d.id); changed = true; }
      } else if (d.data && (!local || (d.data.t || 0) > (local.t || 0))) {
        if (reading[d.id]) continue; // this device is mid-read; its result will win
        S[d.kind][d.id] = d.data;
        await DB.put(d.kind, d.data);
        changed = true;
      }
    }
    if (full) {
      // first connection on a device that already has data elsewhere: drop the untouched starter project
      const seed = S.projects["prj-first"];
      if (seed && seed.t === 1 && docs.some((d) => d.kind === "projects" && !d.deleted && d.id !== "prj-first")) {
        delete S.projects["prj-first"]; await DB.del("projects", "prj-first"); changed = true;
      }
    }
    lsSet("knit-pulled", String(now));
    if (changed) onRemoteChange();
  }
};

const FILE_PART = 20 * 1048576;

// a PDF from this device, or downloaded from your account the first time it's needed
async function getFile(id) {
  let f = await DB.get("files", id);
  if (!f && Sync.pass()) {
    const base = "files/" + encodeURIComponent(id);
    const meta = await (await Sync.api(base + "/meta")).json();
    let data;
    if (!meta.parts) data = await (await Sync.api(base)).arrayBuffer();
    else {
      const pieces = [];
      for (let i = 0; i < meta.parts; i++) pieces.push(new Uint8Array(await (await Sync.api(base + "/" + i)).arrayBuffer()));
      const out = new Uint8Array(pieces.reduce((s, p) => s + p.length, 0));
      let at = 0;
      pieces.forEach((p) => { out.set(p, at); at += p.length; });
      data = out.buffer;
    }
    f = { id, type: "application/pdf", data };
    await DB.put("files", f);
  }
  if (!f) throw new Error(Sync.pass() ? "The PDF for this pattern isn’t on this device or in your account." : "The PDF for this pattern isn’t on this device. Turn on sync in Settings to get it from your other devices.");
  return f;
}

function onRemoteChange() {
  if (view.name === "project") {
    if (!S.projects[view.id]) return goHome("projects");
    rerenderProject();
  } else if (view.name === "pattern") {
    if (!S.patterns[view.id]) return goHome("patterns");
    renderPatternBody();
  } else if (view.name === "home") renderHome();
}

function renderSyncState() {
  const el = $("syncState");
  if (!el) return;
  const map = {
    off: "",
    syncing: "Syncing…",
    ok: "Synced",
    offline: "Offline · saved here",
    error: Sync.code === "wrong_password" ? "Sync password wrong" : Sync.code === "not_configured" ? "Sync not set up" : "Sync problem"
  };
  el.textContent = map[Sync.state] || "";
  el.className = "syncstate" + (Sync.state === "error" ? " warn" : "");
  if (view.name === "settings") renderSyncSettings();
}

async function loadAll() {
  const [pats, prjs] = await Promise.all([DB.all("patterns"), DB.all("projects")]);
  pats.forEach((p) => { S.patterns[p.id] = p; });
  prjs.forEach((p) => { S.projects[p.id] = p; });
  // a read that was running when the app closed can't resume
  Object.values(S.patterns).forEach((p) => {
    if (p.guideStatus === "reading") { p.guideStatus = "error"; p.guideError = "Reading stopped because the app was closed. Tap Read pattern to try again."; save("patterns", p, { keepT: true, local: true }); }
  });
  if (!lsGet("knit-setup-v1")) {
    // starter records carry the oldest possible time so any real edit from another device wins
    if (!S.patterns[BUILTIN_ID]) save("patterns", { id: BUILTIN_ID, kind: "builtin", name: "8-row repeat", createdAt: 0, t: 1 }, { keepT: true, local: true });
    if (!Object.keys(S.projects).length) {
      // carries over the place from the earlier Claude-hosted tracker
      save("projects", {
        id: "prj-first", name: "My first project", patternId: BUILTIN_ID, started: today(),
        yarn: "", gauge: "", notes: "", status: "active",
        progress: { sec: 0, row: 6, rep: 2 }, createdAt: Date.now(), t: 1
      }, { keepT: true, local: true });
    }
    lsSet("knit-setup-v1", "1");
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

/* ============================================================
   Guide model helpers
   ============================================================ */
function guideOf(pat) {
  if (!pat) return null;
  if (pat.kind === "builtin") return BUILTIN_GUIDE;
  return pat.guideStatus === "ready" && pat.guide && pat.guide.sections && pat.guide.sections.length ? pat.guide : null;
}
function cleanPos(g, pr) {
  if (typeof pr.sec !== "number" || pr.sec < 0 || pr.sec >= g.sections.length) pr.sec = 0;
  const s = g.sections[pr.sec];
  if (typeof pr.row !== "number" || pr.row < 0 || pr.row >= s.rows.length) pr.row = 0;
  if (typeof pr.rep !== "number" || pr.rep < 1) pr.rep = 1;
  if (s.repeat_type === "times" && s.repeat_times > 0 && pr.rep > s.repeat_times) pr.rep = s.repeat_times;
  if (!pr.reps) pr.reps = {};
}
function timesOf(s) { return s.repeat_type === "times" && s.repeat_times > 0 ? s.repeat_times : 1; }
function overallRow(g, pr) {
  let n = 0;
  for (let i = 0; i < pr.sec; i++) {
    const s = g.sections[i];
    const reps = s.repeat_type === "until" ? (pr.reps && pr.reps[i]) || 1 : timesOf(s);
    n += s.rows.length * reps;
  }
  return n + (pr.rep - 1) * g.sections[pr.sec].rows.length + pr.row + 1;
}
function guideAdvance(g, pr) {
  const s = g.sections[pr.sec];
  if (pr.row < s.rows.length - 1) { pr.row++; return; }
  if (s.repeat_type === "until" || (s.repeat_type === "times" && pr.rep < timesOf(s))) { pr.row = 0; pr.rep++; return; }
  if (pr.sec < g.sections.length - 1) { pr.reps[pr.sec] = pr.rep; pr.sec++; pr.row = 0; pr.rep = 1; return; }
  pr.done = true;
}
function guideMoveOn(g, pr) {
  if (pr.sec >= g.sections.length - 1) { pr.done = true; return; }
  pr.reps[pr.sec] = pr.rep;
  pr.sec++; pr.row = 0; pr.rep = 1;
}
function guideBack(g, pr) {
  if (pr.done) { pr.done = false; return true; }
  if (pr.row > 0) { pr.row--; return true; }
  if (pr.rep > 1) { pr.rep--; pr.row = g.sections[pr.sec].rows.length - 1; return true; }
  if (pr.sec > 0) {
    pr.sec--;
    const s = g.sections[pr.sec];
    pr.rep = s.repeat_type === "until" ? (pr.reps[pr.sec] || 1) : timesOf(s);
    pr.row = s.rows.length - 1;
    return true;
  }
  return false;
}
function canBack(pr) { return pr.done || pr.row > 0 || pr.rep > 1 || pr.sec > 0; }

function fmtStep(text, techniques) {
  let h = esc(text);
  h = h.replace(/\*(.+?)\*/g, '<span class="rep">$1</span>');
  const terms = (techniques || []).map((t) => t.term).filter((t) => t && t.length > 1).sort((a, b) => b.length - a.length);
  if (terms.length) {
    const re = new RegExp("(^|[^A-Za-z0-9])(" + terms.map((t) => reRegex(esc(t))).join("|") + ")(?![A-Za-z0-9])", "g");
    h = h.replace(re, '$1<strong class="termname">$2</strong>');
  }
  return h;
}
function techsInRow(row, techniques) {
  const text = row.steps.join(" ");
  return (techniques || []).filter((t) => t.term && new RegExp("(^|[^A-Za-z0-9])" + reRegex(t.term) + "(?![A-Za-z0-9])").test(text));
}
function sideLabel(side) { return side === "RS" ? "Right side" : side === "WS" ? "Wrong side" : ""; }
function repeatText(s) {
  if (s.repeat_type === "times" && s.repeat_times > 1) return "Work " + s.rows.length + (s.rows.length === 1 ? " row" : " rows") + " " + s.repeat_times + " times";
  if (s.repeat_type === "until") return "Repeat until " + s.repeat_until.replace(/^until\s+/i, "");
  return "";
}

/* ============================================================
   Views
   ============================================================ */
const view = { name: "home", tab: "projects", id: null, sub: "steps" };

function show(name) {
  ["Home", "Project", "Pattern", "Settings"].forEach((n) => { $("v" + n).hidden = name !== n.toLowerCase(); });
  $("dock").hidden = name !== "project";
  keepAwake(name === "project");
}

function refresh() {
  if (view.name === "home") renderHome();
  else if (view.name === "project") {
    if (!S.projects[view.id]) return goHome("projects");
    renderProjectInfo(); renderTracker(false);
  } else if (view.name === "pattern") {
    if (!S.patterns[view.id]) return goHome("patterns");
    renderPatternInfo();
  }
}

function goHome(tab) {
  destroyViewers();
  view.name = "home"; view.tab = tab || view.tab; view.id = null;
  lsSet("knit-last", null);
  $("app").classList.remove("wide");
  show("home");
  renderHome();
  window.scrollTo(0, 0);
}

/* ---------------- home ---------------- */
const projectsSorted = () => Object.values(S.projects).sort((a, b) => {
  const fa = a.status === "finished" ? 1 : 0, fb = b.status === "finished" ? 1 : 0;
  return fa !== fb ? fa - fb : (b.t || 0) - (a.t || 0);
});
const patternsSorted = () => Object.values(S.patterns).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
const usesOf = (patId) => Object.values(S.projects).filter((p) => p.patternId === patId).length;

function patternStatus(p) {
  if (p.kind === "builtin") return { text: "Row-by-row steps", cls: "ok" };
  if (reading[p.id]) return { text: "Reading pattern…", cls: "" };
  if (p.guideStatus === "ready") return { text: "Row-by-row steps", cls: "ok" };
  if (p.guideStatus === "error") return { text: "Couldn't read", cls: "warn" };
  return { text: "PDF only", cls: "plain" };
}
function progressLabel(prj) {
  const pat = S.patterns[prj.patternId], g = guideOf(pat), pr = prj.progress || {};
  if (g) {
    cleanPos(g, pr);
    if (pr.done) return "Pattern complete";
    const s = g.sections[pr.sec];
    return (g.sections.length > 1 ? s.title + " · " : "") + "Row " + (pr.row + 1) + " of " + s.rows.length + (pr.rep > 1 || s.repeat_type !== "once" ? " · repeat " + pr.rep : "");
  }
  const count = pr.count || 0, L = prj.repeatLen || 0;
  return "Row " + (count + 1) + (L ? " · repeat " + (Math.floor(count / L) + 1) : "");
}
function patternMeta(p) {
  const n = usesOf(p.id);
  const bits = [p.kind === "builtin" ? "Built in" : "PDF" + (p.pages ? " · " + p.pages + (p.pages === 1 ? " page" : " pages") : "")];
  if (p.size) bits.push(fmtSize(p.size));
  bits.push(n ? n + (n === 1 ? " project" : " projects") : "no projects yet");
  return bits.join(" · ");
}

function renderHome() {
  const tab = view.tab;
  $("tabProjects").setAttribute("aria-selected", tab === "projects");
  $("tabPatterns").setAttribute("aria-selected", tab === "patterns");
  $("pProjects").hidden = tab !== "projects";
  $("pPatterns").hidden = tab !== "patterns";
  const projs = projectsSorted(), pats = patternsSorted();
  $("nProjects").textContent = projs.length ? "(" + projs.length + ")" : "";
  $("nPatterns").textContent = pats.length ? "(" + pats.length + ")" : "";

  if (!projs.length) {
    $("projectList").innerHTML = '<div class="empty"><b>No projects yet</b><span>Pick a pattern and tap Start project. Your projects and the row you’re on will show up here.</span><button type="button" class="btn primary" data-go="patterns">Choose a pattern</button></div>';
  } else {
    const card = (p) => {
      const pat = S.patterns[p.patternId];
      let chips = p.status === "finished" ? '<span class="chip ok">Finished</span>' : '<span class="chip row">' + esc(progressLabel(p)) + "</span>";
      if (p.yarn) chips += '<span class="chip">' + esc(p.yarn.length > 28 ? p.yarn.slice(0, 27) + "…" : p.yarn) + "</span>";
      return '<li><button type="button" class="item" data-open="' + esc(p.id) + '"><div><p class="item-name">' + esc(p.name || "Untitled project") + '</p><p class="item-meta">' +
        esc(pat ? pat.name : "Pattern removed") + (p.started ? " · started " + esc(fmtDate(p.started)) : "") + '</p></div><div class="chips">' + chips + "</div></button></li>";
    };
    const active = projs.filter((p) => p.status !== "finished"), done = projs.filter((p) => p.status === "finished");
    let h = '<ul class="list">' + active.map(card).join("") + "</ul>";
    if (done.length) h += '<p class="section-label">Finished</p><ul class="list">' + done.map(card).join("") + "</ul>";
    $("projectList").innerHTML = h;
  }

  $("addNote").className = "hint";
  $("addNote").textContent = getKey() ? "Claude will read each PDF and turn it into row-by-row steps." : "Add your Anthropic API key in Settings and Claude will turn each PDF into row-by-row steps.";
  $("patternList").innerHTML = '<ul class="list">' + pats.map((p) => {
    const st = patternStatus(p);
    return '<li class="item"><div><p class="item-name">' + esc(p.name) + '</p><p class="item-meta">' + esc(patternMeta(p)) + '</p></div><div class="chips"><span class="chip ' + st.cls + '">' + esc(st.text) + "</span></div>" +
      '<div class="item-actions"><button type="button" class="btn primary" data-start="' + esc(p.id) + '">Start project</button><button type="button" class="btn" data-view="' + esc(p.id) + '">Open</button></div></li>';
  }).join("") + "</ul>";
}

$("tabProjects").addEventListener("click", () => { view.tab = "projects"; renderHome(); });
$("tabPatterns").addEventListener("click", () => { view.tab = "patterns"; renderHome(); });
$("vHome").addEventListener("click", (e) => {
  const b = e.target.closest("[data-open],[data-start],[data-view],[data-go]");
  if (!b) return;
  if (b.dataset.open) openProject(b.dataset.open);
  else if (b.dataset.start) startProjectSheet(b.dataset.start);
  else if (b.dataset.view) openPattern(b.dataset.view);
  else if (b.dataset.go) { view.tab = b.dataset.go; renderHome(); }
});

/* ---------------- sheet ---------------- */
let sheetCfg = null;
function openSheet(cfg) {
  sheetCfg = cfg;
  let h = "<h2>" + esc(cfg.title) + "</h2>";
  if (cfg.from) h += '<p class="from">' + esc(cfg.from) + "</p>";
  cfg.fields.forEach((f) => {
    const id = "f_" + f.name;
    h += '<label class="field" for="' + id + '">' + esc(f.label);
    if (f.type === "textarea") h += '<textarea id="' + id + '" rows="4" placeholder="' + esc(f.placeholder || "") + '">' + esc(f.value || "") + "</textarea>";
    else h += '<input id="' + id + '" type="' + (f.type || "text") + '" value="' + esc(f.value || "") + '" placeholder="' + esc(f.placeholder || "") + '" autocomplete="off">';
    h += "</label>";
  });
  h += '<p class="err" id="sheetErr" hidden></p><div class="actions"><button type="button" class="btn" id="sheetCancel">Cancel</button><button type="submit" class="btn primary" id="sheetOk">' + esc(cfg.submit) + "</button></div>";
  $("sheet").innerHTML = h;
  $("scrim").hidden = false;
  $("sheetCancel").addEventListener("click", closeSheet);
}
function closeSheet() { $("scrim").hidden = true; $("sheet").innerHTML = ""; sheetCfg = null; }
$("scrim").addEventListener("click", (e) => { if (e.target === $("scrim") && !($("sheetOk") && $("sheetOk").disabled)) closeSheet(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("scrim").hidden) closeSheet(); });
$("sheet").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!sheetCfg) return;
  const vals = {};
  sheetCfg.fields.forEach((f) => { vals[f.name] = $("f_" + f.name).value.trim(); });
  const err = $("sheetErr"), ok = $("sheetOk"), label = ok.textContent;
  err.hidden = true;
  let res;
  try { res = sheetCfg.onSubmit(vals); } catch (x) { err.textContent = x.message; err.hidden = false; return; }
  if (res && res.then) {
    ok.disabled = true; $("sheetCancel").disabled = true; ok.textContent = sheetCfg.busy || "Saving…";
    res.then(closeSheet, (x) => {
      ok.disabled = false; $("sheetCancel").disabled = false; ok.textContent = label;
      err.textContent = x && x.message ? x.message : "That didn’t work. Try again."; err.hidden = false;
    });
  } else closeSheet();
});

function detailFields(p) {
  return [
    { name: "name", label: "Project name", value: p.name },
    { name: "started", label: "Started", type: "date", value: p.started },
    { name: "yarn", label: "Yarn", value: p.yarn, placeholder: "e.g. Drops Alpaca, 3 skeins, colour 6834" },
    { name: "gauge", label: "Gauge", value: p.gauge, placeholder: "e.g. 22 sts × 30 rows = 10 cm on 4 mm" },
    { name: "notes", label: "Notes", type: "textarea", value: p.notes, placeholder: "Needles, the size you’re making, changes to the pattern…" }
  ];
}
function startProjectSheet(patId) {
  const pat = S.patterns[patId];
  if (!pat) return;
  openSheet({
    title: "Start a project", from: "Pattern: " + pat.name, submit: "Add to projects",
    fields: detailFields({ name: pat.name, started: today() }),
    onSubmit: (v) => {
      if (!v.name) throw new Error("Give the project a name.");
      save("projects", {
        id: newId("prj-"), name: v.name, patternId: patId, started: v.started || today(),
        yarn: v.yarn, gauge: v.gauge, notes: v.notes, status: "active",
        progress: { sec: 0, row: 0, rep: 1, count: 0 }, repeatLen: 0, page: 1, zoom: 1, createdAt: Date.now()
      });
      goHome("projects");
      toast("Added to your projects");
    }
  });
}

/* ---------------- add PDF ---------------- */
$("addPdf").addEventListener("click", () => $("pdfInput").click());
$("pdfInput").addEventListener("change", function () {
  const file = this.files && this.files[0];
  this.value = "";
  if (!file) return;
  const note = $("addNote");
  if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) { note.className = "hint warn"; note.textContent = "That file isn’t a PDF. Choose a .pdf pattern file."; return; }
  if (file.size > 150 * 1048576) { note.className = "hint warn"; note.textContent = "That PDF is " + fmtSize(file.size) + ". The limit is 150 MB."; return; }
  openSheet({
    title: "Add a PDF pattern", from: file.name + " · " + fmtSize(file.size), submit: "Add pattern", busy: "Adding…",
    fields: [{ name: "name", label: "Pattern name", value: file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() }],
    onSubmit: (v) => {
      if (!v.name) throw new Error("Give the pattern a name.");
      return (async () => {
        const buf = await file.arrayBuffer();
        let pages = 0;
        try {
          const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)), isEvalSupported: false }).promise;
          pages = doc.numPages;
          doc.destroy();
        } catch (e) {
          if (e && e.name === "PasswordException") throw new Error("This PDF is password protected. Remove the password and try again.");
          throw new Error("This file couldn’t be opened as a PDF.");
        }
        const fileId = newId("file-");
        await DB.put("files", { id: fileId, type: "application/pdf", data: buf });
        Sync.markFile(fileId);
        const pat = { id: newId("pat-"), kind: "pdf", name: v.name, fileId, fileName: file.name, size: file.size, pages, createdAt: Date.now(), guideStatus: "none" };
        save("patterns", pat);
        view.tab = "patterns";
        renderHome();
        if (getKey()) readPattern(pat.id);
      })();
    }
  });
});

/* ============================================================
   Claude: read a PDF into row-by-row steps
   ============================================================ */
const KEY_NAME = "knit-anthropic-key";
const getKey = () => lsGet(KEY_NAME) || "";
const reading = {};

const GUIDE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "overview", "sections", "techniques"],
  properties: {
    title: { type: "string" },
    overview: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "repeat_type", "repeat_times", "repeat_until", "rows"],
        properties: {
          title: { type: "string" },
          repeat_type: { type: "string", enum: ["once", "times", "until"] },
          repeat_times: { type: "integer" },
          repeat_until: { type: "string" },
          rows: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "side", "steps"],
              properties: {
                label: { type: "string" },
                side: { type: "string", enum: ["RS", "WS", ""] },
                steps: { type: "array", items: { type: "string" } }
              }
            }
          }
        }
      }
    },
    techniques: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["term", "name", "how"],
        properties: { term: { type: "string" }, name: { type: "string" }, how: { type: "string" } }
      }
    }
  }
};

const SYSTEM_PROMPT = `You convert a knitting or crochet pattern into a row-by-row guide for a phone app. The knitter works one entry at a time and taps "row finished" after each, so the guide must follow the pattern from cast-on to finishing, in the order the knitter works it.

How to structure it:
- sections: the pattern's parts in order (cast on, set-up, body, shaping, edging, finishing, and so on). Use the pattern's own section names.
- rows: one entry per row or round the knitter works. A step that covers many rows without row-by-row instructions, such as "Work in pattern until the piece measures 30 cm from cast-on", is a single entry. Cast-on, bind-off, picking up stitches and finishing steps are entries too.
- Repeats: when the pattern says to repeat a group of rows a set number of times, put that group in its own section with repeat_type "times" and repeat_times as the total number of times it is worked. When it says to repeat until a length or other condition, use repeat_type "until" and copy the condition into repeat_until (for example "the piece measures 40 cm from cast-on"). Runs of identical rows ("Rows 2-10: knit") become a one-row section repeated that many times. Otherwise use repeat_type "once", repeat_times 1 and repeat_until "".
- label: the pattern's own name for the row ("Row 5", "Rnd 12", "Set-up row", "Cast on"), so the knitter can find it in the PDF.
- side: "RS" or "WS" when knitting flat and the side is known; "" for rounds or when unknown.
- steps: the row split into short, ordered instructions in plain English. Spell out common abbreviations (k2tog becomes "knit 2 together"), but keep the pattern's abbreviation for special techniques (such as "m1L", "ssk", "kfb", "sl1 wyif") so each can link to its explanation. Wrap a repeated stitch sequence in asterisks, like "Work *knit 1, purl 1* until 2 stitches remain." Include stitch counts the pattern gives at the end of a row.
- Sizes: if the pattern has several sizes, keep every size's number exactly as written, for example "Cast on 96 (104, 112) stitches."
- Charts: transcribe chart rows into steps when you can read them; otherwise write one step such as "Work row 3 of Chart A."
- techniques: every special stitch, abbreviation or method the steps use. term is the exact text used in the steps, name is its full name, and how is a short explanation of how to work it, taken from the pattern's glossary when it has one.
- overview: a few short lines covering yarn, needles, gauge and sizes as the pattern states them.
- title: the pattern's name.

Never add rows the pattern doesn't contain, and don't skip any.`;

// Claude takes at most 32 MB per request and base64 adds a third, so bigger PDFs go as page images plus page text
const DIRECT_PDF_LIMIT = 23 * 1048576;
const IMAGE_BUDGET = 27 * 1048576;

async function patternContent(fileId, onStatus) {
  const f = await getFile(fileId);
  if (f.data.byteLength <= DIRECT_PDF_LIMIT) {
    const data = await bufToB64(f.data);
    return [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data } },
      { type: "text", text: "Turn this pattern into the row-by-row guide." }
    ];
  }
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(f.data.slice(0)), isEvalSupported: false }).promise;
  try {
    if (doc.numPages > 100) throw new Error("This PDF has " + doc.numPages + " pages. Claude can read up to 100 pages of a large PDF at once.");
    // page text is the same at every image size, so read it once
    const texts = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const tc = await (await doc.getPage(i)).getTextContent();
      texts.push(tc.items.map((it) => (it.str || "") + (it.hasEOL ? "\n" : " ")).join("").replace(/[ \t]+\n/g, "\n").trim());
    }
    for (const [maxSide, quality] of [[1568, 0.72], [1280, 0.6], [1000, 0.5]]) {
      const blocks = [];
      let total = 0;
      for (let i = 1; i <= doc.numPages; i++) {
        onStatus("Preparing page " + i + " of " + doc.numPages + "…");
        const page = await doc.getPage(i);
        const vp1 = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: maxSide / Math.max(vp1.width, vp1.height) });
        const c = document.createElement("canvas");
        c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const jpeg = c.toDataURL("image/jpeg", quality).split(",")[1];
        c.width = 0; c.height = 0;
        const text = texts[i - 1];
        blocks.push({ type: "text", text: "Page " + i + (text ? " text:\n" + text : " (no text layer; read it from the image)") });
        blocks.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg } });
        total += jpeg.length + text.length;
        if (total > IMAGE_BUDGET) break;
      }
      if (total <= IMAGE_BUDGET) {
        blocks.push({ type: "text", text: "The pattern PDF was too large to attach, so each page is given as an image together with the text extracted from it. Use the text for exact wording and numbers, and the images for charts, schematics and layout. Turn this pattern into the row-by-row guide." });
        return blocks;
      }
    }
    throw new Error("This PDF is too large to send to Claude, even after shrinking its pages.");
  } finally {
    doc.destroy();
  }
}

async function readPattern(patId) {
  const pat = S.patterns[patId];
  const key = getKey();
  if (!pat || pat.kind !== "pdf" || reading[patId]) return;
  if (!key) { toast("Add your API key in Settings first."); return; }
  reading[patId] = { chars: 0 };
  pat.guideStatus = "reading"; pat.guideError = "";
  save("patterns", pat);
  refresh();
  try {
    const { Anthropic } = await import("./vendor/anthropic-sdk.mjs");
    const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 2 });
    const content = await patternContent(pat.fileId, (msg) => { reading[patId].msg = msg; updateReadProgress(patId); });
    reading[patId].msg = "Claude is reading the pattern…";
    updateReadProgress(patId);
    const body = {
      model: "claude-opus-5-5",
      max_tokens: 64000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: { type: "json_schema", schema: GUIDE_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }]
    };
    let message;
    const runStream = async (req) => {
      const stream = client.beta.messages.stream(req);
      stream.on("text", (delta) => {
        reading[patId].chars += delta.length;
        updateReadProgress(patId);
      });
      return stream.finalMessage();
    };
    try {
      message = await runStream({ ...body, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
    } catch (e) {
      // if the fallback option isn't accepted, retry once without it
      if (e && e.status === 400 && /fallback/i.test(String(e.message))) { reading[patId].chars = 0; message = await runStream(body); }
      else throw e;
    }
    if (message.stop_reason === "refusal") throw new Error("Claude declined to read this pattern.");
    if (message.stop_reason === "max_tokens") throw new Error("This pattern is too long to read in one go.");
    const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const guide = JSON.parse(text);
    guide.sections = (guide.sections || []).filter((s) => s.rows && s.rows.length);
    if (!guide.sections.length) throw new Error("Claude couldn’t find any rows in this PDF.");
    guide.sections.forEach((s) => {
      if (s.repeat_type === "times" && !(s.repeat_times > 1)) s.repeat_type = "once";
      s.rows.forEach((r) => { if (!r.steps || !r.steps.length) r.steps = [r.label || "Work this row."]; });
    });
    pat.guide = guide;
    pat.guideStatus = "ready";
    pat.readAt = Date.now();
    save("patterns", pat);
    toast("“" + pat.name + "” is ready as row-by-row steps");
  } catch (e) {
    pat.guideStatus = "error";
    pat.guideError = explainError(e);
    save("patterns", pat);
  } finally {
    delete reading[patId];
    refresh();
    if (view.name === "pattern" && view.id === patId) renderPatternBody();
    if (view.name === "project") rerenderProject();
  }
}
function explainError(e) {
  const st = e && e.status;
  if (st === 401) return "Your API key wasn’t accepted. Check it in Settings.";
  if (st === 403) return "Your API key doesn’t have permission to use this model.";
  if (st === 429) return "Too many requests right now. Wait a minute and try again.";
  if (st === 413) return "This pattern was too large to send to Claude in one request.";
  if (st && st >= 500) return "Anthropic’s service had a problem. Try again in a moment.";
  if (e instanceof SyntaxError) return "Claude’s answer couldn’t be understood. Try reading the pattern again.";
  if (e && /fetch|network|Load failed/i.test(String(e.message))) return "Couldn’t reach Anthropic. Check your connection and keep the app open while it reads.";
  return (e && e.message) || "Something went wrong while reading the pattern.";
}
function updateReadProgress(patId) {
  const el = document.querySelector('[data-progress="' + patId + '"]');
  if (!el) return;
  const r = reading[patId];
  el.textContent = r.chars ? "Writing steps… " + r.chars.toLocaleString() + " characters so far. Keep the app open." : (r.msg || "Sending the PDF…") + " Keep the app open.";
}

/* ============================================================
   Project screen
   ============================================================ */
const cur = () => S.projects[view.id];
const curPattern = () => { const p = cur(); return p && S.patterns[p.patternId]; };

function openProject(id) {
  const prj = S.projects[id];
  if (!prj) return;
  destroyViewers();
  view.name = "project"; view.id = id;
  view.sub = lsGet("knit-sub-" + id) || "steps";
  lsSet("knit-last", id);
  $("place").hidden = true;
  $("details").open = false;
  show("project");
  rerenderProject();
  window.scrollTo(0, 0);
}
function rerenderProject() {
  const prj = cur(), pat = curPattern();
  if (!prj) return;
  const g = guideOf(pat), hasPdf = pat && pat.kind === "pdf";
  if (!g) view.sub = "pdf";
  else if (!hasPdf) view.sub = "steps";
  $("projTabs").hidden = !(g && hasPdf);
  $("tabSteps").setAttribute("aria-selected", view.sub === "steps");
  $("tabPdf").setAttribute("aria-selected", view.sub === "pdf");
  const showPdf = hasPdf && view.sub === "pdf";
  // the tracker stays visible with a PDF that has no steps yet (row counter)
  $("trackerWrap").hidden = !!(g && showPdf);
  $("app").classList.toggle("wide", showPdf);
  renderProjectInfo();
  renderTracker(false);
  const host = $("projPdf");
  if (showPdf) {
    host.hidden = false;
    if (!viewers.proj) viewers.proj = mountPdf(host, pat, {
      startPage: prj.page || 1, zoom: prj.zoom || 1,
      onPage: (n) => { const p = cur(); if (p && p.page !== n) { p.page = n; save("projects", p); } },
      onZoom: (z) => { const p = cur(); if (p) { p.zoom = z; save("projects", p); } }
    });
  } else {
    host.hidden = true;
    if (viewers.proj) { viewers.proj.destroy(); viewers.proj = null; }
  }
}
$("tabSteps").addEventListener("click", () => { view.sub = "steps"; lsSet("knit-sub-" + view.id, "steps"); rerenderProject(); window.scrollTo(0, 0); });
$("tabPdf").addEventListener("click", () => { view.sub = "pdf"; lsSet("knit-sub-" + view.id, "pdf"); rerenderProject(); });

function renderProjectInfo() {
  const p = cur(), pat = curPattern();
  $("projName").textContent = p.name || "Untitled project";
  $("projMeta").textContent = (pat ? pat.name : "Pattern removed") + (p.started ? " · started " + fmtDate(p.started) : "") + (p.status === "finished" ? " · finished" : "");
  const bits = [p.yarn, p.gauge].filter(Boolean);
  $("detailSum").textContent = bits.length ? bits.join(" · ") : "Yarn, gauge, notes";
  const dd = (label, v) => "<dt>" + label + "</dt>" + (v ? "<dd>" + esc(v) + "</dd>" : '<dd class="none">Not added</dd>');
  $("detailList").innerHTML = dd("Yarn", p.yarn) + dd("Gauge", p.gauge) + dd("Notes", p.notes) + dd("Started", fmtDate(p.started));
  $("finishProj").textContent = p.status === "finished" ? "Mark as in progress" : "Mark finished";
}

$("projBack").addEventListener("click", () => goHome("projects"));
$("editProj").addEventListener("click", () => {
  const p = cur(); if (!p) return;
  openSheet({
    title: "Edit details", submit: "Save changes", fields: detailFields(p),
    onSubmit: (v) => {
      if (!v.name) throw new Error("Give the project a name.");
      Object.assign(p, { name: v.name, started: v.started, yarn: v.yarn, gauge: v.gauge, notes: v.notes });
      save("projects", p);
      renderProjectInfo();
    }
  });
});
$("finishProj").addEventListener("click", () => {
  const p = cur(); if (!p) return;
  p.status = p.status === "finished" ? "active" : "finished";
  save("projects", p);
  renderProjectInfo();
});
armed($("delProj"), () => { const p = cur(); if (!p) return; remove("projects", p.id); goHome("projects"); toast("Project deleted"); });

/* ---------------- tracker ---------------- */
function renderTracker(animate) {
  const p = cur(); if (!p) return;
  const pat = curPattern(), g = guideOf(pat);
  const pr = p.progress || (p.progress = {});
  const card = $("card");
  let strip = "";
  $("done").classList.remove("checked");
  $("done").disabled = false;

  if (g) {
    cleanPos(g, pr);
    const s = g.sections[pr.sec], N = s.rows.length, r = s.rows[pr.row];
    const T = s.repeat_type === "times" ? timesOf(s) : 0;
    const multi = g.sections.length > 1;
    $("secline").hidden = !multi;
    if (multi) $("secline").innerHTML = "Section " + (pr.sec + 1) + " of " + g.sections.length + ": <strong>" + esc(s.title) + "</strong>";
    $("tally").innerHTML = "Row <strong>" + overallRow(g, pr) + "</strong> overall";

    if (pr.done) {
      card.className = "card";
      card.innerHTML = '<div class="endnote"><b>You’ve reached the end of the pattern</b><span class="hint">Use the back arrow if you need to go back a row.</span>' +
        (p.status !== "finished" ? '<button type="button" class="btn primary" id="endFinish">Mark project finished</button>' : "") + "</div>";
      const ef = $("endFinish");
      if (ef) ef.addEventListener("click", () => { p.status = "finished"; save("projects", p); renderProjectInfo(); ef.remove(); });
      $("strip").innerHTML = "";
      $("next").innerHTML = "";
      $("done").disabled = true;
      $("doneLabel").textContent = "Pattern complete";
      $("back").disabled = false;
      $("toolHint").textContent = "";
      return;
    }

    // a one-row section repeated N times reads better as "3 of 9"
    const oneRow = N === 1 && (T > 1 || s.repeat_type === "until");
    let big, label;
    if (oneRow) {
      big = pr.rep;
      label = T ? "of " + T + (multi ? "" : " rows") : "rows so far";
    } else {
      big = pr.row + 1;
      label = "of " + N + (T > 1 ? " · repeat " + pr.rep + " of " + T : s.repeat_type === "until" ? " · repeat " + pr.rep : "");
    }
    const side = sideLabel(r.side);
    const techs = techsInRow(r, g.techniques);
    let h = '<div class="rowhead"><div class="rownum">' + big + '</div><div class="rowmeta"><span class="rowlabel">' + esc(label) + "</span>" +
      (side ? '<span class="side ' + (r.side === "RS" ? "rs" : "ws") + '">' + side + "</span>" : "") + "</div></div>";
    if (r.label && pat.kind !== "builtin") h += '<p class="patlabel">' + esc(r.label) + "</p>";
    h += r.steps.length > 3 && pat.kind !== "builtin"
      ? '<ol class="steplist">' + r.steps.map((t) => "<li>" + fmtStep(t, g.techniques) + "</li>").join("") + "</ol>"
      : '<p class="instr">' + r.steps.map((t) => fmtStep(t, g.techniques)).join(" ") + "</p>";
    if (s.repeat_type === "until") {
      h += '<div class="until">Repeat until <strong>' + esc(s.repeat_until.replace(/^until\s+/i, "")) + "</strong>.</div>";
      h += '<button type="button" class="btn block moveon" id="moveOn">' + (pr.sec < g.sections.length - 1 ? "Done repeating: go to " + esc(g.sections[pr.sec + 1].title) : "Done repeating: finish the pattern") + "</button>";
    }
    if (techs.length) h += '<div class="techs"><h3>Techniques for this row</h3>' + techs.map((t) => '<div class="tech"><b>' + esc(t.name || t.term) + "</b>" + esc(t.how) + "</div>").join("") + "</div>";
    card.className = "card guide";
    card.innerHTML = h;
    const mo = $("moveOn");
    if (mo) mo.addEventListener("click", () => { guideMoveOn(g, pr); save("projects", p); renderTracker(true); window.scrollTo(0, 0); });

    const L = oneRow ? T : N, at = oneRow ? pr.rep - 1 : pr.row;
    if (L > 1 && L <= 24) {
      $("strip").style.gridTemplateColumns = "repeat(" + L + ", 1fr)";
      for (let i = 0; i < L; i++) strip += '<i class="' + (i < at ? "done" : i === at ? "now" : "") + '"></i>';
    }
    // what comes next
    const peek = JSON.parse(JSON.stringify(pr));
    guideAdvance(g, peek);
    let next = "";
    if (peek.done) next = "This is the last row of the pattern.";
    else {
      const ns = g.sections[peek.sec], nr = ns.rows[peek.row];
      const where = peek.sec !== pr.sec ? ", which starts <strong>" + esc(ns.title) + "</strong>" : peek.rep !== pr.rep && !oneRow ? ", which starts repeat " + peek.rep : "";
      next = "Up next: <strong>" + esc(nr.label || "Row " + (peek.row + 1)) + (nr.side ? " (" + nr.side + ")" : "") + "</strong>" + where;
    }
    $("next").innerHTML = next;
    $("back").disabled = !canBack(pr);
    $("doneLabel").textContent = (oneRow ? "Row " + pr.rep : r.label && pat.kind !== "builtin" ? r.label : "Row " + (pr.row + 1)) + " finished";
    $("toolHint").textContent = "Tap the button when the row is finished.";
  } else {
    // PDF without steps: a plain row counter with an optional repeat
    $("secline").hidden = true;
    if (typeof pr.count !== "number" || pr.count < 0) pr.count = 0;
    const L = p.repeatLen || 0, row = pr.count + 1;
    let label, tally;
    if (L) {
      const inRep = (pr.count % L) + 1, rep = Math.floor(pr.count / L) + 1;
      label = "Row <strong>" + inRep + "</strong> of " + L + " in repeat " + rep;
      tally = "Repeats completed: <strong>" + (rep - 1) + "</strong><br>Rows done: <strong>" + pr.count + "</strong>";
      if (L <= 24) {
        $("strip").style.gridTemplateColumns = "repeat(" + L + ", 1fr)";
        for (let i = 0; i < L; i++) strip += '<i class="' + (i < inRep - 1 ? "done" : i === inRep - 1 ? "now" : "") + '"></i>';
      }
      $("next").innerHTML = inRep === L ? "Next row starts <strong>repeat " + (rep + 1) + "</strong>" : "";
    } else {
      label = "Row you’re on";
      tally = "Rows done: <strong>" + pr.count + "</strong>";
      $("next").innerHTML = "";
    }
    let h = '<div class="rowhead"><div class="rownum">' + row + '</div><div class="rowmeta"><span class="rowlabel">' + label + "</span></div></div>";
    if (pat && pat.kind === "pdf") {
      const st = pat.guideStatus;
      if (reading[pat.id]) h += '<div class="until">Claude is turning this pattern into row-by-row steps. You can keep counting rows meanwhile.</div>';
      else if (st === "error") h += '<div class="until">Claude couldn’t read this pattern yet. Open it from Patterns to try again.</div>';
      else if (!getKey()) h += '<div class="until">Add your API key in Settings to get row-by-row steps for this pattern.</div>';
      else h += '<div class="until"><button type="button" class="btn block" id="readNow">Turn into row-by-row steps</button></div>';
    }
    card.className = "card";
    card.innerHTML = h;
    const rn = $("readNow");
    if (rn) rn.addEventListener("click", () => readPattern(pat.id));
    $("tally").innerHTML = tally;
    $("back").disabled = pr.count === 0;
    $("doneLabel").textContent = "Row " + row + " finished";
    $("toolHint").textContent = L ? "Counting a " + L + "-row repeat." : "Set a repeat length under Set my place.";
  }
  $("strip").innerHTML = strip;
  if (animate) { card.classList.remove("slide"); void card.offsetWidth; card.classList.add("slide"); }
}

function advance() {
  const p = cur(), g = guideOf(curPattern()), pr = p.progress;
  if (g) guideAdvance(g, pr); else pr.count = (pr.count || 0) + 1;
  save("projects", p);
  renderTracker(true);
}
function goBack() {
  const p = cur(), g = guideOf(curPattern()), pr = p.progress;
  if (g) { if (!guideBack(g, pr)) return; } else { if (!pr.count) return; pr.count--; }
  save("projects", p);
  renderTracker(true);
}

let busy = false;
$("done").addEventListener("click", () => {
  const b = $("done");
  if (busy || !cur() || b.disabled) return;
  busy = true;
  b.classList.add("checked");
  b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop");
  if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
  setTimeout(() => { busy = false; if (view.name === "project") advance(); }, 450);
});
$("back").addEventListener("click", () => { if (!busy && cur()) goBack(); });

armed($("reset"), () => {
  const p = cur(); if (!p) return;
  p.progress = { sec: 0, row: 0, rep: 1, count: 0 };
  save("projects", p);
  renderTracker(true);
});

$("setplace").addEventListener("click", () => {
  const p = cur(), panel = $("place");
  if (!panel.hidden) { panel.hidden = true; return; }
  const g = guideOf(curPattern()), pr = p.progress;
  let h = "<h2>Set my place</h2><div class=\"fields\">";
  if (g) {
    if (g.sections.length > 1) {
      h += '<label class="field" for="plSec" style="flex-basis:100%">Section<select id="plSec">' +
        g.sections.map((s, i) => '<option value="' + i + '"' + (i === pr.sec ? " selected" : "") + ">" + (i + 1) + ". " + esc(s.title) + "</option>").join("") + "</select></label>";
    }
    h += '<label class="field" for="plRow">Row<select id="plRow"></select></label>' +
      '<label class="field" for="plRep">Repeat number<input id="plRep" type="number" inputmode="numeric" min="1" value="' + pr.rep + '"></label>';
  } else {
    h += '<label class="field" for="plRow">Row I’m on<input id="plRow" type="number" inputmode="numeric" min="1" value="' + ((pr.count || 0) + 1) + '"></label>' +
      '<label class="field" for="plRep">Rows in a repeat<input id="plRep" type="number" inputmode="numeric" min="0" value="' + (p.repeatLen || "") + '" placeholder="None"></label>';
  }
  h += '</div><div class="actions"><button type="button" class="btn" id="plCancel">Cancel</button><button type="button" class="btn primary" id="plSave">Save my place</button></div>';
  panel.innerHTML = h;
  panel.hidden = false;
  const fillRows = () => {
    const si = $("plSec") ? +$("plSec").value : 0;
    $("plRow").innerHTML = g.sections[si].rows.map((r, i) => '<option value="' + i + '"' + (si === pr.sec && i === pr.row ? " selected" : "") + ">" + esc(r.label || "Row " + (i + 1)) + (r.side ? " (" + r.side + ")" : "") + "</option>").join("");
  };
  if (g) { fillRows(); if ($("plSec")) $("plSec").addEventListener("change", fillRows); }
  $("plCancel").addEventListener("click", () => { panel.hidden = true; });
  $("plSave").addEventListener("click", () => {
    if (g) {
      const sec = $("plSec") ? +$("plSec").value : 0;
      let rep = parseInt($("plRep").value, 10);
      if (isNaN(rep) || rep < 1) rep = 1;
      p.progress = { sec, row: +$("plRow").value, rep, reps: pr.reps || {} };
      cleanPos(g, p.progress);
    } else {
      let a = parseInt($("plRow").value, 10), b = parseInt($("plRep").value, 10);
      if (isNaN(a) || a < 1) a = 1;
      if (isNaN(b) || b < 2) b = 0;
      p.progress = { count: a - 1 };
      p.repeatLen = b;
    }
    panel.hidden = true;
    save("projects", p);
    renderTracker(true);
  });
  panel.scrollIntoView({ block: "nearest" });
});

/* ============================================================
   Pattern screen
   ============================================================ */
function openPattern(id) {
  if (!S.patterns[id]) return;
  destroyViewers();
  view.name = "pattern"; view.id = id; view.sub = "steps";
  show("pattern");
  renderPatternInfo();
  renderPatternBody();
  window.scrollTo(0, 0);
}
function renderPatternInfo() {
  const pat = S.patterns[view.id], n = usesOf(pat.id);
  $("patName").textContent = pat.name;
  $("patMeta").textContent = patternMeta(pat);
  $("patRename").hidden = pat.kind === "builtin";
  $("patDelete").hidden = pat.kind === "builtin";
  $("patDelete").disabled = n > 0;
  $("patDelNote").textContent = n > 0 && pat.kind !== "builtin" ? "To delete this pattern, delete its projects first." : "";
  // reading status box
  let rb = "";
  if (pat.kind === "pdf") {
    if (reading[pat.id]) rb = '<div class="readbox"><p><b>Claude is reading this pattern</b></p><p class="hint" data-progress="' + esc(pat.id) + '">Sending the PDF… Keep the app open.</p></div>';
    else if (pat.guideStatus === "error") rb = '<div class="readbox"><p class="hint warn">' + esc(pat.guideError) + '</p><button type="button" class="btn" id="readBtn">Read pattern again</button></div>';
    else if (pat.guideStatus !== "ready") rb = getKey()
      ? '<div class="readbox"><p>Turn this PDF into row-by-row steps with techniques.</p><button type="button" class="btn primary" id="readBtn">Read pattern</button></div>'
      : '<div class="readbox"><p>Add your Anthropic API key in Settings and Claude will turn this PDF into row-by-row steps.</p><button type="button" class="btn" id="goSettings">Open settings</button></div>';
  }
  $("patRead").innerHTML = rb;
  if ($("readBtn")) $("readBtn").addEventListener("click", () => readPattern(pat.id));
  if ($("goSettings")) $("goSettings").addEventListener("click", openSettings);
  if (reading[pat.id]) updateReadProgress(pat.id);
}
function renderPatternBody() {
  const pat = S.patterns[view.id];
  if (!pat || view.name !== "pattern") return;
  renderPatternInfo();
  const g = guideOf(pat), hasPdf = pat.kind === "pdf";
  if (!g) view.sub = "pdf";
  $("patTabs").hidden = !(g && hasPdf);
  $("ptSteps").setAttribute("aria-selected", view.sub === "steps");
  $("ptPdf").setAttribute("aria-selected", view.sub === "pdf");
  const showPdf = hasPdf && view.sub === "pdf";
  $("app").classList.toggle("wide", showPdf);
  if (g && !showPdf) {
    let h = g.overview ? '<p class="overview">' + esc(g.overview) + "</p>" : "";
    g.sections.forEach((s) => {
      h += '<div class="sec"><h3>' + esc(s.title) + "</h3>";
      const rt = repeatText(s);
      if (rt) h += '<p class="rpt">' + esc(rt) + "</p>";
      s.rows.forEach((r) => {
        h += '<div class="rowcard"><p class="patlabel">' + esc(r.label) + (r.side ? ' <span class="side ' + (r.side === "RS" ? "rs" : "ws") + '">' + r.side + "</span>" : "") + '</p><p class="instr">' + r.steps.map((t) => fmtStep(t, g.techniques)).join(" ") + "</p></div>";
      });
      h += "</div>";
    });
    if (g.techniques && g.techniques.length) {
      h += '<div class="sec"><h3>Techniques</h3><div class="rowcard"><div class="techs" style="margin:0;padding:0;border:0">' + g.techniques.map((t) => '<div class="tech"><b>' + esc(t.name || t.term) + (t.name && t.term && t.name !== t.term ? " (" + esc(t.term) + ")" : "") + "</b>" + esc(t.how) + "</div>").join("") + "</div></div></div>";
    }
    if (hasPdf) h += '<p class="hint" style="margin-top:18px">Steps look wrong? <button type="button" class="linkbtn" id="rereadBtn">Read the pattern again</button></p>';
    $("patSteps").innerHTML = h;
    $("patSteps").hidden = false;
    const rr = $("rereadBtn");
    if (rr) armed(rr, () => readPattern(pat.id));
  } else {
    $("patSteps").innerHTML = "";
    $("patSteps").hidden = true;
  }
  const host = $("patPdf");
  if (showPdf) {
    host.hidden = false;
    if (!viewers.pat) viewers.pat = mountPdf(host, pat, { startPage: 1, zoom: 1 });
  } else {
    host.hidden = true;
    if (viewers.pat) { viewers.pat.destroy(); viewers.pat = null; }
  }
}
$("ptSteps").addEventListener("click", () => { view.sub = "steps"; renderPatternBody(); });
$("ptPdf").addEventListener("click", () => { view.sub = "pdf"; renderPatternBody(); });
$("patBack").addEventListener("click", () => goHome("patterns"));
$("patStart").addEventListener("click", () => startProjectSheet(view.id));
$("patRename").addEventListener("click", () => {
  const pat = S.patterns[view.id];
  openSheet({
    title: "Rename pattern", submit: "Save", fields: [{ name: "name", label: "Pattern name", value: pat.name }],
    onSubmit: (v) => { if (!v.name) throw new Error("Give the pattern a name."); pat.name = v.name; save("patterns", pat); renderPatternInfo(); }
  });
});
armed($("patDelete"), () => {
  const pat = S.patterns[view.id];
  if (!pat || usesOf(pat.id) || pat.kind === "builtin") return;
  if (pat.fileId) {
    DB.del("files", pat.fileId).catch(() => {});
    const df = Sync.dirtyFiles(); delete df[pat.fileId]; lsSet("knit-dirty-files", JSON.stringify(df));
    if (Sync.pass()) Sync.api("files/" + encodeURIComponent(pat.fileId), { method: "DELETE" }).catch(() => {});
  }
  remove("patterns", pat.id);
  goHome("patterns");
  toast("Pattern deleted");
});

/* ============================================================
   PDF viewer (pdf.js, pages drawn lazily)
   ============================================================ */
if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
const ZOOMS = [1, 1.5, 2, 2.5, 3];
const viewers = { proj: null, pat: null };
function destroyViewers() {
  if (viewers.proj) { viewers.proj.destroy(); viewers.proj = null; }
  if (viewers.pat) { viewers.pat.destroy(); viewers.pat = null; }
}
const docCache = {};
function loadPdf(fileId) {
  if (!docCache[fileId]) {
    docCache[fileId] = (async () => {
      const f = await getFile(fileId);
      return pdfjsLib.getDocument({ data: new Uint8Array(f.data.slice(0)), isEvalSupported: false }).promise;
    })();
    docCache[fileId].catch(() => { delete docCache[fileId]; });
  }
  return docCache[fileId];
}

function mountPdf(host, pat, opts) {
  const v = { dead: false, slots: [], zoom: ZOOMS.includes(opts.zoom) ? opts.zoom : 1, doc: null, page: 1, io: null, vio: null };
  host.innerHTML = '<div class="pdfbar"><span class="pginfo">Opening pattern…</span><span class="zoom"><button type="button" class="zout" aria-label="Zoom out">−</button><span class="zval"></span><button type="button" class="zin" aria-label="Zoom in">+</button></span></div><div class="pdfpages"></div>';
  const pagesEl = host.querySelector(".pdfpages"), info = host.querySelector(".pginfo");
  const zoomUi = () => {
    host.querySelector(".zval").textContent = Math.round(v.zoom * 100) + "%";
    host.querySelector(".zout").disabled = v.zoom <= ZOOMS[0];
    host.querySelector(".zin").disabled = v.zoom >= ZOOMS[ZOOMS.length - 1];
  };
  zoomUi();
  const setInfo = () => { info.textContent = "Page " + v.page + " of " + v.slots.length; };
  const applyWidth = () => v.slots.forEach((s) => { s.el.style.width = v.zoom * 100 + "%"; });
  const release = (s) => {
    if (s.task) { try { s.task.cancel(); } catch (e) {} s.task = null; }
    if (s.canvas) { s.canvas.width = 0; s.canvas.height = 0; s.canvas.remove(); s.canvas = null; }
    s.drawn = false;
  };
  const draw = async (s) => {
    if (s.drawn || v.dead) return;
    s.drawn = true;
    try {
      const page = await v.doc.getPage(s.n);
      if (v.dead || !s.drawn) return;
      const vp1 = page.getViewport({ scale: 1 });
      s.el.style.aspectRatio = String(vp1.width / vp1.height);
      const cssW = s.el.clientWidth || 360;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      let scale = (cssW * dpr) / vp1.width;
      const maxPx = 12e6;
      if (vp1.width * vp1.height * scale * scale > maxPx) scale = Math.sqrt(maxPx / (vp1.width * vp1.height));
      const vp = page.getViewport({ scale });
      const c = document.createElement("canvas");
      c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      s.task = page.render({ canvasContext: c.getContext("2d"), viewport: vp });
      await s.task.promise;
      s.task = null;
      if (v.dead || !s.drawn) { c.width = 0; c.height = 0; return; }
      if (s.canvas) s.canvas.remove();
      s.canvas = c;
      s.el.insertBefore(c, s.el.firstChild);
    } catch (e) {
      s.task = null;
      if (!e || e.name !== "RenderingCancelledException") s.drawn = false;
    }
  };
  const setZoom = (dir) => {
    const i = ZOOMS.indexOf(v.zoom) + dir;
    if (i < 0 || i >= ZOOMS.length || !v.doc) return;
    const keep = v.page;
    v.zoom = ZOOMS[i];
    zoomUi();
    v.slots.forEach(release);
    applyWidth();
    v.slots.forEach((s) => { v.io.unobserve(s.el); v.io.observe(s.el); });
    v.slots[keep - 1].el.scrollIntoView({ block: "start" });
    if (opts.onZoom) opts.onZoom(v.zoom);
  };
  host.querySelector(".zout").addEventListener("click", () => setZoom(-1));
  host.querySelector(".zin").addEventListener("click", () => setZoom(1));

  if (!pat.fileId) pagesEl.innerHTML = '<p class="pdfmsg warn">This pattern has no PDF attached.</p>';
  else loadPdf(pat.fileId).then(async (doc) => {
    if (v.dead) return;
    v.doc = doc;
    const first = await doc.getPage(1);
    if (v.dead) return;
    const vp = first.getViewport({ scale: 1 });
    for (let i = 1; i <= doc.numPages; i++) {
      const el = document.createElement("div");
      el.className = "pg";
      el.style.aspectRatio = String(vp.width / vp.height);
      el.dataset.n = i;
      el.innerHTML = '<span class="pgn">' + i + "</span>";
      pagesEl.appendChild(el);
      v.slots.push({ n: i, el, canvas: null, drawn: false, task: null });
    }
    applyWidth();
    v.io = new IntersectionObserver((entries) => entries.forEach((en) => {
      const s = v.slots[+en.target.dataset.n - 1];
      if (en.isIntersecting) draw(s); else release(s);
    }), { rootMargin: "1500px 0px" });
    const vis = {};
    v.vio = new IntersectionObserver((entries) => {
      entries.forEach((en) => { vis[en.target.dataset.n] = en.intersectionRatio; });
      let best = v.page, bestR = 0;
      Object.keys(vis).forEach((k) => { if (vis[k] > bestR) { bestR = vis[k]; best = +k; } });
      if (bestR > 0 && best !== v.page) { v.page = best; setInfo(); if (opts.onPage) opts.onPage(best); }
    }, { threshold: [0, 0.25, 0.5, 0.75] });
    v.slots.forEach((s) => { v.io.observe(s.el); v.vio.observe(s.el); });
    v.page = Math.min(Math.max(1, opts.startPage || 1), doc.numPages);
    setInfo();
    if (v.page > 1) setTimeout(() => { if (!v.dead) v.slots[v.page - 1].el.scrollIntoView({ block: "start" }); }, 80);
  }).catch((e) => {
    if (v.dead) return;
    info.textContent = "";
    pagesEl.innerHTML = '<p class="pdfmsg warn">' + esc(e && e.message ? e.message : "Couldn’t open this PDF.") + "</p>";
  });

  return {
    destroy() {
      v.dead = true;
      if (v.io) v.io.disconnect();
      if (v.vio) v.vio.disconnect();
      v.slots.forEach(release);
      host.innerHTML = "";
    }
  };
}

/* ============================================================
   Settings + backup
   ============================================================ */
function openSettings() {
  destroyViewers();
  view.name = "settings";
  show("settings");
  $("app").classList.remove("wide");
  $("apiKey").value = "";
  const k = getKey();
  $("keyNote").className = "hint";
  $("keyNote").textContent = k ? "A key is saved on this device (ends in …" + k.slice(-4) + ")." : "No key saved yet.";
  $("backupNote").textContent = "";
  renderSyncSettings();
  $("storageNote").textContent = "Checking storage…";
  if (navigator.storage && navigator.storage.estimate) {
    Promise.all([navigator.storage.estimate(), navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false)]).then(([est, persisted]) => {
      $("storageNote").textContent = "Using " + fmtSize(est.usage || 0) + " on this device. " +
        (persisted ? "Your browser has agreed to keep this data." : "Download a backup now and then, since a browser can clear app data when the phone runs low on space.");
    }).catch(() => { $("storageNote").textContent = "Everything is stored on this device."; });
  } else $("storageNote").textContent = "Everything is stored on this device.";
  window.scrollTo(0, 0);
}
$("openSettings").addEventListener("click", openSettings);

function syncErrorText(code, missing) {
  if (code === "wrong_password") return "That password doesn’t match the SYNC_PASSWORD set in Cloudflare.";
  if (code === "not_configured") return "Sync isn’t set up in Cloudflare yet" + (missing && missing.length ? " (missing: " + missing.join(", ") + ")" : "") + ". Add the settings, then redeploy.";
  return "";
}
function renderSyncSettings() {
  const on = !!Sync.pass();
  $("syncOff").hidden = on;
  $("syncOn").hidden = !on;
  const note = $("syncNote");
  note.className = "hint";
  if (!on) { note.textContent = ""; return; }
  if (Sync.state === "syncing") note.textContent = "Syncing…";
  else if (Sync.state === "ok") note.textContent = "Sync is on. Changes on this device reach your other devices within a few seconds.";
  else if (Sync.state === "offline") note.textContent = "You’re offline. Changes are saved on this device and will sync when you’re back online.";
  else if (Sync.state === "error") { note.className = "hint warn"; note.textContent = syncErrorText(Sync.code) || "Sync ran into a problem. Tap Sync now to try again."; }
  else note.textContent = "Sync is on.";
}
$("syncConnect").addEventListener("click", async () => {
  const pass = $("syncPass").value;
  const note = $("syncNote"), btn = $("syncConnect");
  if (!pass) { note.className = "hint warn"; note.textContent = "Enter the sync password first."; return; }
  btn.disabled = true; note.className = "hint"; note.textContent = "Checking…";
  try {
    await Sync.api("ping", {}, pass);
    lsSet("knit-sync-pass", pass);
    lsSet("knit-synced-once", null);
    lsSet("knit-pulled", null);
    $("syncPass").value = "";
    await Sync.run();
    renderSyncSettings();
    toast("Sync is on");
  } catch (e) {
    note.className = "hint warn";
    note.textContent = syncErrorText(e.code, e.missing) || (e.status === 404 ? "This copy of the app has no sync server. Open it from your Cloudflare address." : "Couldn’t reach the sync server. Check your connection and try again.");
  } finally { btn.disabled = false; }
});
$("syncNow").addEventListener("click", () => Sync.run());
$("syncDisconnect").addEventListener("click", () => {
  lsSet("knit-sync-pass", null);
  Sync.set("off");
  renderSyncSettings();
  toast("Sync is off on this device. Your data stays here.");
});
$("setBack").addEventListener("click", () => goHome());
$("saveKey").addEventListener("click", () => {
  const k = $("apiKey").value.trim();
  if (!/^sk-ant-/.test(k)) { $("keyNote").className = "hint warn"; $("keyNote").textContent = "That doesn’t look like an Anthropic API key. Keys start with sk-ant-."; return; }
  lsSet(KEY_NAME, k);
  $("apiKey").value = "";
  $("keyNote").className = "hint";
  $("keyNote").textContent = "Key saved on this device (ends in …" + k.slice(-4) + ").";
  toast("API key saved");
});
$("clearKey").addEventListener("click", () => { lsSet(KEY_NAME, null); $("keyNote").className = "hint"; $("keyNote").textContent = "Key removed from this device."; });

function bufToB64(buf) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = () => rej(r.error); r.readAsDataURL(new Blob([buf])); });
}
function b64ToBuf(b64) {
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
$("exportBtn").addEventListener("click", async () => {
  const note = $("backupNote");
  note.className = "hint"; note.textContent = "Preparing backup…";
  try {
    const files = await DB.all("files");
    const backup = {
      app: "knit-row-tracker", version: 1, exportedAt: new Date().toISOString(),
      patterns: Object.values(S.patterns), projects: Object.values(S.projects),
      files: await Promise.all(files.map(async (f) => ({ id: f.id, type: f.type, b64: await bufToB64(f.data) })))
    };
    const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
    const name = "knit-backup-" + today() + ".json";
    const file = new File([blob], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
      await navigator.share({ files: [file], title: name });
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    note.textContent = "Backup ready: " + name + " (" + fmtSize(blob.size) + ").";
  } catch (e) {
    if (e && e.name === "AbortError") { note.textContent = ""; return; }
    note.className = "hint warn"; note.textContent = "Couldn’t make the backup: " + (e && e.message ? e.message : "unknown error");
  }
});
$("importBtn").addEventListener("click", () => $("importInput").click());
$("importInput").addEventListener("change", async function () {
  const file = this.files && this.files[0];
  this.value = "";
  if (!file) return;
  const note = $("backupNote");
  note.className = "hint"; note.textContent = "Restoring…";
  try {
    const data = JSON.parse(await file.text());
    if (!data || data.app !== "knit-row-tracker") throw new Error("This isn’t a Knit Row Tracker backup.");
    for (const f of data.files || []) await DB.put("files", { id: f.id, type: f.type, data: b64ToBuf(f.b64) });
    let np = 0, nj = 0;
    for (const p of data.patterns || []) { const mine = S.patterns[p.id]; if (!mine || (p.t || 0) > (mine.t || 0)) { S.patterns[p.id] = p; await DB.put("patterns", p); np++; } }
    for (const p of data.projects || []) { const mine = S.projects[p.id]; if (!mine || (p.t || 0) > (mine.t || 0)) { S.projects[p.id] = p; await DB.put("projects", p); nj++; } }
    note.textContent = "Restored " + np + (np === 1 ? " pattern" : " patterns") + " and " + nj + (nj === 1 ? " project" : " projects") + ". Newer copies already on this device were kept.";
  } catch (e) {
    note.className = "hint warn"; note.textContent = "Couldn’t restore: " + (e && e.message ? e.message : "unknown error");
  }
});

/* ============================================================
   Keep the screen on while knitting
   ============================================================ */
let wakeLock = null;
function keepAwake(on) {
  try {
    if (on) {
      if (!wakeLock && navigator.wakeLock && document.visibilityState === "visible") {
        navigator.wakeLock.request("screen").then((l) => {
          wakeLock = l;
          l.addEventListener("release", () => { wakeLock = null; });
          if (view.name !== "project") l.release();
        }, () => {});
      }
    } else if (wakeLock) { wakeLock.release(); wakeLock = null; }
  } catch (e) {}
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (view.name === "project") keepAwake(true);
    Sync.soon(200);
  } else if (Object.keys(Sync.dirty()).length) Sync.run(); // send unsaved changes before the app is put away
});
window.addEventListener("online", () => Sync.soon(200));
setInterval(() => { if (document.visibilityState === "visible") Sync.soon(0); }, 45000);

/* ============================================================
   Start
   ============================================================ */
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
loadAll().then(() => {
  const last = lsGet("knit-last");
  if (last && S.projects[last]) openProject(last);
  else { show("home"); renderHome(); }
  if (Sync.pass()) Sync.run();
}).catch((e) => {
  document.getElementById("app").innerHTML = '<p class="pdfmsg warn">This browser couldn’t open the app’s storage (' + esc(e && e.message ? e.message : "unknown error") + "). Private browsing can block it.</p>";
});
