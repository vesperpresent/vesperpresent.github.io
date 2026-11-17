(() => {
  const back = new URLSearchParams(location.search).get("view") === "stage";
  const ch = new BroadcastChannel("vespa-live");
  let last = null, soundVid = null;
  const fmt = sec => { const neg = sec < 0; sec = Math.abs(sec); const m = Math.floor(sec / 60), s = sec % 60; return (neg ? "-" : "") + m + ":" + String(s).padStart(2, "0"); };
  const timerLeft = t => t ? (t.running ? Math.round((t.end - Date.now()) / 1000) : t.left) : 0;
  document.title = back ? "Vespa - Back screen" : "Vespa - Front screen";

  document.body.innerHTML = `<div id="wrap"><div class="vs-stage" id="st"></div></div>
    ${back ? `<div class="sd" id="sd">
      <div class="sd-top"><span id="clk"></span><span id="ttl"></span><span id="tmr"></span></div>
      <div class="sd-now"><div class="sd-label" id="lbl"></div><div class="sd-text" id="now">Waiting for the projector page...</div><div class="sd-sub" id="sub"></div></div>
      <div class="sd-next" id="nxt"></div>
      <div class="sd-msg" id="msg" hidden></div>
    </div>` : ""}
    <div class="hint" id="hint">Double-click for full screen</div>`;
  const st = document.getElementById("st"), hint = document.getElementById("hint");
  const comp = new Compositor(st, { preview: back });
  comp.set({ logo: true, transition: 0 });
  const scale = () => { const s = Math.min(innerWidth / 1920, innerHeight / 1080); st.style.transform = `scale(${s}) translate(-50%, -50%)`; };
  addEventListener("resize", scale); scale();
  comp.onSound = v => { if (back) return; soundVid = v; hint.textContent = "Click once to turn on the sound"; hint.hidden = false; };

  const fs = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); };
  addEventListener("dblclick", fs);
  addEventListener("keydown", e => { if (e.key === "f" || e.key === "F") fs(); });
  addEventListener("click", () => {
    if (soundVid && last && last.frame && last.frame.bg && !last.frame.bg.mute) { soundVid.muted = false; soundVid.play().catch(() => {}); soundVid = null; hint.hidden = true; }
  });
  let idle;
  const wake = () => { document.body.classList.remove("idle"); if (!soundVid) hint.textContent = "Double-click for full screen"; hint.hidden = false; clearTimeout(idle); idle = setTimeout(() => { document.body.classList.add("idle"); if (!soundVid) hint.hidden = true; }, 2500); };
  addEventListener("mousemove", wake); wake();

  const drawBack = s => {
    const mirror = s.backMode === "mirror";
    document.getElementById("sd").hidden = mirror;
    document.getElementById("wrap").hidden = !mirror;
    const f = s.frame;
    document.getElementById("ttl").textContent = s.black ? "Front screen is black" : s.logo ? "Front screen shows the logo" : s.clearText && f ? "Text is hidden" : (s.title || "");
    document.getElementById("lbl").textContent = f && f.label ? f.label : "";
    document.getElementById("now").textContent = f ? (f.text || (f.bg && f.bg.type === "media" ? (f.bg.kind === "video" ? "(video playing)" : "(picture on screen)") : "")) : "Nothing on screen";
    document.getElementById("sub").textContent = f && f.sub ? f.sub : "";
    const n = s.next;
    document.getElementById("nxt").textContent = "Next: " + (n ? (n.label ? "[" + n.label + "] " : "") + (n.text || n.sub || (n.media ? "(picture or video)" : "")).replace(/\n/g, " / ") : "end of service");
    const m = s.backMessage, msg = document.getElementById("msg");
    msg.hidden = !(m && m.show && m.text); if (!msg.hidden) msg.textContent = m.text;
  };

  if (back) setInterval(() => {
    document.getElementById("clk").textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const t = last && last.timer, tm = document.getElementById("tmr");
    if (t && t.back) { const l = timerLeft(t); tm.textContent = fmt(l); tm.className = l < 0 ? "over" : ""; } else tm.textContent = "";
  }, 250);

  ch.onmessage = e => {
    const m = e.data || {};
    if (m.type === "state") {
      last = m.state;
      const s = back ? { ...m.state, message: m.state.backMessage || { text: "", show: false } } : m.state;
      if (!back || m.state.backMode === "mirror") comp.set(s);
      if (back) drawBack(m.state);
    }
    else if (m.type === "video" && !back) comp.control(m.cmd);
    else if (m.type === (back ? "close-stage" : "close")) window.close();
  };
  ch.postMessage({ type: "hello" });
  const ping = () => ch.postMessage({ type: "ping", view: back ? "stage" : "main" });
  ping(); setInterval(ping, 2000);
})();
