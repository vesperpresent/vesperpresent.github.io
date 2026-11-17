const VESPA = {
  origin: "https://kaidaz18.duckdns.org",
  slug: "vesper-presentation-software",
  key: "pk_live_LDtiPPPsRE1psDbDSJJAmbT6",
  logo: "assets/img/logo.svg",
  googleClientId: ""
};

const GOOGLE_G = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

const REEL = `<div class="reel" aria-hidden="true"><div class="reel-s"><span>Amazing grace, how sweet the sound<br>that saved a wretch like me</span></div><div class="reel-s"><span>For God so loved the world<small>John 3:16</small></span></div><div class="reel-s"><span>My chains are gone,<br>I've been set free</span></div><div class="reel-s"><span>Welcome home<small>We're glad you're here</small></span></div></div>`;

function authShell(inner) {
  return `<div class="auth"><div class="auth-main"><a href="./" class="auth-brand"><img src="${VESPA.logo}" alt="Vespa logo" width="30" height="30"><span>Vespa</span></a><div class="auth-form">${inner}</div><p class="auth-foot">Free church presentation software</p></div><aside class="auth-art" aria-hidden="true"><div class="auth-art-in">${REEL}<blockquote>Built for the volunteer at the back of the room.</blockquote><p>Songs, sermons, scripture, images and video on the big screen. Free for every church.</p></div></aside></div>`;
}

const bread = typeof BreadClient !== "undefined" ? new BreadClient({ baseUrl: VESPA.origin, projectSlug: VESPA.slug, apiKey: VESPA.key }) : null;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
function h(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function errMsg(e) { return (e && (e.error || e.message)) || "Something went wrong. Please try again."; }

const Theme = {
  key: "vespa-theme",
  get() { try { return localStorage.getItem(this.key) || "system"; } catch (e) { return "system"; } },
  apply(t) { const r = document.documentElement; if (t === "light" || t === "dark") r.setAttribute("data-theme", t); else r.removeAttribute("data-theme"); },
  effective() { const t = this.get(); if (t !== "system") return t; return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; },
  set(t) { try { localStorage.setItem(this.key, t); } catch (e) {} this.apply(t); document.dispatchEvent(new CustomEvent("themechange")); },
  toggle() { this.set(this.effective() === "dark" ? "light" : "dark"); }
};
Theme.apply(Theme.get());

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  stage: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 20h10M8 8h8M8 12h5"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  video: '<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m16 10 6-3v10l-6-3z"/>',
  song: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  scripture: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  sermon: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/>',
  slides: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M8 9h8M8 12.5h5"/>',
  eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/>',
  square: '<rect x="4" y="4" width="16" height="16" rx="2"/>',
  spark: '<path d="M12 3l2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  grip: '<circle cx="9" cy="6" r=".6"/><circle cx="15" cy="6" r=".6"/><circle cx="9" cy="12" r=".6"/><circle cx="15" cy="12" r=".6"/><circle cx="9" cy="18" r=".6"/><circle cx="15" cy="18" r=".6"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  play: '<path d="M7 4.5v15l13-7.5z"/>',
  pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
  restart: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  eraser: '<path d="m7 21-4-4L14 6l7 7-8 8z"/><path d="M22 21H7M9 11l6 6"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  more: '<circle cx="5" cy="12" r=".8"/><circle cx="12" cy="12" r=".8"/><circle cx="19" cy="12" r=".8"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'
};
function icon(n, cls = "") { return `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ""}</svg>`; }

function toast(msg, kind = "") {
  let w = $(".toasts");
  if (!w) { w = h('<div class="toasts" role="status" aria-live="polite"></div>'); document.body.append(w); }
  const t = h(`<div class="toast ${kind}">${esc(msg)}</div>`);
  w.append(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, 3200);
}

function modal({ title = "", body = "", wide = false, onClose } = {}) {
  const m = h(`<div class="modal-bg"><div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true"><div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">${icon("x")}</button></div><div class="modal-body"></div></div></div>`);
  const b = $(".modal-body", m);
  if (typeof body === "string") b.innerHTML = body; else b.append(body);
  const close = () => { m.classList.add("out"); setTimeout(() => m.remove(), 180); document.removeEventListener("keydown", key); onClose && onClose(); };
  const key = e => { if (e.key === "Escape") close(); };
  m.addEventListener("mousedown", e => { if (e.target === m) close(); });
  $("[data-close]", m).onclick = close;
  document.addEventListener("keydown", key);
  document.body.append(m);
  return { el: m, body: b, close };
}

