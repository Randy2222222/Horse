// js/parser.js
// -----------------------------------------------------------
// Brisnet Past Performance Parser (bottom section + overall horse blocks)
// Anchor: Post Position token (1..20) - used to split horse blocks
// Exports: window.parsePPTable(text) -> [{ horsePP, raw, headerRaw, ppTableRaw, pps: [...] }, ...]
// -----------------------------------------------------------

(function () {
  // small helpers
  function safeTrim(s) { return (s||"").replace(/\u00A0/g," ").replace(/\s+/g," ").trim(); }
  function collapseSpaces(s) { return (s||"").replace(/\u00A0/g," ").replace(/\s+/g," ").trim(); }

  // Normalize extracted text for reliable regex behavior
  function normalizeText(text) {
    if (!text) return "";
    // Replace CR, normalize NBSPs, collapse multiple whitespace where helpful but keep single newlines for block detection
    let t = text.replace(/\u00A0/g, " ").replace(/\r/g, "\n");
    // Remove weird control characters
    t = t.replace(/[\u0000-\u001F\u007F]/g, " ");
    // Collapse more than 2 consecutive newlines to exactly 2 (keeps block separation)
    t = t.replace(/\n{3,}/g, "\n\n");
    // Trim trailing/leading space per line
    t = t.split("\n").map(l => l.trim()).join("\n");
    return t;
  }

  // Find anchors for post positions (1..20).
  // We locate numbers that appear at start or after newline + whitespace and followed by whitespace and a word/char.
  function findPostPositionAnchors(text) {
    const anchors = [];
    // look for standalone 1..20 tokens preceded by start or newline and followed by whitespace
    // We use lookahead to ensure it's likely the post-position (a whitespace and then a capital/word or punctuation)
    const re = /(?:^|\n)(\s*)([1-9]|1[0-9]|20)(?=\s+\S)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      // compute exact index of the digit token within the original string:
      const fullMatchIndex = m.index;                // index of ^ or newline
      const leadingWhitespaceLen = m[1].length;     // whitespace after newline
      const numberTokenIndex = fullMatchIndex + m[0].lastIndexOf(m[2]); // safer index calc
      // But lastIndexOf could be zero; to be robust, compute based on m.index + offset:
      const idx = fullMatchIndex + m[0].length - m[2].length;
      anchors.push({ idx: idx, pp: Number(m[2]) });
      // continue scanning
    }
    // remove duplicates & sort
    const uniq = [];
    const seen = new Set();
    anchors.sort((a,b)=>a.idx-b.idx).forEach(a=>{
      const key = `${a.idx}-${a.pp}`;
      if (!seen.has(key)) { seen.add(key); uniq.push(a); }
    });
    return uniq;
  }

  // Split into horse blocks by the anchor indices
  function splitHorseBlocks(text) {
    const anchors = findPostPositionAnchors(text);
    if (!anchors.length) return [];
    const blocks = [];
    for (let i = 0; i < anchors.length; i++) {
      const start = anchors[i].idx;
      const end = (i + 1 < anchors.length) ? anchors[i+1].idx : text.length;
      const raw = text.slice(start, end).trim();
      blocks.push({ horsePP: anchors[i].pp, raw });
    }
    return blocks;
  }

  // Find PP rows in a horse block (the bottom tabular past-performance area)
  // Heuristic: look for date tokens (DDMonYY) and slice out segments
  function findPPRows(blockText) {
    const rows = [];
    if (!blockText) return rows;
    const t = blockText.replace(/\r/g, "\n");
    // If a visible header "DATE TRK" exists, slice from it
    const hdrIdx = t.search(/DATE\s+TRK/i);
    let candidate = hdrIdx >= 0 ? t.slice(hdrIdx) : t;
    // Now find date tokens (DDMonYY) that likely mark the start of each PP line
    const dateRe = /\d{2}[A-Za-z]{3}\d{2}/g;
    let m;
    const indices = [];
    while ((m = dateRe.exec(candidate)) !== null) {
      indices.push(m.index);
    }
    if (indices.length >= 1) {
      for (let i = 0; i < indices.length; i++) {
        const s = indices[i];
        const e = (i + 1 < indices.length) ? indices[i+1] : candidate.length;
        let row = candidate.slice(s, e).trim();
        // collapse internal newlines/spaces to single space to simplify parsing
        row = row.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
        rows.push(row);
      }
    } else {
      // Fallback: split by lines, take lines that look like they start with a date or a distance token
      candidate.split(/\n+/).map(l => l.trim()).filter(Boolean).forEach(line => {
        if (/\d{2}[A-Za-z]{3}\d{2}/.test(line) || /^\d/.test(line)) {
          rows.push(line.replace(/\s+/g," ").trim());
        }
      });
    }
    return rows;
  }

  // Parse a single PP row (best-effort). Returns object with fields used for calculations.
  function parsePPRow(row) {
    const out = {
      raw: safeTrim(row),
      date: null, trk: null, dist: null, surface: null, racetype: null,
      pp: null, st: null, call1: null, call2: null, str: null, fin: null,
      jockey: null, odds: null, topFinishers: null, comment: null, fld: null
    };

    if (!out.raw) return out;
    let s = out.raw;

    // 1) date (DDMonYY) if present near start
    const dateMatch = s.match(/^(\d{2}[A-Za-z]{3}\d{2})/);
    if (dateMatch) {
      out.date = dateMatch[1];
      s = s.slice(dateMatch[0].length).trim();
    }

    // 2) track token (3 letters) immediately after date or within fused token
    let trkMatch = s.match(/^([A-Za-z]{3})\b/);
    if (trkMatch) {
      out.trk = trkMatch[1];
      s = s.slice(trkMatch[0].length).trim();
    } else {
      // fused case like 09Oct25Baq...
      const glued = out.raw.slice(0, 15).match(/^(\d{2}[A-Za-z]{3}\d{2})([A-Za-z]{3})/);
      if (glued) {
        out.date = glued[1];
        out.trk = glued[2];
        s = out.raw.slice(glued[0].length).trim();
      }
    }

    // 3) dist (e.g., 1ˆ, 1m, 6f, 5½-like) - take first token that starts with digit
    const distMatch = s.match(/^(\d+[^\s]*)\s*/);
    if (distMatch) {
      out.dist = distMatch[1];
      s = s.slice(distMatch[0].length).trim();
    }

    // 4) surface (common abbreviations)
    const surfMatch = s.match(/^(fm|ft|gd|sf|yl|my|yl)\b/i);
    if (surfMatch) {
      out.surface = surfMatch[1];
      s = s.slice(surfMatch[0].length).trim();
    }

    // 5) remove leader call times like :24 :48 1:12 -> not used as numeric fields here
    s = s.replace(/:\d{1,2}(?:\.\d+)?/g, " ").replace(/\d:\d{2}/g, " ").trim();

    // 6) racetype up to the first standalone number (pp)
    const ppNum = s.match(/\b(\d{1,2})\b/);
    if (ppNum) {
      const idx = ppNum.index;
      out.racetype = safeTrim(s.slice(0, idx));
      out.pp = ppNum[1];
      s = s.slice(idx + ppNum[0].length).trim();
    } else {
      // fallback: take chunk as racetype
      const maybe = s.split(/\s{2,}/)[0] || s.split(/\s+/)[0];
      out.racetype = safeTrim(maybe);
      s = s.slice((maybe||"").length).trim();
    }

    // 7) parse up to five "call" tokens (ST, 1C, 2C, STR, FIN)
    const calls = [];
    while (calls.length < 5 && s.length) {
      const m = s.match(/^\s*(\d{1,2}[^\s]*)\s*/);
      if (!m) break;
      calls.push(m[1]);
      s = s.slice(m[0].length).trim();
    }
    out.st = calls[0] || null;
    out.call1 = calls[1] || null;
    out.call2 = calls[2] || null;
    out.str = calls[3] || null;
    out.fin = calls[4] || null;

    // 8) odds and jockey: odds commonly look like "*0.42" or "16.20" or "3.85"
    const oddsMatch = s.match(/(\*?\d{1,3}(?:\.\d{1,2})?)/);
    if (oddsMatch) {
      out.odds = oddsMatch[1];
      // jockey typically immediately precedes odds - take the last token before odds
      const before = s.slice(0, oddsMatch.index).trim();
      if (before) {
        const words = before.split(/\s+/).filter(Boolean);
        out.jockey = words.length ? words.slice(-1)[0] : null;
      }
      s = s.slice(oddsMatch.index + oddsMatch[0].length).trim();
    } else {
      // fallback: try to detect star-form odds
      const alt = s.match(/(\*\d+\.\d+)/);
      if (alt) {
        out.odds = alt[1];
        const before = s.slice(0, alt.index).trim();
        out.jockey = before.split(/\s+/).slice(-1)[0] || null;
        s = s.slice(alt.index + alt[0].length).trim();
      }
    }

    // 9) FLD (field size) often trailing small number
    const fldMatch = s.match(/(\d{1,2})\s*$/);
    if (fldMatch) {
      out.fld = fldMatch[1];
      s = s.slice(0, fldMatch.index).trim();
    }

    // 10) remaining text -> topFinishers and comment
    let top = "", comment = "";
    // Common separators: semicolon, double-space, or a dash list
    const semIdx = s.search(/Ins;|Chck|Stumble|Stmbld|bpd|bpm|gain|stumble|;|;/i);
    if (semIdx >= 0) {
      top = s.slice(0, semIdx).trim();
      comment = s.slice(semIdx).trim();
    } else {
      const sep = s.match(/(.+?)\s{2,}(.+)$/);
      if (sep) { top = sep[1].trim(); comment = sep[2].trim(); }
      else {
        // attempt to split by the typical "TopFinishers" dash separator used in the form
        const dashParts = s.split(/[-–—]/).map(x=>x.trim()).filter(Boolean);
        if (dashParts.length >= 3) {
          top = dashParts.slice(0,3).join("–");
          comment = s.replace(top,"").trim();
        } else {
          top = s.trim();
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
    const normalized = normalizeText(text);

    // quick guard: remove repetitive copyright prefixes that sometimes appear repeated
    // e.g., "(c) Copyright..." repeating at page starts — strip if obviously repeating many times
    const copyright = normalized.match(/\(c\)\s*Copyright/i);
    let cleaned = normalized;
    if (copyright) {
      // remove any repeated copyright line that appears more than once
      cleaned = cleaned.replace(/\(c\)\s*Copyright[\s\S]{0,200}?(Equibase|Brisnet|Bloodstock)[\s\S]{0,200}?/gi, "");
      cleaned = cleaned.replace(/\n{2,}/g, "\n\n");
    }

    // Split into horse blocks using post position anchors
    const blocks = splitHorseBlocks(cleaned);
    if (!blocks.length) {
      // fallback: return a single raw block for manual inspection
      return [{ horsePP: null, raw: cleaned, headerRaw: null, ppTableRaw: cleaned, pps: [] }];
    }

    const result = [];
    for (const b of blocks) {
      const block = { horsePP: b.horsePP, raw: b.raw, headerRaw: null, ppTableRaw: "", pps: [] };

      // Find "DATE TRK" or first date token to separate header from PP table
      const idxHeader = b.raw.search(/DATE\s+TRK/i);
      if (idxHeader >= 0) {
        block.headerRaw = b.raw.slice(0, idxHeader).trim();
        block.ppTableRaw = b.raw.slice(idxHeader).trim();
      } else {
        const idxDate = b.raw.search(/\d{2}[A-Za-z]{3}\d{2}/);
        if (idxDate >= 0) {
          block.headerRaw = b.raw.slice(0, idxDate).trim();
          block.ppTableRaw = b.raw.slice(idxDate).trim();
        } else {
          // no table in this block
          block.headerRaw = b.raw;
          block.ppTableRaw = "";
        }
      }

      // Parse PP rows from ppTableRaw
      const rows = findPPRows(block.ppTableRaw);
      block.pps = rows.map(r => parsePPRow(r));
      result.push(block);
    }

    return result;
  }

  // Export
  if (typeof window !== "undefined") window.parsePPTable = parsePPTable;
  if (typeof module !== "undefined") module.exports = { parsePPTable };

})(); // end module
