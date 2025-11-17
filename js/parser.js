// js/parser.js
// Brisnet PDF text parser (best-effort) for your analyzer
// Requires: CALL_TABLE (from js/calls.js) to be loaded first.
// Usage: call parsePdfText(pdfText) or runParserOnExtractedText() after the PDF text has been extracted.

// Quick ready log
console.log("parser.js loaded");

// ---------------------- Normalizers ----------------------
function unicodeFractionsToText(s) {
  if (!s) return s;
  return s
    .replace(/\u00BC/g, " 1/4") // ¼
    .replace(/\u00BD/g, " 1/2") // ½
    .replace(/\u00BE/g, " 3/4"); // ¾
}

function stripWeirdMarks(s) {
  if (!s) return s;
  // remove non-printing/box characters commonly found in PDF-to-text dumps
  return s.replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, " ")
          .replace(/[¨©«ª°‡†]/g, " ")
          .replace(/[^\x09\x0A\x0D\x20-\x7E\u00BC\u00BD\u00BE]/g, " ");
}

function normalizeWhitespace(s) {
  return s.replace(/\r\n/g, "\n").replace(/\t/g, " ").replace(/[ \u00A0]+/g, " ").trim();
}

// Normalizes an incoming distance string to the exact format used in CALL_TABLE.
// Examples:
//  "6½" -> "6 1/2"
//  "6f"  -> "6"
//  "1m" or "1 Mile" -> "1 m"
//  "1m70" -> "1 m 70 yds"
function normalizeDistForLookup(d) {
  if (!d) return "";
  let t = String(d).toLowerCase().trim();

  // sanitize and remove trailing punctuation
  t = t.replace(/[.,;:]$/g, "").trim();

  // unicode fractions
  t = unicodeFractionsToText(t);

  // common PDF noise
  t = t.replace(/\s*feet\b/g, " ");
  t = t.replace(/\s*yds?\b/g, " yds");
  t = t.replace(/\s*miles?\b/g, " m");
  t = t.replace(/\s+mile\b/g, " m");
  t = t.replace(/\s*ft\b/g, " ");
  t = t.replace(/\s*fm\b/g, " "); // sometimes shows "1m fm" or similar

  // Convert "6f" -> "6"
  t = t.replace(/(\d+)\s*f\b/g, "$1");

  // Normalize a compact 1m70 (or 1m70y) into "1 m 70 yds"
  t = t.replace(/^(\d+)\s*m\s*70\s*yds?/g, "$1 m 70 yds");
  t = t.replace(/^(\d+)m70\b/, "$1 m 70 yds");
  t = t.replace(/^(\d+)m\b/, "$1 m"); // "1m" -> "1 m"

  // Turn "6 1/2" stays as is (we want "6 1/2")
  // collapse whitespace
  t = t.replace(/\s+/g, " ").trim();

  return t;
}

// find row in CALL_TABLE that matches distance (uses normalizeDistForLookup)
function findCallRow(distanceLabel) {
  if (typeof CALL_TABLE === "undefined") {
    console.warn("CALL_TABLE not found (parser needs js/calls.js).");
    return null;
  }
  if (!distanceLabel) return CALL_TABLE[0];

  const want = normalizeDistForLookup(distanceLabel);
  if (!want) return CALL_TABLE[0];

  for (const row of CALL_TABLE) {
    if (normalizeDistForLookup(row.dist) === want) return row;
  }

  // If no exact match, try numeric closests (compare whole-mile/furlong numbers)
  const wantNum = parseFloat(want);
  if (!isNaN(wantNum)) {
    let best = CALL_TABLE[0];
    let bestDiff = Infinity;
    for (const r of CALL_TABLE) {
      const rn = parseFloat(String(r.dist).replace(/[^\d.]/g, ""));
      if (!isNaN(rn)) {
        const diff = Math.abs(rn - wantNum);
        if (diff < bestDiff) { bestDiff = diff; best = r; }
      }
    }
    return best;
  }

  return CALL_TABLE[0];
}

// ---------------------- Extractors ----------------------

