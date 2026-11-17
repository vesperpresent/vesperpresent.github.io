(() => {
  const stageView = new URLSearchParams(location.search).get("view") === "stage";
  const ch = new BroadcastChannel("vespa-live");
  let last = null;

  const fmt = sec => { const neg = sec < 0; sec = Math.abs(sec); const m = Math.floor(sec / 60), s = sec % 60; return (neg ? "-" : "") + m + ":" + String(s).padStart(2, "0"); };
  const timerLeft = t => t ? (t.running ? Math.round((t.end - Date.now()) / 1000) : t.left) : 0;

  if (!stageView) {
    document.body.innerHTML = '<div id="wrap"><div class="vs-stage" id="st"></div></div><div class="hint" id="hint">Double-click for full screen</div>';
    const st = $("#st"), hint = $("#hint");
    const comp = new Compositor(st);
    comp.set({ logo: true, transition: 0 });
    const scale = () => { const s = Math.min(innerWidth / 1920, innerHeight / 1080); st.style.transform = `scale(${s}) translate(-50%, -50%)`; };
    addEventListener("resize", scale); scale();
    let soundVid = null;
    comp.onSound = v => { soundVid = v; hint.textContent = "Click once to turn on sound"; hint.classList.remove("off"); };
    const fs = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); };
    addEventListener("dblclick", fs);
    addEventListener("click", () => {
      if (soundVid && last && last.frame && last.frame.bg && !last.frame.bg.mute) { soundVid.muted = false; soundVid.play().catch(() => {}); soundVid = null; hint.classList.add("off"); }
    });
    addEventListener("keydown", e => { if (e.key === "f" || e.key === "F") fs(); });
    let idle;
    const wake = () => { document.body.classList.remove("idle"); clearTimeout(idle); idle = setTimeout(() => { document.body.classList.add("idle"); if (!soundVid) hint.classList.add("off"); }, 2500); };
    addEventListener("mousemove", wake); wake();
    document.addEventListener("fullscreenchange", () => { if (document.fullscreenElement && !soundVid) hint.classList.add("off"); });
    ch.onmessage = e => {
      const m = e.data || {};
      if (m.type === "state") { last = m.state; comp.set(m.state); }
      else if (m.type === "video") comp.control(m.cmd);
      else if (m.type === "close") window.close();
    };
  } else {
    document.title = "Vespa Stage Display";
    document.body.innerHTML = `<div class="sd">
      <div class="sd-top"><div class="sd-clock" id="clk"></div><div id="ttl"></div><div class="sd-timer" id="tmr"></div></div>
      <div class="sd-now"><div class="sd-label" id="lbl"></div><div class="sd-text" id="now">Waiting for the operator…</div><div class="sd-sub" id="sub"></div></div>
      <div class="sd-next" id="nxt"></div>
      <div class="sd-msg" id="msg" hidden></div>
    </div>`;
    const draw = s => {
      const f = s.frame;
      $("#ttl").innerHTML = (s.black ? '<span class="sd-state">Screen is black</span>' : s.logo ? '<span class="sd-state">Showing logo</span>' : s.clearText && f ? '<span class="sd-state">Text hidden</span>' : esc(s.title || ""));
      $("#lbl").textContent = f && f.label ? f.label : "";
      $("#now").textContent = f ? (f.text || (f.bg && f.bg.type === "media" ? (f.bg.kind === "video" ? "Video playing" : "Image on screen") : "")) : "Nothing on screen";
      $("#sub").textContent = f && f.sub ? f.sub : "";
      const n = s.next;
      $("#nxt").innerHTML = n ? `<b>Next${n.label ? " · " + esc(n.label) : ""}</b>${esc(n.text || n.sub || (n.media ? "Media" : ""))}` : "<b>Next</b>End of service";
      const showMsg = s.message && s.message.stage && s.message.text;
      $("#msg").hidden = !showMsg; if (showMsg) $("#msg").textContent = s.message.text;
    };
    setInterval(() => {
      $("#clk").textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const t = last && last.timer, tm = $("#tmr");
      if (t && t.stage && (t.running || t.left !== undefined)) { const l = timerLeft(t); tm.textContent = fmt(l); tm.classList.toggle("over", l < 0); } else tm.textContent = "";
    }, 250);
    const fs = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); };
    addEventListener("dblclick", fs);
    ch.onmessage = e => { const m = e.data || {}; if (m.type === "state") { last = m.state; draw(m.state); } else if (m.type === "close-stage") window.close(); };
  }
  ch.postMessage({ type: "hello" });
  setInterval(() => ch.postMessage({ type: "ping", view: stageView ? "stage" : "main" }), 2000);
  ch.postMessage({ type: "ping", view: stageView ? "stage" : "main" });
})();
