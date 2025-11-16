// analyzer.js — Full analyzer (Option B, restored)
// - PDF loader uses GitHub raw URL
// - Race-call table uses your exact labels: "1st","2nd","str","fin"
// - LpS/SPL math per-race (Option B)
// - Weighting system and scoring restored
// - Loads jockey_stats.txt into a simple map (name -> score)
// - Parser area has TODO markers to implement exact Brisnet PP token parsing
//
// NOTE: put your RACE_DISTANCE variable (like "4f" or "1m") at the top
//       or add logic in the parser to derive it from the PDF text.
//
// Requirements:
// - pdf.min.js must be loaded in <head>
// - pdfjsLib.GlobalWorkerOptions.workerSrc set (done below)
// - jockey_stats.txt in root (or update path)
// - race_calls_table present (we include the table you gave earlier)

console.log("analyzer.js: full analyzer loaded");

// -----------------------------
// CONFIGURATION
// -----------------------------
const PDF_URL = "https://raw.githubusercontent.com/Randy2222222/Horse/main/bw_pdf_viewer.php.pdf";

// If you want to hardcode the race distance here, set RACE_DISTANCE (string)
// Otherwise, let the parser detect it from the PDF text.
let RACE_DISTANCE = undefined; // e.g. "4f" or "6f" or "1m" — set manually or let parser set it

// Ensure worker is set for Safari
if (window.pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.worker.min.js";
}

// Your race call table (keeps your exact labels). Fill / adjust entries as needed.
const race_calls_table = [
  { "1st": null,  "2nd": 1320, "str": 2640, "fin": 2970 },
  { "1st": null,  "2nd": 1320, "str": 2640, "fin": 3300 },
  { "1st": 1320,  "2nd": 2640, "str": 3300, "fin": 3630 },
  { "1st": 1320,  "2nd": 2640, "str": 3960, "fin": 4290 },
  { "1st": 1320,  "2nd": 2640, "str": 3960, "fin": 4620 },
  { "1st": 1320,  "2nd": 2640, "str": 3300, "fin": 3960 },
  { "1st": 1320,  "2nd": 2640, "str": 3960, "fin": 4950 },
  { "1st": 1320,  "2nd": 2640, "str": 3960, "fin": 5280 },
  { "1st": 1320,  "2nd": 2640, "str": 3960, "fin": 5490 },
  { "1st": 1320,  "2nd": 2640, "str": 3960, "fin": 5610 },
  { "1st": 2640,  "2nd": 3960, "str": 5280, "fin": 5940 },
  { "1st": 2640,  "2nd": 3960, "str": 5280, "fin": 6270 },
  { "1st": 2640,  "2nd": 3960, "str": 5280, "fin": 6600 },
  { "1st": 2640,  "2nd": 3960, "str": 5280, "fin": 7260 },
  { "1st": 2640,  "2nd": 3960, "str": 6600, "fin": 7920 },
  { "1st": 2640,  "2nd": 5280, "str": 6600, "fin": 8580 },
  { "1st": 2640,  "2nd": 6600, "str": 7920, "fin": 9240 },
  { "1st": 2640,  "2nd": 7920, "str": 9240, "fin": 10560 }
];

// -----------------------------
// WEIGHTS (your confirmed weights)
// -----------------------------
const weights = {
  speed: 0.4,
  workouts: 0.15,
  jockey: 0.1,
  trainer: 0.1,
  track: 0.1,
  style: 0.05,
  trouble: 0.1
};

