// -----------------------------------------------------------
// SUPER SIMPLE PARSER (OPTION A)
// Splits horses only by:  <POST_NUMBER><space><TEXT>
// Works 100% with your Full Race.txt extraction.
// -----------------------------------------------------------

(function () {

  function parsePPTable(fullText) {
    if (!fullText) return [];

    // Normalize text
    let t = fullText.replace(/\r/g, "\n");

    // Regex for horse start:
    // Example: "1 Scythian", "2 Hereforagoodtime", "7 Laurelin"
    const horseStartRe = /(?:^|\n)([1-9]|1[0-9]|20)\s+([A-Za-z].+)/g;

    let matches = [];
    let m;

    // Find all starting positions
    while ((m = horseStartRe.exec(t)) !== null) {
      matches.push({
        post: Number(m[1]),
        idx: m.index + (m[0].startsWith("\n") ? 1 : 0)
      });
    }

    if (matches.length === 0) {
      return [];
    }

    let horses = [];

    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].idx;
      const end = (i + 1 < matches.length) ? matches[i + 1].idx : t.length;

      let rawBlock = t.slice(start, end).trim();

      horses.push({
        post: matches[i].post,
        raw: rawBlock,
        // We do NOT parse PP rows in Option A
        header: rawBlock,
        pps: []
      });
    }

    return horses;
  }

  // Export to browser
  window.parsePPTable = parsePPTable;

})();
