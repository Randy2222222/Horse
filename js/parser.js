// js/parser.js
// Simple Brisnet horse-block splitter (post-position anchor)
// Drops in as a single-module file. Good for testing / debugging.
// Returns: [{ horsePP: 1, name: "Scythian", raw: "<raw block text>", header: "<top header (if any)>" }, ...]
// Exports window.parsePPTable for compatibility with your pdfReader.js
(function () {
  'use strict';

  // Normalize & safe trim
  function safeTrim(s) {
    return (s || '').replace(/\u00A0/g, ' ').replace(/\r/g, '\n').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Find anchors like:
  // 1 Scythian (P 5)
  // 12 SomeHorse (E/P 4)
  // Anchor pattern: (start of string or newline) + postNumber + whitespace + horseName + whitespace + "("
  function findAnchors(text) {
    const anchors = [];
    const re = /(?:^|\n)\s*([1-9]|1[0-9]|20)\s+([^\(\n]{1,120}?)\s*\(/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      // m.index points to either newline or start; push the index of the match (start of anchor)
      anchors.push({
        idx: m.index + (text[m.index] === '\n' ? 1 : 0),
        pp: Number(m[1]),
        name: safeTrim(m[2])
      });
    }
    return anchors;
  }

  // Split into blocks using anchors
  function splitBlocks(text) {
    const anchors = findAnchors(text);
    const blocks = [];

    if (!anchors.length) {
      // No anchors — return entire text as a single unaffiliated block
      return [{ horsePP: null, name: null, raw: safeTrim(text), header: null }];
    }

    // Determine header (text before first anchor)
    const firstAnchor = anchors[0];
    const headerRaw = safeTrim(text.slice(0, firstAnchor.idx));

    for (let i = 0; i < anchors.length; i++) {
      const start = anchors[i].idx;
      const end = (i + 1 < anchors.length) ? anchors[i + 1].idx : text.length;
      const raw = safeTrim(text.slice(start, end));

      blocks.push({
        horsePP: anchors[i].pp,
        name: anchors[i].name,
        raw: raw,
        header: (i === 0 ? headerRaw || null : null) // only first block gets header (if present)
      });
    }

    return blocks;
  }

  // Public entry (keeps original name used in your pdfReader)
  function parsePPTable(text) {
    if (!text || !text.length) return [];
    // normalize whitespace/newlines for robust matching
    const normalized = text.replace(/\u00A0/g, ' ').replace(/\r/g, '\n');
    const blocks = splitBlocks(normalized);
    return blocks;
  }

  // Export
  if (typeof window !== 'undefined') {
    window.parsePPTable = parsePPTable;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parsePPTable };
  }
})();
