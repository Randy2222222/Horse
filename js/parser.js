// js/parser.js
// Clean and simple: split horses using "<pp> <name> (" pattern

(function () {
  'use strict';

  // Main horse anchor:
  //  - post position = 1–20
  //  - 1–3 spaces
  //  - horse name (letters, spaces, / and ’ allowed)
  //  - "(" immediately after name block
  const HORSE_RE = /(?:^|\n)([1-9]|1[0-9]|20)\s{1,3}([A-Za-z0-9\/'’.\-\s]+?)\s*\(/g;

  function parsePPTable(text) {
    if (!text) return [];

    // Ensure consistent newlines
    let t = text.replace(/\r/g, "\n");

    // Find all horses
    let horses = [];
    let match;

    while ((match = HORSE_RE.exec(t)) !== null) {
      horses.push({
        idx: match.index,
        name: match[2].trim()
        neme: string(match[2])
      });
    }

    if (!horses.length) {
      console.warn("NO HORSE ANCHORS FOUND");
      return [];
    }

    // Now cut blocks
    let blocks = [];

    for (let i = 0; i < horses.length; i++) {
      const start = horses[i].idx;
      const end = (i + 1 < horses.length) ? horses[i + 1].idx : t.length;
      const slice = t.slice(start, end).trim();

      blocks.push({
        post: horses[i].post,
        name: horses[i].name,
        raw: slice
      });
    }

    return blocks;
  }

  // Export
  window.parsePPTable = parsePPTable;

})();
