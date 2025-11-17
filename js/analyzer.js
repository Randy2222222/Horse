// js/analyzer.js — Clean final analyzer
// Requirements:
// - pdf.min.js loaded in <head>
// - js/calls.js defines CALL_TABLE (load before this file)
// - jockey_stats.txt optional at repo root

console.log("analyzer.js: clean analyzer loaded");

// ---------------- CONFIG ----------------
const PDF_URL = "https://raw.githubusercontent.com/Randy2222222/Horse/main/bw_pdf_viewer.php.pdf";

// small length tokens mapping
const LENGTH_TOKEN_MAP = {
  "hd": 0.1, "hd.": 0.1, "head": 0.1,
  "nk": 0.25, "nk.": 0.25, "neck": 0.25,
  "shd": 0.2, "nose": 0.05
};

// scoring weights
const weights = {
  speed: 0.4,
  workouts: 0.15,
  jockey: 0.1,
  trainer: 0.1,
  track: 0.1,
  style: 0.05,
  trouble: 0.1
};

// ensure pdf worker for Safari/iPad
if (window.pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.worker.min.js";
}

// ---------------- globals ----------------
let jockeyStatsMap = {};
let extractedText = "";
let RACE_DISTANCE = undefined;
let CALL_INFO = null;

// ---------------- UI helper ----------------
function updateStatus(msg) {
  const el = document.getElementById("pdfStatus");
  if (el) el.textContent = msg;
  console.log("STATUS:", msg);
}

// ---------------- time helpers ----------------
function toSeconds(timeStr) {
  if (timeStr == null) return 0;
  const s = String(timeStr).trim();
  if (s.includes(":")) {
    const parts = s.split(":");
    const mm = Number(parts[0]) || 0;
    const ss = Number(parts[1]) || 0;
    return mm * 60 + ss;
  }
  return Number(s);
}

function formatRaceTimeRaw(sec) {
  if (sec == null || isNaN(sec)) return "-";
  const rounded = Math.round(Number(sec) * 100) / 100; // 2 decimals
  if (rounded < 60) {
    return rounded.toFixed(2);
  } else {
    const minutes = Math.floor(rounded / 60);
    const secs = (rounded % 60).toFixed(2).padStart(5, "0");
    return `${minutes}:${secs}`;
  }
}

// ---------------- length parsing ----------------
function parseLengthToken(tok) {
  if (tok == null) return null;
  const raw = String(tok).trim().toLowerCase();
  // "1 1/2"
  if (/^\d+\s+\d+\/\d+$/.test(raw)) {
    const [w, frac] = raw.split(/\s+/);
    const [a, b] = frac.split("/");
    return Number(w) + Number(a) / Number(b);
  }
  // fraction "3/4"
  if (/^\d+\/\d+$/.test(raw)) {
    const [a, b] = raw.split("/");
    return Number(a) / Number(b);
  }
  // plain number
  if (!isNaN(Number(raw))) return Number(raw);
  // tokens like hd, nk
  if (LENGTH_TOKEN_MAP[raw] !== undefined) return LENGTH_TOKEN_MAP[raw];
  // fallback: strip non-numeric
  const n = Number(raw.replace(/[^\d.]/g, ""));
  return isNaN(n) ? null : n;
}

// ---------------- LPS / SPL math ----------------
function computeLpS_and_SPL(callDistanceFeet, leaderCallTimeSec) {
  if (!callDistanceFeet || !leaderCallTimeSec) return { lps: 0, spl: 0 };
  const lps = (callDistanceFeet / leaderCallTimeSec) / 10;
  const spl = lps ? (1 / lps) : 0;
  return { lps, spl };
}
function lengthsToSeconds(lengths, spl) {
  if (!spl || lengths == null) return 0;
  return Number(lengths) * spl;
}

