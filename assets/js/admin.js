const TYPES = {
  song: { label: "Songs", one: "song", desc: "Lyrics for worship. Each block of lines becomes one slide.", author: "Artist or writer" },
  sermon: { label: "Sermons", one: "sermon", desc: "Sermon points and notes. You can insert Bible verses while you type.", author: "Speaker" },
  scripture: { label: "Scripture", one: "passage", desc: "Bible passages. Type a reference and Vespa makes the slides." },
  image: { label: "Photos", one: "photo", desc: "Single pictures or a set of pictures shown one after another." },
  video: { label: "Videos", one: "video", desc: "Video clips such as announcements and countdowns." },
  slides: { label: "Slides", one: "slide set", desc: "Announcements and anything else made of text slides." }
};
const TABS = [...Object.keys(TYPES), "services", "settings"];
const FIELDS = ["title", "type", "author", "slides", "theme", "opts", "projectors"];
const clean = p => Object.fromEntries(FIELDS.filter(k => p[k] !== undefined).map(k => [k, p[k]]));
const arr = x => Array.isArray(x) ? x : (x && (x.docs || x.data || x.items)) || [];
const day = t => { const d = new Date(t); return isNaN(d) ? "" : d.toLocaleDateString(); };
const kindOf = t => String(t || "").startsWith("video") ? "video" : String(t || "").startsWith("image") ? "image" : "";

const S = {
  user: null,
  settings: { churchName: "", logoFile: "", transition: 0.5, defaultPreset: "classic", projectors: [] },
  settingsDoc: false, lib: [], services: [], files: null,
  tab: (location.hash || "").slice(1) || "song", q: "", serviceId: null
};
let DB;

requireUser($("#root"), "admin", u => { S.user = u; boot(); });

async function boot() {
  DB = { pres: bread.collection("presentations"), svc: bread.collection("services"), settings: bread.collection("settings") };
  if (!TABS.includes(S.tab)) S.tab = "song";
  shell();
  $("#page").innerHTML = `<p>Loading...</p>`;
  try {
    const [lib, svcs, set] = await Promise.all([
      DB.pres.get({ limit: 500, orderBy: "updatedAt", order: "desc" }),
      DB.svc.get({ limit: 200, orderBy: "updatedAt", order: "desc" }),
      DB.settings.getById(S.user.id).catch(e => e && e.status === 404 ? null : Promise.reject(e))
    ]);
    S.lib = arr(lib).filter(p => p.ownerId === S.user.id || !p.ownerId);
    S.services = arr(svcs).filter(p => p.ownerId === S.user.id || !p.ownerId);
    if (set) { S.settingsDoc = true; for (const k of Object.keys(S.settings)) if (set[k] !== undefined) S.settings[k] = set[k]; }
  } catch (e) { toast(errMsg(e), "err"); }
  S.serviceId = S.services[0] ? S.services[0].id : null;
  render();
  addEventListener("hashchange", () => { const t = location.hash.slice(1); if (TABS.includes(t) && t !== S.tab) { S.tab = t; render(); } });
}

const projectors = () => (S.settings.projectors || []).slice();
const byId = id => S.lib.find(p => p.id === id);

function shell() {
  $("#root").innerHTML = `<div class="topbar"><img src="${VESPA.logo}" alt="Vespa"><span class="name">Vespa</span><span class="where" id="where"></span>
    <span class="right"><span>Signed in as ${esc(S.user.email)}</span> | <button class="linkbtn" id="tTheme"></button> | <a href="projector.html">Projector page</a> | <button class="linkbtn" id="tOut">Sign out</button></span></div>
    <div class="menubar" id="menu">${TABS.map(t => `<button data-t="${t}">${t === "services" ? "Services" : t === "settings" ? "Settings" : TYPES[t].label}</button>`).join("")}</div>
    <div class="page" id="page"></div>`;
  $$("#menu button").forEach(b => b.onclick = () => { S.tab = b.dataset.t; history.replaceState(null, "", "#" + S.tab); render(); });
  $("#tTheme").onclick = () => { Theme.toggle(); drawTop(); };
  $("#tOut").onclick = () => signOutTo("admin.html");
}
function drawTop() {
  $("#where").textContent = "Admin" + (S.settings.churchName ? " - " + S.settings.churchName : "");
  $("#tTheme").textContent = Theme.effective() === "dark" ? "Light mode" : "Dark mode";
  $$("#menu button").forEach(b => b.classList.toggle("on", b.dataset.t === S.tab));
}

