// js/horseParser.js
// Browser-friendly Brisnet-like PP parser. Drop-in replacement for previous horseParser.
// Exposes:
//  - window.parseHorsePP(text)        => parse a whole PP document (returns array of horse objects)
//  - window.parseHorseBlockFull(raw) => parse a single horse block object { post, name, raw } OR raw string
// Works on iPad/browser, no Node-specific APIs used.

(function () {
  'use strict';

  // Anchor regex (same behavior as your original anchor)
  const HORSE_ANCHOR = /(?:^|\n)([1-9]|1[0-9]|20)\s{1,3}([A-Za-z0-9\/'’.\-\s]+\S?)\s*\(/g;

  // Utilities
  function escapeRegex(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
  function firstLineAfter(key, block){
    const re = new RegExp('^\\s*' + escapeRegex(key) + '\\s*:??\\s*(.+)$','im');
    const m = block.match(re);
    if (m) return m[1].trim();
    const re2 = new RegExp('^\\s*' + escapeRegex(key) + '\\s*$\\n\\s*([^\\n]+)','im');
    const m2 = block.match(re2);
    return m2 ? m2[1].trim() : '';
  }

  // Split the full PP text into horse blocks using anchor
  function splitHorseBlocks(text){
    if (!text) return [];
    const t = text.replace(/\r/g,'\n');
    const anchors = [];
    let m;
    while ((m = HORSE_ANCHOR.exec(t)) !== null) {
      anchors.push({ idx: m.index, post: Number(m[1]), name: m[2].trim() });
    }
    if (!anchors.length) {
      // fallback for multi-line "1\n\nName" style
      const fallback = [];
      const fallbackRe = /(?:^|\n)\s*([1-9]|1[0-9]|20)\s*\n+\s*([A-Za-z0-9\/'’.\-\s]+)\s*\n/ig;
      while ((m = fallbackRe.exec(t)) !== null) fallback.push({ idx: m.index, post: Number(m[1]), name: m[2].trim() });
      if (fallback.length) {
        const blocks = [];
        for (let i=0;i<fallback.length;i++){
          const start = fallback[i].idx;
          const end = (i+1 < fallback.length) ? fallback[i+1].idx : t.length;
          blocks.push({ post: fallback[i].post, name: fallback[i].name, raw: t.slice(start,end).trim() });
        }
        return blocks;
      }
      // nothing found - return entire text as single block
      return [{ post: null, name: null, raw: t }];
    }
    const blocks = [];
    for (let i=0;i<anchors.length;i++){
      const start = anchors[i].idx;
      const end = (i+1 < anchors.length) ? anchors[i+1].idx : t.length;
      blocks.push({ post: anchors[i].post, name: anchors[i].name, raw: t.slice(start,end).trim() });
    }
    return blocks;
  }

  // Small parsing helpers
  function parseJockey(block){
    // Pattern: UPPERCASE NAME (record) or UPPERCASE NAME record-inline
    const re1 = /^([A-Z][A-Z\.\-\'\s]{2,50})\s*\(([^)]+)\)/m;
    const m1 = block.match(re1);
    if (m1) return { name: m1[1].trim(), record: m1[2].trim() };
    const re2 = /^([A-Z][A-Z\.\-\'\s]{2,50})\s*$/m;
    const lines = block.split('\n').slice(0,10);
    for (let i=0;i<lines.length;i++){
      const ln = lines[i].trim();
      const mm = ln.match(/^([A-Z][A-Z\.\-\'\s]{2,50})\s*\(([^)]+)\)/);
      if (mm) return { name: mm[1].trim(), record: mm[2].trim() };
    }
    // inline fallback: look for typical jockey tokens near top
    const inline = block.match(/(?:\n|\r)([A-Z][A-Z\.\s]{2,40})\s*\(([^\)]*)\)/);
    if (inline) return { name: inline[1].trim(), record: (inline[2]||'').trim() };
    // last fallback: look for the first all-caps line
    for (const ln of block.split('\n').slice(0,12)){
      if (/^[A-Z0-9\.\s]{3,40}$/.test(ln.trim())) return { name: ln.trim(), record: '' };
    }
    return { name: '', record: '' };
  }

  function parseOdds(block){
    const m = block.match(/\b(\d+\/\d+|\d+\.\d+|\*\d+\.\d+|\*\d+|\d+)\b/);
    return m ? m[1] : '';
  }

  function parseSexAge(block){
    // find patterns like "B.\n\nf.\n\n3" or "B.   f.   3"
    let m = block.match(/\b([A-Z][a-zA-Z\.]{0,3})\s+([fmcb]\.)\s+(\d{1,2})\b/i);
    if (m) return { sex: (m[2]||'').replace('.',''), age: m[3] };
    m = block.match(/\n\s*([A-Z][a-zA-Z\.]{0,3})\s*\n\s*([fmcb]\.)\s*\n\s*(\d{1,2})/i);
    if (m) return { sex: (m[2]||'').replace('.',''), age: m[3] };
    m = block.match(/([fmcb]\.)\s*(\d{1,2})/i);
    if (m) return { sex: (m[1]||'').replace('.',''), age: m[2] };
    return { sex:'', age:'' };
  }

  function parsePrimePower(block){
    const m = block.match(/Prime Power:\s*([0-9\.]+\s*(?:\([^)]+\))?)/i);
    return m ? m[1].trim() : '';
  }

  function parseLifeYears(block){
    const out = { life:'', by_year:{} };
    const life = block.match(/\bLife:\s*([^\n]+)/i);
    if (life) out.life = life[1].trim();
    const yearRe = /^(\s*20\d{2})[ \t]+(.+)$/gim;
    let mm;
    while ((mm = yearRe.exec(block)) !== null){
      out.by_year[mm[1].trim()] = mm[2].trim();
    }
    return out;
  }

  function parseWorkouts(block){
    const lines = block.split('\n');
    const out = [];
    const wRe = /^\s*\d{2}[A-Za-z]{3}.*\b(?:ft|fm|gd|sf|yl|my)\b.*$/i;
    for (const l of lines){
      if (wRe.test(l) && l.length < 200) out.push(l.trim());
    }
    return out;
  }

  // Parse stat lines (percent lines, sire/dam stats, soldAt, studfee, etc.)
  function parseStatLines(block){
    const out = [];
    for (const l of block.split('\n')){
      if (/%/.test(l) || /Sire Stats|Dam'sSire|SoldAt|StudFee|Prime Power|Blnkr|Blinkers|JKYw|Trn L60|Graded Stakes|Wnr last race/i.test(l)){
        const s = l.trim();
        if (s) out.push(s);
      }
    }
    return out;
  }

  // Notes: lines starting with special chars or those containing specific patterns
  function parseNotes(block){
    const out = [];
    for (const l of block.split('\n')){
      const t = l.trim();
      if (!t) continue;
      if (/^[\u00F1\u00D1ñ×•\*¶\u2022\-\—\+]/.test(t) || /Won last race|Moves up in class|Failed as favorite|Beaten by weaker|Blinkers off/i.test(t)){
        out.push(t);
      }
    }
    return out;
  }

  // Best-effort race rows parser — returns array of records with main fields
  function parseRaceHistory(block){
    // Try to find the DATE TRK section; else scan the whole block
    const startIdx = block.search(/DATE TRK/i);
    const race_text = (startIdx >= 0) ? block.slice(startIdx) : block;
    const lines = race_text.split('\n').map(s=>s.trim()).filter(s=>s && s.length>3);
    const rows = [];

    // Candidate row start regex: 09Oct25 or 10Sep25KD etc
    const startRe = /^(\d{2}[A-Za-z]{3}\d{2}[A-Za-z]*)\b/;
    for (let i=0;i<lines.length;i++){
      const ln = lines[i];
      const m = ln.match(startRe);
      if (!m) continue;
      // collect chunk of this row (this line + next up to 5 continuation lines)
      let chunk = ln;
      for (let j=i+1;j<Math.min(i+6, lines.length); j++){
        if (startRe.test(lines[j])) break;
        // break early on obviously new header like "DATE TRK"
        if (/^DATE TRK/i.test(lines[j])) break;
        chunk += ' ' + lines[j];
      }

      // Extract tokens
      const date = (chunk.match(/^(\d{2}[A-Za-z]{3}\d{2}[A-Za-z]*)/)||[])[1]||'';
      const track = (chunk.match(/\b([A-Za-z]{2,4})\b/)? chunk.match(/\b([A-Za-z]{2,4})\b/)[1] : '');
      const dist = (chunk.match(/\b(\d+ ?(?:½|¼|\/)?(?:f|m|furlong|mile|miles)?|1…|1ˆ|1Š|1‰)\b/i) || [''])[0];
      // times (series of :mm or :mm:ss)
      const times = (chunk.match(/:\d{2}(?::\d{2})?/g) || []).join(' ');
      const racetype = (chunk.match(/(Mdn|OC\d+|G\d|A\d+k|A\d+|n1x|n2x|Regret|QEIICup|DGOaks|PuckerUp|OldDmnOakL|SarOkInv|BelOksIn|ChristinaB|JCOaks|QEIICup)/i) || [''])[0];
      // speed / rating
      const speed = (chunk.match(/\b(\d{2,3})(?:\s*\/\s*\d{2,3})?\b/)||[''])[0];
      // finishing position — rough: look for isolated "1", "2", ... after pattern of splits
      const finMatch = chunk.match(/\b(Fin|FIN|FINISH|FIN:)?\s*(\d{1,2})(?![^\n]*\d{1,2})/i);
      const fin = finMatch ? finMatch[2] : (chunk.match(/\s(\d)\s+(?:\w{2,4}\s|[A-Z][a-z]+)/) ? (chunk.match(/\s(\d)\s+(?:\w{2,4}\s|[A-Z][a-z]+)/)[1]) : '');
      // jockey in the row (attempt)
      const jockey = (chunk.match(/([A-Z][a-zA-Z\.\-]{2,40})(?:\s*[A-Z\.\u00A8]*)\b/)||[''])[0];
      const odds = (chunk.match(/(\*?\d+\.\d+|\d+\/\d+|\*\d+|\d+\.\d+|\d+)/) || [''])[0];
      // extract comment (words like 'ins','rallied','bpd','stumbled','bid' etc.)
      const commentMatch = chunk.match(/(Ins[^.]*|Stmbld[^.]*|Stumble[^.]*|rallied[^.]*|brush[^.]*|drift[^.]*|bid[^.]*|bpd[^.]*|split[^.]*|clear[^.]*|responded[^.]*|duel[^.]*|bumped[^.]*|blocked[^.]*|checked[^.]*|held[^.]*|paced[^.]*|stumble[^.]*)/i);
      const comment = commentMatch ? commentMatch[0].trim() : '';

      rows.push({
        raw: chunk.trim(),
        date,
        track,
        dist: dist || '',
        times,
        racetype: racetype||'',
        speed: speed||'',
        fin: fin||'',
        jockey: jockey||'',
        odds: odds||'',
        comment
      });
    }
    return rows;
  }

  // Full per-horse block parse
  function parseHorseBlock(blockObj){
    // blockObj may be { post, name, raw } OR a raw string
    let post = null, name = null, raw = '';
    if (typeof blockObj === 'string') raw = blockObj;
    else {
      post = blockObj.post || null;
      name = blockObj.name || null;
      raw = (blockObj.raw != null) ? blockObj.raw : (blockObj.text || '');
    }
    if (!raw) return { post, name, raw: '' };

    // header detection fallback
    const headerSlice = raw.split('\n').slice(0,5).join(' ');
    const headerMatch = headerSlice.match(/^\s*(\d+)\s+(.+?)\s*(\([^\)]*\))?/);
    if (!post && headerMatch) post = Number(headerMatch[1]);
    if (!name && headerMatch) name = headerMatch[2].trim();

    // Extract fields
    const owner = firstLineAfter('Own', raw) || firstLineAfter('Owner', raw) || '';
    const silks = (function(){
      // common pattern: line after owner (long line with commas and colors)
      const lines = raw.split('\n').map(s=>s.trim()).filter(Boolean);
      const ownerIdx = lines.findIndex(l => /^Own:|^Owner:/i.test(l) || l===owner);
      // prefer a long line near top that contains commas/colors
      for (let i=0;i<5 && i<lines.length;i++){
        const l = lines[i];
        if (/,/.test(l) && l.length>8 && !/PRAT|VELAZQUEZ|FRANCO|RODRIGUEZ|CARMOUSCHE|CIVACI|ELLIOTT|DAVIS/i.test(l)) return l;
      }
      if (ownerIdx >= 0 && ownerIdx+1 < lines.length) return lines[ownerIdx+1];
      // fallback to first comma-sep line in first 10 lines
      for (let i=0;i<Math.min(12,lines.length);i++){
        if (/,/.test(lines[i])) return lines[i];
      }
      return '';
    })();

    const jockey = parseJockey(raw);
    const { sex, age } = parseSexAge(raw);
    const sire = firstLineAfter('Sire', raw) || firstLineAfter('Sire :', raw) || '';
    const dam = firstLineAfter('Dam', raw) || firstLineAfter('Dam:', raw) || '';
    const breeder = firstLineAfter('Brdr', raw) || firstLineAfter('Brdr:', raw) || '';
    const trainer = firstLineAfter('Trnr', raw) || firstLineAfter('Trnr:', raw) || '';
    const prime_power = parsePrimePower(raw);
    const lifeYears = parseLifeYears(raw);
    const workouts = parseWorkouts(raw);
    const stat_lines = parseStatLines(raw);
    const notes = parseNotes(raw);
    const pastPerformances = parseRaceHistory(raw);
    const odds = parseOdds(raw);

    // surfaces: try to capture blocks like "Fst (111) 2 0 - 1 - 1 $30,000 86" by scanning for common labels
    const surfaces = {};
    (raw.split('\n').map(s=>s.trim())).forEach((ln, idx, arr) => {
      const sKey = ln.match(/^(Fst|Off|Dis|Trf|AW|AQU|FM|FT|YL|MY)\b/i);
      if (sKey){
        const key = sKey[1];
        // collect a few following tokens
        const detail = [ln];
        for (let k=1;k<=3;k++){
          if (arr[idx+k] && arr[idx+k].length < 200) detail.push(arr[idx+k]);
        }
        surfaces[key] = surfaces[key] || [];
        surfaces[key].push(detail.join(' '));
      }
    });

    return {
      post, name, tag: (headerMatch && headerMatch[3]) ? headerMatch[3].trim() : '',
      raw,
      owner: owner || '',
      silks: silks || '',
      odds: odds || '',
      jockey,
      sex: sex || '',
      age: age || '',
      sire, dam, breeder, trainer,
      prime_power: prime_power || '',
      life: lifeYears.life || '',
      by_year: lifeYears.by_year || {},
      surfaces,
      stat_lines,
      workouts,
      notes,
      pastPerformances
    };
  }

  // parse an entire text and return array of horse objects
  function parseHorsePP(text){
    const blocks = splitHorseBlocks(text);
    return blocks.map(b => parseHorseBlock(b));
  }

  // Export for browser usage
  window.parseHorsePP = parseHorsePP;

  // parse a single block — accepts raw string OR { post,name,raw } and returns parsed object
  window.parseHorseBlockFull = function (blk){
    if (!blk) return null;
    try {
      // If called with raw string, wrap; if called with block object pass through
      if (typeof blk === 'string') return parseHorseBlock({ post:null, name:null, raw: blk });
      // if object has .raw, use it; else find raw in .text
      if (blk && typeof blk === 'object') {
        if (blk.raw) return parseHorseBlock(blk);
        // maybe the original parsePPTable returned minimal data and kept text in .raw already - pass it
        if (blk.text) return parseHorseBlock({ post: blk.post || null, name: blk.name || null, raw: blk.text });
        // fallback stringify
        return parseHorseBlock({ post: blk.post || null, name: blk.name || null, raw: String(blk) });
      }
      return null;
    } catch (err) {
      console.error('parseHorseBlockFull ERROR:', err);
      return null;
    }
  };

  // convenience parseText (alias)
  window.parseHorseText = parseHorsePP;

})();
