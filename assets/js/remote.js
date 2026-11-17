(() => {
  let user, R, state = {}, tab = "slides", unsub;
  requireUser($("#root"), u => { user = u; start(); });

  async function start() {
    R = bread.collection("remote");
    $("#root").innerHTML = `<div class="r">
      <div class="r-top"><img src="${VESPA.logo}" alt="Vespa"><b>Remote</b><span class="r-stat" id="stat"><span class="dot"></span>Connecting</span><button class="icon-btn" id="th"></button></div>
      <div class="now" id="now"></div>
      <div class="nav"><button class="btn lg" id="pv">${icon("left")}Back</button><button class="btn primary lg" id="nx">Next${icon("right")}</button></div>
      <div class="ctrls">
        <button data-a="clearText">${icon("eyeoff")}Text</button>
        <button data-a="logo">${icon("spark")}Logo</button>
        <button data-a="black">${icon("square")}Black</button>
        <button data-a="clearAll">${icon("eraser")}Clear</button>
      </div>
      <div class="seg tabs"><button data-t="slides">Slides</button><button data-t="service">Service</button></div>
      <div class="list" id="list"></div>
    </div>`;
    const th = () => $("#th").innerHTML = icon(Theme.effective() === "dark" ? "sun" : "moon");
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
    catch (e) { toast(e && e.status === 404 ? "Open Vespa on your computer first." : errMsg(e), "err"); }
  }

  function drawStat() {
    const on = state.at && Date.now() - state.at < 75000;
    $("#stat").innerHTML = `<span class="dot ${on ? "on" : ""}"></span>${on ? "Connected" : "Open Vespa on your computer"}`;
  }

  function draw() {
    drawStat();
    const f = state.flags || {};
    $$("[data-a]").forEach(b => b.classList.toggle("on", !!f[b.dataset.a]));
    $$("[data-t]").forEach(b => b.classList.toggle("on", b.dataset.t === tab));
    const s = state.slides && state.index >= 0 ? state.slides[state.index] : null;
    const isLive = state.liveId && state.liveId === state.presId;
    $("#now").innerHTML = `<small><span>${esc(state.title || "Nothing selected")}</span><span>${isLive && s ? `${state.index + 1} / ${state.slides.length}` : ""}</span></small>
      ${s && s.l ? `<div class="lb" style="margin-top:10px">${esc(s.l)}</div>` : ""}
      <div class="tx">${isLive && s ? esc(s.t || "") : '<span class="muted" style="font-weight:500">Tap a slide below or press Next to go live.</span>'}</div>`;
    const L = $("#list");
    if (tab === "slides") {
      const sl = state.slides || [];
      if (!sl.length) { L.innerHTML = `<div class="empty-r">No slides to show.</div>`; return; }
      L.innerHTML = sl.map((x, i) => `<button class="li ${isLive && i === state.index ? "on" : ""}" data-i="${i}"><span class="n">${i + 1}</span><span class="t">${x.l ? `<small>${esc(x.l)}</small>` : ""}${esc(x.t || "Slide")}</span></button>`).join("");
      $$(".li", L).forEach(b => b.onclick = () => send("goto", { presId: state.presId, index: +b.dataset.i }));
    } else {
      const it = state.items || [];
      if (!it.length) { L.innerHTML = `<div class="empty-r">This service has no items.</div>`; return; }
      L.innerHTML = it.map((x, i) => `<button class="li ${x.id === state.liveId ? "on" : ""}" data-id="${esc(x.id)}"><span class="n">${i + 1}</span><span class="t"><small>${esc(x.type || "")}</small>${esc(x.title || "Untitled")}</span></button>`).join("");
      $$(".li", L).forEach(b => b.onclick = () => { send("goto", { presId: b.dataset.id, index: 0 }); tab = "slides"; });
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
