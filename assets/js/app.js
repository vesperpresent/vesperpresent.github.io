const ch = new BroadcastChannel("vespa-live");
const TYPES = {
  song: { label: "Song", icon: "song", desc: "Lyrics, split into slides" },
  sermon: { label: "Sermon", icon: "sermon", desc: "Points, notes and verses" },
  scripture: { label: "Scripture", icon: "scripture", desc: "Look up any passage" },
  image: { label: "Image", icon: "image", desc: "One picture or a slideshow" },
  video: { label: "Video", icon: "video", desc: "Play a clip full screen" },
  slides: { label: "Slides", icon: "slides", desc: "Announcements and more" }
};
const FIELDS = ["title", "type", "author", "slides", "theme", "opts"];
const clean = p => Object.fromEntries(FIELDS.filter(k => p[k] !== undefined).map(k => [k, p[k]]));
const arr = x => Array.isArray(x) ? x : (x && (x.docs || x.data || x.items)) || [];
const store = { get(k, d) { try { const v = localStorage.getItem("vespa-" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem("vespa-" + k, JSON.stringify(v)); } catch (e) {} } };

const S = {
  user: null,
  settings: { churchName: "", logoFile: "", transition: 0.5, defaultPreset: "classic" },
  settingsDoc: false,
  lib: [], services: [], files: null,
  serviceId: null, tab: "service", filter: "all", q: "",
  openId: null,
  live: { presId: null, index: -1 },
  clearText: false, clearBg: false, black: false, logo: false,
  message: { text: "", show: false, stage: false },
  timer: { dur: 300, left: 300, end: null, running: false, stage: true },
  thumb: store.get("thumb", 220),
  outAt: 0, stageAt: 0, phoneAt: 0, remoteNonce: null
};
let DB, comp;

requireUser($("#root"), u => { S.user = u; boot(); });

async function boot() {
  DB = { pres: bread.collection("presentations"), svc: bread.collection("services"), settings: bread.collection("settings"), remote: bread.collection("remote") };
  shell();
  try {
    const [lib, svcs, set] = await Promise.all([
      DB.pres.get({ limit: 500, orderBy: "updatedAt", order: "desc" }),
      DB.svc.get({ limit: 200, orderBy: "updatedAt", order: "desc" }),
      DB.settings.getById(S.user.id).catch(e => e && e.status === 404 ? null : Promise.reject(e))
    ]);
    S.lib = arr(lib); S.services = arr(svcs);
    if (set) { S.settingsDoc = true; for (const k of Object.keys(S.settings)) if (set[k] !== undefined) S.settings[k] = set[k]; }
  } catch (e) { toast(errMsg(e), "err"); }
  if (!S.services.length) {
    try { S.services = [await DB.svc.create({ title: "Sunday Service", date: new Date().toISOString().slice(0, 10), items: [] })]; }
    catch (e) { toast(errMsg(e), "err"); }
  }
  const last = store.get("service", null);
  S.serviceId = S.services.find(s => s.id === last) ? last : (S.services[0] && S.services[0].id);
  const items = svcItems();
  S.openId = items.find(id => byId(id)) || null;
  renderTop(); renderSide(); renderCenter(); buildLive(); push();
  initRemote(); bindKeys();
  setInterval(tick, 250);
}

const byId = id => S.lib.find(p => p.id === id);
const svc = () => S.services.find(s => s.id === S.serviceId);
const svcItems = () => ((svc() && svc().items) || []).map(x => typeof x === "string" ? x : x.presId).filter(Boolean);

function shell() {
  $("#root").innerHTML = `<div class="app-shell">
    <header class="top">
      <div class="brand"><img src="${VESPA.logo}" alt="Vespa"><span>Vespa</span><span class="church" id="church"></span></div>
      <div class="top-mid">
        <button class="btn" id="bOut">${icon("monitor")}<span>Present</span></button>
        <button class="btn ghost" id="bStage">${icon("stage")}<span>Stage display</span></button>
      </div>
      <div class="top-right">
        <button class="icon-btn" id="bRemote" title="Phone remote">${icon("phone")}</button>
        <button class="icon-btn" id="bTheme" title="Light or dark"></button>
        <button class="icon-btn" id="bSet" title="Settings">${icon("settings")}</button>
        <button class="avatar" id="bAcct" title="Account"></button>
      </div>
    </header>
    <main class="shell">
      <aside class="side">
        <div class="side-tabs"><div class="seg"><button data-tab="service">Service</button><button data-tab="library">Library</button></div></div>
        <div id="sideBody" style="display:flex;flex-direction:column;min-height:0;flex:1"></div>
      </aside>
      <section class="center" id="center"></section>
      <aside class="live" id="live"></aside>
    </main></div>`;
  $$("[data-tab]").forEach(b => b.onclick = () => { S.tab = b.dataset.tab; renderSide(); });
  $("#bOut").onclick = toggleOutput;
  $("#bStage").onclick = () => window.open("output.html?view=stage", "vespa-stage", "popup=yes,width=1280,height=720");
  $("#bRemote").onclick = remoteModal;
  $("#bTheme").onclick = () => Theme.toggle();
  $("#bSet").onclick = settingsModal;
  $("#bAcct").onclick = e => accountMenu(e.currentTarget);
  document.addEventListener("themechange", renderTop);
}

function renderTop() {
  $("#church").textContent = S.settings.churchName || "";
  $("#church").hidden = !S.settings.churchName;
  $("#bTheme").innerHTML = icon(Theme.effective() === "dark" ? "sun" : "moon");
  $("#bAcct").textContent = (S.user.email || "?")[0].toUpperCase();
  const on = Date.now() - S.outAt < 5000;
  const b = $("#bOut");
  b.className = "btn " + (on ? "live-on" : "primary");
  b.innerHTML = on ? `${icon("square")}<span>Stop presenting</span>` : `${icon("monitor")}<span>Present</span>`;
}

function menu(anchor, items) {
  $$(".menu").forEach(m => m.remove());
  const m = h(`<div class="menu"></div>`);
  for (const it of items) {
    if (it === "-") { m.append(h("<hr>")); continue; }
    if (it.info) { m.append(h(`<div class="who">${esc(it.info)}</div>`)); continue; }
    const b = h(`<button class="${it.danger ? "danger" : ""}">${it.icon ? icon(it.icon) : ""}<span>${esc(it.label)}</span></button>`);
    b.onclick = () => { m.remove(); it.run(); };
    m.append(b);
  }
  document.body.append(m);
  const r = anchor.getBoundingClientRect();
  const w = m.offsetWidth;
  m.style.top = r.bottom + 6 + "px";
  m.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + "px";
  setTimeout(() => document.addEventListener("mousedown", function off(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener("mousedown", off); } }), 0);
}

function accountMenu(a) {
  menu(a, [
    { info: S.user.email },
    { label: "Settings", icon: "settings", run: settingsModal },
    { label: "Phone remote", icon: "phone", run: remoteModal },
    "-",
    { label: "Sign out", icon: "logout", danger: true, run: async () => { try { await bread.auth.logout(); } catch (e) {} location.href = "./"; } }
  ]);
}

function itemMeta(p) {
  const n = (p.slides || []).length;
  return `${TYPES[p.type] ? TYPES[p.type].label : "Slides"} · ${n} slide${n === 1 ? "" : "s"}`;
}