// Attempt to find a single race distance string in the PDF text (heuristic)
function extractRaceDistance(pdfText) {
  if (!pdfText) return null;
  // common patterns found in your pasted sample: "1 Mile", "1m", "6½", "6 1/2" etc.
  // We'll run a few regexes to find the first plausible distance token.
  const lookPatterns = [
    /\b(\d+\s?½|\d+\s?1\/2|\d+\s?1\/4|\d+\s?3\/4)\b/g,   // unicode fractions or typed fractions
    /\b(\d+\s?m(?:\s?\d+\s?yds?)?)\b/gi,                // "1 m", "1m70", "1 m 70 yds"
    /\b(\d+\s?f)\b/gi,                                  // "6f", "7f"
    /\b(\d+\s?\/\s?16|\d+\s?1\/16|\d+\s?1\/8)\b/gi,     // fractional mile notations
    /\b(\d+(?:\.\d+)?\s?f?)\b/g                         // fallback numbers with optional f
  ];

  for (const pat of lookPatterns) {
    const m = pdfText.match(pat);
    if (m && m.length) {
      // pick a candidate that appears near "Race" or "Mdn" or the header if possible
      for (const cand of m) {
        const norm = normalizeDistForLookup(cand);
        if (norm) return norm;
      }
      return normalizeDistForLookup(m[0]);
    }
  }
  return null;
}

// Split pdf text into horse blocks using the "ppN" markers
function splitIntoHorseBlocks(pdfText) {
  if (!pdfText) return [];
  // Normalize line breaks and ensure 'pp' tokens are isolated
  const txt = pdfText.replace(/\r\n/g, "\n");
  // We'll create a marker: replace "pp" followed by number with a unique splitter
  // The PDF seems to use 'pp1', 'pp2', etc. We'll match case-insensitive and with possible whitespace.
  const marker = "__PP_SPLIT__";
  const replaced = txt.replace(/pp\s*(\d{1,2})/gi, match => `\n${marker}${match.toLowerCase()}\n`);
  // Split on marker and drop anything before the first marker (header)
  const parts = replaced.split(marker).map(s => s.trim()).filter(Boolean);
  // Each part now starts with "ppX ..." or some header; filter to parts that actually begin with 'pp'
  const horseParts = parts.filter(p => /^pp\s*\d{1,2}/i.test(p));
  return horseParts;
}

