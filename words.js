(() => {
  "use strict";

  const Saved = window.SSABSaved;
  const listEl = document.getElementById("words");
  const countEl = document.getElementById("count");
  const download = document.getElementById("download");

  function make(tag, cls, text, attrs) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    return n;
  }

  function render() {
    const words = Saved.list().slice().reverse();
    listEl.textContent = "";
    countEl.textContent = words.length === 1 ? "1 word" : `${words.length} words`;
    download.disabled = words.length === 0;
    if (!words.length) {
      listEl.append(make("li", "status", "No saved words yet. Open an episode, tap a word, and press ★ Save word."));
      return;
    }
    for (const w of words) {
      const li = make("li", "word-item");
      const head = make("div", "word-head");
      head.append(make("span", "word-zh", w.zh, { lang: "zh-Hans" }));
      if (w.py) head.append(make("span", "word-py", w.py, { lang: "zh-Latn-pinyin" }));
      const rm = make("button", "icon-btn word-remove", null, { type: "button", "aria-label": `Remove ${w.zh}` });
      rm.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      rm.addEventListener("click", () => { Saved.remove(w.zh); render(); });
      head.append(rm);
      li.append(head);
      if (w.gl) li.append(make("p", "card-gl", w.gl));
      if (w.sent) li.append(make("p", "word-sent", w.sent, { lang: "zh-Hans" }));
      if (w.sentEn) li.append(make("p", "card-sent", w.sentEn, { lang: "en" }));
      if (w.ep) {
        const a = make("a", "word-ep", `${w.epDate || w.ep}${w.epTitle ? " · " + w.epTitle : ""}`, { href: `episode.html?ep=${encodeURIComponent(w.ep)}` });
        li.append(a);
      }
      listEl.append(li);
    }
  }

  download.addEventListener("click", () => {
    const blob = new Blob([Saved.csv(Saved.list())], { type: "text/csv;charset=utf-8" });
    const a = make("a", null, null, { href: URL.createObjectURL(blob), download: `SSAB saved words ${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  // another tab saving a word updates this page
  window.addEventListener("storage", (e) => { if (e.key === Saved.KEY) render(); });
  render();
})();
