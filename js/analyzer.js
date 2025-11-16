// js/analyzer.js (instrumented test version)
const GITHUB_PDF_URL = "https://raw.githubusercontent.com/Randy2222222/REPO/main/bw_pdf_viewer.php.pdf";
console.log("analyzer.js: script loaded");

let loadedPDF = null;   // Will store the PDF object after loading

// -------------------------
// 1. FILE UPLOAD LISTENER
// -------------------------
document.getElementById("pdfFile").addEventListener("change", async function (event) {
    const file = event.target.files[0];
    if (!file) {
        updateStatus("No file selected.");
        return;
    }

    updateStatus("Reading PDF...");

    try {
        const arrayBuffer = await file.arrayBuffer();

        // Load PDF using pdf.js
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        loadedPDF = pdf;

        updateStatus(`PDF loaded successfully! Pages: ${pdf.numPages}`);
        console.log("PDF loaded:", pdf);

    } catch (err) {
        console.error("PDF load error:", err);
        updateStatus("Error loading PDF.");
    }
});

// -----------------------------
// 2. RUN ANALYSIS BUTTON
// -----------------------------
document.getElementById("runAnalysis").addEventListener("click", function () {

    if (!loadedPDF) {
        updateStatus("❌ No PDF loaded. Please upload a file first.");
        return;
    }

    updateStatus("Running analysis... (not implemented yet)");

    // Later: Here we will parse text and analyze horses
});

// -----------------------------
// Helper: update UI status text
// -----------------------------
function updateStatus(msg) {
    document.getElementById("pdfStatus").textContent = msg;
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