// -----------------------------
// JOCKEY STATS LOADER
// Expects jockey_stats.txt at repo root (same place as index.html)
// Format: text lines you used earlier (we parse to map name -> score if possible)
// -----------------------------
let jockeyStatsMap = {}; // name -> numeric score
async function loadJockeyStats() {
  try {
    const res = await fetch("jockey_stats.txt");
    if (!res.ok) {
      console.warn("jockey_stats.txt not found or fetch failed:", res.status);
      return;
    }
    const text = await res.text();
    // crude parse: each line maybe "JOCKEY_NAME,score" or "Jockey Name: score"
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    lines.forEach(line => {
      // try CSV style
      const csv = line.split(",").map(p => p.trim());
      if (csv.length >= 2 && !isNaN(Number(csv[1]))) {
        const name = csv[0];
        jockeyStatsMap[name] = Number(csv[1]);
        return;
      }
      // try "Name: value"
      const m = line.match(/^(.+?)[:\-]\s*([0-9.]+)/);
      if (m) {
        jockeyStatsMap[m[1].trim()] = Number(m[2]);
        return;
      }
      // fallback: try last token numeric
      const tokens = line.split(/\s+/);
      const last = tokens[tokens.length - 1];
      if (!isNaN(Number(last))) {
        const name = tokens.slice(0, -1).join(" ");
        jockeyStatsMap[name] = Number(last);
      }
    });
    console.log("Loaded jockey stats:", Object.keys(jockeyStatsMap).length);
  } catch (err) {
    console.error("Error loading jockey stats:", err);
  }
}

// -----------------------------
// UTILITY / MATH FUNCTIONS (Option B calculations)
// -----------------------------
function average(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

// compute LpS from total feet and winner's total time in seconds:
// LpS = (distance_ft / time_sec) / 10
function computeLpS(distance_ft, time_sec) {
  if (!distance_ft || !time_sec) return 0;
  return (distance_ft / time_sec) / 10;
}

// seconds per length is 1 / LpS
function LpS_to_SPL(lps) {
  if (!lps) return 0;
  return 1 / lps;
}

// convert lengths to seconds with given spl
function lengthsToSeconds(lengths, spl) {
  return lengths * spl;
}

// get call feet for a given distance label (if RACE_DISTANCE used later)
// Since you asked to add distance manually, the code expects RACE_DISTANCE or parser to set it.
// For now, try to match RACE_DISTANCE to a table index via some logic (simple fallback)
function getCallFeetForDistance(distanceLabel) {
  // If distanceLabel is undefined, return first row as fallback
  if (!distanceLabel) return race_calls_table[0];
  // Basic matching: if distanceLabel contains a number, try to use that position:
  // This is a placeholder — you can map labels to table indices or make a keyed table
  // For now, return first entry — you'll replace this by mapping your labels to table rows
  return race_calls_table[0];
}

// -----------------------------
// DATA MODEL HELPERS
// -----------------------------
function createEmptyHorse() {
  return {
    name: "",
    post: null,
    jockey: "",
    trainer: "",
    pastRuns: [], // { distanceLabel, distance_ft, finalTimeS, leaderTimes: { first, second, str, fin }, horseLengthsAtCalls: { first, second, str, finish } }
    workoutScore: 50,
    jockeyScore: 50,
    trainerScore: 50,
    trackScore: 50,
    styleScore: 50,
    troubleScore: 50,
    avgTime: 0,
    speedScore: 0,
    totalScore: 0,
    probability: "0.0%"
  };
}

// -----------------------------
// PARSING: PDF TEXT -> raceHorses
// IMPORTANT: This section is the place we will plug your exact Brisnet rules.
// I provide a robust scaffold — it extracts candidate horse blocks by naive heuristics,
// finds final times using regex, and builds minimal pastRuns. Replace with exact token rules.
// -----------------------------
function parsePdfTextToRaceHorses(pdfText) {
  // Defensive
  if (!pdfText || !pdfText.trim()) {
    return [];
  }

  // Attempt to find all occurrences of time strings mm:ss.xx or m:ss.x or ss.x
  // Brisnet final times often look like "1:12.34" or "92.4" — we'll match both
  const timeRegex = /(\d+:\d{2}\.\d{1,2})|(\d{1,3}\.\d{1,2})/g;

  // Split into lines and try to find horse lines that contain a name and a final time
  const lines = pdfText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Heuristic: horse lines usually contain a name (words) + a final time near the end
  const candidates = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check if line contains a time
    const m = line.match(timeRegex);
    if (m) {
      // Create a candidate block: look back a few lines to find the horse name
      const nameLine = (i >= 1 ? lines[i - 1] : line);
      candidates.push({ nameLine, timeToken: m[m.length - 1], raw: line });
    }
  }

  // Build horse objects from candidates (best-effort)
  const horses = [];
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const h = createEmptyHorse();
    // crude name extraction: take first few words of nameLine (capitals or mixed)
    const nm = cand.nameLine.split(/\s{2,}|\s-\s|,|  /)[0].trim();
    h.name = nm || ("Horse " + (i + 1));
    // parse the time token to seconds
    let tkn = cand.timeToken;
    let secs = 0;
    if (tkn.includes(":")) {
      // mm:ss.xx
      const parts = tkn.split(":");
      const mm = Number(parts[0]);
      const ss = Number(parts[1]);
      secs = mm * 60 + ss;
    } else {
      secs = Number(tkn);
    }
    // minimal pastRun
    h.pastRuns.push({
      distanceLabel: RACE_DISTANCE || "unknown",
      distance_ft: null,
      finalTimeS: secs,
      leaderTimes: { first: null, second: null, str: null, fin: secs },
      horseLengthsAtCalls: { first: null, second: null, str: null, finish: 0 }
    });
    horses.push(h);
  }

  // If parser found zero horses, return empty and we show sample
  return horses;
}