function confirmBox(text, okLabel = "Delete") {
  return new Promise(res => {
    const m = modal({ title: "Are you sure?", body: `<p class="muted">${esc(text)}</p><div class="row end gap"><button class="btn ghost" data-no>Cancel</button><button class="btn danger" data-yes>${esc(okLabel)}</button></div>`, onClose: () => res(false) });
    $("[data-no]", m.el).onclick = () => m.close();
    $("[data-yes]", m.el).onclick = () => { res(true); m.close(); };
  });
}

const FONTS = {
  Inter: "'Inter', system-ui, sans-serif",
  Montserrat: "'Montserrat', sans-serif",
  Oswald: "'Oswald', sans-serif",
  Lora: "'Lora', serif",
  Playfair: "'Playfair Display', serif"
};
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lora:wght@400;500;600;700&family=Montserrat:wght@400;600;700;800&family=Oswald:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap";

const PRESETS = {
  classic: { name: "Classic", font: "Inter", size: 86, weight: 600, color: "#ffffff", align: "center", valign: "middle", upper: false, shadow: true, band: false, bgType: "color", bgColor: "#000000", bgColor2: "#000000", bgFile: "", bgKind: "", overlay: 0 },
  dusk: { name: "Dusk", font: "Montserrat", size: 84, weight: 700, color: "#ffffff", align: "center", valign: "middle", upper: false, shadow: true, band: false, bgType: "gradient", bgColor: "#1a1238", bgColor2: "#5a3a7e", bgFile: "", bgKind: "", overlay: 0 },
  linen: { name: "Linen", font: "Lora", size: 80, weight: 500, color: "#2b2620", align: "center", valign: "middle", upper: false, shadow: false, band: false, bgType: "color", bgColor: "#f3eee4", bgColor2: "#f3eee4", bgFile: "", bgKind: "", overlay: 0 },
  bold: { name: "Bold", font: "Oswald", size: 104, weight: 600, color: "#ffffff", align: "center", valign: "middle", upper: true, shadow: true, band: false, bgType: "gradient", bgColor: "#0b2239", bgColor2: "#0f5c5c", bgFile: "", bgKind: "", overlay: 0 },
  lower: { name: "Lower third", font: "Inter", size: 60, weight: 600, color: "#ffffff", align: "center", valign: "bottom", upper: false, shadow: false, band: true, bgType: "color", bgColor: "#000000", bgColor2: "#000000", bgFile: "", bgKind: "", overlay: 0 },
  editorial: { name: "Editorial", font: "Playfair", size: 82, weight: 600, color: "#f6f1e7", align: "left", valign: "bottom", upper: false, shadow: true, band: false, bgType: "gradient", bgColor: "#121212", bgColor2: "#3b2a1c", bgFile: "", bgKind: "", overlay: 0 }
};
function themeOf(t) { return Object.assign({}, PRESETS.classic, t || {}); }

function mediaUrl(filename) {
  if (!filename) return "";
  if (/^(https?:|blob:|data:)/.test(filename)) return filename;
  try { return bread ? bread.files.url(filename, { withAuth: true }) : ""; } catch (e) { return ""; }
}

function buildFrame(pres, i) {
  if (!pres || !pres.slides) return null;
  const s = pres.slides[i];
  if (!s) return null;
  const th = themeOf(pres.theme);
  const o = pres.opts || {};
  let bg;
  if (s.media) bg = { type: "media", kind: s.media.kind, file: s.media.filename, url: mediaUrl(s.media.filename), loop: o.loop !== false, mute: !!o.mute, fit: o.fit || "contain", overlay: 0, color: "#000000" };
  else if ((th.bgType === "image" || th.bgType === "video") && th.bgFile) bg = { type: "media", kind: th.bgType, file: th.bgFile, url: mediaUrl(th.bgFile), loop: true, mute: true, fit: "cover", overlay: +th.overlay || 0, color: "#000000" };
  else bg = { type: th.bgType === "gradient" ? "gradient" : "color", color: th.bgColor, color2: th.bgColor2 };
  return {
    key: pres.id + ":" + i,
    presId: pres.id,
    index: i,
    bg,
    text: s.text || "",
    sub: s.sub || "",
    label: s.label || "",
    style: { font: th.font, size: +th.size, weight: +th.weight, color: th.color, align: th.align, valign: th.valign, upper: !!th.upper, shadow: !!th.shadow, band: !!th.band }
  };
}