// ---------------- CALL_TABLE helper ----------------
function normalizeDist(d) {
  return String(d || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function findCallRowForDistance(distanceLabel) {
  if (!distanceLabel) return CALL_TABLE[0];
  const norm = normalizeDist(distanceLabel);

  // exact normalized match
  for (const row of CALL_TABLE) {
    if (normalizeDist(row.dist) === norm) return row;
  }

  // substring tolerant match (helpful for small OCR / punctuation differences)
  for (const row of CALL_TABLE) {
    const rnorm = normalizeDist(row.dist);
    if (norm.includes(rnorm) || rnorm.includes(norm)) return row;
  }

  return CALL_TABLE[0];
}

// ---------------- jockey stats loader ----------------
async function loadJockeyStats() {
  jockeyStatsMap = {};
  try {
    const res = await fetch("jockey_stats.txt");
    if (!res.ok) return;
    const text = await res.text();
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const csv = line.split(",").map(s => s.trim());
      if (csv.length >= 2 && !isNaN(Number(csv[1]))) {
        jockeyStatsMap[csv[0]] = Number(csv[1]);
        continue;
      }
      const m = line.match(/^(.+?)[:\-]\s*([0-9.]+)/);
      if (m) { jockeyStatsMap[m[1].trim()] = Number(m[2]); continue; }
      const toks = line.split(/\s+/);
      const last = toks[toks.length - 1];
      if (!isNaN(Number(last))) {
        const name = toks.slice(0, -1).join(" ");
        jockeyStatsMap[name] = Number(last);
      }
    }
    console.log("Loaded jockey stats:", Object.keys(jockeyStatsMap).length);
  } catch (err) {
    console.error("Error loading jockey stats:", err);
  }
}

// ---------------- PDF load + extract ----------------
async function loadPdfAndExtractText(url = PDF_URL) {
  updateStatus("Loading PDF...");
  try {
    const loadingTask = pdfjsLib.getDocument({ url });
    const pdf = await loadingTask.promise;
    updateStatus(`PDF loaded (${pdf.numPages} pages). Extracting text...`);
    let full = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const p = await pdf.getPage(i);
      const cc = await p.getTextContent();
      const pageText = cc.items.map(it => it.str || "").join(" ");
      full += pageText + "\n\n";
    }
    extractedText = full;
    window._pdfText = full; // handy for debugging
    updateStatus("PDF text extracted.");
    return true;
  } catch (err) {
    console.error("PDF load/extract error:", err);
    updateStatus("❌ Error loading PDF: " + (err && err.message ? err.message : String(err)));
    return false;
  }
}

// ---------------- detect race distance ----------------
function detectRaceDistanceFromText(pdfText) {
  if (!pdfText) return null;
  const flat = normalizeDist(pdfText);
  for (const row of CALL_TABLE) {
    const r = normalizeDist(row.dist);
    if (flat.indexOf(r) !== -1) return row.dist;
  }
  return null;
}

// ---------------- parse leader times ----------------
function extractLeaderTimes(pdfText) {
  const out = { first: null, second: null, str: null, fin: null };
  if (!pdfText) return out;
  const flat = pdfText.replace(/\s+/g, " ");
  const m1 = flat.match(/(?:1st(?:\s*call)?|first)\s*[:\-]?\s*(\d+:\d{2}\.\d{1,2}|\d{1,3}\.\d{1,2})/i);
  if (m1) out.first = toSeconds(m1[1]);
  const m2 = flat.match(/(?:2nd(?:\s*call)?|second)\s*[:\-]?\s*(\d+:\d{2}\.\d{1,2}|\d{1,3}\.\d{1,2})/i);
  if (m2) out.second = toSeconds(m2[1]);
  const m3 = flat.match(/(?:str(?:etch)?|stretch)\s*[:\-]?\s*(\d+:\d{2}\.\d{1,2}|\d{1,3}\.\d{1,2})/i);
  if (m3) out.str = toSeconds(m3[1]);
  const m4 = flat.match(/(?:fin(?:al)?|finish)\s*[:\-]?\s*(\d+:\d{2}\.\d{1,2}|\d{1,3}\.\d{1,2})/i);
  if (m4) out.fin = toSeconds(m4[1]);
  const timeRegex = /(\d+:\d{2}\.\d{1,2}|\d{1,3}\.\d{1,2})/g;
  const times = flat.match(timeRegex) || [];
  if (!out.fin && times.length) out.fin = toSeconds(times[times.length - 1]);
  if (!out.first && times.length >= 3) out.first = toSeconds(times[0]);
  if (!out.second && times.length >= 3) out.second = toSeconds(times[1]);
  if (!out.str && times.length >= 3) out.str = toSeconds(times[Math.max(2, times.length - 2)]);
  return out;
}

