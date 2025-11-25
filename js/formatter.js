// formatter.js — clean version
// Takes a horse raw block (string or parsedHorse.raw) and builds the 3-column top section.

(function (global) {
  "use strict";

  function trim(s) { return String(s || "").trim(); }

  function getLines(raw) {
    return String(raw || "")
      .split(/\r?\n/)
      .map(l => trim(l))
      .filter(l => l !== "");
  }

  function findIndex(lines, fn) {
    for (let i = 0; i < lines.length; i++) {
      if (fn(lines[i])) return i;
    }
    return -1;
  }

  // ---------------- BLOCK 1 ----------------
  function block1(lines) {
    const post = lines[0] || "";
    const nameProg = lines[1] || "";
    let name = nameProg;
    let tag = "";

    const p = nameProg.indexOf("(");
    if (p !== -1) {
      name = nameProg.slice(0, p).trim();
      tag = nameProg.slice(p).trim();
    }

    const idxOwn = findIndex(lines, l => /^Own:?$/i.test(l.replace(/\s+/g, "")));
    const owner = (idxOwn !== -1) ? (lines[idxOwn + 1] || "") : "";

    const idxOdds = findIndex(lines, l => /\d+\/\d+/.test(l));
    const odds = (idxOdds !== -1) ? lines[idxOdds] : "";
    const silks = (idxOdds !== -1) ? (lines[idxOdds + 1] || "") : "";
    const jockey = (idxOdds !== -1) ? (lines[idxOdds + 2] || "") : "";

    return [
      post + "        " + name + "   " + tag,
      "          Own: " + owner,
      odds.padEnd(8, " ") + silks,
      jockey
    ];
  }

  // ---------------- BLOCK 2 ----------------
  function block2(lines) {
    const idxB = findIndex(lines, l => l === "B." || l === "B");
    const breed = (idxB !== -1)
      ? (lines[idxB] + " " + (lines[idxB + 1] || "") + " " + (lines[idxB + 2] || "")).trim()
      : "";

    const idxSire = findIndex(lines, l => /^Sire\s*:$/i.test(l.replace(/\s+/g, " ")));
    const sireName = (idxSire !== -1) ? (lines[idxSire + 1] || "") : "";
    const sireFee = (idxSire !== -1) ? (lines[idxSire + 2] || "") : "";
    const sireLine = "Sire:  " + sireName + " " + sireFee;

    const idxDam = findIndex(lines, l => /^Dam:$/i.test(l));
    const damLine = "Dam: " + ((idxDam !== -1) ? lines[idxDam + 1] : "");

    const idxBrdr = findIndex(lines, l => /^Brdr:$/i.test(l));
    const brdrLine = "Brdr:   " + ((idxBrdr !== -1) ? lines[idxBrdr + 1] : "");

    const idxTrnr = findIndex(lines, l => /^Trnr:$/i.test(l));
    const trnrLine = "Trnr:    " + ((idxTrnr !== -1) ? lines[idxTrnr + 1] : "");

    return [breed, sireLine, damLine, brdrLine, trnrLine];
  }

  // ---------------- BLOCK 3 ----------------
  function block3(lines) {
    const idxLife = findIndex(lines, l => /^Life:$/i.test(l));
    const idx2025 = findIndex(lines, l => /^2025$/i.test(l));
    const idx2024 = findIndex(lines, l => /^2024$/i.test(l));

    let lifeParts = [];
    if (idxLife !== -1 && idx2025 > idxLife) {
      lifeParts = lines.slice(idxLife + 1, idx2025);
      if (lifeParts.length) lifeParts.pop(); // drop trailing 87
    }

    let parts2025 = [];
    if (idx2025 !== -1 && idx2024 > idx2025) {
      parts2025 = lines.slice(idx2025 + 1, idx2024);
      if (parts2025.length) parts2025.pop(); // drop 86
    }

    let parts2024 = [];
    if (idx2024 !== -1) {
      parts2024 = lines.slice(idx2024 + 1, idx2024 + 7);
      if (parts2024.length) parts2024.pop(); // drop 87
    }

    const lifeLine  = "Life:    " + lifeParts.join(" ");
    const y2025Line = "2025:    " + parts2025.join(" ");
    const y2024Line = "2024:    " + parts2024.join(" ");

    // Weight 122
    const idxDate = findIndex(lines, l => /^DATE TRK/i.test(l));
    let weight = "";
    if (idxDate !== -1) {
      for (let i = idxDate - 1; i >= 0; i--) {
        if (/^\d+$/.test(lines[i])) {
          weight = lines[i];
          break;
        }
      }
    }

    const weightLine = "              " + weight;

    return [lifeLine, y2025Line, y2024Line, "", weightLine];
  }

  // ---------------- COMBINE ----------------
  function combine(b1, b2, b3) {
    const w1 = 45, w2 = 45;
    const rows = Math.max(b1.length, b2.length, b3.length);
    const out = [];

    for (let i = 0; i < rows; i++) {
      const c1 = (b1[i] || "").padEnd(w1, " ");
      const c2 = (b2[i] || "").padEnd(w2, " ");
      const c3 = (b3[i] || "");
      out.push(c1 + c2 + c3);
    }
    return out.join("\n");
  }

  // ---------------- PUBLIC ----------------
  function formatHorseTop(horseOrRaw) {
    const raw = (typeof horseOrRaw === "string")
      ? horseOrRaw
      : (horseOrRaw && horseOrRaw.raw) || "";

    const lines = getLines(raw);
    if (!lines.length) return "";

    return combine(block1(lines), block2(lines), block3(lines));
  }

  const api = { formatHorseTop };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.formatter = api;
  }

})(typeof window !== "undefined" ? window : globalThis);
