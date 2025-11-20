// js/parser.js
// -----------------------------------------------------------
// Brisnet Past Performance Parser (bottom section + overall horse blocks)
// Anchor: Post Position token (1..20) - used to split horse blocks
// Returns: array of { horsePP: <int>, block: "<raw text>", header: {...}, pps: [ {...} ] }
// Each PP row contains best-effort parsed fields used for calculations (dist, pp, 1c, 2c, str, fin, fld, jockey, odds)
// -----------------------------------------------------------

(function () {
  function safeTrim(s) { return (s||"").replace(/\u00A0/g," ").replace(/\s+/g," ").trim(); }

  // Helper: find post-position anchors (looks for newline or start-of-text + number + whitespace + next text)
  function findPostPositionAnchors(text) {
    const anchors = [];
    const re = /(?:^|\n)\s*([1-9]|1[0-9]|20)\b/g; // 1-20 as a whole token
    let m;
    while ((m = re.exec(text)) !== null) {
      anchors.push({ idx: m.index + (m[0].startsWith("\n")?1:0), pp: Number(m[1]) });
      // note: index points to the newline char start; we'll slice from m.index
    }
    return anchors;
  }

  // Helper: split into horse blocks by anchor indices
  function splitHorseBlocks(text) {
    const anchors = findPostPositionAnchors(text);
    if (!anchors.length) return [];
    const blocks = [];
    for (let i=0;i<anchors.length;i++) {
      const start = anchors[i].idx;
      const end = (i+1 < anchors.length) ? anchors[i+1].idx : text.length;
      const raw = text.slice(start, end).trim();
      blocks.push({ horsePP: anchors[i].pp, raw });
    }
    return blocks;
  }

  // Helper: find PP table rows within a horse block
  // Date token pattern example: 09Oct25Baq (we'll detect "DDMonYYTRK" fused token OR "DDMonYY TRK")
  function findPPRows(blockText) {
    const rows = [];
    // Normalize newlines: ensure some row separation
    const t = blockText.replace(/\r/g, "\n");
    // Try to find DATE header and then subsequent lines that look like rows.
    // We'll search for occurrences of a date token like "09Oct25" (2 digits + 3 letters + 2 digits).
    const dateRe = /(\d{2}[A-Za-z]{3}\d{2})/g;
    let m;
    const indices = [];
    while ((m = dateRe.exec(t)) !== null) {
      indices.push(m.index);
    }
    // Build rows by slicing between date matches; fallback: split by newline groups that contain a date
    if (indices.length >= 1) {
      for (let i=0;i<indices.length;i++) {
        const start = indices[i];
        const end = (i+1<indices.length) ? indices[i+1] : t.length;
        let row = t.slice(start, end).trim();
        // Collapse newlines in row to a single space to simplify regex parsing
        row = row.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
        rows.push(row);
      }
    } else {
      // fallback: look for the header "DATE TRK" then take subsequent lines separated by double spaces/newline
      const headerIdx = t.search(/DATE\s+TRK/i);
      if (headerIdx >= 0) {
        const after = t.slice(headerIdx + 1);
        // split by lines that look like "DDMon" etc
        const candidateLines = after.split(/\n+/).map(l => l.trim()).filter(Boolean);
        for (const ln of candidateLines) {
          if (/\d{2}[A-Za-z]{3}\d{2}/.test(ln)) rows.push(ln.replace(/\s+/g, " "));
        }
      }
    }
    return rows;
  }

  // Heuristic parse of a single PP row string -> object
  function parsePPRow(row) {
    // collapse repeated spaces & NBSP
    const s = safeTrim(row);
    // Expected pieces: DATE TRK DIST [maybe surface] [maybe leader calls like :24 :48] RACETYPE ... then a run of numbers (calls) then jockey odds topFinishers comment fld
    // We will attempt stepwise extraction.

    const out = { raw: s, date:null, trk:null, dist:null, surface:null, racetype:null, pp:null, st:null, call1:null, call2:null, str:null, fin:null, jockey:null, odds:null, topFinishers:null, comment:null, fld:null };

    // 1) Extract date token at start if present
    let cursor = 0;
    const dateMatch = s.slice(cursor).match(/^(\d{2}[A-Za-z]{3}\d{2})/);
    if (dateMatch) {
      out.date = dateMatch[1];
      cursor += dateMatch[0].length;
    }

    // 2) After date, try to extract track token (3 letters usually)
    const restAfterDate = s.slice(cursor).trim();
    const trkMatch = restAfterDate.match(/^([A-Za-z]{3})\b/);
    if (trkMatch) {
      out.trk = trkMatch[1];
      cursor = s.indexOf(trkMatch[0], cursor) + trkMatch[0].length;
    } else {
      // sometimes fused: like 09Oct25Baq -> date+trk glued
      const glued = s.slice(0,15).match(/^(\d{2}[A-Za-z]{3}\d{2})([A-Za-z]{3})/);
      if (glued) {
        out.date = glued[1];
        out.trk = glued[2];
        cursor = s.indexOf(glued[0]) + glued[0].length;
      }
    }

    let rest = s.slice(cursor).trim();

    // 3) DIST (may contain unicode fraction symbol or characters like 1ˆ or 1m or 6f etc)
    const distMatch = rest.match(/^((?:\d+[^\s]*)\b)\s*/);
    if (distMatch) {
      out.dist = distMatch[1];
      rest = rest.slice(distMatch[0].length).trim();
    }

    // 4) Surface token if present (fm, ft, gd, sf, etc)
    const surfMatch = rest.match(/^(fm|ft|gd|sf|yl|my|yl)\b/i);
    if (surfMatch) {
      out.surface = surfMatch[1];
      rest = rest.slice(surfMatch[0].length).trim();
    }

    // 5) There may be leader call times like ":24 :48 1:12" — remove them temporarily if present (they are not used in final fields now)
    // We'll strip sequences that look like time calls (colon + digits and possibly fraction markers)
    rest = rest.replace(/:(\d{1,2})(?:[^\s\d]|[^\s\d]\d)?/g, ""); // crude removal of :24 :48 etc
    rest = rest.replace(/\d:\d{2}/g, ""); // remove minute:seconds

    rest = safeTrim(rest);

    // 6) Extract racetype: text up to the FIRST standalone number (which is PP column)
    const firstStandaloneNum = rest.match(/\b(\d{1,2})\b/);
    if (firstStandaloneNum) {
      const idx = firstStandaloneNum.index;
      out.racetype = safeTrim(rest.slice(0, idx));
      out.pp = firstStandaloneNum[1];
      rest = rest.slice(idx + firstStandaloneNum[0].length).trim();
    } else {
      // fallback: try to detect racetype up to next known pattern
      const parts = rest.split(/\s{2,}/);
      out.racetype = parts[0] || null;
      rest = parts.slice(1).join(" ").trim();
    }

    // 7) Now parse the sequence of call-like tokens (ST, 1C, 2C, STR, FIN). They often look like numbers possibly with special characters.
    const calls = [];
    // A call token may be like "3¨", "10ƒ", "2", "1©" etc.
    while (calls.length < 5 && rest.length) {
      const m = rest.match(/^\s*(\d{1,2}[^\s]*)\s*/);
      if (!m) break;
      calls.push(m[1]);
      rest = rest.slice(m[0].length).trim();
    }
    out.st  = calls[0] || null;
    out.call1 = calls[1] || null;
    out.call2 = calls[2] || null;
    out.str = calls[3] || null;
    out.fin = calls[4] || null;

    // 8) Jockey and odds: odds are often like "*0.42" or "16.20" or "3.85"
    // find first odds-like token
    const oddsMatch = rest.match(/(\*?\d+\.\d{1,2})/);
    if (oddsMatch) {
      out.odds = oddsMatch[1];
      // jockey is the token(s) right before odds
      const beforeOdds = rest.slice(0, oddsMatch.index).trim();
      // jockey is usually last "word" there
      const jw = beforeOdds.split(/\s+/).filter(Boolean);
      out.jockey = jw.length ? jw.slice(-1)[0] : null;
      rest = rest.slice(oddsMatch.index + oddsMatch[0].length).trim();
    } else {
      // fallback: if no decimal odds, maybe it's a star "*3.10" or integer; try to capture a trailing number near end
      const possibleOdds = rest.match(/\*?\d{1,3}(?:\.\d+)?/);
      if (possibleOdds) {
        out.odds = possibleOdds[0];
        const beforeOdds = rest.slice(0, possibleOdds.index).trim();
        out.jockey = beforeOdds.split(/\s+/).slice(-1)[0] || null;
        rest = rest.slice(possibleOdds.index + possibleOdds[0].length).trim();
      }
    }

    // 9) FLD (field size) is frequently the final trailing small number; capture trailing 1-2 digits
    const fldMatch = rest.match(/(\d{1,2})\s*$/);
    if (fldMatch) {
      out.fld = fldMatch[1];
      rest = rest.slice(0, fldMatch.index).trim();
    }

    // 10) Now what's left: top finishers + comment (they are usually separated with two spaces or a semicolon)
    // try to split into topFinishers and comment
    let top = null, comment = null;
    // split on semicolon which often starts comments like "Ins; blck; chckd"
    const semiIdx = rest.search(/Ins;|Chck|Stumble|Stmbld|bpd|bpm|;|gain|stumble/i);
    if (semiIdx >= 0) {
      top = rest.slice(0, semiIdx).trim();
      comment = rest.slice(semiIdx).trim();
    } else {
      // if there are double spaces between two chunks, use that
      const sep = rest.match(/(.+?)\s{2,}(.+)$/);
      if (sep) {
        top = sep[1].trim();
        comment = sep[2].trim();
      } else {
        // fallback: split by "  " or dash groups
        if (rest.indexOf("  ") >= 0) {
          const parts = rest.split(/  +/).map(s=>s.trim()).filter(Boolean);
          top = parts[0]||"";
          comment = parts.slice(1).join(" ")||"";
        } else {
          // last fallback: treat first 50 chars as topFinishers
          top = rest.length>0 ? rest.split(/\s{2,}/)[0] : "";
          comment = "";
        }
      }
    }
    out.topFinishers = safeTrim(top);
    out.comment = safeTrim(comment);

    return out;
  }

  // Main parser entrypoint
  function parsePPTable(text) {
    if (!text || !text.length) return [];
    // Normalize NBSP to space and ensure consistent newlines
    const normalized = text.replace(/\u00A0/g, " ").replace(/\r/g,"\n");
    // Split into horse blocks by post position anchors
    const blocks = splitHorseBlocks(normalized);
    if (!blocks.length) {
      // If no anchors, return a single block fallback
      return [{ horsePP: null, raw: normalized, header: null, pps: [] }];
    }

    const result = [];
    for (const b of blocks) {
      const block = { horsePP: b.horsePP, raw: b.raw };

      // Attempt to extract a header (top hero block info) - everything before the "DATE TRK" header (if present)
      const idxHeader = b.raw.search(/DATE\s+TRK/i);
      if (idxHeader >= 0) {
        block.headerRaw = b.raw.slice(0, idxHeader).trim();
        block.ppTableRaw = b.raw.slice(idxHeader).trim();
      } else {
        // if no explicit header, try to split by "DATE " token
        const idxDate = b.raw.search(/\d{2}[A-Za-z]{3}\d{2}/);
        if (idxDate >= 0) {
          block.headerRaw = b.raw.slice(0, idxDate).trim();
          block.ppTableRaw = b.raw.slice(idxDate).trim();
        } else {
          block.headerRaw = b.raw;
          block.ppTableRaw = "";
        }
      }

      // Parse PP rows
      const rows = findPPRows(block.ppTableRaw);
      const parsedRows = rows.map(r => parsePPRow(r));
      block.pps = parsedRows;
      result.push(block);
    }

    return result;
  }

  // Export
  if (typeof window !== "undefined") {
    window.parsePPTable = parsePPTable;
  }
  if (typeof module !== "undefined") {
    module.exports = { parsePPTable };
  }
})();
