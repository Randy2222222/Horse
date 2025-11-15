// ===============================
// ===============================
// PDF LOADING SYSTEM
// ===============================

document.getElementById("pdfFile").addEventListener("change", handlePDF);
document.getElementById("runAnalysis").addEventListener("click", analyzePDF);

let pdfText = "";

// REQUIRED worker file
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.142/pdf.worker.min.js";

async function handlePDF(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById("pdfStatus").innerText = "Reading PDF...";

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
  document.getElementById("pdfStatus").innerText =
    "PDF Loaded Successfully (" + pdf.numPages + " pages)";
}
async function handlePDF(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById("pdfStatus").innerText = "Reading PDF...";

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
  document.getElementById("pdfStatus").innerText =
    "PDF Loaded Successfully (" + pdf.numPages + " pages)";
}


function analyzePDF() {
  if (!pdfText) {
    alert("Please upload a PDF first.");
    return;
  }

  console.log("=== RAW PDF TEXT ===");
  console.log(pdfText);

  // Later — we will parse horses here
}
// === CONFIGURATION ===
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

// === CORE UI (not used yet, but correct) ===
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

// === CORE CALC FUNCTIONS ===
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

// =========================================================
// === SINGLE CLEAN TEST BLOCK (ONLY ONE!) ===
// =========================================================
let raceHorses = []; // empty till PDF loads
/* temporary test horses
  {
    name: "Fast Rocket",
    raceInfo: "6f Allowance",
    pastTimes: [70.2, 70.5, 69.8],
    calls: { first: "3rd", second: "2nd", stretch: "1st", finish: "1st" },
    workoutScore: 80,
    jockeyScore: 85,
    trainerScore: 82,
    trackScore: 78,
    styleScore: 70,
    troubleScore: 90
  },
  {
    name: "Silver Thunder",
    raceInfo: "6f Allowance",
    pastTimes: [71.4, 71.1, 71.7],
    calls: { first: "6th", second: "5th", stretch: "4th", finish: "3rd" },
    workoutScore: 88,
    jockeyScore: 80,
    trainerScore: 81,
    trackScore: 79,
    styleScore: 75,
    troubleScore: 70
  },
  {
    name: "Golden Dash",
    raceInfo: "6f Allowance",
    pastTimes: [70.9, 70.7, 70.8],
    calls: { first: "4th", second: "3rd", stretch: "3rd", finish: "2nd" },
    workoutScore: 75,
    jockeyScore: 78,
    trainerScore: 83,
    trackScore: 82,
    styleScore: 72,
    troubleScore: 65
  }
];*/

// === MAIN ANALYZER FUNCTION ===
function analyzeRace() {
  // Compute averages
  raceHorses.forEach(h => {
    h.avgTime = averageSpeed(h.pastTimes);
  });

  // Field average
  const fieldAvg = averageSpeed(raceHorses.map(h => h.avgTime));

  // Speed scores
  raceHorses.forEach(h => {
    const adv = normalizeSpeed(h.avgTime, fieldAvg);
    h.speedScore = 100 + adv;
  });

  // Weighted totals
  raceHorses.forEach(h => {
    h.totalScore = weightedScore(h, weights);
  });

  // Sort by highest score
  raceHorses.sort((a, b) => b.totalScore - a.totalScore);

  // Probabilities
  const totalSum = raceHorses.reduce((sum, h) => sum + h.totalScore, 0);
  raceHorses.forEach(h => {
    h.probability = ((h.totalScore / totalSum) * 100).toFixed(1) + "%";
  });

  // Output
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