function render() {
  drawTop();
  if (S.tab === "services") return renderServices();
  if (S.tab === "settings") return renderSettings();
  renderList(S.tab);
}

function notice() {
  return projectors().length ? "" : `<div class="notice">No projector login is set up yet. The projector person cannot see anything until you add their email address in <a href="#settings">Settings</a>.</div>`;
}

function renderList(type) {
  const T = TYPES[type];
  const P = $("#page");
  P.innerHTML = `${notice()}<h1>${T.label}</h1><p class="muted">${T.desc}</p>
    <div class="toolbar"><button class="btn primary" id="add">Add ${T.one}</button><span class="grow"></span><label>Search: <input class="input" id="q" style="width:200px" value="${esc(S.q)}"></label></div>
    <div id="tbl"></div>`;
  $("#add").onclick = () => openEditor(null, type);
  $("#q").oninput = e => { S.q = e.target.value; table(); };
  const table = () => {
    const q = S.q.trim().toLowerCase();
    const rows = S.lib.filter(p => p.type === type && (!q || (p.title || "").toLowerCase().includes(q) || (p.author || "").toLowerCase().includes(q) || (p.slides || []).some(s => (s.text || "").toLowerCase().includes(q))));
    const svc = S.services.find(s => s.id === S.serviceId);
    $("#tbl").innerHTML = `<table class="list"><tr><th></th><th>Title</th>${T.author ? `<th>${T.author}</th>` : ""}<th>Slides</th><th>Last changed</th><th>Actions</th></tr>
      ${rows.length ? rows.map((p, i) => `<tr data-id="${esc(p.id)}"><td class="n">${i + 1}</td><td><a href="#" data-a="edit">${esc(p.title || "Untitled")}</a></td>${T.author ? `<td>${esc(p.author || "")}</td>` : ""}<td>${(p.slides || []).length}</td><td>${day(p.updatedAt || p.createdAt)}</td>
        <td class="act"><button class="btn sm" data-a="edit">Edit</button> <button class="btn sm" data-a="svc" ${svc ? "" : "disabled"} title="${svc ? "Add to " + esc(svc.title) : "Create a service first"}">Add to service</button> <button class="btn sm" data-a="copy">Copy</button> <button class="btn sm danger" data-a="del">Delete</button></td></tr>`).join("")
        : `<tr><td colspan="6">${q ? "Nothing matches your search." : `No ${T.label.toLowerCase()} yet. Click <b>Add ${T.one}</b> to make the first one.`}</td></tr>`}
    </table>${svc ? `<p class="hint">Add to service puts the item at the end of "${esc(svc.title)}". Change the service on the Services page.</p>` : ""}`;
    $$("#tbl [data-a]").forEach(b => b.onclick = e => {
      e.preventDefault();
      const p = byId(b.closest("tr").dataset.id);
      ({ edit: () => openEditor(p), copy: () => dupItem(p), del: () => delItem(p), svc: () => addToService(p.id) })[b.dataset.a]();
    });
  };
  table();
}

async function saveSvc(s, fields) {
  Object.assign(s, fields);
  try { await DB.svc.update(s.id, fields); } catch (e) { toast(errMsg(e), "err"); }
}
function addToService(id) {
  const s = S.services.find(x => x.id === S.serviceId); if (!s) return;
  saveSvc(s, { items: [...(s.items || []), id] });
  toast(`Added to "${s.title}".`);
}

async function dupItem(p) {
  try { const d = await DB.pres.create(clean({ ...JSON.parse(JSON.stringify(p)), title: (p.title || "Untitled") + " (copy)", projectors: projectors() })); S.lib.unshift(d); render(); toast("Copy made."); }
  catch (e) { toast(errMsg(e), "err"); }
}
async function delItem(p) {
  if (!(await confirmBox(`Delete "${p.title || "Untitled"}"? It will also be removed from every service.`))) return;
  try {
    await DB.pres.delete(p.id);
    S.lib = S.lib.filter(x => x.id !== p.id);
    for (const s of S.services) if ((s.items || []).includes(p.id)) saveSvc(s, { items: s.items.filter(x => x !== p.id) });
    render(); toast("Deleted.");
  } catch (e) { toast(errMsg(e), "err"); }
}

