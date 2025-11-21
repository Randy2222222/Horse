// js/horseParser.js
// Browser-friendly Brisnet-style horse parser
// Assumes parsePPTable(text) (your anchor-splitter) is already loaded.

(function () {
  'use strict';

  // --- Utilities ---
  function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function firstLineAfter(key, block) {
    const re = new RegExp('^\\s*' + escapeRegex(key) + '\\s*:??\\s*(.+)$', 'im');
    const m = block.match(re);
    if (m) return m[1].trim();
    const re2 = new RegExp('^\\s*' + escapeRegex(key) + '\\s*$\\n\\s*([^\\n]+)', 'im');
    const m2 = block.match(re2);
    return m2 ? m2[1].trim() : '';
  }
  function takeBetween(startKey, endKey, block) {
    const s = block.indexOf(startKey);
    if (s < 0) return '';
    const tail = block.slice(s + startKey.length);
    if (!endKey) return tail.trim();
    const e = tail.indexOf(endKey);
    return e < 0 ? tail.trim() : tail.slice(0, e).trim();
  }

  // normalize whitespace + preserve lines
  function norm(block) {
    return block.replace(/\r/g, '\n').replace(/\t/g, ' ').replace(/\u00A0/g, ' ').replace(/[ ]{2,}/g, ' ').trim();
  }

  // --- Field parsers ---
  function parseHeader(blockObj) {
    // blockObj may be {post, name, raw} or raw string
    let post = blockObj.post || null;
    let name = blockObj.name || '';
    let tag = '';
    let raw = typeof blockObj === 'string' ? blockObj : (blockObj.raw || '');
    raw = norm(raw);
    // try the one-line header first
    const headLine = raw.split('\n', 2)[0] || '';
    const headMatch = headLine.match(/^\s*(\d{1,2})\s+(.+?)\s*(\([^\)]*\))?\s*$/);
    if (headMatch) {
      post = post || Number(headMatch[1]);
      name = name || headMatch[2].trim();
      tag = headMatch[3] ? headMatch[3].trim() : tag;
    } else {
      // try multi-line header like: "1\n\nScythian (P 5)\n\nOwn:"
      const m = raw.match(/^\s*(\d{1,2})\s*$\n+\s*([^\n(]{2,60})(\([^\)]*\))?/m);
      if (m) {
        post = post || Number(m[1]);
        name = name || m[2].trim();
        tag = m[3] ? m[3].trim() : tag;
      }
    }
    return { post, name, tag };
  }

  function parseOdds(block) {
    // first odds like 8/1, 2/1, 3.57 etc. take first reasonable match near top
    const top = block.split('\n').slice(0, 8).join(' ');
    const m = top.match(/\b(\d+\/\d+|\d+\.\d+|\d+)\b/);
    return m ? m[1] : '';
  }

  function parseJockey(block) {
    // prefer lines like: PRAT FLAVIEN (33 10-3-3 30%)
    const m1 = block.match(/^([A-Z][A-Z\.\s'’\-]{2,50})\s*\(([^)]+)\)/m);
    if (m1) return { name: m1[1].trim(), record: m1[2].trim() };
    // fallback search near top for an all-caps token
    const top = block.split('\n').slice(0, 10);
    for (const ln of top) {
      const l = ln.trim();
      const m = l.match(/^([A-Z][A-Z\.\s'’\-]{2,50})\s*$/);
      if (m) {
        // look next token for parentheses
        const idx = top.indexOf(ln);
        const next = (top[idx + 1] || '').trim();
        const rec = next.match(/^\(?([0-9\-\s%\/]+)\)?$/) ? next : '';
        return { name: m[1].trim(), record: rec || '' };
      }
    }
    // inline pattern
    const m3 = block.match(/([A-Z][A-Z\.\s'’\-]{2,50})\s*\(([0-9\-\s%\/,]+)\)/);
    if (m3) return { name: m3[1].trim(), record: m3[2].trim() };
    // last fallback: find short uppercase token with jockey-ish length
    const m4 = block.match(/\n([A-Z][A-Z\.\s]{2,30})\s*\n/);
    return m4 ? { name: m4[1].trim(), record: '' } : { name: '', record: '' };
  }

  function parseSexAge(block) {
    // common forms: "B.   f.   3" or  "Ch.   f.   3" or multi-line
    const m = block.match(/\b([A-Z][a-zA-Z\.]{0,4})\s+([fmcb]\.)\s+(\d{1,2})\b/i);
    if (m) return { sex: (m[2]||'').replace('.','').trim(), age: m[3] };
    const m2 = block.match(/\n\s*([A-Z][a-zA-Z\.]{0,4})\s*\n\s*([fmcb]\.)\s*\n\s*(\d{1,2})/i);
    if (m2) return { sex: (m2[2]||'').replace('.','').trim(), age: m2[3] };
    const m3 = block.match(/([fmcb]\.)\s*(\d{1,2})/i);
    if (m3) return { sex: (m3[1]||'').replace('.','').trim(), age: m3[2] };
    return { sex: '', age: '' };
  }

  function parsePrimePower(block) {
    const m = block.match(/Prime Power:\s*([0-9\.]+\s*(?:\([^)]+\))?)/i);
    return m ? m[1].trim() : '';
  }

  function parseLifeYears(block) {
    const out = { life: '', by_year: {}, surfaces: {} };
    const lifeM = block.match(/\bLife:\s*([^\n]+)/i);
    if (lifeM) out.life = lifeM[1].trim();
    const yearRe = /^(\s*20\d{2})\s+(.+)$/gim;
    let m;
    while ((m = yearRe.exec(block)) !== null) {
      out.by_year[m[1].trim()] = m[2].trim();
    }
    // surfaces: look for lines like "Trf (119) 4 2-0-1 $169,340 87"
    const surfRe = /(\b[A-Z][a-z]{2,4}\b)\s*\((\d{2,3}\??)\)\s*([\s\S]{0,80})/gim;
    while ((m = surfRe.exec(block)) !== null) {
      const s = m[1];
      out.surfaces[s] = (out.surfaces[s] || []).concat(m[3].trim());
    }
    return out;
  }

  function parseStatLines(block) {
    const out = [];
    for (const ln of block.split('\n')) {
      if (/%/.test(ln) || /JKYw|Sire Stats|Dam'sSire|SoldAt|SoldAt:|StudFee|Prime Power|Blnkr|Blinkers|Blnkr Off/i.test(ln)) {
        const t = ln.trim();
        if (t) out.push(t);
      }
    }
    return out;
  }

  function parseWorkouts(block) {
    const out = [];
    const lines = block.split('\n').map(l => l.trim());
    const wRe = /^\d{2}[A-Za-z]{3}\b.*\b(?:ft|fm|gd|my|sf|yl|ft)\b.*$/i;
    for (const l of lines) {
      if (wRe.test(l) && l.length < 200) out.push(l);
    }
    return out;
  }

  function parseNotes(block) {
    const notes = [];
    for (const l of block.split('\n')) {
      const t = l.trim();
      if (!t) continue;
      if (/^[\u00F1\u00D1ñ×•\*¶\u2022\-\—\+]/.test(t) || /Failed as favorite|Beaten by weaker|Moves up in class|Won last race|Won last race/i.test(t)) {
        notes.push(t);
      }
    }
    return notes;
  }

  // ---- Past performance row parser (best-effort) ----
  // Attempts to parse detailed race rows and extract named columns.
  function parsePastPerformances(block) {
    const out = [];
    // find the section header "DATE TRK" or find lines that look like race rows
    const startIdx = block.search(/DATE TRK/i);
    const raceText = startIdx >= 0 ? block.slice(startIdx) : block;
    const lines = raceText.split('\n').map(l => l.trim()).filter(l => l.length > 3);

    // Row detection regex (very fuzzy)
    const rowToken = /^(\d{2}[A-Za-z]{3}\d{2}\S*)\s+([A-Za-z]{2,4})?\s*(\d?\/?\d?|\S{0,6})?\s*(fm|ft|sf|my|yl|gd|yl|mx|sf)?\s*(.*)$/i;

    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      const m = ln.match(rowToken);
      if (!m) continue;

      // build chunk including following continuation lines (comments, jockey, odds)
      let chunk = ln;
      let look = i + 1;
      while (look < lines.length && !/^\d{2}[A-Za-z]{3}\d{2}/.test(lines[look]) && lines[look].length < 300) {
        chunk += ' ' + lines[look];
        look++;
      }

      // Extract pieces from chunk:
      const date_raw = (m[1] || '').trim();
      const track = (m[2] || '').trim();
      // try to pull distance: tokens like "1ˆ", "1m", "1„", "1Š" — accept trailing non-ascii
      const distMatch = chunk.match(/\b(\d+(?:[\/\d\.]|m|f|ˆ|Š|„|‰)*)\b/);
      const dist = distMatch ? distMatch[1] : '';

      // times sequence: e.g. ":23  :48  1:12  1:42"
      const times = (chunk.match(/(?:\d:)?\d{1,2}:\d{2}/g) || []).join(' ');
      // leader / call times are often sequences around times, try to capture tokens like "1c 2c"
      const LP = (chunk.match(/\bLP\b|\bLP:?\b|leaders? ?first|leaders? ?first call/gi) || []).join(' ') || '';
      // 1c and 2c might be specific numeric tokens in full dump; attempt to capture nearest numbers after times
      const firstCall = (chunk.match(/1c\s*[:\u00A0]?\s*([^\s,]+)/i) || chunk.match(/\b1C\b\s*[:\u00A0]?\s*([^\s,]+)/i) || ['',''])[1] || '';
      const secondCall = (chunk.match(/2c\s*[:\u00A0]?\s*([^\s,]+)/i) || chunk.match(/\b2C\b\s*[:\u00A0]?\s*([^\s,]+)/i) || ['',''])[1] || '';

      // speed / rating
      const sp = (chunk.match(/\b(\d{2,3})(?:\/\d{2,3})?\b/) || [''])[0];
      // final position - last single-digit number before jockey/odds probably
      const fin = (chunk.match(/\b(\d{1,2})\b(?!.*\$)/) || ['',''])[1] || '';

      // jockey in row (uppercase name)
      const jockey = (chunk.match(/\b([A-Z][A-Za-z\.\-]{2,30}J|[A-Z][A-Za-z\.\-]{2,30}\b(?=\s+[^a-z]))/i) || [''])[0] || '';
      const odds = (chunk.match(/(\*?\d+\.\d+|\d+\/\d+|\*\d+)/) || [''])[0];

      // race title detection (™ token or caps words and G1/G2 or Mdn/G)
      const titleM = chunk.match(/™?([A-Za-z][\w\s\-\.\'’]{3,60}?(?:-G\d|G\d|Mdn|OC|n1x|n2x|A\d+k|Regret|PuckerUp|QEIICup|DGOaks|LaCmbeMemB))/i);
      const race_title = titleM ? titleM[1].trim() : '';

      // comment: capture 'Comment' or common words (stumble, bpd, drift, tracked, rallied)
      const commM = chunk.match(/(?:Comment[:\s]*)(.+)$/i) || chunk.match(/(Stumble[^\.;,]*|bpd[^\.;,]*|drift[^.;,]*|tracked[^.;,]*|rallied[^.;,]*|Brush gate[^.;,]*|bumped[^.;,]*|stumbled[^.;,]*)/i);
      const comment = commM ? (commM[1] || commM[0]).trim() : '';

      // leader times / calls attempt: sequences that look like ":24 :48 1:12 1:42" -> treat as leaderTimes array
      const leaderTimes = (chunk.match(/(:\d{2})/g) || []).slice(0,6);

      // push structured row
      out.push({
        raw: chunk.trim(),
        date_raw, track, dist,
        rr: '', // RR (run rank) often in a separate column; too variable to reliably capture generically
        racetype: race_title,
        CR: '', E1: '', E2: '', LP: LP || '',
        call_1c: firstCall, call_2c: secondCall,
        times: times || '',
        leader_times: leaderTimes,
        SPD: sp || '',
        PP: '', ST: '',
        '1C': firstCall || '', '2C': secondCall || '',
        STR: '', FIN: fin || '',
        JOCKEY: jockey || '',
        ODDS: odds || '',
        COMMENT: comment || ''
      });

      // skip ahead
      i = look - 1;
    }

    return out;
  }

  // ---- Top-level horse parse function ----
  function parseHorseBlockInput(blockInput) {
    // Accept either {post,name,raw} or raw string
    let blockObj = blockInput;
    if (typeof blockInput === 'string') blockObj = { post: null, name: null, raw: blockInput };
    blockObj.raw = norm(blockObj.raw || '');

    const header = parseHeader(blockObj);
    const owner = firstLineAfter('Own', blockObj.raw) || firstLineAfter('Owner', blockObj.raw);
    const silks = (() => {
      // try line after owner
      const lines = blockObj.raw.split('\n').map(s => s.trim()).filter(Boolean);
      const ownerIdx = lines.findIndex(l => l && (l.indexOf(owner) >= 0 || l.startsWith('Own') || l.startsWith('Owner')));
      if (ownerIdx >= 0 && lines[ownerIdx + 1]) {
        const cand = lines[ownerIdx + 1];
        if (cand.length > 6 && cand.length < 200 && /[A-Za-z]/.test(cand)) return cand;
      }
      // fallback: first long comma line near top
      for (let i = 0; i < Math.min(8, lines.length); i++) {
        if (lines[i].includes(',') && lines[i].length > 12) return lines[i];
      }
      return '';
    })();
    const odds = parseOdds(blockObj.raw);
    const jockey = parseJockey(blockObj.raw);
    const { sex, age } = parseSexAge(blockObj.raw);
    const sire = firstLineAfter('Sire', blockObj.raw);
    const dam = firstLineAfter('Dam', blockObj.raw);
    const breeder = firstLineAfter('Brdr', blockObj.raw) || firstLineAfter('Brdr:', blockObj.raw);
    const trainer = firstLineAfter('Trnr', blockObj.raw) || firstLineAfter('Trnr:', blockObj.raw);
    const prime_power = parsePrimePower(blockObj.raw);
    const lifeYears = parseLifeYears(blockObj.raw);
    const stat_lines = parseStatLines(blockObj.raw);
    const workouts = parseWorkouts(blockObj.raw);
    const notes = parseNotes(blockObj.raw);
    const pastPerformances = parsePastPerformances(blockObj.raw);

    return {
      post: header.post,
      name: header.name,
      tag: header.tag,
      raw: blockObj.raw,
      owner: owner || '',
      silks: silks || '',
      odds: odds || '',
      jockey,
      sex, age,
      sire, dam, breeder, trainer,
      prime_power,
      life: lifeYears.life, by_year: lifeYears.by_year, surfaces: lifeYears.surfaces,
      stat_lines,
      workouts,
      notes,
      pastPerformances
    };
  }

  // --- Expose API to window ---
  window.parseHorseBlockFull = function (rawBlockOrObj) {
    try {
      return parseHorseBlockInput(rawBlockOrObj);
    } catch (err) {
      console.error('parseHorseBlockFull error', err);
      return null;
    }
  };

  // convenience: parse full PP text using your existing parsePPTable anchor
  window.parseFullPP = function (fullText) {
    if (!fullText || typeof fullText !== 'string') return [];
    if (typeof window.parsePPTable !== 'function') {
      console.warn('parseFullPP: parsePPTable anchor not found; returning single block parse of full text.');
      return [window.parseHorseBlockFull(fullText)];
    }
    const table = window.parsePPTable(fullText);
    if (!Array.isArray(table) || !table.length) {
      // fallback: parse whole text as 1 block
      return [window.parseHorseBlockFull(fullText)];
    }
    return table.map(h => {
      try {
        // h should contain {post, name, raw} from parsePPTable
        return Object.assign({ post: h.post, name: h.name }, window.parseHorseBlockFull(h.raw || h));
      } catch (e) {
        console.error('parseFullPP error for post', h && h.post, e);
        return { post: h.post, name: h.name, raw: (h.raw || ''), error: true };
      }
    });
  };

})(); // end module
