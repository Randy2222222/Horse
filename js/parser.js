// js/parser.js
// Brisnet PP parser focused on bottom-section extraction + horse block splitting
// Anchor: Post Position token (1..20) followed by >=2 spaces then horse name
// Exports: window.parsePPTable(text) -> [ { horsePP, name, style, headerRaw, pps: [...] } ]

(function () {
  // Normalize and safe-trim helper
  function safeTrim(s = "") {
    return String(s).replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
  }

  // Find anchors for post positions using the robust rule:
  // start-of-line or newline, optional whitespace, 1-2 digits (PP), at least 2 spaces, then a letter (start of name)
  function findPPAnchors(text) {
    const re = /(?:^|\n)\s*([1-9]|1[0-9]|20)\s{2,}(?=[A-Za-z])/g;
    const anchors = [];
    let m;
    while ((m = re.exec(text)) !== null) {
      anchors.push({ idx: m.index + (m[0].startsWith("\n") ? 1 : 0), pp: Number(m[1]) });
    }
    return anchors;
  }

  // Split into horse blocks using anchors
  function splitHorseBlocks(text) {
    const anchors = findPPAnchors(text);
    if (!anchors.length) return [];
    const blocks = [];
    for (let i = 0; i < anchors.length; i++) {
      const start = anchors[i].idx;
      const end = (i + 1 < anchors.length) ? anchors[i + 1].idx : text.length;
      const raw = text.slice(start, end).trim();
      blocks.push({ horsePP: anchors[i].pp, raw });
    }
    return blocks;
  }

  // Extract horse name and style from start of block.
  // Expected start examples:
  // "1   Scythian (P 5) Own: ..."  OR "2  Hereforagoodtime (EP4) Own: ..."
  function extractNameAndStyle(raw) {
    // Work from block start
    // Accept PP may be present at start of raw (but splitHorseBlocks slices at PP index)
    // So match optional leading digits then >=2 spaces then name
    const m = raw.match(/^(?:\s*\d{1,2}\s{2,})?([A-Za-z0-9'".&\-\s]+?)\s*(\([A-Za-z]{1,3}\s*\d*\)|\([A-Za-z]{1,3}\d*\))?\b/);
    if (!m) return { name: null, style: null };
    const name = safeTrim(m[1]);
    const style = m[2] ? safeTrim(m[2].replace(/^\(|\)$/g, "")) : null;
    return { name, style };
  }

  // Within a horse block, find PP table rows
  // Approach: look for date tokens DDMonYY (09Oct25) and slice segments starting at each date
  function findPPRows(blockText) {
    const rows = [];
    // normalize whitespace/newlines
    const t = blockText.replace(/\r/g, "\n");
    // find indices of date tokens
    const dateRe = /\d{2}[A-Za-z]{3}\d{2}/g;
    let m;
    const indices = [];
    while ((m = dateRe.exec(t)) !== null) indices.push(m.index);
    if (indices.length) {
      for (let i = 0; i < indices.length; i++) {
        const s = indices[i];
        const e = (i + 1 < indices.length) ? indices[i + 1] : t.length;
        let row = t.slice(s, e).trim();
        // collapse newlines to spaces (we'll parse tokens from the single-line row)
        row = row.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
        rows.push(row);
      }
    } else {
      // fallback: attempt to locate "DATE TRK" header then split following lines containing patterns
      const hdr = t.search(/DATE\s+TRK/i);
      if (hdr >= 0) {
        const after = t.slice(hdr);
        const cand = after.split(/\n+/).map(l => l.trim()).filter(Boolean);
        for (const ln of cand) {
          if (/\d{2}[A-Za-z]{3}\d{2}/.test(ln)) {
            rows.push(ln.replace(/\s+/g, " "));
          }
        }
      }
    }
    return rows;
  }

  // Parse a single PP row (best-effort)
  function parsePPRow(row) {
    const raw = safeTrim(row);
    const out = {
      raw,
      date: null, trk: null, dist: null, surface: null, racetype: null,
      pp: null, st: null, call1: null, call2: null, str: null, fin: null,
      jockey: null, odds: null, topFinishers: null, comment: null, fld: null
    };

    let rest = raw;

    // 1) date (DDMonYY) at start
    const dateMatch = rest.match(/^(\d{2}[A-Za-z]{3}\d{2})/);
    if (dateMatch) {
      out.date = dateMatch[1];
      rest = rest.slice(dateMatch[0].length).trim();
    }

    // 2) track (3 letters) sometimes glued to date; check
    const trackMatch = rest.match(/^([A-Za-z]{3})\b/);
    if (trackMatch) {
      out.trk = trackMatch[1];
      rest = rest.slice(trackMatch[0].length).trim();
    } else {
      // check if glued on original raw e.g. "09Oct25Baq"
      const glued = raw.slice(0, 12).match(/^(\d{2}[A-Za-z]{3}\d{2})([A-Za-z]{3})/);
      if (glued) {
        out.date = glued[1];
        out.trk = glued[2];
        rest = raw.slice(glued[0].length).trim();
      }
    }

    // 3) dist (may be "1ˆ" or "1m" or "6f") — look for token that begins with digit(s)
    const distMatch = rest.match(/^(\d+[^\s]*)\s*/);
    if (distMatch) {
      out.dist = distMatch[1];
      rest = rest.slice(distMatch[0].length).trim();
    }

    // 4) surface if next token is fm/ft/gd/sf etc.
    const surfMatch = rest.match(/^(fm|ft|gd|sf|yl|my|yl)\b/i);
    if (surfMatch) {
      out.surface = surfMatch[1];
      rest = rest.slice(surfMatch[0].length).trim();
    }

    // 5) remove leader call times like ":24 :48 1:12" (they appear earlier in some rows) - coarse removal
    rest = rest.replace(/:\d{1,2}(?:\.\d+)?/g, " ").replace(/\d:\d{2}/g, " ").replace(/\s+/g, " ").trim();

    // 6) racetype up to first standalone number = PP
    const firstNum = rest.match(/\b(\d{1,2})\b/);
    if (firstNum) {
      out.racetype = safeTrim(rest.slice(0, firstNum.index));
      out.pp = firstNum[1];
      rest = rest.slice(firstNum.index + firstNum[0].length).trim();
    } else {
      // fallback: take first chunk as racetype
      const parts = rest.split(/\s{2,}/);
      out.racetype = safeTrim(parts[0] || "");
      rest = parts.slice(1).join(" ").trim();
    }

    // 7) collect up to 5 call-like tokens (ST, 1C, 2C, STR, FIN)
    const calls = [];
    while (calls.length < 5 && rest.length) {
      const m = rest.match(/^\s*(\d{1,2}[^\s]*)\s*/);
      if (!m) break;
      calls.push(m[1]);
      rest = rest.slice(m[0].length).trim();
    }
    out.st = calls[0] || null;
    out.call1 = calls[1] || null;
    out.call2 = calls[2] || null;
    out.str = calls[3] || null;
    out.fin = calls[4] || null;

    // 8) jockey + odds (odds usually decimal with optional * prefix)
    const oddsMatch = rest.match(/(\*?\d+\.\d{1,2})/);
    if (oddsMatch) {
      out.odds = oddsMatch[1];
      const before = rest.slice(0, oddsMatch.index).trim();
      const jw = before.split(/\s+/).filter(Boolean);
      out.jockey = jw.length ? jw.slice(-1)[0] : null;
      rest = rest.slice(oddsMatch.index + oddsMatch[0].length).trim();
    } else {
      // fallback for integer-like odds
      const possibleOdds = rest.match(/(\*?\d{1,3}(?:\.\d+)?)\b/);
      if (possibleOdds) {
        out.odds = possibleOdds[1];
        const before = rest.slice(0, possibleOdds.index).trim();
        out.jockey = before.split(/\s+/).slice(-1)[0] || null;
        rest = rest.slice(possibleOdds.index + possibleOdds[0].length).trim();
      }
    }

    // 9) fld (final small number) at end
    const fldMatch = rest.match(/(\d{1,2})\s*$/);
    if (fldMatch) {
      out.fld = fldMatch[1];
      rest = rest.slice(0, fldMatch.index).trim();
    }

    // 10) remaining -> try to split topFinishers and comment (semicolon or double space)
    let top = "", comment = "";
    const semi = rest.search(/Ins;|Chck|Stumble|Stmbld|bpd|bpm|;|gain|stumble/i);
    if (semi >= 0) {
      top = safeTrim(rest.slice(0, semi));
      comment = safeTrim(rest.slice(semi));
    } else {
      const sep = rest.match(/(.+?)\s{2,}(.+)$/);
      if (sep) {
        top = safeTrim(sep[1]);
        comment = safeTrim(sep[2]);
      } else {
        // fallback: if there are dash-separated names, pick first group
        const parts = rest.split(/[-–—]/).map(s => s.trim()).filter(Boolean);
        top = parts.slice(0, 3).join("–") || rest || "";
      }
    }
    out.topFinishers = top || null;
    out.comment = comment || null;

    return out;
  }

  // Main exported function
  function parsePPTable(text) {
    if (!text) return [];
    const normalized = String(text).replace(/\u00A0/g, " ").replace(/\r/g, "\n");
    const blocks = splitHorseBlocks(normalized);

    if (!blocks.length) {
      // no anchors -> return fallback single block
      return [{ horsePP: null, name: null, style: null, headerRaw: null, pps: [] }];
    }

    const result = [];
    for (const b of blocks) {
      const { horsePP, raw } = b;
      const nameObj = extractNameAndStyle(raw);
      // split header vs pp table: find "DATE TRK" or first date token
      const idxDate = raw.search(/\bDATE\s+TRK\b/i);
      let headerRaw = "", ppTableRaw = "";
      if (idxDate >= 0) {
        headerRaw = raw.slice(0, idxDate).trim();
        ppTableRaw = raw.slice(idxDate).trim();
      } else {
        const firstDateIdx = raw.search(/\d{2}[A-Za-z]{3}\d{2}/);
        if (firstDateIdx >= 0) {
          headerRaw = raw.slice(0, firstDateIdx).trim();
          ppTableRaw = raw.slice(firstDateIdx).trim();
        } else {
          headerRaw = raw;
          ppTableRaw = "";
        }
      }

      const rows = ppTableRaw ? findPPRows(ppTableRaw) : [];
      const parsedRows = rows.map(r => parsePPRow(r));

      result.push({
        horsePP,
        name: nameObj.name,
        style: nameObj.style,
        headerRaw,
        pps: parsedRows
      });
    }

    return result;
  }

  // export
  if (typeof window !== "undefined") window.parsePPTable = parsePPTable;
  if (typeof module !== "undefined") module.exports = { parsePPTable };

})(); // end parser