// -----------------------------
// CORE ANALYZER: compute avgTime, speedScore, weighted total, probabilities
// -----------------------------
function normalizeSpeed(horseTime, fieldAvg) {
  if (!fieldAvg || !horseTime) return 100;
  const adv = ((fieldAvg - horseTime) / fieldAvg) * 100;
  return 100 + adv;
}

function computeWeightedScore(h, weightConfig) {
  return Number(
    (
      (h.speedScore || 0) * weightConfig.speed +
      (h.workoutScore || 0) * weightConfig.workouts +
      (h.jockeyScore || 0) * weightConfig.jockey +
      (h.trainerScore || 0) * weightConfig.trainer +
      (h.trackScore || 0) * weightConfig.track +
      (h.styleScore || 0) * weightConfig.style +
      (h.troubleScore || 0) * weightConfig.trouble
    ).toFixed(1)
  );
}

function analyzeRaceHorses(horses) {
  // compute avgTime per horse from their pastRuns finalTimeS
  horses.forEach(h => {
    const times = (h.pastRuns || []).map(r => r.finalTimeS).filter(Boolean);
    h.avgTime = average(times);
  });

  const fieldAvg = average(horses.map(h => h.avgTime));

  horses.forEach(h => {
    h.speedScore = normalizeSpeed(h.avgTime || 0, fieldAvg || 0);
    // if jockey score available from map, attach it
    if (h.jockey && jockeyStatsMap[h.jockey]) {
      h.jockeyScore = jockeyStatsMap[h.jockey];
    } else {
      h.jockeyScore = h.jockeyScore || 50;
    }
    h.workoutScore = h.workoutScore || 50;
    h.trainerScore = h.trainerScore || 50;
    h.trackScore = h.trackScore || 50;
    h.styleScore = h.styleScore || 50;
    h.troubleScore = h.troubleScore || 50;

    h.totalScore = computeWeightedScore(h, weights);
  });

  horses.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
  const total = horses.reduce((s, h) => s + (h.totalScore || 0), 0) || 1;
  horses.forEach(h => {
    h.probability = ((h.totalScore / total) * 100).toFixed(1) + "%";
  });
  return horses;
}