function renderServices() {
  const P = $("#page");
  const s = S.services.find(x => x.id === S.serviceId);
  P.innerHTML = `${notice()}<h1>Services</h1><p class="muted">A service is the running order for one meeting. The projector person picks a service and goes through it from top to bottom.</p>
    <div class="cols2">
      <fieldset><legend>All services</legend>
        <table class="list"><tr><th>Name</th><th>Date</th><th>Items</th></tr>
        ${S.services.length ? S.services.map(x => `<tr class="${x.id === S.serviceId ? "sel" : ""}"><td><a href="#" data-s="${esc(x.id)}">${esc(x.title || "Untitled")}</a></td><td>${esc(x.date || "")}</td><td>${(x.items || []).length}</td></tr>`).join("") : `<tr><td colspan="3">No services yet.</td></tr>`}
        </table>
        <p style="margin-top:8px"><button class="btn primary" id="sNew">New service</button></p>
      </fieldset>
      <fieldset><legend>${s ? "Order of service: " + esc(s.title) : "Order of service"}</legend><div id="order"></div></fieldset>
    </div>`;
  $$("[data-s]").forEach(a => a.onclick = e => { e.preventDefault(); S.serviceId = a.dataset.s; renderServices(); });
  $("#sNew").onclick = () => serviceModal();
  const O = $("#order");
  if (!s) { O.innerHTML = `<p>Choose a service on the left, or click <b>New service</b>.</p>`; return; }
  const items = (s.items || []);
  const opts = Object.entries(TYPES).map(([k, T]) => { const l = S.lib.filter(p => p.type === k); return l.length ? `<optgroup label="${T.label}">${l.map(p => `<option value="${esc(p.id)}">${esc(p.title || "Untitled")}</option>`).join("")}</optgroup>` : ""; }).join("");
  O.innerHTML = `<p>Date: <b>${esc(s.date || "not set")}</b> &nbsp; <button class="btn sm" id="sRen">Rename or change date</button> <button class="btn sm" id="sCopy">Copy service</button> <button class="btn sm danger" id="sDel">Delete service</button></p>
    <table class="list"><tr><th></th><th>Item</th><th>Type</th><th>Move</th><th></th></tr>
    ${items.length ? items.map((id, i) => { const p = byId(id); return `<tr data-i="${i}"><td class="n">${i + 1}</td><td>${p ? `<a href="#" data-a="edit">${esc(p.title || "Untitled")}</a>` : `<i class="muted">Deleted item</i>`}</td><td>${p ? TYPES[p.type] ? TYPES[p.type].one : "" : ""}</td><td class="act"><button class="btn sm" data-a="up" ${i ? "" : "disabled"}>Up</button> <button class="btn sm" data-a="down" ${i < items.length - 1 ? "" : "disabled"}>Down</button></td><td class="act"><button class="btn sm danger" data-a="rm">Remove</button></td></tr>`; }).join("") : `<tr><td colspan="5">This service is empty. Add items below.</td></tr>`}
    </table>
    <p style="margin-top:8px">${opts ? `Add: <select class="input" id="addSel" style="width:auto;max-width:320px">${opts}</select> <button class="btn" id="addBtn">Add to service</button>` : `Your library is empty. Add songs, sermons or other items first.`}</p>`;
  $("#sRen").onclick = () => serviceModal(s);
  $("#sCopy").onclick = async () => { try { const d = await DB.svc.create({ title: s.title + " (copy)", date: s.date || "", items: items.slice(), projectors: projectors() }); S.services.unshift(d); S.serviceId = d.id; renderServices(); } catch (e) { toast(errMsg(e), "err"); } };
  $("#sDel").onclick = async () => {
    if (!(await confirmBox(`Delete the service "${s.title}"? The songs and other items stay in your library.`))) return;
    try { await DB.svc.delete(s.id); S.services = S.services.filter(x => x.id !== s.id); S.serviceId = S.services[0] ? S.services[0].id : null; renderServices(); } catch (e) { toast(errMsg(e), "err"); }
  };
  const ab = $("#addBtn"); if (ab) ab.onclick = () => { saveSvc(s, { items: [...items, $("#addSel").value] }); renderServices(); };
  $$("#order [data-a]").forEach(b => b.onclick = e => {
    e.preventDefault();
    const i = +b.closest("tr").dataset.i, it = items.slice();
    if (b.dataset.a === "edit") return openEditor(byId(it[i]));
    if (b.dataset.a === "rm") it.splice(i, 1);
    if (b.dataset.a === "up") [it[i - 1], it[i]] = [it[i], it[i - 1]];
    if (b.dataset.a === "down") [it[i + 1], it[i]] = [it[i], it[i + 1]];
    saveSvc(s, { items: it }); renderServices();
  });
}