function bgKey(bg) { if (!bg) return "none"; return [bg.type, bg.kind, bg.file, bg.color, bg.color2, bg.overlay, bg.fit, bg.loop, bg.mute].join("|"); }

function bgEl(bg, { live = false, preview = false } = {}) {
  const el = h('<div class="vs-layer vs-bg"></div>');
  if (!bg) return el;
  if (bg.type === "color") el.style.background = bg.color;
  else if (bg.type === "gradient") el.style.background = `linear-gradient(135deg, ${bg.color}, ${bg.color2})`;
  else {
    el.style.background = bg.color || "#000";
    if (bg.kind === "image") {
      const img = h('<img alt="" draggable="false">');
      img.src = bg.url; img.style.objectFit = bg.fit;
      el.append(img);
    } else {
      const v = document.createElement("video");
      v.playsInline = true; v.style.objectFit = bg.fit; v.preload = live ? "auto" : "metadata";
      v.muted = preview || !live || bg.mute;
      if (live) { v.autoplay = true; v.loop = bg.loop; v.src = bg.url; }
      else v.src = bg.url + "#t=0.5";
      el.append(v);
    }
    if (bg.overlay) { const o = h('<div class="vs-dim"></div>'); o.style.opacity = bg.overlay; el.append(o); }
  }
  return el;
}

function textEl(f) {
  const st = f.style;
  const el = h('<div class="vs-layer vs-text"><div class="vs-box"><div class="vs-tx"></div></div></div>');
  el.dataset.valign = st.valign; el.dataset.align = st.align;
  const box = $(".vs-box", el), tx = $(".vs-tx", el);
  tx.innerHTML = esc(f.text).replace(/\n/g, "<br>") + (f.sub ? `<div class="vs-sub">${esc(f.sub)}</div>` : "");
  Object.assign(tx.style, { fontFamily: FONTS[st.font] || FONTS.Inter, fontSize: st.size + "px", fontWeight: st.weight, color: st.color, textAlign: st.align, textTransform: st.upper ? "uppercase" : "none", textShadow: st.shadow ? "0 4px 24px rgba(0,0,0,.55)" : "none" });
  if (st.band) box.classList.add("band");
  el._fitSize = st.size;
  return el;
}

function fitText(el) {
  const box = $(".vs-box", el), tx = $(".vs-tx", el);
  if (!box || !tx) return;
  const run = () => {
    const H = el.clientHeight - 160, W = box.clientWidth;
    if (!H || H < 0) return;
    let size = el._fitSize || 80, n = 0;
    tx.style.fontSize = size + "px";
    while ((tx.scrollHeight > H || tx.scrollWidth > W + 2) && size > 26 && n++ < 50) { size *= 0.94; tx.style.fontSize = size + "px"; }
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(run));
  requestAnimationFrame(run);
}

const fitRO = new ResizeObserver(es => { for (const e of es) { const st = e.target.firstElementChild; if (st) st.style.transform = `scale(${e.contentRect.width / 1920})`; } });
function makeFit() { const c = h('<div class="vs-fit"><div class="vs-stage" style="transform:scale(.1)"></div></div>'); fitRO.observe(c); return c; }

function renderThumb(container, f) {
  const fit = makeFit();
  const stage = fit.firstElementChild;
  if (f) {
    stage.append(bgEl(f.bg));
    if (f.text || f.sub) { const t = textEl(f); stage.append(t); fitText(t); }
  }
  container.innerHTML = "";
  container.append(fit);
  return fit;
}

