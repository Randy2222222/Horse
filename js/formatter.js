// formatter.js
// Fully automatic reconstruction of the 5-block header
// from flattened Brisnet raw text.

(function (global) {
  'use strict';

  const COL_WIDTH = 28;
  const pad = (s, w) => (s + ' '.repeat(w)).slice(0, w);

  // -------------------------
  // MAIN FUNCTION
  // -------------------------
  global.buildHorseHeader = function (raw) {

    // Normalize flattened text
    const t = raw.replace(/\s+/g, ' ').trim();

    // --------------------------------------
    // EXTRACT BASIC HEADER FIELDS
    // --------------------------------------

    // Post, name, tag  (post name (P 5))
    let post = '', name = '', tag = '';
    const mHead = t.match(/^(\d+)\s+(.+?)\s+(\([^)]*\))/);
    if (mHead) {
      post = mHead[1];
      name = mHead[2].trim();
      tag  = mHead[3].trim();
    }

    // Owner
    let owner = '';
    const ownIdx = t.indexOf('Own:');
    if (ownIdx !== -1) {
      const after = t.slice(ownIdx + 4).trim();
      const stop = after.search(/\b\d+\/\d+\b|[A-Z][A-Z]+/);
      owner = stop > 0 ? after.slice(0, stop).trim() : after;
    }

    // Odds
    const oddsMatch = t.match(/\b\d+\/\d+\b/);
    const odds = oddsMatch ? oddsMatch[0] : '';

    // Jockey
    let jockeyName = '', jockeyRec = '';
    const jm = t.match(/\b([A-Z][A-Z]+(?:\s+[A-Z][A-Z]+)*)\s*\(([^)]+)\)/);
    if (jm) {
      jockeyName = jm[1].trim();
      jockeyRec  = jm[2].trim();
    }

    // Silks: between odds and jockey
    let silks = '';
    if (odds && jm) {
      const oPos = t.indexOf(odds);
      const jPos = t.indexOf(jm[0]);
      silks = t.slice(oPos + odds.length, jPos).trim();
    }

    // Sex/Age
    let sexAge = '';
    const sa = t.match(/\bB\.\s*f\.\s*\d+\b/i);
    if (sa) sexAge = sa[0];

    // Sire / Dam / Brdr / Trnr
    const extract = (from, to) => {
      const i1 = t.indexOf(from);
      if (i1 === -1) return '';
      const start = i1 + from.length;
      const end = to ? t.indexOf(to, start) : -1;
      return (end !== -1 ? t.slice(start, end) : t.slice(start)).trim().replace(/^:/, '').trim();
    };

    const sire  = extract('Sire', 'Dam:');
    const dam   = extract('Dam:', 'Brdr:');
    const brdr  = extract('Brdr:', 'Trnr:');
    const trnr  = extract('Trnr:', 'Prime Power:') || extract('Trnr:', 'Life:');

    // Life / 2025 / 2024
    let lifeLine = '', y2025 = '', y2024 = '', weight = '';

    const lifeIdx = t.indexOf('Life:');
    if (lifeIdx !== -1) {
      const tail = t.slice(lifeIdx).trim();
      const tokens = tail.split(' ');

      // Life line
      const li = tokens.indexOf('Life:');
      const lifeParts = [];
      let i = li + 1;
      while (i < tokens.length && !/^20\d{2}$/.test(tokens[i])) {
        lifeParts.push(tokens[i]);
        i++;
      }
      lifeLine = 'Life:    ' + lifeParts.join(' ');

      // Year lines
      const years = tokens.filter(x => /^20\d{2}$/.test(x));
      if (years.length > 0) {
        const yi = tokens.indexOf(years[0]);
        const yParts = [];
        let j = yi + 1;
        while (j < tokens.length && !/^20\d{2}$/.test(tokens[j])) {
          yParts.push(tokens[j]);
          j++;
        }
        y2025 = years[0] + ':    ' + yParts.join(' ');
      }
      if (years.length > 1) {
        const yi2 = tokens.indexOf(years[1]);
        const y2Parts = [];
        let k = yi2 + 1;
        while (k < tokens.length && !/^20\d{2}$/.test(tokens[k])) {
          y2Parts.push(tokens[k]);
          k++;
        }
        y2024 = years[1] + ':    ' + y2Parts.join(' ');
      }
    }

    // Weight = last 3-digit number before surfaces like AQU Fst etc.
    const w = t.match(/(\d{3})(?=\s+(AQU|Fst|Off|Trf|AW|Dis))/);
    weight = w ? w[1] : '';

    // -----------------------------------
    // BUILD 5 BLOCKS (5 LINES EACH)
    // -----------------------------------

    const b1 = [
      `${post}        ${name}   ${tag}`.trim(),
      `          Own: ${owner}`.trim(),
      `${odds.padEnd(8, ' ')}${silks}`.trim(),
      `${jockeyName} (${jockeyRec})`.trim(),
      ''
    ];

    const b2 = [
      sexAge,
      `Sire:  ${sire}`.trim(),
      `Dam:   ${dam}`.trim(),
      `Brdr:  ${brdr}`.trim(),
      `Trnr:  ${trnr}`.trim()
    ];

    const b3 = [
      lifeLine,
      y2025,
      y2024,
      weight,
      ''
    ];

    const b4 = ['', '', '', '', ''];
    const b5 = ['', '', '', '', ''];

    // -----------------------------------
    // FORMAT INTO FINAL 5-COLUMN HEADER
    // -----------------------------------
    const lines = [];
    for (let i = 0; i < 5; i++) {
      lines.push(
        pad(b1[i], COL_WIDTH) +
        pad(b2[i], COL_WIDTH) +
        pad(b3[i], COL_WIDTH) +
        pad(b4[i], COL_WIDTH) +
        pad(b5[i], COL_WIDTH)
      );
    }

    return lines.join('\n');
  };

})(typeof window !== 'undefined' ? window : globalThis);
