// js/parser.js
// -----------------------------------------------------------
// Brisnet Past Performance Parser — Using POST POSITION as anchor
// -----------------------------------------------------------

function parsePPTable(rawText) {

  // -------------------------------------------------------
  // 1. PRE-FORMAT THE TEXT TO CREATE REAL LINES
  // -------------------------------------------------------
  // Insert newline before any " PP HorseName"
  // Example: " 1 Scythian" → "\n1 Scythian"
  rawText = rawText.replace(/(\s)([1-9]|1[0-9]|20)(\s+[A-Z])/g, "\n$2$3");

  // Convert into lines
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // -------------------------------------------------------
  // 2. POST POSITION TOKEN (1–20)
  // -------------------------------------------------------
  const ppTokenRe = /^([1-9]|1[0-9]|20)\b/;

  const results = [];

  // -------------------------------------------------------
  // 3. PROCESS EACH LINE: FIND A NEW HORSE & PARSE PAST PERFS
  // -------------------------------------------------------
  for (let rawLine of lines) {

    // Skip DATE/TRK headers or separators
    if (/^DATE\s+TRK/i.test(rawLine) || /^-+$/.test(rawLine)) continue;

    // Must start with a post position
    const m = rawLine.match(ppTokenRe);
    if (!m) continue;

    const postPosition = m[1];
    let rest = rawLine.slice(m[0].length).trim();

    // ---------------------------------------------------
    // NOTE: At this point, "rest" starts with:
    //   HorseName (RunningStyle #) Owners: ...
    //   Jockey: ...
    //   Then the past performances further below
    //
    // But since text extraction merges all lines, the 
    // PP rows (DATE, TRK, DIST, TYPE, PP, ST, 1C...) 
    // ALSO appear in the text. We catch ONLY those.
    // ---------------------------------------------------

    // A single PP row begins with a date like 09Oct25
    const dateTrackRe = /^(\d{2}[A-Za-z]{3}\d{2})\s*([A-Za-z]{3})/;
    if (!dateTrackRe.test(rest)) {
      continue; // Not a PP-line, skip
    }

    // Extract date + track
    const dt = rest.match(dateTrackRe);
    const date = dt[1];
    const track = dt[2];
    rest = rest.slice(dt[0].length).trim();

    // DISTANCE (unicode fractions included)
    const distMatch = rest.match(/^(\d+[^\s]*)\s*/);
    const dist = distMatch ? distMatch[1] : null;
    if (distMatch) rest = rest.slice(distMatch[0].length);

    // RACETYPE until PP (1–20)
    const nextNum = rest.match(/\b(\d{1,2})\b/);
    let racetype = null;
    let innerPP = null;

    if (nextNum) {
      const idx = nextNum.index;
      racetype = rest.slice(0, idx).trim() || null;
      innerPP = nextNum[1];
      rest = rest.slice(idx + nextNum[0].length).trim();
    }

    // ST, 1C, 2C, STR, FIN
    const calls = [];
    while (calls.length < 5) {
      const c = rest.match(/^\s*(\d{1,2}[^\s]*)\s*/);
      if (!c) break;
      calls.push(c[1]);
      rest = rest.slice(c[0].length);
    }

    const st  = calls[0] || null;
    const c1  = calls[1] || null;
    const c2  = calls[2] || null;
    const str = calls[3] || null;
    const fin = calls[4] || null;

    // JOCKEY + ODDS
    const oddsMatch = rest.match(/(\*?\d+\.\d+)\b/);
    let jockey = null;
    let odds = null;

    if (oddsMatch) {
      odds = oddsMatch[1];
      const beforeOdds = rest.slice(0, oddsMatch.index).trim();
      jockey = beforeOdds.split(/\s+/).slice(-1)[0] || null;
      rest = rest.slice(oddsMatch.index + oddsMatch[0].length).trim();
    }

    // FLD (field size)
    const fldMatch = rest.match(/(\d{1,2})\s*$/);
    const fld = fldMatch ? fldMatch[1] : null;

    // TOP FINISHERS + COMMENT
    let topFinishers = null;
    let comment = null;

    const sep = rest.match(/(.+?)\s{2,}(.+)$/);
    if (sep) {
      topFinishers = sep[1].trim();
      comment = sep[2].trim();
    } else {
      const idx = rest.search(/(Ins;|Chck|Stumble|bpd|bpm|;)/i);
      if (idx >= 0) {
        topFinishers = rest.slice(0, idx).trim();
        comment = rest.slice(idx).trim();
      } else {
        topFinishers = rest.trim();
        comment = "";
      }
    }

    // -------------------------------------------------------
    // SAVE RESULT
    // -------------------------------------------------------
    results.push({
      pp: postPosition,
      date,
      track,
      dist,
      racetype,
      innerPP,
      st,
      c1,
      c2,
      str,
      fin,
      jockey,
      odds,
      topFinishers,
      comment,
      fld
    });
  }

  return results;
}

// Export for browser
if (typeof window !== "undefined") {
  window.parsePPTable = parsePPTable;
}