function renderSide() {
  $$("[data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === S.tab));
  const body = $("#sideBody");
  if (S.tab === "service") {
    const s = svc();
    body.innerHTML = `<div class="side-head"><select class="input" id="svcSel" aria-label="Service">${S.services.map(x => `<option value="${esc(x.id)}" ${x.id === S.serviceId ? "selected" : ""}>${esc(x.title || "Untitled service")}</option>`).join("")}</select><button class="icon-btn" id="svcMore" title="Service options">${icon("more")}</button></div>
      <div class="side-list" id="svcList"></div>
      <div class="side-foot"><button class="btn primary" id="svcNew">${icon("plus")}New item</button><button class="btn" id="svcLib">${icon("list")}From library</button></div>`;
    $("#svcSel").onchange = e => { S.serviceId = e.target.value; store.set("service", S.serviceId); renderSide(); queueRemote(); };
    $("#svcMore").onclick = e => menu(e.currentTarget, [
      { label: "New service", icon: "plus", run: () => serviceModal() },
      { label: "Rename", icon: "edit", run: () => serviceModal(s) },
      { label: "Duplicate", icon: "copy", run: () => dupService(s) },
      "-",
      { label: "Delete service", icon: "trash", danger: true, run: () => delService(s) }
    ]);
    $("#svcNew").onclick = () => newItem(true);
    $("#svcLib").onclick = () => { S.tab = "library"; renderSide(); };
    renderSvcList();
  } else {
    body.innerHTML = `<div class="search">${icon("search")}<input class="input" id="libQ" placeholder="Search songs, sermons, media" value="${esc(S.q)}"></div>
      <div class="chips">${[["all", "All"], ["song", "Songs"], ["sermon", "Sermons"], ["scripture", "Scripture"], ["media", "Media"], ["slides", "Slides"]].map(([k, l]) => `<button class="chip ${S.filter === k ? "on" : ""}" data-f="${k}">${l}</button>`).join("")}</div>
      <div class="side-list" id="libList"></div>
      <div class="side-foot"><button class="btn primary" id="libNew">${icon("plus")}New</button></div>`;
    $("#libQ").oninput = e => { S.q = e.target.value; renderLibList(); };
    $$("[data-f]", body).forEach(b => b.onclick = () => { S.filter = b.dataset.f; renderSide(); });
    $("#libNew").onclick = () => newItem(false);
    renderLibList();
  }
}

function renderSvcList() {
  const list = $("#svcList"); if (!list) return;
  const items = svcItems();
  if (!items.length) {
    list.innerHTML = `<div class="side-empty">This service is empty.<br>Add songs, sermons, scripture or media.<br><button class="btn" id="emptyAdd">${icon("plus")}Add the first item</button></div>`;
    $("#emptyAdd").onclick = () => newItem(true);
  } else {
    list.innerHTML = "";
    items.forEach((id, i) => {
      const p = byId(id);
      const row = h(`<div class="item ${S.openId === id ? "sel" : ""}" draggable="true" data-i="${i}" data-id="${esc(id)}">
        <span class="grip">${icon("grip")}</span>
        <span class="ti">${icon(p ? (TYPES[p.type] || TYPES.slides).icon : "x")}</span>
        <span class="tt"><b>${esc(p ? p.title || "Untitled" : "Removed item")}</b><small>${p ? itemMeta(p) : "No longer in library"}</small></span>
        ${S.live.presId === id ? '<span class="live-tag">LIVE</span>' : ""}
        <span class="acts"><button class="icon-btn sm" data-rm title="Remove from service">${icon("x")}</button></span></div>`);
      row.onclick = e => { if (e.target.closest("[data-rm]")) return; if (p) openItem(id); };
      row.ondblclick = () => { if (p && p.slides.length) goLive(id, 0); };
      $("[data-rm]", row).onclick = () => setSvcItems(items.filter((_, k) => k !== i));
      dnd(row, i);
      list.append(row);
    });
  }
  list.ondragover = e => e.preventDefault();
  list.ondrop = e => { e.preventDefault(); dropAt(e, svcItems().length); };
}

let dragSrc = null;
function dnd(row, i) {
  row.ondragstart = e => { dragSrc = { from: "svc", i }; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", "svc"); };
  row.ondragover = e => { e.preventDefault(); row.classList.add("drop-above"); };
  row.ondragleave = () => row.classList.remove("drop-above");
  row.ondrop = e => { e.preventDefault(); e.stopPropagation(); row.classList.remove("drop-above"); dropAt(e, i); };
}
function dropAt(e, at) {
  const items = svcItems().slice();
  if (!dragSrc) return;
  if (dragSrc.from === "svc") {
    const [m] = items.splice(dragSrc.i, 1);
    items.splice(at > dragSrc.i ? at - 1 : at, 0, m);
  } else items.splice(at, 0, dragSrc.id);
  dragSrc = null;
  setSvcItems(items);
}

async function setSvcItems(items) {
  const s = svc(); if (!s) return;
  s.items = items;
  renderSvcList(); renderLibList(); queueRemote();
  try { await DB.svc.update(s.id, { items }); } catch (e) { toast(errMsg(e), "err"); }
}
function addToService(id) {
  if (!svc()) return toast("Create a service first.", "err");
  setSvcItems([...svcItems(), id]);
  toast("Added to " + (svc().title || "service"));
}

function renderLibList() {
  const list = $("#libList"); if (!list) return;
  const q = S.q.trim().toLowerCase();
  const inSvc = new Set(svcItems());
  const rows = S.lib.filter(p => {
    if (S.filter === "media" ? !(p.type === "image" || p.type === "video") : S.filter !== "all" && p.type !== S.filter) return false;
    if (!q) return true;
    return (p.title || "").toLowerCase().includes(q) || (p.author || "").toLowerCase().includes(q) || (p.slides || []).some(s => (s.text || "").toLowerCase().includes(q));
  });
  if (!rows.length) {
    list.innerHTML = `<div class="side-empty">${S.lib.length ? "Nothing matches your search." : "Your library is empty.<br>Everything you create is saved here."}${S.lib.length ? "" : `<br><button class="btn" id="libEmptyNew">${icon("plus")}Create something</button>`}</div>`;
    const b = $("#libEmptyNew"); if (b) b.onclick = () => newItem(false);
    return;
  }
  list.innerHTML = "";
  for (const p of rows) {
    const row = h(`<div class="item ${S.openId === p.id ? "sel" : ""}" draggable="true" data-id="${esc(p.id)}">
      <span class="ti">${icon((TYPES[p.type] || TYPES.slides).icon)}</span>
      <span class="tt"><b>${esc(p.title || "Untitled")}</b><small>${esc(p.author ? p.author + " · " : "")}${itemMeta(p)}</small></span>
      <span class="acts"><button class="icon-btn sm" data-add title="Add to service">${icon(inSvc.has(p.id) ? "check" : "plus")}</button></span></div>`);
    row.onclick = e => { if (e.target.closest("[data-add]")) return; openItem(p.id); };
    $("[data-add]", row).onclick = () => addToService(p.id);
    row.ondragstart = e => { dragSrc = { from: "lib", id: p.id }; e.dataTransfer.setData("text/plain", "lib"); };
    list.append(row);
  }
}

function openItem(id) {
  S.openId = id;
  $$(".side-list .item").forEach(r => r.classList.toggle("sel", r.dataset.id === id));
  renderCenter(); queueRemote();
}

function renderCenter() {
  const c = $("#center");
  const p = byId(S.openId);
  if (!p) {
    c.innerHTML = `<div class="empty"><div><div class="art">${icon("spark")}</div><h2>Ready when you are</h2><p>Pick something from your service, or create a song, sermon, verse, image or video.</p><button class="btn primary lg" id="cNew">${icon("plus")}Create</button></div></div>`;
    $("#cNew").onclick = () => newItem(S.tab === "service");
    return;
  }
  c.innerHTML = `<div class="center-head">
      <h1>${esc(p.title || "Untitled")}</h1><span class="type">${esc((TYPES[p.type] || TYPES.slides).label)}</span>
      <div class="grow"></div>
      <input type="range" class="size" id="tSize" min="150" max="440" value="${S.thumb}" aria-label="Slide size">
      <button class="btn sm" id="cEdit">${icon("edit")}Edit</button>
      <button class="icon-btn" id="cMore">${icon("more")}</button>
    </div><div class="grid" id="grid" style="--tw:${S.thumb}px"></div>`;
  $("#tSize").oninput = e => { S.thumb = +e.target.value; $("#grid").style.setProperty("--tw", S.thumb + "px"); store.set("thumb", S.thumb); };
  $("#cEdit").onclick = () => openEditor(p);
  $("#cMore").onclick = e => menu(e.currentTarget, [
    { label: "Add to service", icon: "plus", run: () => addToService(p.id) },
    { label: "Duplicate", icon: "copy", run: () => dupItem(p) },
    "-",
    { label: "Delete from library", icon: "trash", danger: true, run: () => delItem(p) }
  ]);
  const g = $("#grid");
  if (!p.slides || !p.slides.length) { g.innerHTML = `<div class="side-empty" style="grid-column:1/-1">No slides yet. Click Edit to add some.</div>`; return; }
  p.slides.forEach((s, i) => {
    const el = h(`<div class="slide" data-i="${i}" tabindex="0"><div class="th"></div><div class="slide-meta"><span class="n">${i + 1}</span>${s.label ? `<span class="lb">${esc(s.label)}</span>` : ""}<span class="grow"></span></div></div>`);
    renderThumb($(".th", el), buildFrame(p, i));
    el.onclick = () => goLive(p.id, i);
    g.append(el);
  });
  markLive();
}

function markLive() {
  $$("#grid .slide").forEach(el => el.classList.toggle("live", S.live.presId === S.openId && +el.dataset.i === S.live.index));
}

function goLive(presId, i) {
  const p = byId(presId); if (!p || !p.slides[i]) return;
  const changedItem = S.live.presId !== presId;
  S.live = { presId, index: i };
  S.clearText = false; S.black = false; S.logo = false; S.clearBg = false;
  if (S.openId !== presId) { S.openId = presId; renderCenter(); renderSide(); }
  else { markLive(); if (changedItem) renderSide(); }
  const el = $(`#grid .slide[data-i="${i}"]`);
  if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  push();
}
function nextPos(from = S.live) {
  const p = byId(from.presId); if (!p) return null;
  if (from.index < p.slides.length - 1) return { presId: p.id, index: from.index + 1 };
  const items = svcItems(), k = items.indexOf(p.id);
  if (k >= 0) for (let j = k + 1; j < items.length; j++) { const q = byId(items[j]); if (q && q.slides.length) return { presId: q.id, index: 0 }; }
  return null;
}
function prevPos(from = S.live) {
  const p = byId(from.presId); if (!p) return null;
  if (from.index > 0) return { presId: p.id, index: from.index - 1 };
  const items = svcItems(), k = items.indexOf(p.id);
  if (k > 0) for (let j = k - 1; j >= 0; j--) { const q = byId(items[j]); if (q && q.slides.length) return { presId: q.id, index: q.slides.length - 1 }; }
  return null;
}
function next() {
  if (!byId(S.live.presId)) { const p = byId(S.openId); if (p && p.slides.length) goLive(p.id, 0); return; }
  if (S.openId !== S.live.presId) { const p = byId(S.openId); if (p && p.slides.length) return goLive(p.id, 0); }
  const n = nextPos(); if (n) goLive(n.presId, n.index);
}
function prev() { const n = prevPos(); if (n) goLive(n.presId, n.index); }
function toggle(k) { S[k] = !S[k]; push(); }
function clearAll() { S.clearText = true; S.clearBg = true; S.logo = false; S.black = false; S.message.show = false; push(); }

function timerLeft() { const t = S.timer; return t.running ? Math.round((t.end - Date.now()) / 1000) : t.left; }
function fmt(sec) { const neg = sec < 0; sec = Math.abs(sec); const m = Math.floor(sec / 60), s = sec % 60; return (neg ? "-" : "") + m + ":" + String(s).padStart(2, "0"); }

function liveState() {
  const p = byId(S.live.presId);
  const frame = p ? buildFrame(p, S.live.index) : null;
  const n = nextPos();
  const nf = n ? buildFrame(byId(n.presId), n.index) : null;
  return {
    frame, next: nf ? { text: nf.text, sub: nf.sub, label: nf.label, media: !!(byId(n.presId).slides[n.index].media) } : null,
    title: p ? p.title : "", clearText: S.clearText, clearBg: S.clearBg, black: S.black, logo: S.logo,
    logoUrl: S.settings.logoFile ? mediaUrl(S.settings.logoFile) : "",
    message: S.message, timer: { running: S.timer.running, end: S.timer.end, left: S.timer.left, stage: S.timer.stage },
    transition: +S.settings.transition, at: Date.now()
  };
}
function push() {
  const st = liveState();
  if (comp) comp.set(st);
  ch.postMessage({ type: "state", state: st });
  updateLiveUI(st);
  queueRemote();
}

ch.onmessage = e => {
  const m = e.data || {};
  if (m.type === "hello") push();
  if (m.type === "ping") { if (m.view === "stage") S.stageAt = Date.now(); else { const was = Date.now() - S.outAt < 5000; S.outAt = Date.now(); if (!was) renderTop(); } }
};

let outWin = null;
async function toggleOutput() {
  if (Date.now() - S.outAt < 5000) { ch.postMessage({ type: "close" }); S.outAt = 0; renderTop(); return; }
  outWin = window.open("output.html", "vespa-output", "popup=yes,width=1280,height=720");
  if (!outWin) return toast("Your browser blocked the window. Allow pop-ups for this site.", "err");
  if ("getScreenDetails" in window) {
    try {
      const d = await window.getScreenDetails();
      const other = d.screens.find(s => s !== d.currentScreen);
      if (other && outWin && !outWin.closed) { outWin.moveTo(other.availLeft, other.availTop); outWin.resizeTo(other.availWidth, other.availHeight); toast("Output opened on your second screen. Double-click it for full screen."); }
    } catch (e) {}
  }
}

function buildLive() {
  const L = $("#live");
  L.innerHTML = `
    <div class="live-sec">
      <div class="sec-title"><span>On screen</span><span class="badge" id="lvBadge"></span></div>
      <div class="live-view"><div class="vs-fit" id="lvFit"><div class="vs-stage"></div></div></div>
      <div class="nav-row"><button class="btn" id="lvPrev">${icon("left")}Back</button><button class="btn primary" id="lvNext">Next${icon("right")}</button></div>
      <div class="transport" id="lvVid" hidden style="margin-top:12px">
        <button class="icon-btn sm" id="vPlay">${icon("pause")}</button><button class="icon-btn sm" id="vRe" title="Restart">${icon("restart")}</button>
        <div class="bar"><i id="vBar"></i></div><span class="t" id="vT">0:00</span>
      </div>
    </div>
    <div class="live-sec">
      <div class="ctrl-grid">
        <button class="ctrl" data-k="clearText">${icon("eyeoff")}Text<kbd>T</kbd></button>
        <button class="ctrl" data-k="clearBg">${icon("image")}Media<kbd>G</kbd></button>
        <button class="ctrl" data-k="logo">${icon("spark")}Logo<kbd>L</kbd></button>
        <button class="ctrl" data-k="black">${icon("square")}Black<kbd>B</kbd></button>
      </div>
      <button class="btn ghost sm" id="lvClear" style="width:100%;margin-top:8px">${icon("eraser")}Clear everything <kbd style="color:var(--faint);font-size:10px">Esc</kbd></button>
    </div>
    <div class="live-sec">
      <div class="sec-title"><span>Up next</span></div>
      <div class="next-view" id="lvNextView"></div>
    </div>
    <div class="live-sec">
      <div class="sec-title"><span>Message</span></div>
      <input class="input" id="msgText" placeholder="e.g. Parking lot B is full" value="${esc(S.message.text)}">
      <div class="row between" style="margin-top:10px">
        <label class="row gap"><span class="switch"><input type="checkbox" id="msgShow"><i></i></span><span>Audience</span></label>
        <label class="row gap"><span class="switch"><input type="checkbox" id="msgStage"><i></i></span><span>Stage</span></label>
      </div>
    </div>
    <div class="live-sec">
      <div class="sec-title"><span>Countdown</span><label class="row gap" style="text-transform:none;letter-spacing:0;font-weight:500"><span class="switch"><input type="checkbox" id="tStage" ${S.timer.stage ? "checked" : ""}><i></i></span>Stage</label></div>
      <div class="timer-face" id="tFace">5:00</div>
      <div class="row gap">
        <select class="input" id="tDur" style="height:36px">${[1, 2, 3, 5, 10, 15, 20, 30, 45, 60].map(m => `<option value="${m * 60}" ${m * 60 === S.timer.dur ? "selected" : ""}>${m} min</option>`).join("")}</select>
        <button class="btn primary" id="tGo">${icon("play")}</button>
        <button class="btn" id="tReset">${icon("restart")}</button>
      </div>
    </div>
    <div class="kbd-hint">Space or arrows to move · Works with clickers</div>`;
  comp = new Compositor($("#lvFit .vs-stage"), { preview: true });
  fitRO.observe($("#lvFit"));
  $("#lvPrev").onclick = prev; $("#lvNext").onclick = next;
  $$(".ctrl[data-k]").forEach(b => b.onclick = () => toggle(b.dataset.k));
  $("#lvClear").onclick = clearAll;
  $("#msgText").oninput = e => { S.message.text = e.target.value; if (S.message.show || S.message.stage) pushSoon(); };
  $("#msgShow").onchange = e => { S.message.show = e.target.checked; push(); };
  $("#msgStage").onchange = e => { S.message.stage = e.target.checked; push(); };
  $("#tStage").onchange = e => { S.timer.stage = e.target.checked; push(); };
  $("#tDur").onchange = e => { S.timer.dur = +e.target.value; if (!S.timer.running) S.timer.left = S.timer.dur; push(); };
  $("#tGo").onclick = () => { const t = S.timer; if (t.running) { t.left = timerLeft(); t.running = false; } else { t.end = Date.now() + t.left * 1000; t.running = true; } push(); };
  $("#tReset").onclick = () => { const t = S.timer; t.running = false; t.left = t.dur; push(); };
  $("#vPlay").onclick = () => { const v = comp.video(); const cmd = v && v.paused ? "play" : "pause"; comp.control(cmd); ch.postMessage({ type: "video", cmd }); };
  $("#vRe").onclick = () => { comp.control("restart"); ch.postMessage({ type: "video", cmd: "restart" }); };
}
let pushT;
function pushSoon() { clearTimeout(pushT); pushT = setTimeout(push, 250); }

function updateLiveUI(st) {
  if (!$("#live")) return;
  $$(".ctrl[data-k]").forEach(b => b.classList.toggle("on", !!S[b.dataset.k]));
  const nv = $("#lvNextView");
  if (st.next) {
    const n = nextPos();
    nv.innerHTML = `<div class="th"></div><div class="tx">${esc(byId(n.presId).title)}${st.next.label ? " · " + esc(st.next.label) : ""}<br><span style="color:var(--text)">${esc((st.next.text || st.next.sub || (st.next.media ? "Media" : "")).slice(0, 120))}</span></div>`;
    renderThumb($(".th", nv), buildFrame(byId(n.presId), n.index));
  } else nv.innerHTML = `<div class="tx">End of service</div>`;
  $("#msgShow").checked = !!S.message.show; $("#msgStage").checked = !!S.message.stage;
  $("#tGo").innerHTML = icon(S.timer.running ? "pause" : "play");
  const lv = $("#lvBadge");
  lv.innerHTML = st.frame ? `<span class="dot live"></span>Live` : "";
}

function tick() {
  const f = $("#tFace");
  if (f) { const l = timerLeft(); f.textContent = fmt(l); f.classList.toggle("over", l < 0); }
  const v = comp && comp.video();
  const tv = $("#lvVid");
  if (tv) {
    tv.hidden = !v;
    if (v) {
      $("#vBar").style.width = (v.duration ? (v.currentTime / v.duration) * 100 : 0) + "%";
      $("#vT").textContent = fmt(Math.floor(v.currentTime || 0)) + " / " + fmt(Math.floor(v.duration || 0));
      const ic = v.paused ? "play" : "pause";
      if ($("#vPlay").dataset.ic !== ic) { $("#vPlay").dataset.ic = ic; $("#vPlay").innerHTML = icon(ic); }
    }
  }
  const on = Date.now() - S.outAt < 5000;
  const b = $("#bOut");
  if (b && b.classList.contains("live-on") !== on) renderTop();
}

function bindKeys() {
  document.addEventListener("keydown", e => {
    if ($(".modal-bg")) return;
    const t = e.target;
    if (t.closest && t.closest("input, textarea, select, [contenteditable]")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === "ArrowRight" || k === "ArrowDown" || k === " " || k === "PageDown") { e.preventDefault(); next(); }
    else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp") { e.preventDefault(); prev(); }
    else if (k === "Escape") clearAll();
    else if (k === "t" || k === "T") toggle("clearText");
    else if (k === "g" || k === "G") toggle("clearBg");
    else if (k === "l" || k === "L") toggle("logo");
    else if (k === "b" || k === "B" || k === ".") toggle("black");
  });
}

function newItem(addToSvc) {
  const m = modal({ title: "What would you like to create?", body: `<div class="types">${Object.entries(TYPES).map(([k, t]) => `<button class="type-card" data-t="${k}"><div class="ti">${icon(t.icon)}</div><b>${t.label}</b><small>${t.desc}</small></button>`).join("")}</div>`, wide: false });
  m.el.querySelector(".modal").style.width = "min(620px,100%)";
  $$("[data-t]", m.el).forEach(b => b.onclick = () => { m.close(); openEditor(null, b.dataset.t, addToSvc); });
}

async function dupItem(p) {
  try {
    const d = await DB.pres.create(clean({ ...JSON.parse(JSON.stringify(p)), title: (p.title || "Untitled") + " copy" }));
    S.lib.unshift(d); openItem(d.id); toast("Duplicated");
  } catch (e) { toast(errMsg(e), "err"); }
}
async function delItem(p) {
  if (!(await confirmBox(`"${p.title || "Untitled"}" will be removed from your library and every service.`))) return;
  try {
    await DB.pres.delete(p.id);
    S.lib = S.lib.filter(x => x.id !== p.id);
    for (const s of S.services) {
      const items = (s.items || []).filter(x => (typeof x === "string" ? x : x.presId) !== p.id);
      if (items.length !== (s.items || []).length) { s.items = items; DB.svc.update(s.id, { items }).catch(() => {}); }
    }
    if (S.live.presId === p.id) { S.live = { presId: null, index: -1 }; push(); }
    if (S.openId === p.id) S.openId = null;
    renderSide(); renderCenter(); toast("Deleted");
  } catch (e) { toast(errMsg(e), "err"); }
}

function serviceModal(s) {
  const m = modal({ title: s ? "Rename service" : "New service", body: `<form class="stack"><label class="field"><span>Name</span><input class="input" name="t" value="${esc(s ? s.title : "")}" placeholder="Sunday Morning" required></label><label class="field"><span>Date</span><input class="input" type="date" name="d" value="${esc(s ? s.date || "" : new Date().toISOString().slice(0, 10))}"></label><div class="row end gap"><button type="button" class="btn ghost" data-c>Cancel</button><button class="btn primary">${s ? "Save" : "Create"}</button></div></form>` });
  const f = $("form", m.el); $("input", f).focus();
  $("[data-c]", f).onclick = () => m.close();
  f.onsubmit = async e => {
    e.preventDefault();
    const title = f.t.value.trim() || "Untitled service", date = f.d.value;
    const b = $(".btn.primary", f); b.classList.add("busy");
    try {
      if (s) { await DB.svc.update(s.id, { title, date }); s.title = title; s.date = date; }
      else { const d = await DB.svc.create({ title, date, items: [] }); S.services.unshift(d); S.serviceId = d.id; store.set("service", d.id); }
      m.close(); S.tab = "service"; renderSide(); queueRemote();
    } catch (ex) { toast(errMsg(ex), "err"); b.classList.remove("busy"); }
  };
}
async function dupService(s) {
  if (!s) return;
  try { const d = await DB.svc.create({ title: (s.title || "Service") + " copy", date: s.date || "", items: (s.items || []).slice() }); S.services.unshift(d); S.serviceId = d.id; store.set("service", d.id); renderSide(); toast("Service duplicated"); }
  catch (e) { toast(errMsg(e), "err"); }
}
async function delService(s) {
  if (!s) return;
  if (S.services.length < 2) return toast("You need at least one service.", "err");
  if (!(await confirmBox(`Delete "${s.title}"? Items stay in your library.`))) return;
  try { await DB.svc.delete(s.id); S.services = S.services.filter(x => x.id !== s.id); S.serviceId = S.services[0].id; store.set("service", S.serviceId); renderSide(); }
  catch (e) { toast(errMsg(e), "err"); }
}

async function loadFiles() {
  if (S.files) return S.files;
  try { S.files = arr(await bread.files.list()).filter(f => !f.ownerId || f.ownerId === S.user.id); }
  catch (e) { S.files = []; }
  return S.files;
}
async function uploadFile(file) {
  if (file.size > 50 * 1024 * 1024) throw { error: `"${file.name}" is over 50 MB. Try a smaller file.` };
  const f = await bread.files.upload(file);
  const rec = { ...f, type: f.type || file.type, name: f.name || file.name, createdAt: new Date().toISOString() };
  if (S.files) S.files.unshift(rec);
  return rec;
}
const kindOf = t => String(t || "").startsWith("video") ? "video" : String(t || "").startsWith("image") ? "image" : "";

function openEditor(pres, type, addToSvc) {
  const isNew = !pres;
  const d = pres ? JSON.parse(JSON.stringify(clean(pres))) : {
    type, title: "", author: "", slides: [],
    theme: { ...PRESETS[S.settings.defaultPreset] || PRESETS.classic, preset: S.settings.defaultPreset || "classic" },
    opts: { loop: type !== "video", mute: false, fit: "contain" }
  };
  d.type = d.type || "slides"; d.theme = themeOf(d.theme); d.opts = d.opts || {};
  const media = d.type === "image" || d.type === "video";
  let src = media ? "" : blocksToSource(d.slides);
  let page = 0;
  const T = TYPES[d.type] || TYPES.slides;
  const body = h(`<div><div class="editor">
      <div class="stack" id="eL"></div>
      <div class="preview"><div id="ePrev"></div><div class="count"><span id="eCount"></span><span class="pager"><button class="icon-btn sm" id="pgP">${icon("left")}</button><button class="icon-btn sm" id="pgN">${icon("right")}</button></span></div><div id="eLook"></div></div>
    </div>
    <div class="editor-foot">${isNew ? "" : `<button class="btn ghost" id="eDel" style="color:var(--live)">${icon("trash")}Delete</button>`}<div class="grow"></div><button class="btn ghost" id="eCancel">Cancel</button><button class="btn primary" id="eSave">${isNew ? "Create" : "Save changes"}</button></div></div>`);
  const m = modal({ title: (isNew ? "New " : "Edit ") + T.label.toLowerCase(), body, wide: true });
  const L = $("#eL", body);
  const authorLabel = d.type === "song" ? "Artist or writer" : d.type === "sermon" ? "Speaker" : "";
  L.innerHTML = `<label class="field"><span>Title</span><input class="input" id="eTitle" value="${esc(d.title)}" placeholder="${{ song: "Amazing Grace", sermon: "Hope That Holds", scripture: "John 3:16-21", image: "Welcome slide", video: "Countdown", slides: "Announcements" }[d.type]}"></label>
    ${authorLabel ? `<label class="field"><span>${authorLabel}</span><input class="input" id="eAuthor" value="${esc(d.author || "")}"></label>` : ""}
    ${d.type === "scripture" || d.type === "sermon" ? `<div class="field"><span>${d.type === "sermon" ? "Insert a verse" : "Look up a passage"}</span><div class="row gap"><input class="input" id="sRef" placeholder="Romans 8:28-30"><select class="input" id="sTr" style="width:110px">${Object.entries(TRANSLATIONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select><select class="input" id="sPer" style="width:120px" title="Verses per slide"><option value="1">1 per slide</option><option value="2" selected>2 per slide</option><option value="3">3 per slide</option></select><button class="btn" id="sGo">${d.type === "sermon" ? "Insert" : "Find"}</button></div></div>` : ""}
    ${media ? `<div class="drop" id="eDrop">${icon("upload")}<div><b>Drop ${d.type === "image" ? "images" : "a video"} here</b> or click to choose</div><div class="hint">Up to 50 MB each</div><input type="file" id="eFile" hidden accept="${d.type === "image" ? "image/*" : "video/*"}" ${d.type === "image" ? "multiple" : ""}></div>
      <div class="media-grid" id="eMedia"></div>
      <div class="look"><div class="lrow"><span>Fit</span><div class="seg" id="oFit"><button data-v="contain">Whole picture</button><button data-v="cover">Fill screen</button></div></div>
      ${d.type === "video" ? `<div class="lrow"><span>Loop</span><label class="switch"><input type="checkbox" id="oLoop" ${d.opts.loop ? "checked" : ""}><i></i></label></div><div class="lrow"><span>Mute</span><label class="switch"><input type="checkbox" id="oMute" ${d.opts.mute ? "checked" : ""}><i></i></label></div>` : ""}</div>`
      : `<label class="field"><span>Slides</span><textarea class="input" id="eSrc" rows="16" placeholder="${d.type === "song" ? "[Verse 1]\nAmazing grace how sweet the sound\nThat saved a wretch like me\n\n[Chorus]\n..." : "Type your first slide\n\nLeave an empty line to start a new slide"}">${esc(src)}</textarea><span class="hint">Empty line = new slide. A line like [Chorus] names a section. Start a line with ~ for a small caption.</span></label>`}`;
  const prevEl = $("#ePrev", body);
  const syncSlides = () => { if (!media) d.slides = parseBlocks($("#eSrc", body).value); };
  const draw = () => {
    const n = d.slides.length;
    if (page >= n) page = Math.max(0, n - 1);
    const f = n ? buildFrame({ ...d, id: "edit" }, page) : buildFrame({ ...d, id: "edit", slides: [{ text: media ? "" : "Your words appear here" }] }, 0);
    renderThumb(prevEl, f);
    $("#eCount", body).textContent = n ? `Slide ${page + 1} of ${n}` : "No slides yet";
  };
  $("#pgP", body).onclick = () => { page = Math.max(0, page - 1); draw(); };
  $("#pgN", body).onclick = () => { page = Math.min(d.slides.length - 1, page + 1); draw(); };
  if (!media) {
    const ta = $("#eSrc", body);
    ta.oninput = () => { syncSlides(); draw(); };
    ta.onkeyup = ta.onclick = () => { const before = ta.value.slice(0, ta.selectionStart); const idx = parseBlocks(before + "x").length - 1; if (idx !== page && idx >= 0) { page = idx; draw(); } };
    lookPanel($("#eLook", body), d, draw);
  }
  const sGo = $("#sGo", body);
  if (sGo) sGo.onclick = async () => {
    const ref = $("#sRef", body).value.trim(); if (!ref) return $("#sRef", body).focus();
    sGo.classList.add("busy");
    try {
      const tr = $("#sTr", body).value, j = await fetchScripture(ref, tr);
      const block = scriptureSource(j, +$("#sPer", body).value, tr);
      const ta = $("#eSrc", body);
      ta.value = d.type === "scripture" ? block : (ta.value.trim() ? ta.value.replace(/\s+$/, "") + "\n\n" : "") + block;
      if (d.type === "scripture" && !$("#eTitle", body).value.trim()) $("#eTitle", body).value = j.reference;
      syncSlides(); page = d.type === "scripture" ? 0 : d.slides.length - 1; draw();
    } catch (e) { toast(errMsg(e), "err"); }
    sGo.classList.remove("busy");
  };
  if (sGo) $("#sRef", body).onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); sGo.click(); } };
  if (media) {
    const grid = $("#eMedia", body), inp = $("#eFile", body), drop = $("#eDrop", body);
    const drawMedia = () => {
      grid.innerHTML = "";
      d.slides.forEach((s, i) => {
        const t = h(`<div class="media-tile ${i === page ? "on" : ""}"><div></div><button class="icon-btn sm rm" title="Remove">${icon("x")}</button></div>`);
        renderThumb(t.firstElementChild, { bg: { type: "media", kind: s.media.kind, url: mediaUrl(s.media.filename), fit: "cover" } });
        t.onclick = e => { if (e.target.closest(".rm")) { d.slides.splice(i, 1); drawMedia(); draw(); return; } page = i; drawMedia(); draw(); };
        grid.append(t);
      });
      drop.hidden = d.type === "video" && d.slides.length > 0;
    };
    const handle = async files => {
      files = [...files].filter(f => kindOf(f.type) === d.type);
      if (!files.length) return toast(`Please choose ${d.type === "image" ? "an image" : "a video"} file.`, "err");
      if (d.type === "video") files = files.slice(0, 1);
      drop.classList.add("over"); drop.querySelector("b").textContent = "Uploading…";
      for (const f of files) {
        try { const r = await uploadFile(f); d.slides.push({ id: uid(), text: "", media: { filename: r.filename, kind: d.type, name: f.name } }); if (!$("#eTitle", body).value.trim()) $("#eTitle", body).value = f.name.replace(/\.[^.]+$/, ""); }
        catch (e) { toast(errMsg(e), "err"); }
      }
      drop.classList.remove("over"); drop.querySelector("b").textContent = `Drop ${d.type === "image" ? "images" : "a video"} here`;
      page = d.slides.length - 1; drawMedia(); draw();
    };
    drop.onclick = () => inp.click();
    inp.onchange = () => handle(inp.files);
    drop.ondragover = e => { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = () => drop.classList.remove("over");
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove("over"); handle(e.dataTransfer.files); };
    const fit = $("#oFit", body);
    const setFit = () => $$("button", fit).forEach(b => b.classList.toggle("on", b.dataset.v === (d.opts.fit || "contain")));
    $$("button", fit).forEach(b => b.onclick = () => { d.opts.fit = b.dataset.v; setFit(); draw(); });
    setFit();
    const lp = $("#oLoop", body), mu = $("#oMute", body);
    if (lp) lp.onchange = () => d.opts.loop = lp.checked;
    if (mu) mu.onchange = () => d.opts.mute = mu.checked;
    drawMedia();
  }
  draw();
  $("#eCancel", body).onclick = () => m.close();
  const del = $("#eDel", body); if (del) del.onclick = () => { m.close(); delItem(pres); };
  $("#eSave", body).onclick = async e => {
    syncSlides();
    d.title = $("#eTitle", body).value.trim() || (d.slides[0] && (d.slides[0].text || "").split("\n")[0].slice(0, 60)) || "Untitled " + T.label.toLowerCase();
    const a = $("#eAuthor", body); if (a) d.author = a.value.trim();
    if (!d.slides.length) return toast(media ? "Add a file first." : "Add at least one slide.", "err");
    const b = e.currentTarget; b.classList.add("busy");
    try {
      if (isNew) {
        const doc = await DB.pres.create(clean(d));
        S.lib.unshift(doc);
        if (addToSvc) await setSvcItems([...svcItems(), doc.id]);
        S.openId = doc.id;
      } else {
        const doc = await DB.pres.update(pres.id, clean(d));
        const i = S.lib.findIndex(x => x.id === pres.id);
        S.lib[i] = { ...pres, ...clean(d), ...(doc && doc.id ? doc : {}) };
        if (S.live.presId === pres.id && S.live.index >= d.slides.length) S.live.index = d.slides.length - 1;
      }
      m.close(); renderSide(); renderCenter(); push();
      toast(isNew ? "Created" : "Saved");
    } catch (ex) { toast(errMsg(ex), "err"); b.classList.remove("busy"); }
  };
  setTimeout(() => { const t = $("#eTitle", body); if (t && isNew) t.focus(); }, 50);
}

function lookPanel(root, d, onChange) {
  const th = d.theme;
  root.innerHTML = `<div class="look">
    <div class="sec-title" style="margin:6px 0 -4px"><span>Look</span></div>
    <div class="presets" id="lkP"></div>
    <div class="lrow"><span>Font</span><select class="input" id="lkFont" style="height:34px">${Object.keys(FONTS).map(f => `<option ${th.font === f ? "selected" : ""} value="${f}">${f === "Playfair" ? "Playfair Display" : f}</option>`).join("")}</select></div>
    <div class="lrow"><span>Size</span><input type="range" id="lkSize" min="40" max="160" value="${th.size}"></div>
    <div class="lrow"><span>Text color</span><input type="color" id="lkColor" value="${th.color}"><span class="grow"></span><label class="row gap hint"><span class="switch"><input type="checkbox" id="lkUp" ${th.upper ? "checked" : ""}><i></i></span>CAPS</label><label class="row gap hint"><span class="switch"><input type="checkbox" id="lkSh" ${th.shadow ? "checked" : ""}><i></i></span>Shadow</label></div>
    <div class="lrow"><span>Align</span><div class="seg" id="lkAl"><button data-v="left">Left</button><button data-v="center">Center</button></div></div>
    <div class="lrow"><span>Position</span><div class="seg" id="lkVa"><button data-v="top">Top</button><button data-v="middle">Middle</button><button data-v="bottom">Bottom</button></div></div>
    <div class="lrow"><span>Background</span><div class="seg" id="lkBg"><button data-v="color">Color</button><button data-v="gradient">Gradient</button><button data-v="image">Image</button><button data-v="video">Video</button></div></div>
    <div class="lrow" id="lkCols"><span></span><input type="color" id="lkC1" value="${th.bgColor}"><input type="color" id="lkC2" value="${th.bgColor2}"></div>
    <div id="lkMedia"></div>
    <div class="lrow" id="lkDimRow"><span>Darken</span><input type="range" id="lkDim" min="0" max="0.8" step="0.05" value="${th.overlay || 0}"></div>
    <label class="row gap hint"><span class="switch"><input type="checkbox" id="lkBand" ${th.band ? "checked" : ""}><i></i></span>Text box behind words</label>
  </div>`;
  const P = $("#lkP", root);
  const drawPresets = () => {
    P.innerHTML = "";
    for (const [k, p] of Object.entries(PRESETS)) {
      const b = h(`<button class="preset ${th.preset === k ? "on" : ""}"><div></div><span>${p.name}</span></button>`);
      renderThumb(b.firstElementChild, buildFrame({ id: "p", theme: p, slides: [{ text: "Grace" }] }, 0));
      b.onclick = () => { const keepMedia = th.bgType === "image" || th.bgType === "video" ? { bgType: th.bgType, bgFile: th.bgFile, overlay: th.overlay } : {}; Object.assign(th, PRESETS[k], keepMedia, { preset: k }); lookPanel(root, d, onChange); onChange(); };
      P.append(b);
    }
  };
  drawPresets();
  const changed = () => { th.preset = ""; $$(".preset", P).forEach(b => b.classList.remove("on")); onChange(); };
  const bind = (id, k, f = v => v) => { const el = $(id, root); el.oninput = el.onchange = () => { th[k] = f(el.type === "checkbox" ? el.checked : el.value); changed(); }; };
  bind("#lkFont", "font"); bind("#lkSize", "size", Number); bind("#lkColor", "color"); bind("#lkUp", "upper"); bind("#lkSh", "shadow");
  bind("#lkC1", "bgColor"); bind("#lkC2", "bgColor2"); bind("#lkDim", "overlay", Number); bind("#lkBand", "band");
  const seg = (id, k, after) => { const s = $(id, root); const up = () => $$("button", s).forEach(b => b.classList.toggle("on", b.dataset.v === th[k])); $$("button", s).forEach(b => b.onclick = () => { th[k] = b.dataset.v; up(); after && after(); changed(); }); up(); };
  seg("#lkAl", "align"); seg("#lkVa", "valign");
  const bgUi = () => {
    const t = th.bgType;
    $("#lkC2", root).hidden = t !== "gradient";
    $("#lkCols", root).hidden = t === "image" || t === "video";
    $("#lkDimRow", root).hidden = !(t === "image" || t === "video");
    const M = $("#lkMedia", root);
    if (t === "image" || t === "video") mediaPicker(M, t, th.bgFile, f => { th.bgFile = f; th.bgKind = t; changed(); });
    else M.innerHTML = "";
  };
  seg("#lkBg", "bgType", bgUi);
  bgUi();
}

async function mediaPicker(root, kind, current, onPick) {
  root.innerHTML = `<div class="drop" style="padding:14px">${icon("upload")}<div><b>Upload ${kind}</b></div><input type="file" hidden accept="${kind}/*"></div><div class="media-grid"></div>`;
  const drop = $(".drop", root), inp = $("input", root), grid = $(".media-grid", root);
  const draw = files => {
    grid.innerHTML = "";
    files.filter(f => kindOf(f.type) === kind).slice(0, 24).forEach(f => {
      const t = h(`<div class="media-tile ${f.filename === current ? "on" : ""}" title="${esc(f.name || "")}"><div></div></div>`);
      renderThumb(t.firstElementChild, { bg: { type: "media", kind, url: mediaUrl(f.filename), fit: "cover" } });
      t.onclick = () => { current = f.filename; onPick(f.filename); draw(files); };
      grid.append(t);
    });
  };
  drop.onclick = () => inp.click();
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    drop.querySelector("b").textContent = "Uploading…";
    try { const r = await uploadFile(f); current = r.filename; onPick(r.filename); draw(await loadFiles()); }
    catch (e) { toast(errMsg(e), "err"); }
    drop.querySelector("b").textContent = "Upload " + kind;
  };
  draw(await loadFiles());
}

function settingsModal() {
  const st = { ...S.settings };
  const body = h(`<div>
    <div class="settings-sec"><h3>Church</h3><div class="stack">
      <label class="field"><span>Church name</span><input class="input" id="sName" value="${esc(st.churchName)}" placeholder="Grace Community Church"></label>
      <div class="field"><span>Logo shown when you press Logo</span><div class="row gap"><div id="sLogo" style="width:120px;border-radius:8px;overflow:hidden"></div><button class="btn sm" id="sLogoUp">${icon("upload")}Upload</button><button class="btn sm ghost" id="sLogoRm">Use Vespa logo</button><input type="file" id="sLogoF" accept="image/*" hidden></div></div>
    </div></div>
    <div class="settings-sec"><h3>Presenting</h3><div class="stack">
      <div class="row between"><span>Transition</span><div class="seg" id="sTr">${[[0, "None"], [0.25, "Quick"], [0.5, "Smooth"], [1, "Slow"]].map(([v, l]) => `<button data-v="${v}">${l}</button>`).join("")}</div></div>
      <div class="row between"><span>Appearance</span><div class="seg" id="sTheme"><button data-v="system">Auto</button><button data-v="light">${icon("sun")}Light</button><button data-v="dark">${icon("moon")}Dark</button></div></div>
      <div class="row between"><span>Default look for new items</span><select class="input" id="sPre" style="width:160px;height:34px">${Object.entries(PRESETS).map(([k, p]) => `<option value="${k}" ${st.defaultPreset === k ? "selected" : ""}>${p.name}</option>`).join("")}</select></div>
    </div></div>
    <div class="settings-sec"><h3>Account and security</h3><div class="stack">
      <div class="row between"><span>${esc(S.user.email)}</span><span class="hint">${icon("check")} Verified</span></div>
      <div class="row between"><span>Two-step verification</span><button class="btn sm" id="sMfa">${S.user.mfaEnabled ? "Turn off" : "Turn on"}</button></div>
      <div class="row between"><span>Signed in on other devices?</span><button class="btn sm" id="sOthers">Sign out other devices</button></div>
      <div class="row between"><span>Change password</span><button class="btn sm" id="sPw">Email me a link</button></div>
    </div></div>
    <div class="editor-foot"><div class="grow"></div><button class="btn ghost" id="sCancel">Cancel</button><button class="btn primary" id="sSave">Save</button></div>
  </div>`);
  const m = modal({ title: "Settings", body });
  m.el.querySelector(".modal").style.width = "min(560px,100%)";
  const drawLogo = () => renderThumb($("#sLogo", body), { bg: { type: "media", kind: "image", url: st.logoFile ? mediaUrl(st.logoFile) : VESPA.logo, fit: "contain", color: "#000" } });
  drawLogo();
  $("#sLogoUp", body).onclick = () => $("#sLogoF", body).click();
  $("#sLogoF", body).onchange = async e => { const f = e.target.files[0]; if (!f) return; const b = $("#sLogoUp", body); b.classList.add("busy"); try { st.logoFile = (await uploadFile(f)).filename; drawLogo(); } catch (x) { toast(errMsg(x), "err"); } b.classList.remove("busy"); };
  $("#sLogoRm", body).onclick = () => { st.logoFile = ""; drawLogo(); };
  const seg = (id, val, set) => { const s = $(id, body); const up = v => $$("button", s).forEach(b => b.classList.toggle("on", b.dataset.v === String(v))); $$("button", s).forEach(b => b.onclick = () => { set(b.dataset.v); up(b.dataset.v); }); up(val); };
  seg("#sTr", st.transition, v => st.transition = +v);
  seg("#sTheme", Theme.get(), v => Theme.set(v));
  $("#sPre", body).onchange = e => st.defaultPreset = e.target.value;
  $("#sMfa", body).onclick = () => { m.close(); mfaModal(); };
  $("#sOthers", body).onclick = async () => { try { await bread.auth.revokeOtherSessions(); toast("Other devices have been signed out."); } catch (e) { toast(errMsg(e), "err"); } };
  $("#sPw", body).onclick = async () => { try { await bread.auth.forgotPassword(S.user.email); toast("Check your email for a link to set a new password."); } catch (e) { toast(errMsg(e), "err"); } };
  $("#sCancel", body).onclick = () => m.close();
  $("#sSave", body).onclick = async e => {
    st.churchName = $("#sName", body).value.trim();
    const b = e.currentTarget; b.classList.add("busy");
    try {
      if (S.settingsDoc) await DB.settings.update(S.user.id, st);
      else { try { await DB.settings.create(st, S.user.id); } catch (x) { if (x.status === 409) await DB.settings.update(S.user.id, st); else throw x; } S.settingsDoc = true; }
      S.settings = st; renderTop(); push(); m.close(); toast("Settings saved");
    } catch (x) { toast(errMsg(x), "err"); b.classList.remove("busy"); }
  };
}

async function mfaModal() {
  if (S.user.mfaEnabled) {
    const m = modal({ title: "Turn off two-step verification", body: `<form class="stack"><p class="muted">Enter a code from your authenticator app to confirm.</p><input class="input code" name="c" inputmode="numeric" maxlength="6" placeholder="000000"><button class="btn primary lg">Turn off</button></form>` });
    $("form", m.el).onsubmit = async e => { e.preventDefault(); try { await bread.auth.mfa.disable(e.target.c.value.trim()); S.user.mfaEnabled = false; m.close(); toast("Two-step verification is off."); } catch (x) { toast(errMsg(x), "err"); } };
    return;
  }
  let setup;
  try { setup = await bread.auth.mfa.setup(); } catch (e) { return toast(errMsg(e), "err"); }
  const m = modal({ title: "Turn on two-step verification", body: `<form class="stack"><p class="muted">Scan this with an authenticator app like Google Authenticator, then type the 6-digit code it shows.</p><div class="qr"><img src="${esc(setup.qrCodeUrl)}" width="180" height="180" alt="QR code"></div><p class="hint" style="text-align:center;word-break:break-all">${esc(setup.secret)}</p><input class="input code" name="c" inputmode="numeric" maxlength="6" placeholder="000000"><button class="btn primary lg">Turn on</button></form>` });
  $("form", m.el).onsubmit = async e => { e.preventDefault(); try { await bread.auth.mfa.enable(e.target.c.value.trim(), setup.secret); S.user.mfaEnabled = true; m.close(); toast("Two-step verification is on."); } catch (x) { toast(errMsg(x), "err"); } };
}

function remoteUrl() { return new URL("remote.html", location.href).href; }
function remoteModal() {
  const url = remoteUrl();
  const m = modal({ title: "Control from your phone", body: `<div class="stack" style="text-align:center"><p class="muted">Scan with your phone's camera and sign in with this same account. Your phone becomes a remote for this screen.</p><div class="qr" id="qr"></div><div class="copy-row"><input class="input" readonly value="${esc(url)}"><button class="btn" id="cp">${icon("copy")}</button></div><p class="hint" id="rStat"></p></div>` });
  try { new QRCode($("#qr", m.el), { text: url, width: 180, height: 180, correctLevel: QRCode.CorrectLevel.M }); } catch (e) { $("#qr", m.el).hidden = true; }
  $("#cp", m.el).onclick = () => { navigator.clipboard.writeText(url).then(() => toast("Link copied")); };
  $("#rStat", m.el).innerHTML = Date.now() - S.phoneAt < 120000 ? `<span class="dot on"></span> A phone used the remote recently` : "Keep this window open while you present.";
}

async function initRemote() {
  try { const d = await DB.remote.getById(S.user.id); S.remoteNonce = d && d.command ? d.command.nonce : null; S.remoteReady = true; }
  catch (e) {
    if (e && e.status === 404) { try { await DB.remote.create({ state: {}, command: null }, S.user.id); S.remoteReady = true; } catch (x) {} }
  }
  queueRemote();
  subscribeRemote();
  setInterval(pollRemote, 4000);
  setInterval(() => queueRemote(), 30000);
}
function subscribeRemote() {
  try {
    if (S.unsubRemote) S.unsubRemote();
    const r = DB.remote.subscribe(ev => { if (ev && ev.docId === S.user.id && ev.doc) handleCmd(ev.doc.command); });
    if (r && r.then) r.then(f => S.unsubRemote = f).catch(() => {}); else S.unsubRemote = r;
  } catch (e) {}
}
async function pollRemote() {
  if (!S.remoteReady || document.hidden && Date.now() - S.phoneAt > 300000) return;
  try { const d = await DB.remote.getById(S.user.id); handleCmd(d && d.command); } catch (e) {}
}
function handleCmd(c) {
  if (!c || !c.nonce || c.nonce === S.remoteNonce) return;
  S.remoteNonce = c.nonce;
  if (c.from !== "phone" || Date.now() - (c.at || 0) > 30000) return;
  S.phoneAt = Date.now();
  switch (c.action) {
    case "next": next(); break;
    case "prev": prev(); break;
    case "goto": if (byId(c.presId)) goLive(c.presId, +c.index || 0); break;
    case "clearText": case "black": case "logo": case "clearBg": toggle(c.action); break;
    case "clearAll": clearAll(); break;
    case "timer": $("#tGo").click(); break;
  }
}
let remT, remLast = 0;
function queueRemote() {
  if (!S.remoteReady) return;
  clearTimeout(remT);
  const wait = Math.max(300, 700 - (Date.now() - remLast));
  remT = setTimeout(async () => {
    remLast = Date.now();
    const p = byId(S.live.presId) || byId(S.openId);
    const state = {
      service: svc() ? svc().title : "",
      presId: p ? p.id : null, title: p ? p.title : "", type: p ? p.type : "",
      index: p && p.id === S.live.presId ? S.live.index : -1,
      slides: p ? p.slides.map(s => ({ t: (s.text || s.sub || (s.media ? (s.media.name || s.media.kind) : "")).slice(0, 160), l: s.label || "" })) : [],
      items: svcItems().map(id => byId(id)).filter(Boolean).map(x => ({ id: x.id, title: x.title, type: x.type })),
      liveId: S.live.presId,
      flags: { clearText: S.clearText, clearBg: S.clearBg, black: S.black, logo: S.logo },
      at: Date.now()
    };
    try { await DB.remote.update(S.user.id, { state }); } catch (e) {}
  }, wait);
}
