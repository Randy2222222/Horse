// js/formatter.js
// Formatter for parsed Brisnet horses (browser-only).
// Expects horse objects from parseText / parseHorseBlockFull in parser.js

(function (global) {
  'use strict';

  if (typeof window === 'undefined') {
    // browser only – do nothing in Node
    return;
  }

  // ---------- Small helpers ----------
  function trim(s) {
    return (s == null ? '' : String(s)).trim();
  }

  function padR(str, width) {
    str = str == null ? '' : String(str);
    if (str.length >= width) return str.slice(0, width);
    return str + ' '.repeat(width - str.length);
  }

  function padL(str, width) {
    str = str == null ? '' : String(str);
    if (str.length >= width) return str.slice(str.length - width);
    return ' '.repeat(width - str.length) + str;
  }

  // ---------- Column layout for PP table ----------
  // We don't have all these fields parsed yet, but we keep the full Brisnet header.
  // Missing values will just appear blank for now and we can fill them in later.
  const PP_COLUMNS = [
    { key: 'date',     label: 'DATE',    width: 10 }, // 09Oct25Baq
    { key: 'track',    label: 'TRK',     width: 4  }, // AQU, Sar, etc.
    { key: 'dist',     label: 'DIST',    width: 5  }, // 1ˆ, 1m, 6f
    { key: 'rr',       label: 'RR',      width: 3  }, // not parsed yet
    { key: 'racetype', label: 'RACETYPE',width: 10 }, // G3, Mdn 90k etc.
    { key: 'cr',       label: 'CR',      width: 3  }, // not parsed yet
    { key: 'e1',       label: 'E1',      width: 3  }, // not parsed yet
    { key: 'e2lp',     label: 'E2/ LP',  width: 7  }, // not parsed yet
    { key: 'c1',       label: '1c',      width: 3  }, // not parsed yet
    { key: 'c2',       label: '2c',      width: 3  }, // not parsed yet
    { key: 'spd',      label: 'SPD',     width: 4  }, // speed (we have this)
    { key: 'pp',       label: 'PP',      width: 3  }, // not parsed yet
    { key: 'st',       label: 'ST',      width: 3  }, // not parsed yet
    { key: 'c1p',      label: '1C',      width: 3  }, // not parsed yet
    { key: 'c2p',      label: '2C',      width: 3  }, // not parsed yet
    { key: 'str',      label: 'STR',     width: 3  }, // not parsed yet
    { key: 'fin',      label: 'FIN',     width: 3  }, // we have this
    { key: 'jockey',   label: 'JOCKEY',  width: 14 }, // we have this
    { key: 'odds',     label: 'ODDS',    width: 6  }  // we have this
    // Top Finishers + Comment will be rendered after columns as free text
  ];

  function buildPPHeaderLine() {
    const cols = PP_COLUMNS.map(col => padR(col.label, col.width));
    // Brisnet footer of the header row: "Top Finishers Comment"
    cols.push('Top Finishers Comment');
    return cols.join(' ');
  }

  function buildPPRowLine(ppRow) {
    const cols = [];

    // Map our parsed PP row to the columns we have
    // Anything we don't have yet is left blank.
    const date   = trim(ppRow.date);
    const track  = trim(ppRow.track);
    const dist   = trim(ppRow.dist);
    const speed  = trim(ppRow.speed);
    const fin    = trim(ppRow.fin);
    const jockey = trim(ppRow.jockey);
    const odds   = trim(ppRow.odds);
    const comment = trim(ppRow.comment || '');

    // Build columns in order
    PP_COLUMNS.forEach(col => {
      let value = '';
      switch (col.key) {
        case 'date':   value = date;   break;
        case 'track':  value = track;  break;
        case 'dist':   value = dist;   break;
        case 'spd':    value = speed;  break;
        case 'fin':    value = fin;    break;
        case 'jockey': value = jockey; break;
        case 'odds':   value = odds;   break;
        default:       value = '';     break; // we’ll fill these later when parser supports them
      }
      cols.push(padR(value, col.width));
    });

    // After columns, append the comment (Top Finishers + trip comment etc.)
    if (comment) {
      cols.push(comment);
    }

    return cols.join(' ');
  }

  // ---------- Core formatter for a single horse ----------
  function formatHorse(horse) {
    if (!horse) return '';

    const lines = [];

    // ========== HEADER (Post, Name, Tag) ==========
    // Example: "1 Scythian (P 5)"
    const headerParts = [];
    if (horse.post != null) headerParts.push(String(horse.post));
    if (horse.name) headerParts.push(trim(horse.name));
    if (horse.tag)  headerParts.push(trim(horse.tag));
    lines.push(headerParts.join(' '));

    // Odds + owner/silks like Brisnet
    // e.g. "Own: Goichman Lawrence"
    if (horse.owner) {
      lines.push('Own: ' + trim(horse.owner));
    }
    if (horse.odds) {
      // Morning line odds line – Brisnet includes them near the top.
      // Example: "8/1 Red And Purple Diamonds, Red Sleeves..."
      // We don’t try to rebuild the exact silks sentence here yet, but we keep odds visible.
      lines.push(trim(horse.odds));
    }
    if (horse.silks) {
      lines.push(trim(horse.silks));
    }

    // Jockey line: "CIVACI SAHIN (12 1-2-0 8%)"
    if (horse.jockey && (horse.jockey.name || horse.jockey.record)) {
      const jName   = trim(horse.jockey.name || '');
      const jRecord = trim(horse.jockey.record || '');
      const jLine   = jRecord ? (jName + ' (' + jRecord + ')') : jName;
      if (jLine) lines.push(jLine);
    }

    // Sex/Age + breeding line
    // Example: "B. f. 3 Sire : Tiz the Law ... Dam: ... Brdr: ... Trnr: ..."
    const parts = [];
    if (horse.sex || horse.age) {
      // e.g. "f 3"
      parts.push((horse.sex || '').replace(/\./g, '') + '.');
      if (horse.age) parts.push(String(horse.age));
    }
    if (horse.sire)   parts.push('Sire : ' + trim(horse.sire));
    if (horse.dam)    parts.push('Dam: ' + trim(horse.dam));
    if (horse.breeder) parts.push('Brdr: ' + trim(horse.breeder));
    if (horse.trainer) parts.push('Trnr: ' + trim(horse.trainer));
    if (parts.length) lines.push(parts.join(' '));

    // Prime Power + Life + by-year + surfaces (just printed as-is from parser)
    if (horse.prime_power) {
      lines.push('Prime Power: ' + trim(horse.prime_power));
    }
    if (horse.life) {
      lines.push('Life: ' + trim(horse.life));
    }
    // Yearly breakdown
    if (horse.by_year) {
      Object.keys(horse.by_year).forEach(yearKey => {
        lines.push(yearKey + ' ' + trim(horse.by_year[yearKey]));
      });
    }
    // Surfaces (AQU, Fst, Off, Trf, AW, etc.)
    if (horse.surfaces) {
      Object.keys(horse.surfaces).forEach(sKey => {
        const arr = horse.surfaces[sKey] || [];
        arr.forEach(line => lines.push(line));
      });
    }

    // Stat lines (jockey/trainer stats, sire stats, dam stats, etc.)
    if (Array.isArray(horse.stat_lines) && horse.stat_lines.length) {
      horse.stat_lines.forEach(l => {
        lines.push(trim(l));
      });
    }

    // ========== TOP NOTES (unicode block before PP header) ==========
    // You told me: these are the ñ / × / etc lines just above the PP header.
    // We print them exactly as parsed, no extra labels.
    if (Array.isArray(horse.notes) && horse.notes.length) {
      horse.notes.forEach(l => {
        lines.push(trim(l));
      });
    }

    // ========== PAST PERFORMANCE TABLE ==========
    const pp = Array.isArray(horse.pastPerformances) ? horse.pastPerformances : [];

    if (pp.length) {
      // Blank separator line (Brisnet usually has some white space before header)
      lines.push('');

      // Full PP header line (all columns kept for now)
      lines.push(buildPPHeaderLine());

      // Each PP row
      pp.forEach(row => {
        lines.push(buildPPRowLine(row));
      });
    }

    // ========== WORKOUTS ==========
    if (Array.isArray(horse.workouts) && horse.workouts.length) {
      // Workout strings already look Brisnet-like, so just print them as-is.
      horse.workouts.forEach(w => {
        lines.push(trim(w));
      });
    }

    // Join everything into the final block
    return lines.join('\n');
  }

  // Format an array of horses into one big text block
  function formatHorses(horses) {
    if (!Array.isArray(horses)) return '';
    return horses.map(formatHorse).join('\n\n');
  }

  // Expose to browser
  window.formatHorse   = formatHorse;
  window.formatHorses  = formatHorses;

})(this);
