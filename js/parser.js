// js/parser.js
// Layout-tuned Brisnet PP parser — tuned to the sample you provided.
// Use: const parsed = parsePPBlock(rawText);

/////////////////////
// Helpers
/////////////////////
function toSeconds(timeStr) {
  if (!timeStr) return null;
  const s = String(timeStr).trim();
  if (!s) return null;
  // Accept "1:12.34", " :22", "72.34", ":22«" (strip non-digit/colon/dot)
  const clean = s.replace(/[^\d:\.]/g, "");
  if (!clean) return null;
  if (clean.includes(":")) {
    const [m, sec] = clean.split(":");
    const mm = Number(m) || 0;
    const ss = Number(sec) || 0;
    return mm * 60 + ss;
  }
  return Number(clean);
}

// Return array of time tokens found in a string (keeps order)
function extractTimesFromString(str) {
  if (!str) return [];
  const timeRegex = /(\d+:\d{2}\.\d{1,2}|\:\d{1,2}|\d{1,3}\.\d{1,2})/g;
  const found = [];
  let m;
  while ((m = timeRegex.exec(str)) !== null) {
    found.push(m[0]);
  }
  return found;
}

// Trim and collapse spaces, but keep single-space separators
function cleanLine(line) {
  return line.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

/////////////////////
// Main parser
/////////////////////
function parsePPBlock(rawText) {
  if (!rawText || !rawText.trim()) return null;

  // Normalize newlines and split into lines
  const lines = rawText.replace(/\r/g, "").split("\n").map(l => cleanLine(l)).filter(Boolean);

  // 1) Header extraction (everything before the "DATE TRK" header line)
  let headerLines = [];
  let bodyStartIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const low = lines[i].toLowerCase();
    if (low.includes("date trk") || low.includes("date  trk") || low.includes("date trk   dist")) {
      bodyStartIndex = i + 1;
      break;
    }
    headerLines.push(lines[i]);
  }

  const headerText = headerLines.join(" ");
  // Name: look for "ppN   <Name>" pattern or first token up to "Own:" or '('
  let name = null;
  const nameMatch = headerText.match(/^pp\d+\s+(.+?)(?:\s+Own:|\s+\(|\s+Sire:|\s+Trnr:|$)/i);
  if (nameMatch) name = nameMatch[1].trim();
  else {
    // fallback: first capitalized phrase
    const m2 = headerText.match(/^[A-Z][A-Za-z'\-\. ]{2,40}/);
    if (m2) name = m2[0].trim();
  }

  // Jockey: uppercase name immediately followed by "(" with starts like "(21 0-1-4 0%)"
  let jockey = null;
  const jMatch = headerText.match(/([A-Z][A-Z\s'\-\.]{2,80}?)\s*\(\d{1,3}\s/);
  if (jMatch) {
    // ensure not to pick SIRE or other ALL CAPS: check it contains two words (first + last)
    const candidate = jMatch[1].trim();
    if ((candidate.split(/\s+/).length >= 2) && candidate.length < 40) jockey = candidate;
  } else {
    // alternate: find pattern like " JOCKEYNAME (21 0-1-4"
    const j2 = headerText.match(/([A-Z][A-Z\s]+\b)\s*\(\d/);
    if (j2) jockey = j2[1].trim();
  }

  // Trainer: "Trnr:   Name"
  let trainer = null;
  const trn = headerText.match(/Trnr:\s*([^,]+?)(?:\s+\(|\s+Prime|\s+Life|$)/i);
  if (trn) trainer = trn[1].trim();

  // Basic header object
  const header = {
    name: name || null,
    jockey: jockey || null,
    trainer: trainer || null,
    raw: headerText
  };

  // 2) Body: collect lines after "DATE TRK" header that are actual PP rows.
  const bodyLines = lines.slice(bodyStartIndex);

  // Heuristic: a PP row is a line (or two lines combined) that contains at least one time token like ":22" or "1:35"
  const ppRows = [];
  for (let i = 0; i < bodyLines.length; i++) {
    const L = bodyLines[i];
    // Some rows break to next line for comments or workouts - we'll look ahead a bit.
    const combined = [L, bodyLines[i+1] || "", bodyLines[i+2] || ""].join(" ");
    const times = extractTimesFromString(combined);
    if (times.length >= 1) {
      // Likely a PP row. We'll capture the single-line (if it contains the four call times) or combined
      // Consolidate until we hit the next line that looks like a date or a blank.
      let rowText = L;
      let j = i + 1;
      // If next line contains a workout line like "31Oct SA 5f ft 1:00« H 6/13" that's also a PP/extra; include if it has times
      while (j < bodyLines.length && extractTimesFromString(bodyLines[j]).length > 0 && /[A-Za-z]/.test(bodyLines[j])) {
        rowText += " " + bodyLines[j];
        j++;
      }
      ppRows.push(rowText.trim());
      // advance i to j-1
      i = j - 1;
    }
  }

  // 3) For each pp row, parse tokens. We expect tokens like:
  // "03Oct25SA   à 1m fm   :22   :46 1:11 1:35   ...  HernandezJJ  2.80  Comment"
  const pastPerformances = ppRows.map(rawRow => {
    const row = cleanLine(rawRow);

    // Split by 2+ spaces (column separators) — many PDF extractions have double-space between columns
    let tokens = row.split(/\s{2,}/).map(t => t.trim()).filter(Boolean);
    if (tokens.length === 1) {
      // fallback: split by single spaces (conservative)
      tokens = row.split(/\s+/).map(t => t.trim()).filter(Boolean);
    }

    // Try to find date/token that looks like "03Oct25SA" or "11Oct25SA"
    let dateToken = null, trackToken = null, distToken = null, surfaceToken = null;
    // Search tokens left-to-right for a token containing month letters and digits
    for (let k = 0; k < Math.min(tokens.length, 4); k++) {
      if (/[A-Za-z]{3}\d{2}/.test(tokens[k]) || /^\d{1,2}[A-Za-z]{3}\d{2}/.test(tokens[k])) {
        dateToken = tokens[k];
        // try next token(s) for track+distance/surface
        if (tokens[k+1]) {
          // combined example "SA   à 1m fm" -> may require splitting by single space
          const extra = tokens[k+1].split(/\s+/);
          if (extra.length >= 2) {
            trackToken = extra[0];
            distToken = extra[1];
            if (extra.length >= 3) surfaceToken = extra[2];
          } else {
            // maybe tokens[k+2] exists
            trackToken = tokens[k+1] || null;
            distToken = tokens[k+2] || null;
            surfaceToken = tokens[k+3] || null;
          }
        }
        break;
      }
    }

    // Extract time tokens from the row in sequence — assume first four time tokens are 1c,2c,str,fin (approx)
    const allTimes = extractTimesFromString(row);
    const firstCall = allTimes[0] || null;
    const secondCall = allTimes[1] || null;
    const stretchCall = allTimes[2] || null;
    const finishCall = allTimes[3] || null;

    // Jockey: try to find a token that has mixed-case or is last uppercase before odds (heuristic)
    let jockeyName = null;
    // Find token that looks like a capitalized name followed by digits or odds
    const jockeyMatch = row.match(/([A-Z][A-Za-z'\-\. ]{2,40})\s+(?:\d+\.\d{1,2}|\d{1,2}\.\d)/);
    if (jockeyMatch) jockeyName = jockeyMatch[1].trim();
    else {
      // alternate: find common short uppercase juggling "HernandezJJ" style
      const jm = row.match(/\b([A-Z][a-z]+[A-Z]{1,3})\b/);
      if (jm) jockeyName = jm[1];
    }

    // Odds: try last numeric token like 2.80 or 29.50 etc.
    const oddsMatch = row.match(/(\d{1,2}\.\d{1,2})\b(?!:)/);
    const odds = oddsMatch ? oddsMatch[1] : null;

    // Compose parsed object
    return {
      raw: row,
      dateRaw: dateToken,
      track: trackToken,
      distanceRaw: distToken,
      surface: surfaceToken,
      callsRaw: {
        first: firstCall,
        second: secondCall,
        stretch: stretchCall,
        finish: finishCall
      },
      callsSec: {
        first: toSeconds(firstCall),
        second: toSeconds(secondCall),
        stretch: toSeconds(stretchCall),
        finish: toSeconds(finishCall)
      },
      jockey: jockeyName,
      odds: odds
    };
  });

  return {
    header,
    pastPerformances
  };
}

/////////////////////
// Example usage
/////////////////////
// const parsed = parsePPBlock(yourRawText);
// console.log(JSON.stringify(parsed, null, 2));