// Extract a clean horse name (best-effort), jockey, and a final time from a horse block
function parseHorseBlock(blockText) {
  const lines = blockText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const joined = lines.join(" ");
  const result = {
    raw: blockText,
    idMarker: null, // pp# token
    name: null,
    jockey: null,
    trainer: null,
    owner: null,
    finalTimeS: null,
    callLengths: { first: null, second: null, str: null, fin: null },
    workouts: []
  };

  // idMarker: pick the leading "ppX"
  const mpp = joined.match(/^pp\s*(\d{1,2})/i);
  if (mpp) result.idMarker = "pp" + mpp[1];

  // find a probable name: Typically the name appears just after pp# and before parentheses or (S 0)
  const nameMatch = joined.match(/^pp\s*\d{1,2}\s+([A-Z0-9][A-Za-z0-9'\-\. ]{2,80}?)(?:\s*\(|\s{2,}|\s+Own:|\s+Life:|\s+Sire:|\,)/i);
  if (nameMatch) result.name = nameMatch[1].trim();

  // jockey: look for uppercase name in parentheses, or after name line "JOCKEY" or known caps with last name
  let jk = null;
  // pattern "  JOCKEYNAME (## #-#-# #-%)" often appears like "HERNANDEZ JUAN J (18 3-3-3 17%)"
  const jkMatch = joined.match(/([A-Z][A-Z' ]{2,40}[A-Z])\s*\(\d{1,3}\s*\d?[-\d\s]*%?\)/);
  if (jkMatch) jk = jkMatch[1].trim();
  if (!jk) {
    // fallback: find " JockeyName " followed by parenthesis with stats
    const j2 = joined.match(/([A-Z][A-Za-z'\-]{2,40}\s+[A-Z][A-Za-z'\-]{1,40})\s*\(\d/);
    if (j2) jk = j2[1].trim();
  }
  result.jockey = jk || null;

  // trainer (Trnr:) and owner (Own:)
  const tr = joined.match(/Trnr:\s*([A-Za-z0-9 \.\-']{2,60})/i);
  if (tr) result.trainer = tr[1].trim();
  const ow = joined.match(/Own:\s*([A-Za-z0-9 \.\-']{2,60})/i);
  if (ow) result.owner = ow[1].trim();

  // final time: look for time tokens like 1:35.12 OR 95.12
  const timeRx = /(\d+:\d{2}\.\d{1,2}|\d{1,3}\.\d{1,2})/g;
  const tAll = joined.match(timeRx) || [];
  if (tAll.length) {
    // The final time is often the last time token in the block (best-effort)
    const finalRaw = tAll[tAll.length - 1];
    result.finalTimeS = toSeconds(finalRaw);
  }

  // Extract call-length tokens (we look for three successive length tokens near the PP lines)
  // Look for patterns like "4-4-3-1" or "4 4 3 1" or "4 1/2 4 3"
  const callPattern = /(\d+(?:\.\d+)?(?:\s*\d\/\d+)?|(?:\d+\s*\/\s*\d+)|\b(?:hd|nk|nose|shd)\b)/gi;

  // find sequences of three or four length tokens in the block (scan lines)
  for (const ln of lines.slice(0, 10)) { // examine first few lines where call strings usually live
    const toks = ln.match(callPattern);
    if (toks && toks.length >= 3) {
      // assign first three tokens to 1st, 2nd, str (fin is race finish margin or 0)
      const parsed = toks.map(t => parseLengthToken(t));
      if (parsed.length >= 1) result.callLengths.first = parsed[0];
      if (parsed.length >= 2) result.callLengths.second = parsed[1];
      if (parsed.length >= 3) result.callLengths.str = parsed[2];
      break;
    }

    // dash pattern "4-4-3-1"
    const dash = ln.match(/(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)-?(\d+(?:\.\d+)?)?/);
    if (dash) {
      result.callLengths.first = parseLengthToken(dash[1]);
      result.callLengths.second = parseLengthToken(dash[2]);
      result.callLengths.str = parseLengthToken(dash[3]);
      break;
    }
  }

  // parse workouts: pick lines that look like "04Oct Dmr 4f ft :49 H"
  const wkRx = /(?:\d{2}[A-Za-z]{3}\d{2,4}|\d{2}\/\d{2}\/\d{2,4}|\d{2}[A-Za-z]{3}\d{2})[\s\S]{0,60}?[:\d\.\:]{3,}/g;
  const wks = blockText.match(wkRx);
  if (wks && wks.length) {
    result.workouts = wks.slice(0, 8).map(w => w.trim());
  }

  return result;
}

// small util: parse length token strings into numeric lengths (fractions handled)
function parseLengthToken(tok) {
  if (tok == null) return null;
  const raw = String(tok).trim().toLowerCase();
  // unicode fractions to text
  const f = unicodeFractionsToText(raw);
  const clean = f.replace(/\s+/g, "");
  // mixed number "1 1/2"
  const mixed = raw.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  // fraction only
  const frac = raw.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  // plain decimal or integer
  const num = Number(raw.replace(/[^\d\.]/g, ""));
  if (!isNaN(num)) return num;
  // tokens like hd, nk
  const tokens = { hd: 0.1, head: 0.1, nk: 0.25, neck: 0.25, shd: 0.2, nose: 0.05 };
  if (tokens[raw]) return tokens[raw];
  return null;
}

// seconds converter
function toSeconds(timestr) {
  if (!timestr) return null;
  const s = String(timestr).trim();
  if (s.indexOf(":") >= 0) {
    const [m, rest] = s.split(":");
    const mm = Number(m) || 0;
    const ss = Number(rest) || 0;
    return mm * 60 + ss;
  }
  return Number(s);
}

// ------------------ Main Parser Entrypoints ------------------

// Parse a full plain-text PDF dump and build structured RACE_DATA
function parsePdfText(pdfRawText) {
  if (!pdfRawText) return null;

  // 1) cleanup
  let t = stripWeirdMarks(pdfRawText);
  t = normalizeWhitespace(t);

  // 2) normalize some repeated markers to consistent "pp1" casing
  t = t.replace(/\bPP\s*(\d{1,2})\b/gi, "pp$1"); // PP -> pp
  t = t.replace(/\bpp\.(\d{1,2})\b/gi, "pp$1");

  // 3) find race distance (best-effort)
  const detectedDistance = extractRaceDistance(t);
  const callRow = findCallRow(detectedDistance);

  // 4) split into horse blocks
  const horseBlocks = splitIntoHorseBlocks(t);
  const horses = horseBlocks.map(b => parseHorseBlock(b));

  // 5) Build the RACE_DATA object
  const RACE_DATA = {
    rawText: pdfRawText,
    cleanedText: t,
    detectedDistance: detectedDistance,
    callRow: callRow,
    horses: horses
  };

  // store globally so analyzer can use it
  window.RACE_DATA = RACE_DATA;
  console.log("parser: built RACE_DATA:", {
    distance: detectedDistance,
    callRowName: callRow ? callRow.dist : null,
    horsesCount: horses.length
  });

  return RACE_DATA;
}

// convenience for analyzer: if you previously stored extracted text at window._pdfText
function runParserOnExtractedText() {
  const txt = window._pdfText || "";
  if (!txt) {
    console.warn("parser.runParserOnExtractedText: no text found at window._pdfText");
    return null;
  }
  return parsePdfText(txt);
}

// expose functions
window.parser = {
  parsePdfText,
  runParserOnExtractedText,
  normalizeDistForLookup,
  findCallRow,
  splitIntoHorseBlocks,
  parseHorseBlock
};

// ready
console.log("parser.js ready");
