
// ===============================
// PDF LOADING SYSTEM
// ===============================
function log(msg) {
  const box = document.getElementById("jsConsole");
  box.innerText += msg + "\n";
}
// MUST COME FIRST — Safari requires this BEFORE any PDF.js calls
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.142/pdf.worker.min.js";



let pdfText = "";

// --- SINGLE VALID PDF HANDLER ---
async function handlePDF(event) {
    log("handlePDF triggered");
  console.log("HANDLE PDF FIRED");
  const file = event.target.files[0];
    log("File object = " + file);
  if (!file) return;

  document.getElementById("pdfStatus").innerText = "Reading PDF...";

  const arrayBuffer = await file.arrayBuffer();
    log("ArrayBuffer loaded");
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    fullText += strings.join(" ") + "\n\n";
  }

  pdfText = fullText;

  document.getElementById("pdfStatus").innerText =
    "PDF Loaded Successfully (" + pdf.numPages + " pages)";
}

// --- ANALYZE PDF ---
function analyzePDF() {
  if (!pdfText) {
    alert("Please upload a PDF first.");
    return;
  }

  console.log("=== RAW PDF TEXT ===");
  console.log(pdfText);

  // Parsing will go here later
}

// ===============================
// CONFIGURATION
// ===============================
const LENGTH_TO_SEC = 1 / 6; // placeholder until LPS table is integrated

const weights = {
  speed: 0.4,
  workouts: 0.15,
  jockey: 0.1,
  trainer: 0.1,
  track: 0.1,
  style: 0.05,
  trouble: 0.1
};

// ===============================
// CORE UI
// ===============================
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

// ===============================
// CORE CALC FUNCTIONS
// ===============================
function lengthsToSeconds(lengths) {
  return lengths * LENGTH_TO_SEC;
}

function averageSpeed(timesArray) {
  if (!timesArray.length) return 0;
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

// ===============================
// EMPTY RACE HORSES LIST
// ===============================
let raceHorses = [];

// ===============================
// MAIN ANALYZER FUNCTION
// ===============================
function analyzeRace() {
  raceHorses.forEach(h => {
    h.avgTime = averageSpeed(h.pastTimes);
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
window.onload = () => {
  document.getElementById("pdfFile").addEventListener("change", handlePDF);
  document.getElementById("runAnalysis").addEventListener("click", analyzePDF);
};
