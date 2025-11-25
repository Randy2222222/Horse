// formatter.js  -- strict Brisnet 5-block header layout

function padRight(str, width) {
  str = (str || "").toString();
  if (str.length >= width) return str.slice(0, width);
  return str + " ".repeat(width - str.length);
}

function formatHorseHeader(h) {
  // Column widths (strict Brisnet)
  const W1 = 44;  // Identity block
  const W2 = 24;  // Pedigree block
  const W3 = 18;  // Performance block
  const W4 = 12;  // Prime Power block
  const W5 = 10;  // Surface Stats block

  // ----- BLOCK 1: Identity -----
  const block1 = [
    `${h.post} ${h.name} ${h.tag || ""}`.trim(),
    h.owner || "",
    h.odds || "",
    h.silks || "",
    `${h.jockey?.name || ""} ${h.jockey?.record || ""}`.trim()
  ];

  // ----- BLOCK 2: Pedigree -----
  const block2 = [
    `${h.sex ? h.sex.toUpperCase() + "." : ""}  ${h.age || ""}`.trim(),
    `Sire: ${h.sire || ""}`.trim(),
    `Dam: ${h.dam || ""}`.trim(),
    `Brdr: ${h.breeder || ""}`.trim(),
    `Trnr: ${h.trainer || ""}`.trim()
  ];

  // ----- BLOCK 3: Life + Years -----
  const block3 = [];
  if (h.life) block3.push(`Life: ${h.life}`);
  for (const y of Object.keys(h.by_year)) {
    block3.push(`${y}: ${h.by_year[y]}`);
  }

  // ----- BLOCK 4: Prime Power -----
  const block4 = [ h.prime_power ? `PP ${h.prime_power}` : "" ];

  // ----- BLOCK 5: Surface Stats (EMPTY for now) -----
  const block5 = [ "" ];

  // Determine max rows among blocks (usually 5)
  const maxRows = Math.max(block1.length, block2.length, block3.length, block4.length, block5.length);

  let lines = [];

  for (let i = 0; i < maxRows; i++) {
    const col1 = padRight(block1[i] || "", W1);
    const col2 = padRight(block2[i] || "", W2);
    const col3 = padRight(block3[i] || "", W3);
    const col4 = padRight(block4[i] || "", W4);
    const col5 = padRight(block5[i] || "", W5);

    lines.push(col1 + col2 + col3 + col4 + col5);
  }

  return lines.join("\n");
}

// Export for browser
window.formatHorseHeader = formatHorseHeader;