class Compositor {
  constructor(stage, { preview = false } = {}) {
    this.stage = stage; this.preview = preview;
    stage.classList.add("vs-comp");
    stage.innerHTML = '<div class="vs-layer L-bg"></div><div class="vs-layer L-tx"></div><div class="vs-layer L-msg"><div class="vs-msg"></div></div><div class="vs-layer L-logo"><img alt=""></div><div class="vs-layer L-black"></div>';
    this.bgs = $(".L-bg", stage); this.txts = $(".L-tx", stage);
    this.bgK = null; this.txK = null; this.dur = 0.5;
    this.onSound = null;
  }
  set(st) {
    this.dur = st.transition ?? 0.5;
    this.stage.style.setProperty("--fade", this.dur + "s");
    const f = st.frame;
    const bg = !f || st.clearBg ? null : f.bg;
    const bk = bgKey(bg);
    if (bk !== this.bgK) { this.bgK = bk; this.swap(this.bgs, bg ? bgEl(bg, { live: true, preview: this.preview }) : null, false); }
    const show = f && !st.clearText && (f.text || f.sub);
    const tk = show ? [f.text, f.sub, JSON.stringify(f.style)].join("|") : "none";
    if (tk !== this.txK) { this.txK = tk; this.swap(this.txts, show ? textEl(f) : null, true); }
    const msg = $(".L-msg", this.stage);
    const mtext = st.message && st.message.show && st.message.text ? st.message.text : "";
    if (mtext) $(".vs-msg", msg).textContent = mtext;
    msg.classList.toggle("on", !!mtext);
    const lg = $(".L-logo", this.stage);
    const img = $("img", lg);
    const lsrc = st.logoUrl || VESPA.logo;
    if (img.getAttribute("src") !== lsrc) img.setAttribute("src", lsrc);
    lg.classList.toggle("on", !!st.logo);
    $(".L-black", this.stage).classList.toggle("on", !!st.black);
  }
  swap(layer, el, fit) {
    const dur = this.dur;
    [...layer.children].forEach(o => {
      o.classList.remove("in");
      setTimeout(() => { $$("video", o).forEach(v => { try { v.pause(); v.removeAttribute("src"); v.load(); } catch (e) {} }); o.remove(); }, dur * 1000 + 80);
    });
    if (!el) return;
    el.classList.add("fx");
    layer.append(el);
    if (fit) fitText(el);
    const v = $("video", el);
    if (v) {
      const p = v.play();
      if (p && p.catch) p.catch(() => { v.muted = true; v.play().catch(() => {}); if (!this.preview && this.onSound) this.onSound(v); });
    }
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("in")));
  }
  video() { const l = this.bgs.lastElementChild; return l ? $("video", l) : null; }
  control(cmd) {
    const v = this.video(); if (!v) return;
    if (cmd === "play") v.play().catch(() => {});
    else if (cmd === "pause") v.pause();
    else if (cmd === "restart") { v.currentTime = 0; v.play().catch(() => {}); }
  }
}

function parseBlocks(src) {
  const blocks = String(src || "").replace(/\r/g, "").split(/\n\s*\n/);
  let label = "";
  const out = [];
  for (const b of blocks) {
    let lines = b.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length && /^\[(.+)\]$/.test(lines[0])) { label = lines[0].slice(1, -1).trim(); lines.shift(); }
    const sub = lines.filter(l => l.startsWith("~")).map(l => l.slice(1).trim()).join(" ");
    lines = lines.filter(l => !l.startsWith("~"));
    if (!lines.length && !sub) continue;
    out.push({ id: uid(), text: lines.join("\n"), sub, label });
  }
  return out;
}

function blocksToSource(slides) {
  let last = "";
  return (slides || []).filter(s => !s.media).map(s => {
    let t = "";
    if (s.label && s.label !== last) t += `[${s.label}]\n`;
    last = s.label || last;
    t += s.text || "";
    if (s.sub) t += (s.text ? "\n" : "") + "~ " + s.sub;
    return t;
  }).join("\n\n");
}

const TRANSLATIONS = { web: "WEB", kjv: "KJV", bbe: "BBE", "oeb-us": "OEB", clementine: "Vulgate", almeida: "Almeida", rccv: "RCCV" };
async function fetchScripture(ref, tr = "web") {
  let r;
  try { r = await fetch("https://bible-api.com/" + encodeURIComponent(ref.trim()) + "?translation=" + tr); }
  catch (e) { throw { error: "Could not reach the scripture service. Check your connection." }; }
  if (!r.ok) throw { error: "Passage not found. Try a format like John 3:16-18." };
  const j = await r.json();
  if (!j.verses || !j.verses.length) throw { error: "Passage not found." };
  return j;
}
function scriptureSource(j, per = 2, tr = "web") {
  const out = [];
  for (let i = 0; i < j.verses.length; i += per) {
    const g = j.verses.slice(i, i + per);
    const a = g[0], z = g[g.length - 1];
    const ref = `${a.book_name} ${a.chapter}:${a.verse}${z.verse !== a.verse || z.chapter !== a.chapter ? "-" + (z.chapter !== a.chapter ? z.chapter + ":" : "") + z.verse : ""} ${TRANSLATIONS[tr] || ""}`.trim();
    out.push(g.map(v => v.text.replace(/\s+/g, " ").trim()).join(" ") + "\n~ " + ref);
  }
  return out.join("\n\n");
}

