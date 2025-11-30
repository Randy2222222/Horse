// parsePP.js
// Phase 1 DEV parser — organizes decoded text into blocks we can inspect

export function parsePP(decodedText) {
  // Split into lines and clean blanks
  const lines = decodedText
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // DEV Structure (what we will show in the dev panel)
  const structure = {
    rawLines: lines,
    raceLines: [],
    ppBlocks: [],
    unknown: []
  };

  // Basic line pattern detection
  const dateRegex = /^\d{2}[A-Za-z]{3}\d{2}/;  // e.g. "09Oct25"
  const fractionRegex = /^(:?\d{1,2}:\d{2}|\:\d{2})/;
  const jockeyRegex = /[A-Za-z]+\s?[A-Za-z]+$/;

  let currentBlock = [];

  for (let line of lines) {

    // Detect the start of a new PP block
    if (dateRegex.test(line)) {
      // Close previous block
      if (currentBlock.length > 0) {
        structure.ppBlocks.push([...currentBlock]);
        currentBlock = [];
      }
      currentBlock.push(line);
      continue;
    }

    // Add lines that belong to the current block
    if (currentBlock.length > 0) {
      currentBlock.push(line);
      continue;
    }

    // Otherwise mark as unknown (we’ll categorize later)
    structure.unknown.push(line);
  }

  // Push last open block
  if (currentBlock.length > 0) {
    structure.ppBlocks.push([...currentBlock]);
  }

  return structure;
}
