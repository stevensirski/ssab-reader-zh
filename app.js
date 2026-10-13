(() => {
  "use strict";

  const INDEX_URL = "content/index.json";
  const episodeUrl = (id) => `content/episodes/${encodeURIComponent(id)}.json`;
  const LAST_KEY = "ssab-reader:last-opened";
  const PREFS_KEY = "ssab-reader:prefs:v1";
  const SIZES = [16, 18, 20, 22, 24, 27, 30, 34];
  const DEFAULT_PREFS = { sizeIndex: 3, pinyin: false, allTranslations: false };

  const $ = (id) => document.getElementById(id);
  const el = {
    episode: $("episode"),
    pinyinToggle: $("pinyin-toggle"),
    trToggle: $("translations-toggle"),
    sizeDown: $("size-down"),
    sizeUp: $("size-up"),
    announce: $("announce"),
    player: $("player"),
    audio: $("audio"),
    controls: $("audio-controls"),
    unavailable: $("audio-unavailable"),
    unavailableDetail: $("audio-unavailable-detail"),
    note: $("audio-note"),
    play: $("play"),
    seek: $("seek"),
    timeCur: $("time-cur"),
    timeDur: $("time-dur"),
    speed: $("speed"),
    card: $("card"),
    cardZh: $("card-zh"),
    cardPy: $("card-py"),
    cardGl: $("card-gl"),
    cardSent: $("card-sent"),
    cardPlay: $("card-play"),
    cardClose: $("card-close"),
  };

  /* ---------------- Preferences (local only) ---------------- */
  function loadPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return Object.assign({}, DEFAULT_PREFS, raw ? JSON.parse(raw) : {});
    } catch { return Object.assign({}, DEFAULT_PREFS); }
  }
  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* storage unavailable */ }
  }
  const prefs = loadPrefs();
  prefs.sizeIndex = Math.min(SIZES.length - 1, Math.max(0, prefs.sizeIndex | 0));

  function say(msg) { el.announce.textContent = ""; requestAnimationFrame(() => { el.announce.textContent = msg; }); }

  function applySize(announce) {
    document.documentElement.style.setProperty("--zh-size", SIZES[prefs.sizeIndex] + "px");
    el.sizeDown.disabled = prefs.sizeIndex === 0;
    el.sizeUp.disabled = prefs.sizeIndex === SIZES.length - 1;
    if (announce) say(`Text size ${prefs.sizeIndex + 1} of ${SIZES.length}`);
  }
  function applyPinyin() {
    document.body.classList.toggle("pinyin", prefs.pinyin);
    el.pinyinToggle.setAttribute("aria-pressed", String(prefs.pinyin));
  }

  el.sizeDown.addEventListener("click", () => { if (prefs.sizeIndex > 0) { prefs.sizeIndex--; applySize(true); savePrefs(); } });
  el.sizeUp.addEventListener("click", () => { if (prefs.sizeIndex < SIZES.length - 1) { prefs.sizeIndex++; applySize(true); savePrefs(); } });
  el.pinyinToggle.addEventListener("click", () => {
    prefs.pinyin = !prefs.pinyin; applyPinyin(); savePrefs();
    say(prefs.pinyin ? "Pinyin shown" : "Pinyin hidden");
  });
  el.trToggle.addEventListener("click", () => {
    prefs.allTranslations = !allOpen();
    setAll(prefs.allTranslations); savePrefs();
    say(prefs.allTranslations ? "All translations shown" : "All translations hidden");
  });
  applySize(false);
  applyPinyin();

  /* ---------------- Sentences ---------------- */
  let sentences = []; // { data, node, tr, timed }

  function setOpen(s, open) { s.tr.hidden = !open; }
  function allOpen() { return sentences.length > 0 && sentences.every((s) => !s.tr.hidden); }
  function syncAllToggle() { el.trToggle.setAttribute("aria-pressed", String(allOpen())); }
  function setAll(open) { sentences.forEach((s) => setOpen(s, open)); syncAllToggle(); }

  function make(tag, cls, attrs) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function renderSegments(parent, s) {
    const segs = Array.isArray(s.segments) && s.segments.length ? s.segments : [{ zh: s.zh }];
    const joined = segs.map((g) => g.zh || "").join("");
    if (joined !== s.zh) console.warn(`[SSAB] ${s.id}: segments ("${joined}") differ from zh ("${s.zh}")`);
    segs.forEach((g, i) => {
      if (!g.py && !g.gl) { parent.append(g.zh || ""); return; }
      const w = make("span", "w", { "data-k": String(i) });
      if (g.py) {
        const ruby = document.createElement("ruby");
        ruby.append(g.zh);
        const rt = make("rt", null, { lang: "zh-Latn-pinyin" });
        rt.textContent = g.py;
        ruby.append(rt);
        w.append(ruby);
      } else {
        w.append(g.zh);
      }
      parent.append(w);
    });
  }

  /* ---------------- Word card ---------------- */
  let cardEntry = null, cardWord = null;

  function openCard(entry, seg, wordNode) {
    closeCard(false);
    cardEntry = entry;
    entry.node.classList.add("is-selected");
    if (wordNode) { cardWord = wordNode; wordNode.classList.add("is-selected"); }
    el.cardZh.textContent = seg ? seg.zh : entry.data.zh;
    el.cardZh.classList.toggle("is-sentence", !seg);
    el.cardPy.textContent = seg && seg.py ? seg.py : "";
    el.cardGl.textContent = seg && seg.gl ? seg.gl : "";
    el.cardGl.hidden = !(seg && seg.gl);
    el.cardSent.textContent = entry.data.en || "";
    el.cardPlay.hidden = !entry.timed;
    el.card.hidden = false;
    syncCardSpace();
    keepInView(entry.node);
  }
  function closeCard(restoreFocus) {
    if (cardEntry) {
      cardEntry.node.classList.remove("is-selected");
      if (restoreFocus) cardEntry.node.focus({ preventScroll: true });
    }
    if (cardWord) cardWord.classList.remove("is-selected");
    cardEntry = cardWord = null;
    el.card.hidden = true;
    syncCardSpace();
  }
  function syncCardSpace() {
    document.documentElement.style.setProperty("--player-h", (el.player.hidden ? 0 : el.player.offsetHeight) + "px");
    document.documentElement.style.setProperty("--card-h", (el.card.hidden ? 0 : el.card.offsetHeight) + "px");
  }
  el.cardClose.addEventListener("click", () => closeCard(true));
  el.cardPlay.addEventListener("click", () => { if (cardEntry) playSentence(cardEntry); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el.card.hidden) closeCard(true); });
  window.addEventListener("resize", syncCardSpace);

  const fmtDate = (iso) => {
    const d = new Date(iso + "T12:00:00");
    return isNaN(d) ? iso : d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "long", day: "numeric" });
  };

  function renderEpisode(ep, hasTimedAudio) {
    const root = el.episode;
    root.textContent = "";
    root.setAttribute("aria-labelledby", "ep-title");

    const head = make("header", "ep-head");
    const meta = make("p", "ep-meta");
    const time = make("time", null, { datetime: ep.date });
    time.textContent = fmtDate(ep.date);
    meta.append(time);
    head.append(meta);

    if (ep.titleZh) {
      const zh = make("p", "ep-title-zh", { lang: "zh-Hans" });
      zh.textContent = ep.titleZh;
      head.append(zh);
    }
    const h1 = make("h1", "ep-title", { id: "ep-title" });
    h1.textContent = ep.title;
    head.append(h1);
    const desc = make("p", "ep-desc");
    desc.textContent = ep.description;
    head.append(desc);
    const hint = make("p", "hint");
    hint.textContent = "Tap a word for its pinyin, meaning and the sentence in English" +
      (hasTimedAudio ? ", and to play just that sentence." : ".");
    head.append(hint);
    root.append(head);

    const reader = make("section", "reader", { id: "reader", "aria-label": "Chinese text", tabindex: "-1" });
    sentences = [];
    let list = null;
    for (const p of ep.paragraphs || []) {
      const type = p.type || "para";
      let block;
      if (type === "heading") { block = make("h2", "sec", { lang: "zh-Hans" }); list = null; }
      else if (type === "item") {
        if (!list) { list = make("ul", "items", { lang: "zh-Hans" }); reader.append(list); }
        block = make("li", "para");
      } else { block = make("p", "para", { lang: "zh-Hans" }); list = null; }

      for (const s of p.sentences || []) {
        const node = make("span", "sent", { tabindex: "0", "data-sid": s.id });
        renderSegments(node, s);
        block.append(node);
        const tr = make("span", "tr", { lang: "en" });
        tr.textContent = s.en;
        tr.hidden = true;
        block.append(tr);

        const timed = hasTimedAudio && Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start;
        const entry = { data: s, node, tr, timed };
        sentences.push(entry);
        node.addEventListener("click", (e) => {
          const w = e.target.closest(".w");
          const seg = w ? (s.segments || [])[Number(w.dataset.k)] : null;
          openCard(entry, seg, w);
        });
        node.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCard(entry, null, null); }
        });
      }
      if (type === "item") list.append(block); else reader.append(block);
    }
    root.append(reader);

    if (Array.isArray(ep.vocab) && ep.vocab.length) {
      const sec = make("section", "vocab", { "aria-labelledby": "vocab-title" });
      const h = make("h2", "sec", { id: "vocab-title" });
      h.textContent = "Words to know";
      sec.append(h);
      const dl = make("dl");
      for (const v of ep.vocab) {
        const dt = make("dt");
        const zh = make("span", "v-zh", { lang: "zh-Hans" }); zh.textContent = v.zh;
        const py = make("span", "v-py", { lang: "zh-Latn-pinyin" }); py.textContent = v.py || "";
        dt.append(zh, " ", py);
        const dd = make("dd"); dd.textContent = v.en;
        dl.append(dt, dd);
      }
      sec.append(dl);
      root.append(sec);
    }

    const nav = make("nav", "ep-nav", { "aria-label": "More episodes" });
    nav.id = "ep-nav";
    root.append(nav);

    root.removeAttribute("aria-busy");
    document.title = `${ep.titleZh || ep.title} · SSAB Reader`;
    setAll(prefs.allTranslations);
  }

  function renderNav(list, id) {
    const nav = $("ep-nav");
    if (!nav) return;
    const i = list.findIndex((e) => e.id === id);
    const link = (ep, label, cls) => {
      const a = make("a", "nav-link " + cls, { href: `episode.html?ep=${encodeURIComponent(ep.id)}` });
      const small = make("span", "nav-label"); small.textContent = label;
      const t = make("span", "nav-title", { lang: "zh-Hans" }); t.textContent = ep.titleZh || ep.title;
      a.append(small, t);
      return a;
    };
    if (i > 0) nav.append(link(list[i - 1], "Newer episode", "newer"));
    if (i >= 0 && i < list.length - 1) nav.append(link(list[i + 1], "Older episode", "older"));
  }

  /* ---------------- Audio ---------------- */
  const audio = el.audio;
  let stopAt = null;   // end time when playing a single sentence
  let rafId = 0;
  let nowEntry = null;

  const fmtTime = (t) => {
    if (!Number.isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  function showUnavailable(detail) {
    el.player.hidden = false;
    el.controls.hidden = true;
    el.note.hidden = true;
    el.unavailable.hidden = false;
    el.unavailableDetail.textContent = detail;
    sentences.forEach((s) => { s.timed = false; });
    el.cardPlay.hidden = true;
    clearNow();
  }

  function setupAudio(ep, forceOff) {
    el.player.hidden = false;
    const src = ep.audio && ep.audio.src;
    if (forceOff || !src) {
      showUnavailable(" for this episode.");
      return false;
    }
    el.unavailable.hidden = true;
    el.controls.hidden = false;
    if (ep.audio.label) { el.note.textContent = ep.audio.label; el.note.hidden = false; }
    audio.src = src; // preload=auto buffers in the background so Play starts at once; never autoplay
    audio.playbackRate = Number(el.speed.value);
    return true;
  }

  function updateTime() {
    const t = audio.currentTime;
    el.timeCur.textContent = fmtTime(t);
    if (document.activeElement !== el.seek) el.seek.value = String(t);
    el.seek.setAttribute("aria-valuetext", `${fmtTime(t)} of ${fmtTime(audio.duration)}`);
    if (stopAt !== null && t >= stopAt) {
      audio.pause();
      stopAt = null;
    }
    highlight(t);
  }

  function clearNow() {
    if (nowEntry) nowEntry.node.classList.remove("is-now");
    nowEntry = null;
  }
  function highlight(t) {
    const hit = sentences.find((s) => s.timed && t >= s.data.start && t < s.data.end) || null;
    if (hit === nowEntry) return;
    clearNow();
    if (!hit) return;
    nowEntry = hit;
    hit.node.classList.add("is-now");
    if (!audio.paused) keepInView(hit.node);
  }
  function keepInView(node) {
    const r = node.getBoundingClientRect();
    const top = 72, bottom = window.innerHeight - el.player.offsetHeight - (el.card.hidden ? 0 : el.card.offsetHeight) - 16;
    if (r.top < top || r.bottom > bottom) {
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      node.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
    }
  }

  function tick() { updateTime(); rafId = requestAnimationFrame(tick); }

  function playSentence(s) {
    if (!s.timed) return;
    audio.currentTime = s.data.start;
    stopAt = s.data.end;
    audio.play().catch(() => {});
  }

  el.play.addEventListener("click", () => {
    if (audio.paused) { stopAt = null; audio.play().catch(() => {}); } else audio.pause();
  });
  el.seek.addEventListener("input", () => { stopAt = null; audio.currentTime = Number(el.seek.value); updateTime(); });
  el.speed.addEventListener("change", () => { audio.playbackRate = Number(el.speed.value); });

  audio.addEventListener("loadedmetadata", () => {
    el.seek.max = String(audio.duration || 0);
    el.timeDur.textContent = fmtTime(audio.duration);
    updateTime();
  });
  audio.addEventListener("play", () => {
    el.play.classList.add("playing"); el.play.setAttribute("aria-label", "Pause");
    if (audio.readyState < 3) el.play.classList.add("loading");
    cancelAnimationFrame(rafId); tick();
  });
  // spinner while the browser is still fetching audio, so a tap never looks ignored
  audio.addEventListener("waiting", () => { if (!audio.paused) el.play.classList.add("loading"); });
  audio.addEventListener("playing", () => el.play.classList.remove("loading"));
  audio.addEventListener("pause", () => {
    el.play.classList.remove("playing", "loading"); el.play.setAttribute("aria-label", "Play");
    cancelAnimationFrame(rafId); updateTime();
  });
  audio.addEventListener("ended", () => { stopAt = null; });
  audio.addEventListener("error", () => {
    el.play.classList.remove("loading");
    if (!audio.getAttribute("src")) return;
    showUnavailable(": the audio file could not be loaded.");
  });

  /* ---------------- Load content ---------------- */
  async function getJSON(url) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.json();
  }

  async function init() {
    const params = new URLSearchParams(location.search);
    try {
      const index = await getJSON(INDEX_URL).catch(() => ({ episodes: [] }));
      const list = index.episodes || [];
      const id = params.get("ep") || (list[0] && list[0].id);
      if (!id) throw new Error("No episodes in content/index.json");
      const ep = await getJSON(episodeUrl(id));
      // ?audio=off previews the no-audio state without editing the content file.
      const forceOff = params.get("audio") === "off";
      const hasTimedAudio = !forceOff && !!(ep.audio && ep.audio.src);
      renderEpisode(ep, hasTimedAudio);
      renderNav(list, ep.id);
      setupAudio(ep, forceOff);
      syncCardSpace();
      try {
        const seen = JSON.parse(localStorage.getItem(LAST_KEY) || "{}");
        seen[ep.id] = Date.now();
        localStorage.setItem(LAST_KEY, JSON.stringify(seen));
      } catch { /* storage unavailable */ }
    } catch (err) {
      el.episode.removeAttribute("aria-busy");
      el.episode.innerHTML =
        '<p class="status error"><strong>Could not load the episode.</strong><br>' +
        'Check the link, or go back to <a href="./">all episodes</a>.</p>';
      console.error("[SSAB]", err);
    }
  }
  init();
})();
