// js/analyzer.js (instrumented test version)
// Paste this entire file over your current analyzer.js, test, then remove the small alerts afterwards.

// Quick load check (remove later)
try {
  // small visual confirmation that the script executed
  alert("analyzer.js: script loaded");
} catch (e) {
  // ignore if alerts are blocked
  console.log("analyzer.js loaded (no alert)");
}

// Try to locate pdfjsLib in the most common global places
const pdfjsLib =
  window['pdfjs-dist/build/pdf'] || // some builds
  window.pdfjsLib ||               // typical CDN build (pdf.min.js)
  null;

if (!pdfjsLib) {
  // If pdfjsLib cannot be found, show a clear message
  alert("ERROR: pdfjsLib not found. Make sure pdf.min.js is loaded in <head>.");
  throw new Error("pdfjsLib not found");
}

// REQUIRED for PDF.js worker — set it safely
if (pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.142/pdf.worker.min.js";
} else {
  alert("WARNING: pdfjsLib.GlobalWorkerOptions not present (unexpected).");
}

// ======= PDF loader state =======
let pdfText = "";

// --- SINGLE VALID PDF HANDLER ---
async function handlePDF(event) {
  try {
    const file = event.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById("pdfStatus");
    if (statusEl) statusEl.innerText = "Reading PDF...";

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map(item => item.str);
      fullText += strings.join(" ") + "\n\n";
    }

    pdfText = fullText;

    if (statusEl) {
      statusEl.innerText = "PDF Loaded Successfully (" + pdf.numPages + " pages)";
    }
  } catch (err) {
    // Visible error so we can debug on iPad
    alert("Error reading PDF: " + (err && err.message ? err.message : err));
    console.error("handlePDF error", err);
  }
}

// --- ANALYZE PDF ---
function analyzePDF() {
  if (!pdfText) {
    alert("Please upload a PDF first.");
    return;
  }

  // Parsing code will go here (left intentionally empty for now)
  alert("analyzePDF: PDF text present (length: " + pdfText.length + ")");
}

// ===============================
// Configuration + helpers (unchanged logic)
// ===============================
const LENGTH_TO_SEC = 1 / 6;

const weights = {
  speed: 0.4,
  workouts: 0.15,
  jockey: 0.1,
  trainer: 0.1,
  track: 0.1,
  style: 0.05,
  trouble: 0.1
};

function createHorsePPBox(horse) {
  const box = document.createElement("div");
  box.className = "horse-pp-box";

  box.innerHTML = `
    <h3 class="horse-name">${horse.name}</h3>
    <div class="race-info">${horse.raceInfo}</div>
    <div class="compact-calls">
      <table>
        <tr>
          <th>1st</th><th>2nd</th><th>Str</th><th>Fin</th>
        </tr>
        <tr>
          <td>${horse.calls.first}</td>
          <td>${horse.calls.second}</td>
          <td>${horse.calls.stretch}</td>
          <td>${horse.calls.finish}</td>
        </tr>
      </table>
    </div>
  `;
  return box;
}

function lengthsToSeconds(lengths) {
  return lengths * LENGTH_TO_SEC;
}

function averageSpeed(timesArray) {
  if (!timesArray || !timesArray.length) return 0;
  return timesArray.reduce((sum, t) => sum + t, 0) / timesArray.length;
}

function normalizeSpeed(horseSpeed, fieldAvg) {
  if (fieldAvg === 0) return 0;
  return ((fieldAvg - horseSpeed) / fieldAvg) * 100;
}

function weightedScore(horse, weights) {
  return Number(
    (
      horse.speedScore * weights.speed +
      horse.workoutScore * weights.workouts +
      horse.jockeyScore * weights.jockey +
      horse.trainerScore * weights.trainer +
      horse.trackScore * weights.track +
      horse.styleScore * weights.style +
      horse.troubleScore * weights.trouble
    ).toFixed(1)
  );
}

let raceHorses = [];

function analyzeRace() {
  raceHorses.forEach(h => {
    h.avgTime = averageSpeed(h.pastTimes || []);
  });

  const fieldAvg = averageSpeed(raceHorses.map(h => h.avgTime));

  raceHorses.forEach(h => {
    const adv = normalizeSpeed(h.avgTime, fieldAvg);
    h.speedScore = 100 + adv;
  });

  raceHorses.forEach(h => {
    h.totalScore = weightedScore(h, weights);
  });

  raceHorses.sort((a, b) => b.totalScore - a.totalScore);

  const totalSum = raceHorses.reduce((sum, h) => sum + h.totalScore, 0);
  raceHorses.forEach(h => {
    h.probability = ((h.totalScore / totalSum) * 100).toFixed(1) + "%";
  });

  let output = "=== Race Analysis Results ===\n\n";
  raceHorses.forEach((h, i) => {
    output += `${i + 1}. ${h.name}\n`;
    output += `   Score: ${h.totalScore}\n`;
    output += `   Probability: ${h.probability}\n\n`;
  });

  let box = document.createElement("pre");
  box.style.whiteSpace = "pre-wrap";
  box.style.background = "#111";
  box.style.color = "#0f0";
  box.style.padding = "15px";
  box.style.border = "1px solid #333";
  box.style.marginTop = "10px";
  box.innerText = output;

  document.body.appendChild(box);
}

// ===============================
// EVENT LISTENERS (attach last)
// ===============================
window.onload = () => {
  // Visual confirmation that onload fired (remove later)
  try { console.log("analyzer.js: window.onload fired"); } catch (e) {}

  const fileEl = document.getElementById("pdfFile");
  const runBtn = document.getElementById("runAnalysis");

  if (fileEl) fileEl.addEventListener("change", handlePDF);
  else alert("ERROR: #pdfFile element not found in DOM");

  if (runBtn) runBtn.addEventListener("click", analyzePDF);
  else alert("ERROR: #runAnalysis button not found in DOM");
};