function serviceModal(s) {
  const m = modal({ title: s ? "Rename service" : "New service", body: `<form class="stack"><label class="field"><span>Name</span><input class="input" name="t" value="${esc(s ? s.title : "Sunday Service")}" required></label><label class="field"><span>Date</span><input class="input" type="date" name="d" value="${esc(s ? s.date || "" : new Date().toISOString().slice(0, 10))}"></label><div class="row end gap"><button type="button" class="btn" data-c>Cancel</button><button class="btn primary">${s ? "Save" : "Create service"}</button></div></form>` });
  const f = $("form", m.el); f.t.focus(); f.t.select();
  $("[data-c]", f).onclick = () => m.close();
  f.onsubmit = async e => {
    e.preventDefault();
    const title = f.t.value.trim() || "Untitled service", date = f.d.value;
    try {
      if (s) await saveSvc(s, { title, date });
      else { const d = await DB.svc.create({ title, date, items: [], projectors: projectors() }); S.services.unshift(d); S.serviceId = d.id; }
      m.close(); renderServices();
    } catch (ex) { toast(errMsg(ex), "err"); }
  };
}

function renderSettings() {
  const st = JSON.parse(JSON.stringify(S.settings));
  const P = $("#page");
  P.innerHTML = `<h1>Settings</h1>
    <fieldset><legend>Projector logins</legend>
      <p>The projector person signs in on the <a href="projector.html">projector page</a> with their own account. Enter the email address they use to sign in. They will see your services and library, but they cannot change them.</p>
      <label class="field"><span>Projector email addresses (one per line)</span><textarea class="input" id="pEm" rows="3" style="min-height:60px;font-family:var(--font);font-size:12px">${esc(projectors().join("\n"))}</textarea></label>
      <p class="hint">Tell them to open ${esc(new URL("projector.html", location.href).href)} and choose "Create one" if they do not have an account yet.</p>
    </fieldset>
    <fieldset><legend>Church</legend>
      <label class="field" style="max-width:360px"><span>Church name</span><input class="input" id="sName" value="${esc(st.churchName)}"></label>
      <div class="field" style="margin-top:8px"><span>Logo (shown when the projector person presses Logo)</span><div class="row gap"><div id="sLogo" style="width:140px"></div><div class="stack"><button class="btn sm" id="sLogoUp">Upload logo</button><button class="btn sm" id="sLogoRm">Use the Vespa logo</button></div><input type="file" id="sLogoF" accept="image/*" hidden></div></div>
    </fieldset>
    <fieldset><legend>Presenting</legend>
      <table class="form"><tr><td>Fade between slides</td><td><select class="input" id="sTr" style="width:auto">${[[0, "No fade"], [0.25, "Quick"], [0.5, "Normal"], [1, "Slow"]].map(([v, l]) => `<option value="${v}" ${+st.transition === v ? "selected" : ""}>${l}</option>`).join("")}</select></td></tr>
      <tr><td>Look for new items</td><td><select class="input" id="sPre" style="width:auto">${Object.entries(PRESETS).map(([k, p]) => `<option value="${k}" ${st.defaultPreset === k ? "selected" : ""}>${p.name}</option>`).join("")}</select></td></tr></table>
    </fieldset>
    <p><button class="btn primary lg" id="sSave">Save settings</button></p>
    ${accountBox(S.user)}`;
  bindAccountBox(P, S.user);
  const drawLogo = () => renderThumb($("#sLogo"), { bg: { type: "media", kind: "image", url: st.logoFile ? mediaUrl(st.logoFile) : VESPA.logo, fit: "contain", color: "#000" } });
  drawLogo();
  $("#sLogoUp").onclick = () => $("#sLogoF").click();
  $("#sLogoF").onchange = async e => { const f = e.target.files[0]; if (!f) return; const b = $("#sLogoUp"); b.classList.add("busy"); try { st.logoFile = (await uploadFile(f)).filename; drawLogo(); } catch (x) { toast(errMsg(x), "err"); } b.classList.remove("busy"); };
  $("#sLogoRm").onclick = () => { st.logoFile = ""; drawLogo(); };
  $("#sSave").onclick = async e => {
    st.churchName = $("#sName").value.trim();
    st.transition = +$("#sTr").value;
    st.defaultPreset = $("#sPre").value;
    const raw = $("#pEm").value.split(/[\s,;]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
    const bad = raw.filter(x => !/^\S+@\S+\.\S+$/.test(x));
    if (bad.length) return toast(`"${bad[0]}" is not a valid email address.`, "err");
    if (raw.includes((S.user.email || "").toLowerCase())) return toast("Use a different account for the projector. Your admin email cannot also be a projector login.", "err");
    st.projectors = [...new Set(raw)];
    const changed = JSON.stringify(st.projectors) !== JSON.stringify(projectors());
    const b = e.currentTarget; b.classList.add("busy");
    try {
      const doc = { ...st };
      if (S.settingsDoc) await DB.settings.update(S.user.id, doc);
      else { try { await DB.settings.create(doc, S.user.id); } catch (x) { if (x.status === 409) await DB.settings.update(S.user.id, doc); else throw x; } S.settingsDoc = true; }
      S.settings = st;
      if (changed) await shareAll(st.projectors, b);
      drawTop(); toast("Settings saved.");
    } catch (x) { toast(errMsg(x), "err"); }
    b.classList.remove("busy"); b.textContent = "Save settings";
  };
}

async function shareAll(list, b) {
  const jobs = [...S.lib.map(p => () => DB.pres.update(p.id, { projectors: list }).then(() => p.projectors = list)), ...S.services.map(s => () => DB.svc.update(s.id, { projectors: list }).then(() => s.projectors = list))];
  let done = 0, fail = 0;
  for (let i = 0; i < jobs.length; i += 5) {
    await Promise.all(jobs.slice(i, i + 5).map(j => j().catch(() => fail++)));
    done = Math.min(jobs.length, i + 5); b.textContent = `Sharing ${done} of ${jobs.length}`;
  }
  if (fail) toast(`${fail} item(s) could not be shared. Save again to retry.`, "err");
}

async function loadFiles() {
  if (S.files) return S.files;
  try { S.files = arr(await bread.files.list()).filter(f => !f.ownerId || f.ownerId === S.user.id); }
  catch (e) { S.files = []; }
  return S.files;
}
async function uploadFile(file) {
  if (file.size > 50 * 1024 * 1024) throw { error: `"${file.name}" is larger than 50 MB. Choose a smaller file.` };
  const f = await bread.files.upload(file);
  const rec = { ...f, type: f.type || file.type, name: f.name || file.name };
  if (S.files) S.files.unshift(rec);
  return rec;
}

function openEditor(pres, type) {
  if (!pres && !type) return;
  const isNew = !pres;
  const d = pres ? JSON.parse(JSON.stringify(clean(pres))) : {
    type, title: "", author: "", slides: [],
    theme: { ...(PRESETS[S.settings.defaultPreset] || PRESETS.classic), preset: S.settings.defaultPreset || "classic" },
    opts: { loop: type !== "video", mute: false, fit: "contain" }
  };
  d.type = d.type || "slides"; d.theme = themeOf(d.theme); d.opts = d.opts || {};
  const media = d.type === "image" || d.type === "video";
  const T = TYPES[d.type] || TYPES.slides;
  let page = 0;
  const body = h(`<div><div class="editor"><div class="stack" id="eL"></div>
      <div class="preview"><div id="ePrev"></div><div class="row between" style="margin:4px 0 8px"><span id="eCount" class="hint"></span><span><button class="btn sm" id="pgP">&lt; Prev</button> <button class="btn sm" id="pgN">Next &gt;</button></span></div><div id="eLook"></div></div></div>
    <div class="editor-foot"><button class="btn primary lg" id="eSave">${isNew ? "Save " + T.one : "Save changes"}</button><button class="btn lg" id="eCancel">Cancel</button><span class="grow"></span>${isNew ? "" : `<button class="btn danger" id="eDel">Delete</button>`}</div></div>`);
  const m = modal({ title: (isNew ? "Add " : "Edit ") + T.one, body, wide: true });
  $("#eL", body).innerHTML = `<label class="field"><span>Title</span><input class="input" id="eTitle" value="${esc(d.title)}"></label>
    ${T.author ? `<label class="field"><span>${T.author}</span><input class="input" id="eAuthor" value="${esc(d.author || "")}"></label>` : ""}
    ${d.type === "scripture" || d.type === "sermon" ? `<fieldset style="margin:0"><legend>${d.type === "sermon" ? "Insert a Bible verse" : "Look up a passage"}</legend><div class="row gap"><input class="input" id="sRef" placeholder="John 3:16-18"><select class="input" id="sTr" style="width:auto">${Object.entries(TRANSLATIONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select><select class="input" id="sPer" style="width:auto"><option value="1">1 verse per slide</option><option value="2" selected>2 verses per slide</option><option value="3">3 verses per slide</option></select><button class="btn" id="sGo">${d.type === "sermon" ? "Insert" : "Look up"}</button></div></fieldset>` : ""}
    ${media ? `<fieldset style="margin:0"><legend>${d.type === "image" ? "Photos" : "Video file"}</legend><p><input type="file" id="eFile" accept="${d.type}/*" ${d.type === "image" ? "multiple" : ""}> <span class="hint">Up to 50 MB each.</span></p><div id="eStat" class="hint"></div><table class="list" id="eMedia"></table></fieldset>
      <table class="form"><tr><td>Fit</td><td><select class="input" id="oFit" style="width:auto"><option value="contain">Show the whole ${d.type === "image" ? "picture" : "video"}</option><option value="cover">Fill the screen (may crop edges)</option></select></td></tr>
      ${d.type === "video" ? `<tr><td>Options</td><td><label><input type="checkbox" id="oLoop" ${d.opts.loop ? "checked" : ""}>Play again when it ends</label><br><label><input type="checkbox" id="oMute" ${d.opts.mute ? "checked" : ""}>No sound</label></td></tr>` : ""}</table>`
      : `<label class="field"><span>Slides</span><textarea class="input" id="eSrc" rows="18">${esc(blocksToSource(d.slides))}</textarea></label>
      <div class="hint">Leave an empty line between slides.<br>A line like <b>[Chorus]</b> gives the next slides a name.<br>A line that starts with <b>~</b> becomes a small caption, for example a Bible reference.</div>`}`;
  const prevEl = $("#ePrev", body);
  const syncSlides = () => { if (!media) d.slides = parseBlocks($("#eSrc", body).value); };
  const draw = () => {
    const n = d.slides.length;
    if (page >= n) page = Math.max(0, n - 1);
    renderThumb(prevEl, n ? buildFrame({ ...d, id: "edit" }, page) : buildFrame({ ...d, id: "edit", slides: [{ text: media ? "" : "Your words appear here" }] }, 0));
    $("#eCount", body).textContent = n ? `Slide ${page + 1} of ${n}` : "No slides yet";
  };
  $("#pgP", body).onclick = () => { page = Math.max(0, page - 1); draw(); };
  $("#pgN", body).onclick = () => { page = Math.min(d.slides.length - 1, page + 1); draw(); };
  if (!media) {
    const ta = $("#eSrc", body);
    ta.oninput = () => { syncSlides(); draw(); };
    ta.onkeyup = ta.onclick = () => { const idx = parseBlocks(ta.value.slice(0, ta.selectionStart) + "x").length - 1; if (idx !== page && idx >= 0) { page = idx; draw(); } };
    lookPanel($("#eLook", body), d, draw);
  }
  const sGo = $("#sGo", body);
  if (sGo) {
    sGo.onclick = async () => {
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
    $("#sRef", body).onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); sGo.click(); } };
  }
  if (media) {
    const tbl = $("#eMedia", body), inp = $("#eFile", body), stat = $("#eStat", body);
    const drawMedia = () => {
      tbl.innerHTML = d.slides.length ? `<tr><th></th><th>File</th><th></th></tr>` + d.slides.map((s, i) => `<tr class="${i === page ? "sel" : ""}" data-i="${i}"><td class="n">${i + 1}</td><td><a href="#" data-a="show">${esc(s.media.name || s.media.filename)}</a></td><td class="act">${d.type === "image" ? `<button class="btn sm" data-a="up" ${i ? "" : "disabled"}>Up</button> ` : ""}<button class="btn sm danger" data-a="rm">Remove</button></td></tr>`).join("") : `<tr><td>No file chosen yet.</td></tr>`;
      $$("[data-a]", tbl).forEach(b => b.onclick = e => {
        e.preventDefault(); const i = +b.closest("tr").dataset.i;
        if (b.dataset.a === "rm") d.slides.splice(i, 1);
        if (b.dataset.a === "up") [d.slides[i - 1], d.slides[i]] = [d.slides[i], d.slides[i - 1]];
        if (b.dataset.a === "show") page = i;
        drawMedia(); draw();
      });
      inp.hidden = d.type === "video" && d.slides.length > 0;
    };
    inp.onchange = async () => {
      let files = [...inp.files].filter(f => kindOf(f.type) === d.type);
      if (!files.length) return toast(`Choose ${d.type === "image" ? "a picture" : "a video"} file.`, "err");
      if (d.type === "video") files = files.slice(0, 1);
      inp.disabled = true;
      for (const [n, f] of files.entries()) {
        stat.textContent = `Uploading ${n + 1} of ${files.length}: ${f.name}...`;
        try { const r = await uploadFile(f); d.slides.push({ id: uid(), text: "", media: { filename: r.filename, kind: d.type, name: f.name } }); if (!$("#eTitle", body).value.trim()) $("#eTitle", body).value = f.name.replace(/\.[^.]+$/, ""); }
        catch (e) { toast(errMsg(e), "err"); }
      }
      stat.textContent = ""; inp.disabled = false; inp.value = "";
      page = d.slides.length - 1; drawMedia(); draw();
    };
    $("#oFit", body).value = d.opts.fit || "contain";
    $("#oFit", body).onchange = e => { d.opts.fit = e.target.value; draw(); };
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
    d.title = $("#eTitle", body).value.trim() || (d.slides[0] && (d.slides[0].text || "").split("\n")[0].slice(0, 60)) || "Untitled " + T.one;
    const a = $("#eAuthor", body); if (a) d.author = a.value.trim();
    if (!d.slides.length) return toast(media ? "Choose a file first." : "Type at least one slide.", "err");
    d.projectors = projectors();
    const b = e.currentTarget; b.classList.add("busy");
    try {
      if (isNew) S.lib.unshift(await DB.pres.create(clean(d)));
      else { const doc = await DB.pres.update(pres.id, clean(d)); const i = S.lib.findIndex(x => x.id === pres.id); S.lib[i] = { ...pres, ...clean(d), ...(doc && doc.id ? doc : {}) }; }
      m.close(); render(); toast(isNew ? "Saved." : "Changes saved.");
    } catch (ex) { toast(errMsg(ex), "err"); b.classList.remove("busy"); }
  };
  setTimeout(() => { const t = $("#eTitle", body); if (t && isNew) t.focus(); }, 30);
}

function lookPanel(root, d, onChange) {
  const th = d.theme;
  root.innerHTML = `<fieldset style="margin:0"><legend>How it looks</legend>
    <div class="presets" id="lkP"></div>
    <table class="form">
    <tr><td>Font</td><td><select class="input" id="lkFont" style="width:auto">${Object.keys(FONTS).map(f => `<option ${th.font === f ? "selected" : ""} value="${f}">${f === "Playfair" ? "Playfair Display" : f}</option>`).join("")}</select> Size <input type="number" class="input" id="lkSize" min="30" max="200" value="${th.size}" style="width:60px"></td></tr>
    <tr><td>Text color</td><td><input type="color" id="lkColor" value="${th.color}"> <label><input type="checkbox" id="lkUp" ${th.upper ? "checked" : ""}>Capitals</label> <label><input type="checkbox" id="lkSh" ${th.shadow ? "checked" : ""}>Shadow</label> <label><input type="checkbox" id="lkBand" ${th.band ? "checked" : ""}>Box behind text</label></td></tr>
    <tr><td>Text position</td><td><select class="input" id="lkAl" style="width:auto"><option value="center">Centered</option><option value="left">Left</option></select> <select class="input" id="lkVa" style="width:auto"><option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></select></td></tr>
    <tr><td>Background</td><td><select class="input" id="lkBg" style="width:auto"><option value="color">One color</option><option value="gradient">Two colors</option><option value="image">Picture</option><option value="video">Moving video</option></select> <span id="lkCols"><input type="color" id="lkC1" value="${th.bgColor}"> <input type="color" id="lkC2" value="${th.bgColor2}"></span></td></tr>
    <tr id="lkDimRow"><td>Darken picture</td><td><select class="input" id="lkDim" style="width:auto">${[0, .2, .4, .6].map(v => `<option value="${v}" ${+th.overlay === v ? "selected" : ""}>${v ? v * 100 + "%" : "None"}</option>`).join("")}</select></td></tr>
    </table><div id="lkMedia"></div></fieldset>`;
  const P = $("#lkP", root);
  for (const [k, p] of Object.entries(PRESETS)) {
    const b = h(`<button class="preset ${th.preset === k ? "on" : ""}" title="${p.name}"><div></div><span>${p.name}</span></button>`);
    renderThumb(b.firstElementChild, buildFrame({ id: "p", theme: p, slides: [{ text: "Grace" }] }, 0));
    b.onclick = () => { const keep = th.bgType === "image" || th.bgType === "video" ? { bgType: th.bgType, bgFile: th.bgFile, overlay: th.overlay } : {}; Object.assign(th, PRESETS[k], keep, { preset: k }); lookPanel(root, d, onChange); onChange(); };
    P.append(b);
  }
  const changed = () => { th.preset = ""; $$(".preset", P).forEach(b => b.classList.remove("on")); onChange(); };
  const bind = (id, k, f = v => v, after) => { const el = $(id, root); if (el.tagName === "SELECT") el.value = String(th[k]); el.oninput = el.onchange = () => { th[k] = f(el.type === "checkbox" ? el.checked : el.value); after && after(); changed(); }; };
  const bgUi = () => {
    const t = th.bgType;
    $("#lkC2", root).hidden = t !== "gradient";
    $("#lkCols", root).hidden = t === "image" || t === "video";
    $("#lkDimRow", root).hidden = !(t === "image" || t === "video");
    if (t === "image" || t === "video") mediaPicker($("#lkMedia", root), t, th.bgFile, f => { th.bgFile = f; th.bgKind = t; changed(); });
    else $("#lkMedia", root).innerHTML = "";
  };
  bind("#lkFont", "font"); bind("#lkSize", "size", v => Math.max(30, Math.min(200, +v || 80))); bind("#lkColor", "color"); bind("#lkUp", "upper"); bind("#lkSh", "shadow"); bind("#lkBand", "band");
  bind("#lkAl", "align"); bind("#lkVa", "valign"); bind("#lkBg", "bgType", v => v, bgUi); bind("#lkC1", "bgColor"); bind("#lkC2", "bgColor2"); bind("#lkDim", "overlay", Number);
  bgUi();
}

async function mediaPicker(root, kind, current, onPick) {
  root.innerHTML = `<p style="margin-top:6px">Upload a ${kind === "image" ? "picture" : "video"}: <input type="file" accept="${kind}/*"></p><div class="hint">Or pick one you uploaded before:</div><div class="media-grid"></div>`;
  const inp = $("input", root), grid = $(".media-grid", root);
  const draw = files => {
    const list = files.filter(f => kindOf(f.type) === kind).slice(0, 24);
    grid.innerHTML = list.length ? "" : `<span class="hint">None yet.</span>`;
    list.forEach(f => {
      const t = h(`<button class="media-tile ${f.filename === current ? "on" : ""}" title="${esc(f.name || "")}"><div></div></button>`);
      renderThumb(t.firstElementChild, { bg: { type: "media", kind, url: mediaUrl(f.filename), fit: "cover" } });
      t.onclick = () => { current = f.filename; onPick(f.filename); draw(files); };
      grid.append(t);
    });
  };
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    inp.disabled = true;
    try { const r = await uploadFile(f); current = r.filename; onPick(r.filename); draw(await loadFiles()); }
    catch (e) { toast(errMsg(e), "err"); }
    inp.disabled = false;
  };
  draw(await loadFiles());
}
