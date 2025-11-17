// js/parser.js
// parsePPBlock(extractedText) -> { header: string, pastPerformances: [...] }
// Lightweight, tolerant parser tuned to Brisnet-style raw text blocks.
// Returns an array of past performance objects (see fields below).

(function(global){

  // small helper to convert times like "1:35", " :22", "1:12.34", "72.34" -> seconds
  function toSeconds(timeStr){
    if (!timeStr) return null;
    const s = String(timeStr).trim();
    // leading ":" like ":22" -> "0:22"
    if (/^:\d{1,2}(?:\.\d+)?$/.test(s)) {
      return parseFloat("0" + s.replace(":", "")) || null;
    }
    if (s.includes(":")) {
      const parts = s.split(":");
      const mm = Number(parts[0]) || 0;
      const ss = Number(parts[1]) || 0;
      return mm * 60 + ss;
    }
    const n = Number(s.replace(/[^\d\.]/g,""));
    return isNaN(n) ? null : n;
  }

  // extract a small token like "pp1" boundaries
  function splitIntoPPBlocks(text){
    // normalize odd whitespace and preserve original blocks by finding "ppX" tokens
    const re = /\bpp\s*([0-9]{1,2})\b/ig;
    let blocks = [];
    let lastIndex = 0;
    let lastMatch = null;
    let match;
    // find all pp matches and use them to slice text
    const matches = [];
    while ((match = re.exec(text)) !== null) {
      matches.push({ idx: match.index, num: match[1], match: match[0] });
    }
    if (matches.length === 0) {
      // fallback: if no explicit pp markers, attempt split by "  pp" or by lines that start with "#   "
      return [text.trim()];
    }
    // capture header (anything before first match)
    const header = text.slice(0, matches[0].idx).trim();
    for (let i=0;i<matches.length;i++){
      const start = matches[i].idx;
      const end = (i+1 < matches.length) ? matches[i+1].idx : text.length;
      const block = text.slice(start, end).trim();
      blocks.push(block);
    }
    return { header, blocks };
  }

  // small normalizer for whitespace and odd non-ascii chars
  function clean(s){
    if (!s) return "";
    return s.replace(/\u00A0/g," ").replace(/[^\x00-\x7F]/g," ").replace(/\s+/g," ").trim();
  }

  // parse one PP block into an object
  function parseOneBlock(raw){
    const r = { raw: raw };
    const text = clean(raw);

    // pp number and top-of-block name line
    const ppNumMatch = text.match(/\bpp\s*([0-9]{1,2})\b/i);
    if (ppNumMatch) r.pp = Number(ppNumMatch[1]);

    // Name: usually follows ppN and is capitalized
    // pattern: "pp1   Conquistadora (S 0) Own: ... "
    const nameMatch = text.match(/\bpp\s*[0-9]{1,2}\b\s+([A-Z][A-Za-z'’\-\.\s]{2,60}?)\s*(?:\(|Own:|Sire|Trnr:|Prime Power|Life:)/i);
    if (nameMatch) r.name = nameMatch[1].trim();

    // Owner and colors: "Own: ...  White, Yellow Triangular Panel ..."
    const ownerMatch = text.match(/Own:\s*([^A-Z]{0,}.*?)(?=(?:\s+[A-Z][a-z]|KIMURA|KIMURA KAZUSHI|Sire|Trnr:|Prime Power|Life:|pp[0-9]|DATE TRK|DATE|$))/i);
    if (ownerMatch) r.owner = clean(ownerMatch[1]);

    // Colors are often immediately after owner, try capture by comma segments of caps/lower
    const colorsMatch = text.match(/Own:[^A\n]*?\s{2,}([A-Z][a-z].*?)(?=\s{2,}[A-Z]|\sKIMURA|\sTrnr:|Sire:|Prime Power|Life:|DATE|$)/);
    if (colorsMatch) r.colors = clean(colorsMatch[1]);

    // sex/age token like "Dkbbr. f. 2 (May)" or "B. f. 2 (Mar)"
    const sexAge = text.match(/([A-Z]?\.? ?[bfmBFM][a-z]*\.?\s*\d{1,2})/);
    if (sexAge) r.sexAge = sexAge[0].trim();

    // jockey in header: e.g. "KIMURA KAZUSHI (21 0-1-4 0%)"
    const jockeyMatch = text.match(/([A-Z][A-Z '\-\.]{2,40})\s*\(\d{1,3}.*?\%?\)/);
    if (jockeyMatch) r.jockey = clean(jockeyMatch[1]);

    // Sire: "Sire :   Justify (Scat Daddy)" or "Sire :   Justify (Scat Daddy) $250,000"
    const sireMatch = text.match(/Sire\s*[:\u2013\-]\s*([A-Za-z0-9 '\-().,]+?)(?=(?:Dam:|Brdr:|Trnr:|Prime Power|Life:|DATE TRK|DATE|$))/i);
    if (sireMatch) r.sire = clean(sireMatch[1]);

    // Dam:
    const damMatch = text.match(/Dam\s*[:\u2013\-]\s*([A-Za-z0-9 '\-().,]+?)(?=(?:Brdr:|Trnr:|Prime Power|Life:|DATE TRK|DATE|$))/i);
    if (damMatch) r.dam = clean(damMatch[1]);

    // Breeder:
    const brdrMatch = text.match(/Brdr\s*[:\u2013\-]\s*([A-Za-z0-9 '\-().,]+?)(?=(?:Trnr:|Prime Power|Life:|DATE TRK|DATE|$))/i);
    if (brdrMatch) r.breeder = clean(brdrMatch[1]);

    // Trainer:
    const trnMatch = text.match(/Trnr\s*[:\u2013\-]\s*([A-Za-z0-9 '\-().,]+?)(?=(?:Prime Power|Life:|DATE TRK|DATE|$))/i);
    if (trnMatch) r.trainer = clean(trnMatch[1]);

    // Prime Power:
    const ppMatch = text.match(/Prime Power[:\s]*([0-9]{1,3}\.?[0-9]?)/i);
    if (ppMatch) r.primePower = Number(ppMatch[1]);

    // Final time (from a race line) - attempt to find the first occurrence of a final time pattern like "1:35" or "1:35.12"
    // We'll search the block for the last time in the first date line
    const dateLineMatch = text.match(/(\d{2}[A-Za-z]{3}\d{2}[\s\S]{0,120}?)(?=(?:\d{2}[A-Za-z]{3}\d{2}|$))/i);
    const blockToScan = dateLineMatch ? dateLineMatch[1] : text;
    // grab times like ":22", ":46", "1:11", "1:35" etc.
    const timeRe = /(\d+:\d{2}\.\d{1,2}|\d+:\d{2}|:\d{1,2}(?:\.\d+)?|\d{1,3}\.\d{1,2})/g;
    const times = [];
    let t;
    while ((t = timeRe.exec(blockToScan)) !== null){
      times.push(t[0]);
      // guard to avoid infinite loop
      if (times.length > 10) break;
    }
    // heuristics: if times looks like 4 tokens -> 1st, 2nd, str, fin
    if (times.length >= 1) {
      // final time likely last time token in that date line
      const finalRaw = times[times.length - 1];
      const finalS = toSeconds(finalRaw);
      if (finalS !== null) r.finalTimeS = finalS;
    }

    // attempt to extract the 1st/2nd/str times if the date line had >= 3 tokens
    if (times.length >= 4) {
      // find the last occurrence group of 4 times (often present)
      const lastFour = times.slice(-4);
      r.callTimes = {
        firstRaw: lastFour[0],
        secondRaw: lastFour[1],
        strRaw: lastFour[2],
        finRaw: lastFour[3],
        firstS: toSeconds(lastFour[0]),
        secondS: toSeconds(lastFour[1]),
        strS: toSeconds(lastFour[2]),
        finS: toSeconds(lastFour[3])
      };
    } else {
      r.callTimes = { firstRaw:null, secondRaw:null, strRaw:null, finRaw:null, firstS:null, secondS:null, strS:null, finS:null };
    }

    // lengths behind leader: try to find dash pattern or length tokens near the date line e.g. "8 7« 8‚ 6ªƒ 5ª 3ª"
    // We'll attempt to find a sequence like " 1 2 3 4 " or "1-2-3-4"
    const lengthLineMatch = raw.match(/(?:\b[0-9]+(?:[\s\-][0-9]+){2,3}\b)/);
    if (lengthLineMatch) {
      const parts = lengthLineMatch[0].replace(/-/g," ").split(/\s+/).map(x=>x.trim()).filter(Boolean);
      // assign to callLengths if numeric-looking
      r.callLengths = { first:null, second:null, str:null, fin:null };
      if (parts.length>=1) r.callLengths.first = isNaN(Number(parts[0])) ? null : Number(parts[0]);
      if (parts.length>=2) r.callLengths.second = isNaN(Number(parts[1])) ? null : Number(parts[1]);
      if (parts.length>=3) r.callLengths.str = isNaN(Number(parts[2])) ? null : Number(parts[2]);
      if (parts.length>=4) r.callLengths.fin = isNaN(Number(parts[3])) ? null : Number(parts[3]);
    } else {
      r.callLengths = { first:null, second:null, str:null, fin:null };
    }

    return r;
  }

  function parsePPBlock(text){
    const cleaned = typeof text === 'string' ? text : String(text || "");
    const splitter = splitIntoPPBlocks(cleaned);
    let header = "";
    let blockTexts = [];
    if (Array.isArray(splitter)) {
      // fallback if splitIntoPPBlocks returned array only
      blockTexts = splitter;
    } else {
      header = splitter.header || "";
      blockTexts = splitter.blocks || [];
    }
    // If there's no explicit pp tokens we attempt to split by double-newline groups that look like PPs
    if (blockTexts.length === 0) {
      const groups = cleaned.split(/\n{2,}/).map(s=>s.trim()).filter(Boolean);
      // if the first group contains "pp" then use groups
      blockTexts = groups.filter(g => /\bpp\s*\d\b/i.test(g));
      if (blockTexts.length === 0) blockTexts = groups; // fallback to all groups
    }

    const pastPerformances = blockTexts.map(b => parseOneBlock(b));
    return { header: clean(header), pastPerformances };
  }

  // export
  global.parsePPBlock = parsePPBlock;

})(window);
