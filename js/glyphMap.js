// glyphMap.js
// Converts Brisnet encoded glyphs → readable text

export const GLYPHS = {

  // ---------- Distance Fractions ----------
  "Ë": "1/16",
  "Ë‡": "1/32",

  // ---------- Fractional Seconds ----------
  "ª": ".3",
  "¨": ".1",
  "«": ".4",
  "¯": ".7",
  "¬": ".5",

  // ---------- Margins / Beaten Lengths ----------
  "©": "1",
  "³": ".75",
  "²": ".5",
  "ƒ": "nk",    // neck

  // ---------- Path Symbols ----------
  "": "p1",
  "": "p2",
  "": "p3",

  // ---------- Surface ----------
  "Ã": "T",     // Turf (Brisnet uses a weird Ã code for turf)
  // "D" will remain dirt
  // "AW" appears as letters normally

  // ---------- Pace/Class Symbols ----------
  "™": "",
  "‘": "",
  "’": "",

  // ---------- Just in case ----------
  "": "p1",
};

// Apply glyph replacements to text
export function applyGlyphMap(text) {
  let out = text;

  for (let key in GLYPHS) {
    const val = GLYPHS[key];
    out = out.split(key).join(val);
  }

  return out;
}
