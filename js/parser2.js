// js/parser.js
// Single-file Brisnet-style parser for browser (iPad-friendly) and Node.
// Drop into your project as js/parser.js and include BEFORE pdfReader.js
// Exposes: window.parsePPTable(text), window.parseHorseBlockFull(blockOrRaw), window.parseText(text)
// Also module.exports for Node.

// --- Universal wrapper so file works both in browser and Node ---
(function (global) {
  'use strict';

  // ---------- Anchor that we used before ----------
  // post position 1-20, 1-3 spaces, horse name, "(" immediate
  const HORSE_ANCHOR = /(?:^|\n)([1-9]|1[0-9]|20)\s{1,3}([A-Za-z0-9\/'’.\-\s]+?)\s*\(/g;

  // ---------- Utility helpers ----------
  function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function trim(s) { return (s || '').toString().trim(); }
  function firstLineAfter(key, block) {
    if (!block) return '';
    // match "Key:" on same line
    const re = new RegExp('^\\s*' + escapeRegex(key) + '\\s*:\\s*(.+)$', 'im');
    const m = block.match(re);
    if (m) return trim(m[1]);
    // or key on its own line then value next
    const re2 = new RegExp('^\\s*' + escapeRegex(key) + '\\s*$[\\r\\n]+\\s*([^\\r\\n]+)', 'im');
    const m2 = block.match(re2);
    return m2 ? trim(m2[1]) : '';
  }

  // find uppercase jockey like "CIVACI SAHIN (12 1-2-0 8%)"
  function parseJockey(block) {
    if (!block) return { name: '', record: '' };
    // prefer lines with parentheses
    const m = block.match(/^([A-Z][A-Z\.\-\'\s]{2,60})\s*\(([^)]+)\)/m);
    if (m) return { name: trim(m[1]), record: trim(m[2]) };
    // fallback: uppercase single line near top
    const lines = block.split(/\r?\n/).slice(0, 10);
    for (const line of lines) {
      const mm = line.match(/^([A-Z0-9\.\s]{3,60})\s*\(([^)]+)\)/);
      if (mm) return { name: trim(mm[1]), record: trim(mm[2]) };
    }
    // fallback: any uppercase name line near top
    for (const line of lines) {
      if (/^[A-Z][A-Z\.\s]{2,40}$/.test(trim(line))) {
        // see if next line looks like record
        const next = lines[lines.indexOf(line)+1] || '';
        if (/\d+\s+\d+\-\d+\-\d+/.test(next)) return { name: trim(line), record: trim(next) };
        return { name: trim(line), record: '' };
      }
    }
    return { name: '', record: '' };
  }

  function parseOdds(block) {
    if (!block) return '';
    const m = block.match(/\b(\d+\/\d+|\d+\.\d+|\d+)\b/);
    return m ? m[1] : '';
  }

  function parseSexAge(block) {
    if (!block) return { sex: '', age: '' };
    // patterns like "B.   f.   3" or multi-line "B.\n\nf.\n\n3"
    let m = block.match(/\b([A-Z][a-zA-Z\.]{0,6})\s+([fmcb]\.)\s+(\d{1,2})\b/i);
    if (m) return { sex: m[2].replace(/\./, ''), age: m[3] };
    m = block.match(/\n\s*([A-Z][a-zA-Z\.]{0,6})\s*\n\s*([fmcb]\.)\s*\n\s*(\d{1,2})/i);
    if (m) return { sex: m[2].replace(/\./, ''), age: m[3] };
    m = block.match(/([fmcb]\.)\s*(\d{1,2})/i);
    if (m) return { sex: m[1].replace(/\./, ''), age: m[2] };
    return { sex: '', age: '' };
  }
    
  function parsePrimePower(block) {
    if (!block) return '';
    const m = block.match(/Prime Power:\s*([0-9.]+\s*(?:\([^)]*\))?)/i);
    return m ? trim(m[1]) : '';
 }

  function parseLifeYears(block) {
    const out = { life: '', by_year: {} };
    if (!block) return out;
    const lifeM = block.match(/\bLife:\s*([^\n]+)/i);
    if (lifeM) out.life = trim(lifeM[1]);
    const yearRe = /^(\s*20\d{2})\s+(.+)$/gim;
    let mm;
    while ((mm = yearRe.exec(block)) !== null) {
      out.by_year[trim(mm[1])] = trim(mm[2]);
    }
    return out;
  }

  function parseWorkouts(block) {
    if (!block) return [];
    const lines = block.split(/\r?\n/);
    const out = [];
    const wRe = /^\s*\d{2}[A-Za-z]{3}\b.*\b(?:ft|fm|my|yl|sf|gd|ft|tr\.)\b.*$/i;
    for (const l of lines) {
      if (wRe.test(l) && l.length < 200) out.push(trim(l));
    }
    return out;
  }

  // General stat lines: hold everything with %, Sire Stats, SoldAt, StudFee, or special markers
  function parseStatLines(block) {
    if (!block) return [];
    const lines = block.split(/\r?\n/);
    const out = [];
    for (const l of lines) {
      if (/%/.test(l) || /Sire Stats|Dam'sSire|SoldAt|StudFee|Prime Power|JKYw/i.test(l) || /^ñ|^×|^—|^•/.test(trim(l))) {
        out.push(trim(l));
      }
    }
    return out;
  }

  function parseNotes(block) {
    if (!block) return [];
    const lines = block.split(/\r?\n/);
    const out = [];
    for (const l of lines) {
      const t = trim(l);
      if (!t) continue;
      if (/^[\u00F1\u00D1ñ×•\*¶\u2022\-\—\+]/.test(t) || /Beaten by weaker|Failed as favorite|Won last race|Moves up in class|Finished 3rd in last race/i.test(t)) {
        out.push(t);
      }
    }
    return out;
  }
