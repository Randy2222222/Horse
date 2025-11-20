// js/parser.js
// -----------------------------------------------------------
// SIMPLE HORSE BLOCK SPLITTER
// Anchor: "PP HorseName (STYLE DIGIT)"
// STYLE = E | P | S | E/P
// DIGIT = 1..6
// -----------------------------------------------------------

(function () {

  // ✔ Runstyle anchor regex: (E 5) or (P 3) or (S 2) or (E/P 4)
  const STYLE_RE = /\((E|P|S|E\/P)\s([1-6])\)/;

  // ✔ Full horse line anchor:
  //    <PP 1–20>  <word(s)>  (STYLE DIGIT)
  const HORSE_ANCHOR_RE = /^([1-9]|1[0-9]|20)\s+(.+?)\s+\((E|P|S|E\/P)\s([1-6])\)/;

  // --------------------------------------------------------------------
  // MAIN FUNCTION
  // --------------------------------------------------------------------
  function parsePPTable(fullText) {

    if (!fullText || !fullText.length) return [];

    // Normalize the text — remove NBSP and unify newlines
    let text = fullText.replace(/\u00A0/g, " ").replace(/\r/g, "\n");

    let lines = text.split("\n").map(l => l.trim());

    let horses = [];
    let curr = null;

    for (let line of lines) {

      // ✔ NEW HORSE detected
      let m = line.match(HORSE_ANCHOR_RE);
      if (m) {
        // If we were inside a horse block, push it
        if (curr) horses.push(curr);

        curr = {
          post: Number(m[1]),
          name: m[2].trim(),
          runstyle: m[3],
          styleDigit: Number(m[4]),
          raw: line + "\n"
        };

        continue;
      }

      // ✔ If inside a horse, keep collecting text
      if (curr) {
        curr.raw += line + "\n";
      }
    }

    // ✔ Don't forget last horse
    if (curr) horses.push(curr);

    return horses;
  }

  // Export
  if (typeof window !== "undefined")
    window.parsePPTable = parsePPTable;

  if (typeof module !== "undefined")
    module.exports = { parsePPTable };

})();
