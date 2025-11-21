// js/horseParser.js
// Node.js: parse big Brisnet-like text blocks into JSON objects.
//
// Usage (Node):
//   node parser_full.js /mnt/data/brisnet_raw.txt
//
// The parser is permissive and tries to extract as many fields as possible.

'use strict';

const fs = require('fs');
const path = require('path');

// Horse anchor regex (keeps your original anchor behavior)
const HORSE_ANCHOR = /(?:^|\n)([1-9]|1[0-9]|20)\s{1,3}([A-Za-z0-9\/'’.\-\s]+\S?)\s*\(/g;

// helper safe match
function safeMatch(re, txt, idx = 1) {
  const m = re.exec(txt);
  if (!m) return '';
  return (typeof idx === 'number') ? (m[idx] || '').trim() : m;
}

// split into blocks using HORSE_ANCHOR but preserve all text
function splitHorseBlocks(text) {
  const t = text.replace(/\r/g, '\n');
  const horses = [];
  let match;
  // collect anchors with their index
  while ((match = HORSE_ANCHOR.exec(t)) !== null) {
    horses.push({ idx: match.index, post: Number(match[1]), name: match[2].trim() });
  }
  if (!horses.length) {
    // fallback: try leading number lines in multi-line form "1\n\nName"
    const fallback = [];
    const fallbackRe = /(?:^|\n)\s*([1-9]|1[0-9]|20)\s*\n+\s*([A-Za-z0-9\/'’.\-\s]+)\s*\n/ig;
    while ((match = fallbackRe.exec(t)) !== null) {
      fallback.push({ idx: match.index, post: Number(match[1]), name: match[2].trim() });
    }
    if (fallback.length) {
      // same logic: cut blocks
      const blocks = [];
      for (let i = 0; i < fallback.length; i++) {
        const start = fallback[i].idx;
        const end = (i + 1 < fallback.length) ? fallback[i+1].idx : t.length;
        blocks.push({ post: fallback[i].post, name: fallback[i].name, raw: t.slice(start, end).trim() });
      }
      return blocks;
    }
    console.warn('No anchors found; returning entire text as single block.');
    return [{ post: null, name: null, raw: t }];
  }

  const blocks = [];
  for (let i = 0; i < horses.length; i++) {
    const start = horses[i].idx;
    const end = (i + 1 < horses.length) ? horses[i+1].idx : t.length;
    blocks.push({ post: horses[i].post, name: horses[i].name, raw: t.slice(start, end).trim() });
  }
  return blocks;
}

// text helpers
const LINE = '[^\\n]*';
function firstLineAfter(key, block) {
  const re = new RegExp('^\\s*' + escapeRegex(key) + '\\s*:??\\s*(.+)$','im');
  const m = block.match(re);
  if (m) return m[1].trim();
  // sometimes the value is on next line
  const re2 = new RegExp('^\\s*' + escapeRegex(key) + '\\s*$\\n\\s*(' + LINE + ')','im');
  const m2 = block.match(re2);
  return m2 ? m2[1].trim() : '';
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// parse jockey line like: "PRAT FLAVIEN (33 10-3-3 30%)" or "AlvaradoJ¨¨¯"
function parseJockey(block) {
  // prefer uppercase full name followed by parentheses
  const re1 = /^([A-Z][A-Z\.\-\'\s]{2,50})\s*\(([^)]+)\)/m;
  const m1 = block.match(re1);
  if (m1) return { name: m1[1].trim(), record: m1[2].trim() };

  // fallback: uppercase on a single line
  const re2 = /^([A-Z][A-Z\.\-\'\s]{2,50})\s*$/m;
  const lines = block.split('\n');
  for (let i = 0; i < 6 && i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && /^[A-Z0-9\.\s]{3,40}\s*\([^\)]*\)/.test(line)) {
      const mm = line.match(/^([A-Z0-9\.\s]{3,40})\s*\(([^)]+)\)/);
      return { name: (mm[1]||'').trim(), record: (mm[2]||'').trim() };
    }
    if (line && /^[A-Z][A-Z\.\s]{2,40}$/.test(line) && /[0-9]{1,2}\s/.test((lines[i+1]||''))) {
      // weird formats
      return { name: line.trim(), record: lines[i+1].trim() };
    }
  }
  // inline jockey after silks (common)
  const re3 = /(?:\n|\r)([A-Z][A-Z\.\s]{2,40}\([^)]+\))/;
  const m3 = block.match(re3);
  if (m3) {
    const mm = m3[1].match(/^([A-Z\.\s]+)\(([^)]+)\)/);
    if (mm) return { name: mm[1].trim(), record: mm[2].trim() };
  }
  return { name: '', record: '' };
}

// capture simple numeric odds like 8/1 or 2/1 or decimals
function parseOdds(block) {
  // try near top: first occurrence of digit/digit, or decimal prefixed by whitespace
  const m = block.match(/\b(\d+\/\d+|\d+\.\d+|\d+\/\d+)\b/);
  return m ? m[1] : '';
}

// parse sex & age: often lines like "B.\n\nf.\n\n3" or "B.   f.   3"
function parseSexAge(block) {
  // compact line
  let m = block.match(/\b([A-Z][a-zA-Z\.]{0,3})\s+([fmcb]\.)\s+(\d{1,2})\b/i);
  if (m) return { sex: (m[2]||'').replace(/\./,'').trim(), age: (m[3]||'').trim() };
  // multi-line
  m = block.match(/\n\s*([A-Z][a-zA-Z\.]{0,3})\s*\n\s*([fmcb]\.)\s*\n\s*(\d{1,2})/i);
  if (m) return { sex: (m[2]||'').replace(/\./,'').trim(), age: (m[3]||'').trim() };
  // fallback single-line with 'f.' and digit
  m = block.match(/([fmcb]\.)\s*(\d{1,2})/i);
  if (m) return { sex: (m[1]||'').replace(/\./,'').trim(), age: (m[2]||'').trim() };
  return { sex: '', age: '' };
}

// parse prime power
function parsePrimePower(block) {
  const m = block.match(/Prime Power:\s*([0-9\.]+\s*(?:\([^)]+\))?)/i);
  return m ? m[1].trim() : '';
}

// parse life and per-year lines: find "Life:" then subsequent "2025" style lines
function parseLifeYears(block) {
  const out = { life: '', by_year: {} };
  const lifeM = block.match(/\bLife:\s*([^\n]+)/i);
  if (lifeM) out.life = lifeM[1].trim();
  // find lines with year at line start
  const yearRe = /^(\s*20\d{2})[ \t]+(.+)$/gim;
  let m;
  while ((m = yearRe.exec(block)) !== null) {
    out.by_year[m[1].trim()] = m[2].trim();
  }
  return out;
}

// parse workout lines (lines that look like "08Nov CD 4f ft :49 B  90/168")
function parseWorkouts(block) {
  const lines = block.split('\n');
  const workouts = [];
  const wRe = /^\s*\d{2}[A-Za-z]{3}\b.*\b(?:ft|fm|my|yl|sf|gd|ft)\b.*$/i;
  for (const line of lines) {
    if (wRe.test(line) && line.length < 180) workouts.push(line.trim());
  }
  return workouts;
}

// parse race history: fuzzy but robust extraction of date/track/dist/times/title/speed/fin/jockey/odds/comment
function parseRaceHistory(block) {
  // isolate the date/trk... section if present
  const start = block.search(/DATE TRK/i);
  const race_text = start >= 0 ? block.slice(start) : block;
  const lines = race_text.split('\n').map(l => l.trim()).filter(l => l && l.length > 5);
  const rows = [];
  // candidate lines usually start with two-digit day-month-year token like 09Oct25 or 10Sep25KD
  const rowRe = /^(\d{2}[A-Za-z]{3}\d{2}[A-Za-z]*)\s+([A-Za-z]{2,4})?\s*([^\s]{1,6})?\s*(fm|ft|sf|my|yl|gd|sf|yl)?\s*(.*)$/i;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const m = ln.match(rowRe);
    if (m) {
      // Attempt to parse times / speed / jockey pattern by looking at this line and following tokens until blank or next date
      let chunk = ln;
      // look ahead for continuation lines that start with spaces or odd symbols
      for (let j = i+1; j < Math.min(i+5, lines.length); j++) {
        if (/^\d{2}[A-Za-z]{3}\d{2}/.test(lines[j])) break;
        if (/^(07|08|09|10|11|12|13|14|15|16|17|18|19|20)\w{0,2}\b/.test(lines[j])) break;
        chunk += ' ' + lines[j];
      }
      // extract some key tokens from chunk
      const date_raw = m[1] || '';
      const track = (chunk.match(/\b([A-Za-z]{2,4})\b/)? (chunk.match(/\b([A-Za-z]{2,4})\b/)[1]) : (m[2]||''));
      const times = (chunk.match(/(:\d{2}(\s|:)?\d{0,2}|\:\d{2})/g) || []).join(' ');
      const race_titleM = chunk.match(/™?([^\d]{3,60}?(?:-G\d|-n\d|n1x|OC|Mdn|A\d{1,3}k|A\d{1,3}k)?)\b/);
      const race_title = race_titleM ? race_titleM[1].trim() : (chunk.match(/(Mdn|OC|A\d+|Regret|BelOksIn|QEIICup|DGOaks|PuckerUp|Regret|MsGrillo|LaCmbeMemB)/i) || [''])[0];
      const speed = (chunk.match(/\b(\d{2,3})(?:\s*\/\s*\d{2,3})?\b/) || [''])[0];
      const fin = (chunk.match(/\b(\d{1,2})\b(?!.*\d{1,2}.*\$)/) || [''])[0]; // rough
      const jockey = (chunk.match(/[A-Z][A-Za-z\.\-]{2,30}J|[A-Z][A-Za-z\.\-]{2,30}(?=[A-Z]{1,3}¨|$|\s\*)/i) || [''])[0];
      const odds = (chunk.match(/(\*?\d+\.\d+|\d+\/\d+|\*\d+\.\d+|\*\d+)/) || [''])[0];
      // comment: take trailing commentary tokens
      const commentMatch = chunk.match(/(?:Comment|Comment:)\s*(.+)$/i) || chunk.match(/(Ins[^.]*|Stmbld[^.]*|Stumble[^.]*|Blinkers[^.]*|tracked[^.]*|rallied[^.]*|brush[^.]*|drift[^.]*|bid[^.]*|bpd[^.]*|clear[^.]*|split[^.]*|\bup\b.*$)/i);
      const comment = commentMatch ? commentMatch[0] : '';
      rows.push({ raw: chunk.trim(), date_raw, track, times, race_title: race_title||'', speed: speed||'', fin: fin||'', jockey: jockey||'', odds: odds||'', comment: comment||'' });
    }
  }
  return rows;
}

// parse general stat lines (lines with percent signs or "JKYw" or "Sire Stats")
function parseStatLines(block) {
  const out = [];
  const lines = block.split('\n');
  for (const line of lines) {
    if (/%/.test(line) || /JKYw|Sire Stats|Dam'sSire|SoldAt|StudFee|Prime Power|Blnkr|Blinkers|Blnkr Off|Prime Power/i.test(line)) {
      const s = line.trim();
      if (s) out.push(s);
    }
  }
  return out;
}

// notes: lines starting with special chars or 'ñ' or '×' or '•' etc.
function parseNotes(block) {
  const notes = [];
  const lines = block.split('\n');
  for (const ln of lines) {
    const trimmed = ln.trim();
    if (/^[\u00F1\u00D1ñ×•\*¶\u2022\-\—\+]/.test(trimmed) || /^ñ|^×|^•|^—|^-/i.test(trimmed)) {
      notes.push(trimmed);
    }
    // also short "× Failed as favorite in last race"
    if (/Failed as favorite|Beaten by weaker|Moves up in class|Won last race|Won last race \(.*\)/i.test(trimmed)) {
      notes.push(trimmed);
    }
  }
  return notes;
}

function parseHorseBlock(blockObj) {
  const raw = blockObj.raw;
  const headerLine = raw.split('\n', 3).slice(0,3).join(' ').slice(0,300);
  const headerMatch = headerLine.match(/^\s*(\d+)\s+(.+?)\s*(\([^\)]*\))?/);
  const post = blockObj.post || (headerMatch ? Number(headerMatch[1]) : null);
  const name = blockObj.name || (headerMatch ? headerMatch[2].trim() : '');
  const tag = headerMatch && headerMatch[3] ? headerMatch[3].trim() : '';
  const owner = firstLineAfter('Own', raw) || firstLineAfter('Owner', raw);
  const silksCandidate = (() => {
    // often the silks is on the same line after odds — try to isolate the color line between owner and jockey
    const afterOwner = raw.split(/\n/).slice(0,10).join('\n').split(owner || '').pop();
    const cand = (afterOwner || '').split('\n').map(s=>s.trim()).filter(Boolean)[0] || '';
    if (cand && /[A-Za-z]/.test(cand) && cand.length > 8 && cand.length < 200 && !/PRAT|VELAZQUEZ|CIVACI|FRANCO|RODRIGUEZ|CARMOUSCHE|ELLIOTT/i.test(cand)) return cand;
    // fallback: find first long comma-containing line near top
    const topLines = raw.split('\n').slice(0,8);
    for (const l of topLines) {
      if (/,/.test(l) && l.length > 12 && l.length < 200) return l.trim();
    }
    return '';
  })();

  const jockey = parseJockey(raw);
  const { sex, age } = parseSexAge(raw);
  const sire = firstLineAfter('Sire', raw);
  const dam = firstLineAfter('Dam', raw);
  const breeder = firstLineAfter('Brdr', raw) || firstLineAfter('Brdr:', raw);
  const trainer = firstLineAfter('Trnr', raw) || firstLineAfter('Trnr:', raw);
  const prime_power = parsePrimePower(raw);
  const lifeYears = parseLifeYears(raw);
  const workouts = parseWorkouts(raw);
  const race_history = parseRaceHistory(raw);
  const stat_lines = parseStatLines(raw);
  const notes = parseNotes(raw);
  const odds = parseOdds(raw);

  return {
    post, name, tag, raw,
    owner: owner || '',
    silks: silksCandidate || '',
    odds: odds || '',
    jockey,
    sex, age,
    sire, dam, breeder, trainer,
    prime_power,
    life: lifeYears.life, by_year: lifeYears.by_year,
    workouts, race_history, stat_lines, notes
  };
}

// main parse function
function parseText(text) {
  const blocks = splitHorseBlocks(text);
  const horses = blocks.map(b => parseHorseBlock(b));
  return horses;
}

// Node CLI loader
if (require.main === module) {
  const fpath = process.argv[2] || '/mnt/data/brisnet_raw.txt';
  if (!fs.existsSync(fpath)) {
    console.error('File not found:', fpath);
    process.exit(2);
  }
  const raw = fs.readFileSync(fpath, { encoding: 'utf8' });
  const out = parseText(raw);
  // pretty JSON output
  console.log(JSON.stringify(out, null, 2));
}

module.exports = { parseText, splitHorseBlocks, parseHorseBlock };

// ------------------------------
// CORRECT EXPORT WRAPPER
// ------------------------------
if (window.parseHorseBlockFull && window._pdfReader.parsedPP) {
  try {
    window._pdfReader.horses = window._pdfReader.parsedPP.map(h => {
      return window.parseHorseBlockFull(h);
    });

    console.log("Full Horse Parse:", window._pdfReader.horses);
  } catch (err) {
    console.error("Full horse parse error:", err);
  }
}
