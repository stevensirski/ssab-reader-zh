// Saved words: kept in this browser only (localStorage). Used by app.js (the ★ Save button) and words.js (My words).
window.SSABSaved = (() => {
  "use strict";

  const KEY = "ssab-reader:saved-words:v1";

  function list() {
    try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  function write(words) {
    try { localStorage.setItem(KEY, JSON.stringify(words)); return true; } catch { return false; }
  }
  const has = (zh) => list().some((w) => w.zh === zh);

  // word: { zh, py, gl, sent, sentEn, ep, epDate, epTitle }; the first sentence a word was saved from is kept
  function add(word) {
    const words = list();
    if (words.some((w) => w.zh === word.zh)) return true;
    words.push(Object.assign({}, word, { saved: new Date().toISOString().slice(0, 10) }));
    return write(words);
  }
  function remove(zh) { return write(list().filter((w) => w.zh !== zh)); }

  function csv(words) {
    const cell = (v) => {
      const s = String(v == null ? "" : v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [["Word", "Pinyin", "Meaning", "Sentence", "Sentence (English)", "Episode", "Saved on"]];
    for (const w of words) rows.push([w.zh, w.py, w.gl, w.sent, w.sentEn, w.epDate || w.ep, w.saved]);
    // the byte-order mark makes Excel read the Chinese correctly; Google Sheets ignores it
    return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
  }

  return { KEY, list, has, add, remove, csv };
})();
