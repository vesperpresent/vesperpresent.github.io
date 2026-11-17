(() => {
  let user, R, state = {}, tab = "slides", unsub;
  requireUser($("#root"), "projector", u => { user = u; start(); });

  async function start() {
    R = bread.collection("remote");
    $("#root").innerHTML = `<div class="r">
      <div class="topbar"><img src="${VESPA.logo}" alt="Vespa"><span class="name">Vespa</span><span class="where">Remote</span><span class="right"><span id="stat"></span> <button class="linkbtn" id="th"></button></span></div>
      <div class="now" id="now"></div>
      <div class="nav"><button class="btn" id="pv">&lt; Back</button><button class="btn primary" id="nx">Next &gt;</button></div>
      <div class="ctrls">
        <button class="btn" data-a="clearText">Hide text</button>
        <button class="btn" data-a="logo">Logo</button>
        <button class="btn" data-a="black">Black</button>
        <button class="btn" data-a="clearAll">Clear all</button>
      </div>
      <div class="seg tabs"><button data-t="slides">Slides</button><button data-t="service">Running order</button></div>
      <div class="list" id="list"></div>
    </div>`;
    const th = () => $("#th").textContent = Theme.effective() === "dark" ? "Light mode" : "Dark mode";
    th(); $("#th").onclick = () => { Theme.toggle(); th(); };
    $("#pv").onclick = () => send("prev");
    $("#nx").onclick = () => send("next");
    $$("[data-a]").forEach(b => b.onclick = () => send(b.dataset.a));
    $$("[data-t]").forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
    swipe($("#now"));
    await refresh();
    subscribe();
    setInterval(refresh, 4000);
    setInterval(drawStat, 2000);
    keepAwake();
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { refresh(); subscribe(); keepAwake(); } });
  }

  async function refresh() {
    try { const d = await R.getById(user.id); if (d && d.state) { state = d.state; draw(); } }
    catch (e) { if (e && e.status === 404) { state = {}; draw(); } }
  }
  function subscribe() {
    try {
      if (unsub) unsub();
      const r = R.subscribe(ev => { if (ev && ev.docId === user.id && ev.doc && ev.doc.state) { state = ev.doc.state; draw(); } });
      if (r && r.then) r.then(f => unsub = f).catch(() => {}); else unsub = r;
    } catch (e) {}
  }

  async function send(action, extra = {}) {
    if (navigator.vibrate) navigator.vibrate(12);
    try { await R.update(user.id, { command: { action, ...extra, nonce: uid(), at: Date.now(), from: "phone" } }); }
    catch (e) { toast(e && e.status === 404 ? "Open the projector page on the computer first." : errMsg(e), "err"); }
  }

  function drawStat() {
    const on = state.at && Date.now() - state.at < 75000;
    $("#stat").innerHTML = `<span class="dot ${on ? "on" : ""}"></span> ${on ? "Connected" : "Not connected"}`;
  }

  function draw() {
    drawStat();
    const f = state.flags || {};
    $$("[data-a]").forEach(b => b.classList.toggle("on", !!f[b.dataset.a]));
    $$("[data-t]").forEach(b => b.classList.toggle("on", b.dataset.t === tab));
    const s = state.slides && state.index >= 0 ? state.slides[state.index] : null;
    const isLive = state.liveId && state.liveId === state.presId;
    $("#now").innerHTML = `<div class="row between"><b>${esc(state.title || "Nothing chosen")}</b><span>${isLive && s ? `Slide ${state.index + 1} of ${state.slides.length}` : ""}</span></div>
      ${s && s.l ? `<div class="lb">[${esc(s.l)}]</div>` : ""}
      <div class="tx">${isLive && s ? esc(s.t || "") : '<span class="muted" style="font-weight:normal">Tap a slide below or press Next.</span>'}</div>`;
    const L = $("#list");
    if (tab === "slides") {
      const sl = state.slides || [];
      if (!sl.length) { L.innerHTML = `<p>No slides to show. Open the projector page on the computer.</p>`; return; }
      L.innerHTML = `<table class="list">${sl.map((x, i) => `<tr class="${isLive && i === state.index ? "on" : ""}" data-i="${i}"><td class="n">${i + 1}</td><td>${x.l ? `<b>[${esc(x.l)}]</b> ` : ""}${esc(x.t || "Slide").replace(/\n/g, " / ")}</td></tr>`).join("")}</table>`;
      $$("tr[data-i]", L).forEach(b => b.onclick = () => send("goto", { presId: state.presId, index: +b.dataset.i }));
    } else {
      const it = state.items || [];
      if (!it.length) { L.innerHTML = `<p>The running order is empty.</p>`; return; }
      L.innerHTML = `<table class="list">${it.map((x, i) => `<tr class="${x.id === state.liveId ? "on" : ""}" data-id="${esc(x.id)}"><td class="n">${i + 1}</td><td>${esc(x.title || "Untitled")}</td></tr>`).join("")}</table>`;
      $$("tr[data-id]", L).forEach(b => b.onclick = () => { send("goto", { presId: b.dataset.id, index: 0 }); tab = "slides"; });
    }
  }

  function swipe(el) {
    let x0 = null;
    el.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
    el.addEventListener("touchend", e => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) send(dx < 0 ? "next" : "prev");
    });
  }

  let lock = null;
  async function keepAwake() { try { if ("wakeLock" in navigator && !lock) { lock = await navigator.wakeLock.request("screen"); lock.addEventListener("release", () => lock = null); } } catch (e) {} }
})();