// ---------------- parse horses (scaffold — refine with real PDF text if needed) ----------------
function parseHorsesFromText(pdfText) {
  const lines = pdfText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const horses = [];
  const timeRx = /(\d+:\d{2}\.\d{1,2}|\d{1,3}\.\d{1,2})/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const timeMatch = line.match(timeRx);
    if (!timeMatch) continue;
    const prev = i > 0 ? lines[i - 1] : null;
    let name = null;
    if (prev && /[A-Za-z]/.test(prev) && !/\d/.test(prev)) name = prev;
    if (!name) {
      const m = line.match(/^([A-Z][A-Za-z'\-\. ]{2,40})/);
      if (m) name = m[1].trim();
    }
    if (!name) continue;
    const finalTime = toSeconds(timeMatch[0]);
    const horse = {
      name: name,
      jockey: null,
      trainer: null,
      finalTimeS: finalTime,
      callLengths: { first: null, second: null, str: null, fin: 0 }
    };
    for (let k = 0; k < 6 && (i + k) < lines.length; k++) {
      const probe = lines[i + k];
      const tokens = probe.split(/\s+/);
      const lenTokens = tokens.filter(t => {
        return /^\d+(\.\d+)?$/.test(t) || /^\d+\/\d+$/.test(t) || /^[0-9]+\s+[0-9]\/[0-9]+$/.test(t)
               || /^(hd|nk|shd|nose|head)$/i.test(t);
      });
      if (lenTokens.length >= 3) {
        const l0 = parseLengthToken(lenTokens[0]);
        const l1 = parseLengthToken(lenTokens[1]);
        const l2 = parseLengthToken(lenTokens[2]);
        if (l0 !== null) horse.callLengths.first = l0;
        if (l1 !== null) horse.callLengths.second = l1;
        if (l2 !== null) horse.callLengths.str = l2;
        break;
      }
      const dash = probe.match(/(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)-?(\d+(?:\.\d+)?)?/);
      if (dash) {
        horse.callLengths.first = parseLengthToken(dash[1]);
        horse.callLengths.second = parseLengthToken(dash[2]);
        horse.callLengths.str = parseLengthToken(dash[3]);
        break;
      }
    }
    horses.push(horse);
  }
  return horses;
}

// ---------------- compute call times per horse ----------------
function computeCallTimesForRace(horses, leaderTimes, callFeet) {
  const calls = ["first", "second", "str", "fin"];
  const callLabelMap = { first: "1st", second: "2nd", str: "str", fin: "fin" };
  const callMetrics = {};
  for (const c of calls) {
    const label = callLabelMap[c];
    const ft = callFeet[label];
    const leaderT = leaderTimes[c] || null;
    if (ft && leaderT) {
      const { lps, spl } = computeLpS_and_SPL(ft, leaderT);
      callMetrics[c] = { ft, leaderT, lps, spl };
    } else {
      callMetrics[c] = { ft, leaderT: null, lps: 0, spl: 0 };
    }
  }
  for (const h of horses) {
    h.calculatedCalls = { first: null, second: null, str: null, fin: null };
    for (const c of calls) {
      const metrics = callMetrics[c];
      const lengthsBehind = (c === "fin") ? 0 : (h.callLengths[c] == null ? null : Number(h.callLengths[c]));
      if (!metrics.leaderT && c === "fin") {
        h.calculatedCalls.fin = h.finalTimeS;
        continue;
      }
      if (!metrics.leaderT) {
        h.calculatedCalls[c] = null;
        continue;
      }
      if (lengthsBehind == null) {
        h.calculatedCalls[c] = null;
        continue;
      }
      const deltaSec = lengthsToSeconds(lengthsBehind, metrics.spl);
      h.calculatedCalls[c] = metrics.leaderT + deltaSec;
    }
    if (!h.calculatedCalls.fin && h.finalTimeS) h.calculatedCalls.fin = h.finalTimeS;
  }
  return { horses, callMetrics };
}

// ---------------- scoring ----------------
function avg(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce((s,v)=>s+v,0)/arr.length;
}
function normalizeSpeed(hTime, fAvg) {
  if (!fAvg || !hTime) return 100;
  return 100 + ((fAvg - hTime) / fAvg) * 100;
}
function computeWeightedScoreForHorse(h) {
  return Number((
    (h.speedScore||0) * weights.speed +
    (h.workoutScore||0) * weights.workouts +
    (h.jockeyScore||0) * weights.jockey +
    (h.trainerScore||0) * weights.trainer +
    (h.trackScore||0) * weights.track +
    (h.styleScore||0) * weights.style +
    (h.troubleScore||0) * weights.trouble
  ).toFixed(1));
}
function analyzeScores(horses) {
  horses.forEach(h => {
    h.avgTime = h.finalTimeS || 0;
  });
  const fieldAvg = avg(horses.map(h => h.avgTime || 0)) || 1;
  horses.forEach(h => {
    h.speedScore = normalizeSpeed(h.avgTime, fieldAvg);
    h.jockeyScore = (h.jockey && jockeyStatsMap[h.jockey]) ? jockeyStatsMap[h.jockey] : (h.jockeyScore || 50);
    h.workoutScore = h.workoutScore || 50;
    h.trainerScore = h.trainerScore || 50;
    h.trackScore = h.trackScore || 50;
    h.styleScore = h.styleScore || 50;
    h.troubleScore = h.troubleScore || 50;
    h.totalScore = computeWeightedScoreForHorse(h);
  });
  horses.sort((a,b)=> (b.totalScore||0) - (a.totalScore||0));
  const total = horses.reduce((s,h)=>s+(h.totalScore||0),0)||1;
  horses.forEach(h=> { h.probability = ((h.totalScore/total)*100).toFixed(1) + "%"; });
  return horses;
}

// ---------------- render ----------------
function renderAnalysis(horses, callMetrics) {
  const out = document.getElementById("output");
  if (!out) return;
  let s = "=== Race Analysis Results ===\n\n";
  s += `Detected race distance: ${RACE_DISTANCE || "unknown"}\n\n`;
  s += "Per-call leader metrics (lps / spl):\n";
  for (const k in callMetrics) {
    const m = callMetrics[k];
    s += `${k}: leaderT=${m.leaderT ? formatRaceTimeRaw(m.leaderT) : "-"}, lps=${m.lps ? m.lps.toFixed(3) : "-"}, spl=${m.spl ? m.spl.toFixed(3) : "-"}\n`;
  }
  s += "\nHorses:\n";
  horses.forEach((h,i)=>{
    s += `${i+1}. ${h.name}\n`;
    s += `     FinalTime: ${h.finalTimeS ? formatRaceTimeRaw(h.finalTimeS) : "-"}\n`;
    s += `     Calculated Calls: 1st:${h.calculatedCalls.first ? formatRaceTimeRaw(h.calculatedCalls.first) : "-"}, 2nd:${h.calculatedCalls.second ? formatRaceTimeRaw(h.calculatedCalls.second) : "-"}, Str:${h.calculatedCalls.str ? formatRaceTimeRaw(h.calculatedCalls.str) : "-"}, Fin:${h.calculatedCalls.fin ? formatRaceTimeRaw(h.calculatedCalls.fin) : "-"}\n`;
    s += `     Score: ${h.totalScore}  Probability: ${h.probability}\n`;
    if (h.jockey) {
      const jscore = jockeyStatsMap[h.jockey] || "n/a";
      s += `     Jockey: ${h.jockey} (score: ${jscore})\n`;
    }
    s += "\n";
  });
  out.textContent = s;
}

// ---------------- main flow ----------------
async function runFullAnalysis() {
  updateStatus("Loading jockey stats...");
  await loadJockeyStats();

  updateStatus("Loading and extracting PDF...");
  const ok = await loadPdfAndExtractText();
  if (!ok) return;

  updateStatus("Detecting race distance...");
  let detected = detectRaceDistanceFromText(extractedText);
  if (detected) {
    RACE_DISTANCE = detected;
  } else {
    const dmatch = extractedText.match(/\b(\d+(?:\s+\d\/\d+)?(?:\s?m(?:\s?\d+\s?yds)?)?)\b/i);
    if (dmatch) RACE_DISTANCE = dmatch[0].trim();
  }
  CALL_INFO = findCallRowForDistance(RACE_DISTANCE);

  updateStatus("Extracting leader call times...");
  const leaderTimes = extractLeaderTimes(extractedText);
  console.log("Leader times:", leaderTimes);

  updateStatus("Parsing horses and call lengths...");
  let horses = parseHorsesFromText(extractedText);
  console.log("Parsed horses (count):", horses.length, horses);

  // IMPORTANT: no demo horses inserted here — if parse fails you'll get empty array.
  // If you'd like a safe fallback, uncomment the lines below:
  /*
  if (!horses || horses.length === 0) {
    const s1 = { name: "Sample A", jockey: "Sample J", finalTimeS: 92.4, callLengths: { first:0, second:0, str:0, fin:0 } };
    const s2 = { name: "Sample B", jockey: "Sample J2", finalTimeS: 94.1, callLengths: { first:2, second:2, str:1, fin:0 } };
    horses = [s1, s2];
  }
  */

  updateStatus("Computing call times using SPL math...");
  if (!CALL_INFO) {
    updateStatus("No CALL_TABLE row found for detected distance — using first row as fallback.");
    CALL_INFO = CALL_TABLE[0];
  }
  const callFeet = { "1st": CALL_INFO["1st"], "2nd": CALL_INFO["2nd"], "str": CALL_INFO["str"], "fin": CALL_INFO["fin"] };
  const { horses: computedHorses, callMetrics } = computeCallTimesForRace(horses, leaderTimes, callFeet);

  updateStatus("Computing scores...");
  const scored = analyzeScores(computedHorses);

  updateStatus("Rendering results...");
  renderAnalysis(scored, callMetrics);

  updateStatus("Analysis complete.");
}

// attach to UI button safely
window.addEventListener("load", () => {
  const fileEl = document.getElementById("pdfFile");
  const runBtn = document.getElementById("runAnalysis");
  if (fileEl) fileEl.addEventListener("change", () => {
    // user file input is optional in your current setup; this handler exists if you keep the input.
    updateStatus("File input changed. Use Run Analysis to process.");
  });
  if (runBtn) runBtn.addEventListener("click", async () => {
    await runFullAnalysis();
  });
  const statusEl = document.getElementById("pdfStatus");
  if (statusEl && statusEl.textContent.trim() === "") statusEl.textContent = "Ready — click Run Analysis.";
  console.log("Analyzer ready.");
});
