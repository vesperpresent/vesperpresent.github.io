const ch = new BroadcastChannel("vespa-live");
const ONE = { song: "song", sermon: "sermon", scripture: "scripture", image: "photo", video: "video", slides: "slides" };
const arr = x => Array.isArray(x) ? x : (x && (x.docs || x.data || x.items)) || [];
const store = { get(k, d) { try { const v = localStorage.getItem("vespa-" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem("vespa-" + k, JSON.stringify(v)); } catch (e) {} } };
const fmt = sec => { const neg = sec < 0; sec = Math.abs(sec); const m = Math.floor(sec / 60), s = sec % 60; return (neg ? "-" : "") + m + ":" + String(s).padStart(2, "0"); };

const S = {
  user: null, settings: { churchName: "", logoFile: "", transition: 0.5 },
  lib: [], services: [], serviceId: store.get("service", null), openId: null,
  live: { presId: null, index: -1 },
  clearText: false, clearBg: false, black: false, logo: false,
  message: { text: "", show: false }, backMessage: { text: "", show: false }, backMode: store.get("backMode", "notes"),
  timer: { dur: 300, left: 300, end: null, running: false, back: true },
  frontAt: 0, backAt: 0, phoneAt: 0, remoteNonce: null, remoteReady: false
};
let DB, comp;

requireUser($("#root"), "projector", u => { S.user = u; boot(); });

async function boot() {
  DB = { pres: bread.collection("presentations"), svc: bread.collection("services"), settings: bread.collection("settings"), remote: bread.collection("remote") };
  shell();
  await load();
  buildRight();
  renderAll(); push();
  bindKeys(); initRemote(); live();
  setInterval(tick, 250);
}

async function load() {
  try {
    const [lib, svcs, set] = await Promise.all([
      DB.pres.get({ limit: 500, orderBy: "updatedAt", order: "desc" }),
      DB.svc.get({ limit: 200, orderBy: "updatedAt", order: "desc" }),
      DB.settings.get({ limit: 5 })
    ]);
    S.lib = arr(lib); S.services = arr(svcs);
    const st = arr(set)[0]; if (st) Object.assign(S.settings, { churchName: st.churchName || "", logoFile: st.logoFile || "", transition: st.transition ?? 0.5 });
  } catch (e) { toast(errMsg(e), "err"); }
  if (S.serviceId !== "all" && !S.services.find(s => s.id === S.serviceId)) S.serviceId = S.services[0] ? S.services[0].id : "all";
  if (!byId(S.openId)) S.openId = items()[0] || null;
}

function live() {
  const on = (col, list, after) => {
    try {
      const r = col.subscribe(ev => {
        if (!ev) return;
        const L = S[list];
        const i = L.findIndex(x => x.id === ev.docId);
        if (ev.action === "delete") { if (i >= 0) L.splice(i, 1); }
        else if (ev.doc) { if (i >= 0) L[i] = ev.doc; else L.unshift(ev.doc); }
        after();
      });
      if (r && r.catch) r.catch(() => {});
    } catch (e) {}
  };
  on(DB.pres, "lib", () => { renderAll(); push(); });
  on(DB.svc, "services", () => renderAll());
}

const byId = id => S.lib.find(p => p.id === id);
const svc = () => S.services.find(s => s.id === S.serviceId);
const items = () => S.serviceId === "all" ? S.lib.map(p => p.id) : ((svc() && svc().items) || []).filter(id => byId(id));

function shell() {
  $("#root").innerHTML = `<div class="topbar"><img src="${VESPA.logo}" alt="Vespa"><span class="name">Vespa</span><span class="where" id="where"></span>
    <span class="right"><span>Signed in as ${esc(S.user.email)}</span> | <button class="linkbtn" id="tRemote">Phone remote</button> | <button class="linkbtn" id="tTheme"></button> | <button class="linkbtn" id="tAcct">Account</button> | <button class="linkbtn" id="tOut">Sign out</button></span></div>
    <div class="menubar pj-bar"><label>Service: <select class="input" id="svcSel" style="width:auto;height:22px"></select></label>
      <button class="btn sm" id="reload">Reload</button>
      <span class="grow"></span>
      <span>Front screen: <b id="stFront">closed</b></span><span>Back screen: <b id="stBack">closed</b></span></div>
    <div class="pj" id="pj">
      <fieldset class="pj-order"><legend>Running order</legend><div id="order"></div></fieldset>
      <fieldset class="pj-slides"><legend id="slTitle">Slides</legend><div id="grid" class="grid"></div></fieldset>
      <div class="pj-right" id="right"></div>
    </div>`;
  $("#svcSel").onchange = e => { S.serviceId = e.target.value; store.set("service", S.serviceId); S.openId = items()[0] || null; renderAll(); queueRemote(); };
  $("#reload").onclick = async () => { await load(); renderAll(); push(); toast("Reloaded."); };
  $("#tTheme").onclick = () => { Theme.toggle(); drawTop(); };
  $("#tOut").onclick = () => signOutTo("projector.html");
  $("#tRemote").onclick = remoteModal;
  $("#tAcct").onclick = () => { const m = modal({ title: "Account", body: accountBox(S.user) }); bindAccountBox(m.el, S.user); };
}
function drawTop() {
  $("#where").textContent = "Projector" + (S.settings.churchName ? " - " + S.settings.churchName : "");
  $("#tTheme").textContent = Theme.effective() === "dark" ? "Light mode" : "Dark mode";
}

function renderAll() {
  drawTop();
  $("#svcSel").innerHTML = S.services.map(s => `<option value="${esc(s.id)}">${esc(s.title || "Untitled")}${s.date ? " (" + esc(s.date) + ")" : ""}</option>`).join("") + `<option value="all">Whole library</option>`;
  $("#svcSel").value = S.serviceId;
  renderOrder(); renderGrid();
}

function renderOrder() {
  const O = $("#order");
  if (!S.lib.length) {
    O.innerHTML = `<p>Nothing has been shared with this login yet.</p><p>Ask your church admin to sign in on the admin page, open <b>Settings</b>, and add this email address under <b>Projector logins</b>:</p><p><b>${esc(S.user.email)}</b></p><p>Then click <b>Reload</b>.</p>`;
    return;
  }
  const ids = items();
  O.innerHTML = `<table class="list">${ids.length ? ids.map((id, i) => { const p = byId(id); return `<tr class="${id === S.openId ? "sel" : ""}" data-id="${esc(id)}"><td class="n">${i + 1}</td><td><a href="#">${esc(p.title || "Untitled")}</a><br><span class="hint">${ONE[p.type] || ""}, ${(p.slides || []).length} slide${(p.slides || []).length === 1 ? "" : "s"}</span></td><td class="act">${S.live.presId === id ? '<b class="live">LIVE</b>' : ""}</td></tr>`; }).join("") : `<tr><td>This service is empty. The admin adds items to it on the Services page.</td></tr>`}</table>`;
  $$("#order tr[data-id]").forEach(r => {
    r.onclick = e => { e.preventDefault(); S.openId = r.dataset.id; renderOrder(); renderGrid(); queueRemote(); };
    r.ondblclick = () => goLive(r.dataset.id, 0);
  });
}

function renderGrid() {
  const p = byId(S.openId), g = $("#grid");
  $("#slTitle").textContent = p ? `Slides: ${p.title || "Untitled"}` : "Slides";
  if (!p) { g.innerHTML = `<p>Choose an item from the running order.</p>`; return; }
  g.innerHTML = "";
  p.slides.forEach((s, i) => {
    const el = h(`<button class="slide" data-i="${i}"><div class="th"></div><div class="cap"><b>${i + 1}</b> ${esc(s.label || "")}</div></button>`);
    renderThumb($(".th", el), buildFrame(p, i));
    el.onclick = () => goLive(p.id, i);
    g.append(el);
  });
  markLive();
}
function markLive() { $$("#grid .slide").forEach(el => el.classList.toggle("live", S.live.presId === S.openId && +el.dataset.i === S.live.index)); }

function goLive(presId, i) {
  const p = byId(presId); if (!p || !p.slides[i]) return;
  const changed = S.live.presId !== presId;
  S.live = { presId, index: i };
  S.clearText = S.black = S.logo = S.clearBg = false;
  if (S.openId !== presId) { S.openId = presId; renderOrder(); renderGrid(); }
  else { markLive(); if (changed) renderOrder(); }
  const el = $(`#grid .slide[data-i="${i}"]`); if (el) el.scrollIntoView({ block: "nearest" });
  push();
}
function nextPos(from = S.live) {
  const p = byId(from.presId); if (!p) return null;
  if (from.index < p.slides.length - 1) return { presId: p.id, index: from.index + 1 };
  const ids = items(), k = ids.indexOf(p.id);
  if (k >= 0) for (let j = k + 1; j < ids.length; j++) { const q = byId(ids[j]); if (q && q.slides.length) return { presId: q.id, index: 0 }; }
  return null;
}
function prevPos(from = S.live) {
  const p = byId(from.presId); if (!p) return null;
  if (from.index > 0) return { presId: p.id, index: from.index - 1 };
  const ids = items(), k = ids.indexOf(p.id);
  if (k > 0) for (let j = k - 1; j >= 0; j--) { const q = byId(ids[j]); if (q && q.slides.length) return { presId: q.id, index: q.slides.length - 1 }; }
  return null;
}
function next() {
  if (!byId(S.live.presId) || S.openId !== S.live.presId) { const p = byId(S.openId); if (p && p.slides.length) return goLive(p.id, 0); return; }
  const n = nextPos(); if (n) goLive(n.presId, n.index);
}
function prev() { const n = prevPos(); if (n) goLive(n.presId, n.index); }
function toggle(k) { S[k] = !S[k]; push(); }
function clearAll() { S.clearText = S.clearBg = true; S.logo = S.black = false; S.message.show = false; push(); }
function timerLeft() { const t = S.timer; return t.running ? Math.round((t.end - Date.now()) / 1000) : t.left; }

function liveState() {
  const p = byId(S.live.presId);
  const n = nextPos();
  const nf = n ? buildFrame(byId(n.presId), n.index) : null;
  return {
    frame: p ? buildFrame(p, S.live.index) : null,
    next: nf ? { text: nf.text, sub: nf.sub, label: nf.label, media: !!byId(n.presId).slides[n.index].media } : null,
    title: p ? p.title : "", clearText: S.clearText, clearBg: S.clearBg, black: S.black, logo: S.logo,
    logoUrl: S.settings.logoFile ? mediaUrl(S.settings.logoFile) : "",
    message: S.message, backMessage: S.backMessage, backMode: S.backMode,
    timer: { running: S.timer.running, end: S.timer.end, left: S.timer.left, back: S.timer.back },
    transition: +S.settings.transition, at: Date.now()
  };
}
function push() {
  const st = liveState();
  if (comp) comp.set(st);
  ch.postMessage({ type: "state", state: st });
  updateRight(st);
  queueRemote();
}

ch.onmessage = e => {
  const m = e.data || {};
  if (m.type === "hello") push();
  if (m.type === "ping") { if (m.view === "stage") S.backAt = Date.now(); else S.frontAt = Date.now(); }
};

async function openScreen(back) {
  const isOpen = Date.now() - (back ? S.backAt : S.frontAt) < 5000;
  if (isOpen) { ch.postMessage({ type: back ? "close-stage" : "close" }); if (back) S.backAt = 0; else S.frontAt = 0; return; }
  const w = window.open(back ? "output.html?view=stage" : "output.html", back ? "vespa-back" : "vespa-front", "popup=yes,width=960,height=540");
  if (!w) return toast("The browser blocked the new window. Allow pop-ups for this site and try again.", "err");
  if (!back && "getScreenDetails" in window) {
    try {
      const d = await window.getScreenDetails();
      const other = d.screens.find(s => s !== d.currentScreen);
      if (other && !w.closed) { w.moveTo(other.availLeft, other.availTop); w.resizeTo(other.availWidth, other.availHeight); }
    } catch (e) {}
  }
  toast(`${back ? "Back" : "Front"} screen opened. Move it to the right display and double-click it for full screen.`);
}

function buildRight() {
  $("#right").innerHTML = `
    <fieldset><legend>Front screen</legend>
      <p><button class="btn" id="oFront">Open front screen</button></p>
      <div class="vs-fit pv" id="pvFront"><div class="vs-stage"></div></div>
      <p class="row gap" style="margin-top:6px"><button class="btn lg" id="bPrev">&lt; Back</button><button class="btn lg primary grow" id="bNext">Next &gt;</button></p>
      <div class="row gap" style="flex-wrap:wrap">
        <button class="btn" data-k="clearText">Hide text</button><button class="btn" data-k="clearBg">Hide picture</button><button class="btn" data-k="logo">Logo</button><button class="btn" data-k="black">Black</button><button class="btn" id="bClear">Clear all</button>
      </div>
      <div id="vid" class="vidrow" hidden>Video: <button class="btn sm" id="vPlay">Pause</button> <button class="btn sm" id="vRe">Start again</button> <span id="vT"></span></div>
      <p style="margin-top:8px"><label class="field"><span>Message on the front screen</span><input class="input" id="mFront" placeholder="Example: The car with plate ABC 123 has its lights on"></label><label><input type="checkbox" id="mFrontOn">Show message</label></p>
    </fieldset>
    <fieldset><legend>Back screen</legend>
      <p><button class="btn" id="oBack">Open back screen</button></p>
      <p><label>Shows: <select class="input" id="bMode" style="width:auto"><option value="notes">Notes for the people on stage</option><option value="mirror">The same as the front screen</option></select></label></p>
      <div class="backpv" id="pvBack"></div>
      <p style="margin-top:8px"><label class="field"><span>Message on the back screen</span><input class="input" id="mBack" placeholder="Example: Two more minutes"></label><label><input type="checkbox" id="mBackOn">Show message</label></p>
      <div class="field"><span>Countdown</span><div class="row gap"><b class="clock" id="tFace">5:00</b><select class="input" id="tDur" style="width:auto">${[1, 2, 3, 5, 10, 15, 20, 30, 45, 60].map(m => `<option value="${m * 60}" ${m === 5 ? "selected" : ""}>${m} min</option>`).join("")}</select><button class="btn" id="tGo">Start</button><button class="btn" id="tReset">Reset</button></div><label><input type="checkbox" id="tBack" checked>Show on the back screen</label></div>
    </fieldset>
    <fieldset><legend>Keyboard</legend><div class="hint">Right arrow, Down arrow or Space: next slide<br>Left arrow or Up arrow: previous slide<br>B: black &nbsp; L: logo &nbsp; T: hide text &nbsp; Esc: clear all<br>Presentation clickers work too.</div></fieldset>`;
  comp = new Compositor($("#pvFront .vs-stage"), { preview: true });
  fitRO.observe($("#pvFront"));
  $("#oFront").onclick = () => openScreen(false);
  $("#oBack").onclick = () => openScreen(true);
  $("#bPrev").onclick = prev; $("#bNext").onclick = next;
  $$("#right [data-k]").forEach(b => b.onclick = () => toggle(b.dataset.k));
  $("#bClear").onclick = clearAll;
  $("#bMode").value = S.backMode;
  $("#bMode").onchange = e => { S.backMode = e.target.value; store.set("backMode", S.backMode); push(); };
  let mt;
  const msg = (inp, chk, obj) => { $(inp).oninput = e => { obj.text = e.target.value; clearTimeout(mt); mt = setTimeout(push, 300); }; $(chk).onchange = e => { obj.show = e.target.checked; push(); }; };
  msg("#mFront", "#mFrontOn", S.message); msg("#mBack", "#mBackOn", S.backMessage);
  $("#tDur").onchange = e => { S.timer.dur = +e.target.value; if (!S.timer.running) S.timer.left = S.timer.dur; push(); };
  $("#tGo").onclick = () => { const t = S.timer; if (t.running) { t.left = timerLeft(); t.running = false; } else { t.end = Date.now() + t.left * 1000; t.running = true; } push(); };
  $("#tReset").onclick = () => { S.timer.running = false; S.timer.left = S.timer.dur; push(); };
  $("#tBack").onchange = e => { S.timer.back = e.target.checked; push(); };
  $("#vPlay").onclick = () => { const v = comp.video(); const cmd = v && v.paused ? "play" : "pause"; comp.control(cmd); ch.postMessage({ type: "video", cmd }); };
  $("#vRe").onclick = () => { comp.control("restart"); ch.postMessage({ type: "video", cmd: "restart" }); };
}

function updateRight(st) {
  if (!$("#right")) return;
  $$("#right [data-k]").forEach(b => b.classList.toggle("on", !!S[b.dataset.k]));
  $("#tGo").textContent = S.timer.running ? "Pause" : "Start";
  const f = st.frame, n = st.next;
  $("#pvBack").innerHTML = S.backMode === "mirror" ? `<i class="hint">The back screen shows the same picture as the front screen.</i>`
    : `<div><b>Now:</b> ${f ? esc(f.text || f.sub || (f.bg && f.bg.type === "media" ? "(" + (f.bg.kind === "video" ? "video" : "picture") + ")" : "")).replace(/\n/g, " / ") : "<i>nothing</i>"}</div><div><b>Next:</b> ${n ? esc(n.text || n.sub || (n.media ? "(picture or video)" : "")).replace(/\n/g, " / ") : "<i>end of service</i>"}</div>`;
}

function tick() {
  const l = timerLeft(), f = $("#tFace");
  if (f) { f.textContent = fmt(l); f.classList.toggle("live", l < 0); }
  const fo = Date.now() - S.frontAt < 5000, bo = Date.now() - S.backAt < 5000;
  if ($("#stFront")) {
    $("#stFront").textContent = fo ? "open" : "closed"; $("#stFront").className = fo ? "ok" : "";
    $("#stBack").textContent = bo ? "open" : "closed"; $("#stBack").className = bo ? "ok" : "";
    $("#oFront").textContent = fo ? "Close front screen" : "Open front screen";
    $("#oBack").textContent = bo ? "Close back screen" : "Open back screen";
  }
  const v = comp && comp.video();
  if ($("#vid")) {
    $("#vid").hidden = !v;
    if (v) { $("#vPlay").textContent = v.paused ? "Play" : "Pause"; $("#vT").textContent = fmt(Math.floor(v.currentTime || 0)) + " / " + fmt(Math.floor(v.duration || 0)); }
  }
}

function bindKeys() {
  document.addEventListener("keydown", e => {
    if ($(".modal-bg")) return;
    if (e.target.closest && e.target.closest("input, textarea, select")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === "ArrowRight" || k === "ArrowDown" || k === " " || k === "PageDown") { e.preventDefault(); next(); }
    else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp") { e.preventDefault(); prev(); }
    else if (k === "Escape") clearAll();
    else if (k === "t" || k === "T") toggle("clearText");
    else if (k === "l" || k === "L") toggle("logo");
    else if (k === "b" || k === "B" || k === ".") toggle("black");
  });
}

function remoteModal() {
  const url = new URL("remote.html", location.href).href;
  const m = modal({ title: "Phone remote", body: `<p>Open this address on your phone and sign in with this same projector login. Your phone can then move the slides.</p><div id="qr" style="background:#fff;padding:8px;width:max-content;margin:8px auto;border:1px solid #000"></div><p><input class="input" readonly value="${esc(url)}"></p><p class="hint">${Date.now() - S.phoneAt < 120000 ? "A phone used the remote in the last 2 minutes." : "Keep this page open while you use the remote."}</p>` });
  try { new QRCode($("#qr", m.el), { text: url, width: 160, height: 160, correctLevel: QRCode.CorrectLevel.M }); } catch (e) { $("#qr", m.el).hidden = true; }
}

async function initRemote() {
  try { const d = await DB.remote.getById(S.user.id); S.remoteNonce = d && d.command ? d.command.nonce : null; S.remoteReady = true; }
  catch (e) { if (e && e.status === 404) { try { await DB.remote.create({ state: {}, command: null }, S.user.id); S.remoteReady = true; } catch (x) {} } }
  queueRemote();
  try { const r = DB.remote.subscribe(ev => { if (ev && ev.docId === S.user.id && ev.doc) handleCmd(ev.doc.command); }); if (r && r.catch) r.catch(() => {}); } catch (e) {}
  setInterval(async () => { if (!S.remoteReady) return; try { const d = await DB.remote.getById(S.user.id); handleCmd(d && d.command); } catch (e) {} }, 4000);
  setInterval(queueRemote, 30000);
}
function handleCmd(c) {
  if (!c || !c.nonce || c.nonce === S.remoteNonce) return;
  S.remoteNonce = c.nonce;
  if (c.from !== "phone" || Date.now() - (c.at || 0) > 30000) return;
  S.phoneAt = Date.now();
  if (c.action === "next") next();
  else if (c.action === "prev") prev();
  else if (c.action === "goto") { if (byId(c.presId)) goLive(c.presId, +c.index || 0); }
  else if (["clearText", "black", "logo", "clearBg"].includes(c.action)) toggle(c.action);
  else if (c.action === "clearAll") clearAll();
}
let remT, remLast = 0;
function queueRemote() {
  if (!S.remoteReady) return;
  clearTimeout(remT);
  remT = setTimeout(async () => {
    remLast = Date.now();
    const p = byId(S.live.presId) || byId(S.openId);
    const state = {
      service: S.serviceId === "all" ? "Whole library" : svc() ? svc().title : "",
      presId: p ? p.id : null, title: p ? p.title : "", type: p ? p.type : "",
      index: p && p.id === S.live.presId ? S.live.index : -1,
      slides: p ? p.slides.map(s => ({ t: (s.text || s.sub || (s.media ? (s.media.name || s.media.kind) : "")).slice(0, 160), l: s.label || "" })) : [],
      items: items().slice(0, 80).map(id => byId(id)).map(x => ({ id: x.id, title: x.title, type: x.type })),
      liveId: S.live.presId,
      flags: { clearText: S.clearText, clearBg: S.clearBg, black: S.black, logo: S.logo },
      at: Date.now()
    };
    try { await DB.remote.update(S.user.id, { state }); } catch (e) {}
  }, Math.max(300, 700 - (Date.now() - remLast)));
}