// -----------------------------
// UI OUTPUT
// -----------------------------
function renderAnalysisOutput(horses) {
  const out = document.getElementById("output");
  if (!out) return;
  let s = "=== Race Analysis Results ===\n\n";
  horses.forEach((h, i) => {
    s += `${i + 1}. ${h.name}\n`;
    s += `   AvgTime: ${h.avgTime || "n/a"}\n`;
    s += `   Score: ${h.totalScore}\n`;
    s += `   Probability: ${h.probability}\n\n`;
  });
  out.textContent = s;
}

// -----------------------------
// PDF LOADING & ENTRY POINT
// -----------------------------
let loadedPdfDoc = null;
let extractedText = "";

// load jockey stats first
loadJockeyStats();

// load PDF and extract text
async function loadPdfAndExtract() {
  updateStatus("Loading PDF...");
  try {
    const loadingTask = pdfjsLib.getDocument({ url: PDF_URL });
    const pdf = await loadingTask.promise;
    loadedPdfDoc = pdf;
    updateStatus(`PDF loaded (${pdf.numPages} pages). Extracting text...`);

    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(it => it.str || "").join(" ") + "\n\n";
    }
    extractedText = fullText;
    window._pdfText = fullText;
    updateStatus("PDF text extracted.");
    return true;
  } catch (err) {
    console.error("PDF load/extract error:", err);
    updateStatus("❌ Error loading PDF: " + (err && err.message ? err.message : String(err)));
    return false;
  }
}

// -----------------------------
// Button: Run Analysis
// -----------------------------
document.getElementById("runAnalysis").addEventListener("click", async () => {
  updateStatus("Starting analysis: loading PDF...");
  const ok = await loadPdfAndExtract();
  if (!ok) return;

  updateStatus("Parsing PDF text into horses...");
  const pdfText = extractedText || "";
  // If you know RACE_DISTANCE ahead of time, set RACE_DISTANCE variable above.
  // Else attempt to detect in pdfText (simple detection below)
  if (!RACE_DISTANCE) {
    // simple attempt to find patterns like "6f" or "1m" near the top of the file
    const m = pdfText.match(/\b(\d+(\.\d+)?f|1m|1\s?m|1m1\/16|1 1\/16|1 1\/8|1m1\/8)\b/i);
    if (m) RACE_DISTANCE = m[0].replace(/\s+/g, "");
  }

  // parse into horses (replace this function with Brisnet-specific tokens for exact mapping)
  let horses = parsePdfTextToRaceHorses(pdfText);

  if (!horses || horses.length === 0) {
    // fallback sample so UI shows something — you can remove when parser is completed
    const sample = createEmptyHorse();
    sample.name = "Sample Horse A";
    sample.jockey = "Sample J";
    sample.pastRuns = [{ distanceLabel: RACE_DISTANCE || "unknown", finalTimeS: 92.4 }];
    const sample2 = createEmptyHorse();
    sample2.name = "Sample Horse B";
    sample2.jockey = "Sample J2";
    sample2.pastRuns = [{ distanceLabel: RACE_DISTANCE || "unknown", finalTimeS: 93.6 }];
    horses = [sample, sample2];
  }

  // compute derived data using your LpS/SPL formulas once you have leader times and lengths
  // NOTE: when real parsed data includes leaderTimes (leaderTimes.first etc) and horseLengthsAtCalls,
  // you should compute per-run SPL with computeLpS(distance_ft, leaderFinalTime) then convert lengths to secs.

  horses = analyzeRaceHorses(horses);

  renderAnalysisOutput(horses);
  updateStatus("Analysis complete.");
});

// -----------------------------
// Window onload: nothing auto-loading (we keep load-on-click)
// -----------------------------
window.addEventListener("load", () => {
  // UI sanity
  const statusEl = document.getElementById("pdfStatus");
  if (statusEl && statusEl.textContent.trim() === "") statusEl.textContent = "No file loaded.";
  console.log("Analyzer ready. Click Run Analysis to start.");
});
