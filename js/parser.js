// js/parser.js
// -----------------------------------------------------------
// Brisnet Past Performance Parser (Bottom Section Only)
// Uses unbroken date+track token as the anchor
// Extracts: date, track, dist, racetype, pp, st, 1c, 2c, str, fin,
// jockey, odds, topFinishers, comment, fld
// -----------------------------------------------------------

function parsePPTable(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  // ORIGINAL ANCHOR: detects "09Oct25Baq1" or "30Aug24Sar"
  const startTokenRe = /^(\d{2}[A-Za-z]{3}\d{2})([A-Za-z]{3})(\d{1,2})?/;

  const results = [];

  for (let rawLine of lines) {
    // skip header lines
    if (/^DATE\s+TRK/i.test(rawLine) || /^-+$/.test(rawLine)) continue;

    // detect DATE+TRACK at start
    const startMatch = rawLine.match(startTokenRe);
    if (!startMatch) continue;

    const tokenEnd = startMatch[0].length;
    const date = startMatch[1];
    const track = startMatch[2];
    const gluedNumber = startMatch[3] || null;

    let rest = rawLine.slice(tokenEnd).trim();

    // DIST
    const distMatch = rest.match(/^(\d+[^\s]*)\s*/);
    const dist = distMatch ? distMatch[1] : null;
    if (distMatch) rest = rest.slice(distMatch[0].length);

    // RACETYPE (text) until we hit the Post Position (first standalone 1–20 number)
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

    // ST, 1C, 2C, STR, FIN
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
      rest = rest.slice((jk || '').length).trim();
    }

    // FLD (field size)
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
        comment      = rest.slice(commentIdx).trim();
      } else {
        const parts = rest.split(/[-–—]/).map(s => s.trim()).filter(s => s.length);
        if (parts.length >= 3) {
          topFinishers = parts.slice(0,3).join('–');
          comment = rest.replace(topFinishers, '').trim();
        } else {
          topFinishers = rest.trim();
          comment = '';
        }
      }
    }

    results.push({
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

// browser export
if (typeof window !== "undefined") {
  window.parsePPTable = parsePPTable;
}
// node export
if (typeof module !== "undefined") {
  module.exports = { parsePPTable };
}
