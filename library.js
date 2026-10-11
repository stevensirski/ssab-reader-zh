(() => {
  "use strict";

  const list = document.getElementById("ep-list");
  const LAST_KEY = "ssab-reader:last-opened";

  const fmtDate = (iso) => {
    const d = new Date(iso + "T12:00:00");
    return isNaN(d) ? iso : d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  };
  const fmtDur = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "");

  function make(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function opened() {
    try { return JSON.parse(localStorage.getItem(LAST_KEY) || "{}"); } catch { return {}; }
  }

  async function init() {
    try {
      const res = await fetch("content/index.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { episodes = [] } = await res.json();
      list.textContent = "";
      if (!episodes.length) list.append(make("li", "status", "No episodes yet."));
      const seen = opened();
      episodes.forEach((ep, i) => {
        const li = make("li", "ep-item");
        const a = make("a", "ep-link");
        a.href = `episode.html?ep=${encodeURIComponent(ep.id)}`;

        const meta = make("p", "ep-meta");
        if (i === 0) meta.append(make("span", "badge", "Latest"));
        const time = make("time", null, fmtDate(ep.date));
        time.dateTime = ep.date;
        meta.append(time);
        if (ep.duration) meta.append(make("span", null, `${fmtDur(ep.duration)} audio`));
        if (ep.chars) meta.append(make("span", null, `${ep.chars.toLocaleString()} characters`));
        if (seen[ep.id]) meta.append(make("span", "seen", "Opened"));
        a.append(meta);

        if (ep.titleZh) {
          const zh = make("span", "ep-title-zh", ep.titleZh);
          zh.lang = "zh-Hans";
          a.append(zh);
        }
        a.append(make("span", "ep-title", ep.title));
        if (ep.description) a.append(make("span", "ep-desc", ep.description));
        li.append(a);
        list.append(li);
      });
    } catch (err) {
      list.innerHTML = '<li class="status error"><strong>Could not load the episode list.</strong><br>' +
        "Serve this folder over HTTP (for example <code>python3 -m http.server</code>) and check <code>content/index.json</code>.</li>";
      console.error("[SSAB]", err);
    }
    list.removeAttribute("aria-busy");
  }
  init();
})();
