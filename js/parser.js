// js/parser.js
// ------------------------------------------------------------
// ULTRA-SAFE BRISNET HORSE BLOCK PARSER
// No race header parsing, no PP table parsing.
// Only splits the PDF text into correct HORSE blocks.
// ------------------------------------------------------------

(function () {

  // Detect horse header:  <post> <name> (RUNSTYLE NUMBER)
  // RUNSTYLE = E, P, S, EP, E/P
  const HORSE_HEADER_RE =
    /(?:^|\n)\s*([1-9]|1[0-9]|20)\s+([A-Za-z][A-Za-z0-9'’\- ]+?)\s*\((E\/P|EP|E|P|S)\s*\d\)/g;

  // ------------------------------------------------------------
  // Split into horse blocks
  // ------------------------------------------------------------
  function splitHorseBlocks(text) {
    let match;
    const found = [];

    while ((match = HORSE_HEADER_RE.exec(text)) !== null) {
      const post = Number(match[1]);
      const idx = match.index + (match[0].startsWith("\n") ? 1 : 0);

      found.push({ post, idx });
    }

    if (found.length === 0) return [];

    const blocks = [];
    for (let i = 0; i < found.length; i++) {
      const start = found[i].idx;
      const end = (i + 1 < found.length) ? found[i + 1].idx : text.length;

      blocks.push({
        post: found[i].post,
        raw: text.slice(start, end).trim()
      });
    }

    return blocks;
  }

  // ------------------------------------------------------------
  // MAIN: return horse blocks only
  // ------------------------------------------------------------
  function parsePPTable(text) {
    if (!text) return [];

    // Normalize NBSP (Brisnet PDFs always include these)
    text = text.replace(/\u00A0/g, " ");

    const horses = splitHorseBlocks(text);

    // Only return horse blocks — no PP tables or row parsing yet
    return horses;
  }

  // Export
  if (typeof window !== "undefined") {
    window.parsePPTable = parsePPTable;
  }
  if (typeof module !== "undefined") {
    module.exports = { parsePPTable };
  }

})();
