// js/parser.js
// SIMPLE Brisnet horse-block splitter using only:
// POST#  +  name  + "("
// with race header removed.

(function () {
  'use strict';

  function safeTrim(s) {
    return (s || '')
      .replace(/\u00A0/g, ' ')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  // SIMPLE anchor:
  // <post>  <anything>  "("
  const HORSE_ANCHOR_RE = /(?:^|\n)\s*([1-9]|1[0-9]|20)\s+(.{1,80}?)\s*\(/g;

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

  // Remove race header by cutting everything before first horse
  function stripRaceHeader(fullText) {
    const anchors = findAnchors(fullText);
    if (!anchors.length) return fullText;
    return fullText.slice(anchors[0].idx);
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
        raw: raw,
        header: null
      });
    }

    return blocks;
  }

  function parsePPTable(text) {
    if (!text) return [];

    // Normalize minimal stuff
    let t = text.replace(/\u00A0/g, ' ')
                .replace(/\r/g, '\n');

    // Remove header
    t = stripRaceHeader(t);

    // Split into horses
    return splitBlocks(t);
  }

  if (typeof window !== 'undefined') {
    window.parsePPTable = parsePPTable;
  }

})();
