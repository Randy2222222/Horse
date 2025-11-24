// js/formatter.js — Final Brisnet-style layout (Blocks 1, 2, 3 + Notes + PP + Workouts)

(function (global) {
  'use strict';
  if (typeof window === 'undefined') return;

  function trim(s) { return (s == null ? '' : String(s)).trim(); }
  function padR(str, w) { str = trim(str); return str.length >= w ? str.slice(0,w) : str + " ".repeat(w-str.length); }

  // Past Performance column layout
  const PP_COLUMNS = [
    { key: 'date', label: 'DATE', width: 10 },
    { key: 'track', label: 'TRK', width: 4 },
    { key: 'dist', label: 'DIST', width: 5 },
    { key: 'rr', label: 'RR', width: 3 },
    { key: 'racetype', label: 'RACETYPE', width: 10 },
    { key: 'cr', label: 'CR', width: 3 },
    { key: 'e1', label: 'E1', width: 3 },
    { key: 'e2lp', label: 'E2/LP', width: 6 },
    { key: 'c1', label: '1c', width: 3 },
    { key: 'c2', label: '2c', width: 3 },
    { key: 'spd', label: 'SPD', width: 4 },
    { key: 'pp', label: 'PP', width: 3 },
    { key: 'st', label: 'ST', width: 3 },
    { key: 'c1p', label: '1C', width: 3 },
    { key: 'c2p', label: '2C', width: 3 },
    { key: 'str', label: 'STR', width: 3 },
    { key: 'fin', label: 'FIN', width: 3 },
    { key: 'jockey', label: 'JOCKEY', width: 14 },
    { key: 'odds', label: 'ODDS', width: 6 }
  ];

  function buildPPHeaderLine() {
    return PP_COLUMNS.map(col => padR(col.label, col.width)).join(" ");
  }

  function buildPPRow(row) {
    return PP_COLUMNS.map(col => {
      let val = "";
      switch(col.key) {
        case 'date': val = row.date; break;
        case 'track': val = row.track; break;
        case 'dist': val = row.dist; break;
        case 'spd': val = row.speed; break;
        case 'fin': val = row.fin; break;
        case 'jockey': val = row.jockey; break;
        case 'odds': val = row.odds; break;
        default: val = "";
      }
      return padR(val || "", col.width);
    }).join(" ");
  }

  // Split notes into good (ñ,+) and bad (×,-)
  function splitNotes(notes) {
    const good = [];
    const bad = [];
    notes.forEach(n => {
      const t = trim(n);
      if (!t) return;
      if (t.startsWith("ñ") || t.startsWith("+")) good.push(t);
      else if (t.startsWith("×") || t.startsWith("-") || t.startsWith("*")) bad.push(t);
    });
    return { good, bad };
  }

  function formatHorse(h) {
    const out = [];

    // ========== BLOCK 1 (Left) ==========
    let b1 = [];
    b1.push(`${h.post} ${h.name}`);
    if (h.running_style) b1.push(trim(h.running_style));
    if (h.odds) b1.push(trim(h.odds));
    if (h.silks) b1.push(trim(h.silks));
    if (h.jockey && (h.jockey.name || h.jockey.record)) {
      const j = h.jockey;
      b1.push(j.record ? `${j.name} (${j.record})` : j.name);
    }

    // ========== BLOCK 2 (Middle) ==========
    let b2 = [];
    b2.push(`${h.sex}.${" " + h.age}`);
    if (h.sire) b2.push("Sire: " + h.sire);
    if (h.dam) b2.push("Dam: " + h.dam);
    if (h.breeder) b2.push("Brdr: " + h.breeder);
    if (h.trainer) b2.push("Trnr: " + h.trainer);

    // ========== BLOCK 3 (Right) ==========
    let b3 = [];
    if (h.life_full) b3.push("Life: " + h.life_full);
    if (h.year_2025) b3.push("2025: " + h.year_2025);
    if (h.year_2024) b3.push("2024: " + h.year_2024);
    b3.push("");  // blank line before weight
    if (h.weight) b3.push(String(h.weight));

    // assemble 3 blocks side-by-side
    const maxRows = Math.max(b1.length, b2.length, b3.length);
    for (let i=0; i<maxRows; i++) {
      const c1 = b1[i] || "";
      const c2 = b2[i] || "";
      const c3 = b3[i] || "";
      out.push(padR(c1, 40) + padR(c2, 40) + c3);
    }

    // ========== NOTES BLOCK ==========
    if (Array.isArray(h.notes) && h.notes.length) {
      const { good, bad } = splitNotes(h.notes);
      const maxN = Math.max(good.length, bad.length);
      for (let i=0; i<maxN; i++) {
        out.push(padR(good[i] || "", 60) + (bad[i] || ""));
      }
    }

    // ========== PP TABLE ==========
    const pp = Array.isArray(h.pastPerformances) ? h.pastPerformances : [];
    if (pp.length) {
      out.push("");
      out.push(buildPPHeaderLine());
      pp.forEach(r => out.push(buildPPRow(r)));
    }

    // ========== WORKOUTS ==========
    if (Array.isArray(h.workouts) && h.workouts.length) {
      out.push("");
      h.workouts.forEach(w => out.push(trim(w)));
    }

    return out.join("\n");
  }

  window.formatHorse = formatHorse;
  window.formatHorses = horses => horses.map(formatHorse).join("\n\n");

})(this); 