const Auth = {
  user: null,
  async restore() {
    if (!bread || !bread.auth.isSignedIn()) return null;
    try { const { user } = await bread.auth.me(); this.user = user; return user; }
    catch (e) { return null; }
  },
  async providers() {
    try { const r = await fetch(`${VESPA.origin}/api/v1/${VESPA.slug}/auth/providers`, { headers: { "x-api-key": VESPA.key } }); return await r.json(); }
    catch (e) { return {}; }
  }
};

function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.async = true; s.onload = res; s.onerror = rej; document.head.append(s); });
}

const AuthUI = {
  mount(root, { onDone, title = "Vespa" } = {}) {
    const p = new URLSearchParams(location.search);
    let mode = p.get("signup") ? "signup" : "signin";
    let mfaToken = null;
    const view = () => {
      const heads = { signin: ["Welcome back", "Sign in to continue to " + title], signup: ["Create your free account", "Free for every church. No card, no catch."], forgot: ["Reset your password", "We will email you a secure link."], mfa: ["Two-step verification", "Enter the 6-digit code from your authenticator app."] };
      const [hd, sb] = heads[mode];
      const gate = mode === "signin" || mode === "signup";
      root.innerHTML = authShell(`
        <h1>${hd}</h1><p class="muted auth-sub">${sb}</p>
        ${gate ? `<div class="g-slot"><button type="button" class="btn g-btn lg" id="g-fallback">${GOOGLE_G}<span>Continue with Google</span></button><div id="g-btn"></div></div><div class="divider"><span>or use email</span></div>` : ""}
        <form class="stack" novalidate>
          ${mode === "mfa" ? `<input class="input code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required>` : `<label class="field"><span>Email</span><input class="input" type="email" name="email" autocomplete="email" placeholder="you@church.org" required></label>`}
          ${gate ? `<label class="field"><span class="row between">Password${mode === "signin" ? `<a href="#" data-m="forgot" class="field-link">Forgot?</a>` : ""}</span><input class="input" type="password" name="password" minlength="8" maxlength="72" autocomplete="${mode === "signup" ? "new-password" : "current-password"}" placeholder="${mode === "signup" ? "At least 8 characters" : ""}" required></label>` : ""}
          <div class="form-err" hidden></div>
          <button class="btn primary lg" type="submit">${{ signin: "Sign in", signup: "Create free account", forgot: "Send reset link", mfa: "Verify" }[mode]}</button>
        </form>
        <div class="auth-links">
          ${mode === "signin" ? `<span>New to Vespa? <a href="#" data-m="signup">Create an account</a></span>` : ""}
          ${mode === "signup" ? `<span>Already have an account? <a href="#" data-m="signin">Sign in</a></span><span class="hint">You will verify your email before your first service.</span>` : ""}
          ${mode === "forgot" || mode === "mfa" ? `<a href="#" data-m="signin">Back to sign in</a>` : ""}
        </div>`);
      $$("[data-m]", root).forEach(a => a.onclick = e => { e.preventDefault(); mode = a.dataset.m; view(); });
      const form = $("form", root), err = $(".form-err", root), btn = $("button[type=submit]", root);
      const showErr = m => { err.textContent = m; err.hidden = !m; };
      form.onsubmit = async e => {
        e.preventDefault(); showErr("");
        const fd = new FormData(form);
        const email = String(fd.get("email") || "").trim(), pw = String(fd.get("password") || "");
        if (mode !== "mfa" && !/^\S+@\S+\.\S+$/.test(email)) return showErr("Please enter a valid email address.");
        if ((mode === "signup" || mode === "signin") && pw.length < 8) return showErr("Passwords are at least 8 characters.");
        btn.disabled = true; btn.classList.add("busy");
        try {
          if (mode === "signup") { const r = await bread.auth.signup(email, pw); return onDone(r.user); }
          if (mode === "signin") {
            const r = await bread.auth.login(email, pw);
            if (r.mfaRequired) { mfaToken = r.mfaToken; mode = "mfa"; return view(); }
            return onDone(r.user);
          }
          if (mode === "mfa") { const r = await bread.auth.mfa.verify(mfaToken, String(fd.get("code") || "").trim()); return onDone(r.user || (await bread.auth.me()).user); }
          if (mode === "forgot") { await bread.auth.forgotPassword(email); toast("If that email has an account, a reset link is on its way."); mode = "signin"; view(); }
        } catch (ex) { showErr(ex.status === 409 ? "That email already has an account. Try signing in." : errMsg(ex)); }
        finally { btn.disabled = false; btn.classList.remove("busy"); }
      };
      if (mode === "signin" || mode === "signup") this.google(root, r => {
        if (r.mfaRequired) { mfaToken = r.mfaToken; mode = "mfa"; view(); } else onDone(r.user);
      }, showErr);
    };
    view();
  },
  async google(root, done, showErr) {
    const fb = $("#g-fallback", root);
    let cid = VESPA.googleClientId;
    if (!cid) { const pv = await Auth.providers(); const g = pv && pv.google; cid = g && g.enabled && g.clientIds && g.clientIds[0]; }
    if (!cid) { if (fb) fb.onclick = () => showErr("Google sign-in is not switched on yet. Please use email for now."); return; }
    try { if (!window.google || !google.accounts) await loadScript("https://accounts.google.com/gsi/client"); }
    catch (e) { if (fb) fb.onclick = () => showErr("Could not load Google sign-in. Check your connection or use email."); return; }
    const slot = $("#g-btn", root); if (!slot || !slot.isConnected) return;
    const nonce = uid() + uid();
    google.accounts.id.initialize({
      client_id: cid, nonce, auto_select: false, cancel_on_tap_outside: true, use_fedcm_for_prompt: true,
      callback: async resp => {
        try { done(await bread.auth.signInWithGoogle(resp.credential, { nonce })); }
        catch (e) { showErr(errMsg(e)); }
      }
    });
    google.accounts.id.renderButton(slot, { theme: Theme.effective() === "dark" ? "filled_black" : "outline", size: "large", shape: "pill", text: "continue_with", logo_alignment: "center", width: Math.min(400, slot.parentElement.clientWidth || 360) });
    if (fb) fb.hidden = true;
    try { google.accounts.id.prompt(); } catch (e) {}
  },
  verify(root, user, { onVerified, onSignOut }) {
    root.innerHTML = authShell(`
      <div class="auth-badge">${icon("mail")}</div>
      <h1>Check your inbox</h1>
      <p class="muted auth-sub">We sent a verification link to <b>${esc(user.email)}</b>. Open it to activate your account, then come back here.</p>
      <div class="stack">
        <button class="btn primary lg" data-a="check">I have verified my email</button>
        <button class="btn lg" data-a="resend">Send the email again</button>
      </div>
      <div class="auth-links"><a href="#" data-a="out">Use a different account</a></div>`);
    $("[data-a=check]", root).onclick = async e => {
      const b = e.currentTarget; b.classList.add("busy");
      try { const { user: u } = await bread.auth.me(); if (u.isVerified) onVerified(u); else toast("Not verified yet. Check your inbox and spam folder."); }
      catch (ex) { toast(errMsg(ex), "err"); }
      b.classList.remove("busy");
    };
    $("[data-a=resend]", root).onclick = async () => { try { await bread.auth.resendVerification(user.email); toast("Verification email sent."); } catch (ex) { toast(errMsg(ex), "err"); } };
    $("[data-a=out]", root).onclick = async e => { e.preventDefault(); try { await bread.auth.logout(); } catch (ex) {} onSignOut(); };
  }
};

async function requireUser(root, onReady) {
  if (!bread) { root.innerHTML = authShell(`<h1>Can't connect</h1><p class="muted auth-sub">Vespa could not reach its server. Check your internet connection and reload.</p><button class="btn primary lg" onclick="location.reload()">Reload</button>`); return; }
  const start = async u => {
    if (!u) return AuthUI.mount(root, { onDone: start });
    if (!u.isVerified) return AuthUI.verify(root, u, { onVerified: start, onSignOut: () => start(null) });
    root.innerHTML = "";
    onReady(u);
  };
  start(await Auth.restore());
}
