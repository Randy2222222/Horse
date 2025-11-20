// js/parser.js
// -----------------------------------------------------------
// Clean, stable Brisnet PP parser
// Core anchor: post-position line (1–20 followed by horse name)
// -----------------------------------------------------------

(function () {

  // Remove weird space characters and normalize
  function cleanSpaces(s) {
    return s
      .replace(/\u00A0/g, " ")            // non-breaking space
      .replace(/[\u2000-\u200B]/g, " ")   // wide/special spaces
      .replace(/\t/g, " ")
      .replace(/\r/g, "\n");
  }

  // -----------------------------------------------------------
  // 1) Find horse anchors (post position + horse name)
  // -----------------------------------------------------------
  function findPostPositionAnchors(text) {

    const anchors = [];
    const cleaned = cleanSpaces(text);

    // Matches:
    //   1 Scythian (P 5)
    //   \n1 Laurelin (S 3)
    //   5   Fionn
    //   " 7 Hereforagoodtime"
    //
    const re = /(?:^|\n| )([1-9]|1[0-9]|20)\s+(?=[A-Za-z(])/g;

    let m;
    while ((m = re.exec(cleaned)) !== null) {
      let idx = m.index;

      // If match starts with a newline, skip that newline
      if (cleaned[idx] === "\n") idx++;

      anchors.push({
        idx,
        pp: Number(m[1])
      });
    }

    return anchors;
  }

  // -----------------------------------------------------------
  // 2) Split text into per-horse blocks
  // -----------------------------------------------------------
  function splitHorseBlocks(text) {
    const anchors = findPostPositionAnchors(text);
    if (!anchors.length) return [];

    const blocks = [];

    for (let i = 0; i < anchors.length; i++) {
      const start = anchors[i].idx;
      const end = (i + 1 < anchors.length) ? anchors[i + 1].idx : text.length;
      const raw = text.slice(start, end).trim();

      blocks.push({
        horsePP: anchors[i].pp,
        raw
      });
    }

    return blocks;
  }

  // -----------------------------------------------------------
  // 3) Find PP rows inside a horse block
  // -----------------------------------------------------------
  function findPPRows(blockText) {
    const t = cleanSpaces(blockText);

    // Date token like: 09Oct25
    const dateRe = /(\d{2}[A-Za-z]{3}\d{2})/g;

    const indices = [];
    let m;
    while ((m = dateRe.exec(t)) !== null) indices.push(m.index);

    const rows = [];
    for (let i = 0; i < indices.length; i++) {
      const start = indices[i];
      const end = (i + 1 < indices.length) ? indices[i + 1] : t.length;
      let row = t.slice(start, end).trim();

      // squash newlines
      row = row.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();

      rows.push(row);
    }

    return rows;
  }

  // -----------------------------------------------------------
  // 4) Very light parse of each PP row
  // -----------------------------------------------------------
  function parsePPRow(row) {
    // DO NOT get fancy — we only need speed, calls, etc later
    const s = row;

    const out = { raw: s };

    // Date
    const date = s.match(/^(\d{2}[A-Za-z]{3}\d{2})/);
    if (date) out.date = date[1];

    // Track
    const trk = s.match(/^\d{2}[A-Za-z]{3}\d{2}\s+([A-Za-z]{3})/);
    if (trk) out.trk = trk[1];

    return out;
  }

  // -----------------------------------------------------------
  // 5) Main parser
  // -----------------------------------------------------------
  function parsePPTable(fullText) {

    if (!fullText || !fullText.length) return [];

    const text = cleanSpaces(fullText);

    // 1. Split into horses
    const horses = splitHorseBlocks(text);

    const result = [];

    for (const h of horses) {

      const horse = {
        horsePP: h.horsePP,
        raw: h.raw
      };

      // Try to find PP table area ("DATE TRK")
      const idx = h.raw.search(/DATE\s+TRK/i);
      if (idx >= 0) {
        horse.headerRaw = h.raw.slice(0, idx).trim();
        horse.ppTableRaw = h.raw.slice(idx).trim();
      } else {
        // fallback: find first date
        const idx2 = h.raw.search(/\d{2}[A-Za-z]{3}\d{2}/);
        if (idx2 >= 0) {
          horse.headerRaw = h.raw.slice(0, idx2).trim();
          horse.ppTableRaw = h.raw.slice(idx2).trim();
        } else {
          horse.headerRaw = h.raw;
          horse.ppTableRaw = "";
        }
      }

      // Parse PP rows
      const rows = findPPRows(horse.ppTableRaw);
      horse.pps = rows.map(r => parsePPRow(r));

      result.push(horse);
    }

    return result;
  }

  // -----------------------------------------------------------
  // Export
  // -----------------------------------------------------------
  if (typeof window !== "undefined") {
    window.parsePPTable = parsePPTable;
  }
  if (typeof module !== "undefined") {
    module.exports = { parsePPTable };
  }

})();
