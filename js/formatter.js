// formatter.js — Brisnet-style 3-column top section

(function (global) {
  "use strict";

  function trim(x) { return String(x || "").trim(); }

  function find(lines, test) {
    for (let i = 0; i < lines.length; i++) {
      if (test(trim(lines[i]))) return i;
    }
    return -1;
  }

  function buildBlock1(lines) {
    // Post number
    const idxPost = find(lines, t => /^\d+$/.test(t));
    const post = trim(lines[idxPost]);

    // Name + (P #)
    const nameProg = trim(lines[idxPost + 1]); // "Scythian (P 5)"
    let name = nameProg, prog = "";
    const pIndex = nameProg.indexOf("(");
    if (pIndex !== -1) {
      name = nameProg.slice(0, pIndex).trim();
      prog = nameProg.slice(pIndex).trim();
    }

    // Owner
    const idxOwn = find(lines, t => /^Own:?$/.test(t.replace(/\s+/g, "")));
    const owner = trim(lines[idxOwn + 1]);

    // Odds + silks
    const idxOdds = find(lines, t => /\d+\/\d+/.test(t));
    const odds = trim(lines[idxOdds]);
    const silks = trim(lines[idxOdds + 1]);

    // Jockey
    const jockey = trim(lines[idxOdds + 2]);

    // EXACT Brisnet spacing from your sample:
    const line1 = post + "        " + name + "   " + prog;   // 8 spaces, 3 spaces
    const line2 = "          Own: " + owner;                // 10 spaces
    const line3 = odds.padEnd(8, " ") + silks;              // odds padded
    const line4 = jockey;

    return [ line1, line2, line3, line4 ];
  }

  function buildBlock2(lines) {
    // Gender, color, age: B. / f. / 3
    const iB = find(lines, t => t === "B." || t === "B");
    const breedLine = trim(lines[iB]) + " " + trim(lines[iB+1]) + " " + trim(lines[iB+2]);

    // Sire:  Tiz the Law... $30,000
    const iSire = find(lines, t => /^Sire\s*:/.test(t));
    const sire = trim(lines[iSire + 1]);
    const fee  = trim(lines[iSire + 2]);
    const sireLine = "Sire:  " + sire + " " + fee;

    // Dam
    const iDam = find(lines, t => /^Dam:/.test(t));
    const dam = trim(lines[iDam + 1]);
    const damLine = "Dam: " + dam;

    // Breeder
    const iBr = find(lines, t => /^Brdr:/.test(t));
    const brdr = trim(lines[iBr + 1]);
    const brdrLine = "Brdr:   " + brdr;       // spacing EXACTLY as you typed

    // Trainer
    const iTr = find(lines, t => /^Trnr:/.test(t));
    const trnr = trim(lines[iTr + 1]);
    const trnrLine = "Trnr:    " + trnr;      // spacing EXACTLY as you typed

    return [
      breedLine,
      sireLine,
      damLine,
      brdrLine,
      trnrLine
    ];
  }

  function buildBlock3(lines) {
    // Life block
    const iLife = find(lines, t => /^Life:$/.test(t));
    const L = [
      trim(lines[iLife+1]),
      trim(lines[iLife+2]),
      trim(lines[iLife+3]),
      trim(lines[iLife+4]),
      trim(lines[iLife+5])
    ]; // omit the last number (e.g., 87)
    const lifeLine = "Life:    " + L.join(" ");

    // 2025 block
    const i2025 = find(lines, t => /^2025$/.test(t));
    const Y25 = [
      trim(lines[i2025+1]),
      trim(lines[i2025+2]),
      trim(lines[i2025+3]),
      trim(lines[i2025+4]),
      trim(lines[i2025+5])
    ]; // omit trailing number (86)
    const y25Line = "2025:    " + Y25.join(" ");

    // 2024 block
    const i2024 = find(lines, t => /^2024$/.test(t));
    const Y24 = [
      trim(lines[i2024+1]),
      trim(lines[i2024+2]),
      trim(lines[i2024+3]),
      trim(lines[i2024+4]),
      trim(lines[i2024+5])
    ];
    const y24Line = "2024:    " + Y24.join(" ");

    // Weight centered-ish
    const weightLine = "              122";

    return [
      lifeLine,
      y25Line,
      y24Line,
      "",
      weightLine
    ];
  }

  // ⭐ THIS is the Brisnet-style 3-column layout you asked for
  function combineThreeBlocksSideBySide(b1, b2, b3) {
    // Brisnet PDF widths based on your screenshot
    const col1 = 45;
    const col2 = 45;

    const max = Math.max(b1.length, b2.length, b3.length);
    const out = [];

    for (let i = 0; i < max; i++) {
      const c1 = (b1[i] || "").padEnd(col1, " ");
      const c2 = (b2[i] || "").padEnd(col2, " ");
      const c3 = (b3[i] || "");
      out.push(c1 + c2 + c3);
    }
    return out.join("\n");
  }

  function formatHorseTopSection(rawLines) {
    const b1 = buildBlock1(rawLines);
    const b2 = buildBlock2(rawLines);
    const b3 = buildBlock3(rawLines);
    return combineThreeBlocksSideBySide(b1, b2, b3);
  }

  const api = { formatHorseTopSection };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.formatter = api;
  }

})(typeof window !== "undefined" ? window : globalThis);
