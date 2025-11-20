// js/parser.js
// Simple Brisnet horse-block splitter (post-position anchor)
// NOW ALSO removes everything before the first true horse (post + name + "(")

(function () {
  'use strict';

  function safeTrim(s) {
    return (s || '')
      .replace(/\u00A0/g, ' ')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Detect horse anchors:
  // <post> <name> (
  const HORSE_ANCHOR_RE = /(?:^|\n)\s*([1-9]|1[0-9]|20)\s+([^\(\n]{1,120}?)\s*\(/g;

  function findAnchors(text) {
    const anchors = [];
    let m;
    while ((m = HORSE_ANCHOR_RE.exec(text)) !== null) {
      const idx = m.index + (text[m.index] === '\n' ? 1 : 0);
      anchors.push({
        idx,
        pp: Number(m[1]),
        name: safeTrim(m[2])
      });
    }
    return anchors;
  }

  // Cut off the entire race header BEFORE the first horse
  function stripRaceHeader(fullText) {
    const anchors = findAnchors(fullText);
    if (!anchors.length) return fullText; // no horses found

    const firstIdx = anchors[0].idx;
    return fullText.slice(firstIdx); // everything before first horse gone
  }

  function splitBlocks(text) {
    const anchors = findAnchors(text);
    const blocks = [];

    if (!anchors.length) {
      return [{ horsePP: null, name: null, raw: safeTrim(text), header: null }];
    }

    for (let i = 0; i < anchors.length; i++) {
      const start = anchors[i].idx;
      const end = (i + 1 < anchors.length) ? anchors[i + 1].idx : text.length;
      const raw = safeTrim(text.slice(start, end));

      blocks.push({
        horsePP: anchors[i].pp,
        name: anchors[i].name,
        raw,
        header: null   // header no longer used — we stripped it out
      });
    }

    return blocks;
  }

  function parsePPTable(text) {
    if (!text || !text.length) return [];

    let normalized = text.replace(/\u00A0/g, ' ').replace(/\r/g, '\n');

    // 🔥 REMOVE RACE HEADER FIRST
    normalized = stripRaceHeader(normalized);

    // Split into horse blocks
    return splitBlocks(normalized);
  }

  if (typeof window !== 'undefined') {
    window.parsePPTable = parsePPTable;
  }
  if (typeof module !== 'undefined') {
    module.exports = { parsePPTable };
  }
})();
