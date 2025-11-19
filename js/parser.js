// js/parser.js
// -----------------------------------------------------------
// Brisnet Past Performance Parser (Bottom Section Only)
// Uses unbroken date+track token as the anchor
// Extracts: date, track, dist, racetype, pp, st, 1c, 2c, str, fin,
// jockey, odds, topFinishers, comment, fld
// -----------------------------------------------------------

function parsePPTable(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  // Detects start token like "09Oct25Baq1"
  const startTokenRe = /^([1-9]|1[0-9]|20)\b/;

  const results = [];

  for (let rawLine of lines) {
    // skip header
    if (/^DATE\s+TRK/i.test(rawLine) || /^-+$/.test(rawLine)) continue;

    const startMatch = rawLine.match(startTokenRe);
    if (!startMatch) continue;

    const tokenEnd = startMatch[0].length;
    const date = startMatch[1];
    const track = startMatch[2];
    const gluedNumber = startMatch[3] || null; // rare, but valid

    let rest = rawLine.slice(tokenEnd).trim();

    // DIST field (contains unicode fractions sometimes)
    const distMatch = rest.match(/^(\d+[^\s]*)\s*/);
    const dist = distMatch ? distMatch[1] : null;
    if (distMatch) rest = rest.slice(distMatch[0].length);

    // RACETYPE until PP (first standalone number)
    const nextNumMatch = rest.match(/\b(\d{1,2})\b/);
    let racetype = null;
    let pp = null;

    if (nextNumMatch) {
      const idx = nextNumMatch.index;
      racetype = rest.slice(0, idx).trim() || null;
      pp = nextNumMatch[1];
      rest = rest.slice(idx + nextNumMatch[0].length).trim();
    } else {
      // fallback
      const fw = rest.split(/\s+/)[0];
      racetype = fw;
      rest = rest.slice(fw.length).trim();
    }

    // ST, 1C, 2C, STR, FIN (5 call fields)
    const calls = [];
    while (calls.length < 5 && rest.length) {
      const m = rest.match(/^\s*(\d{1,2}[^\s]*)\s*/);
      if (!m) break;
      calls.push(m[1]);
      rest = rest.slice(m[0].length);
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
      jockey = beforeOdds.split(/\s+/).slice(-1)[0] || beforeOdds || null;
      rest = rest.slice(oddsMatch.index + oddsMatch[0].length).trim();
    } else {
      const jk = rest.split(/\s+/)[0];
      jockey = jk || null;
      rest = rest.slice((jk||'').length).trim();
    }

    // FLD (field size, final number)
    const fldMatch = rest.match(/(\d{1,2})\s*$/);
    let fld = null;
    if (fldMatch) {
      fld = fldMatch[1];
      rest = rest.slice(0, fldMatch.index).trim();
    }

    // TOP FINISHERS + COMMENT
    let topFinishers = null;
    let comment = null;

    const sepMatch = rest.match(/(.+?)\s{2,}(.+)$/);
    if (sepMatch) {
      topFinishers = sepMatch[1].trim();
      comment = sepMatch[2].trim();
    } else {
      const commentIdx = rest.search(/(Ins;|Chck|Stumble|bpd|bpm|;)/i);
      if (commentIdx >= 0) {
        topFinishers = rest.slice(0, commentIdx).trim();
        comment     = rest.slice(commentIdx).trim();
      } else {
        const parts = rest.split(/[-–—]/).map(s => s.trim()).filter(s => s.length);
        if (parts.length >= 3) {
          topFinishers = parts.slice(0,3).join('–');
          comment      = rest.replace(topFinishers, '').trim();
        } else {
          topFinishers = rest.trim();
          comment = '';
        }
      }
    }

    // Save parsed row
results.push({
      horsePP: ppStart,
      date,
      track,
      gluedNumber,
      dist,
      racetype,
      pp,
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

// OPTIONAL export for module use
if (typeof window !== "undefined") {
  window.parsePPTable = parsePPTable;
}
if (typeof module !== "undefined") {
  module.exports = { parsePPTable };
}
