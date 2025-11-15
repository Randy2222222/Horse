// ===============================
// HORSE RACING ANALYZER ENGINE
// Phase 1: Core Calculations
// ===============================

// === CONFIGURATION ===
const LENGTH_TO_SEC = 1 / 6; // placeholder until your LPS table is integrated
const weights = {
  speed: 0.4,
  workouts: 0.15,
  jockey: 0.1,
  trainer: 0.1,
  track: 0.1,
  style: 0.05,
  trouble: 0.1
};

// === CORE UI PIECE (NOT USED YET, KEEPS CODE COMPLETE) ===
function createHorsePPBox(horse) {
  const box = document.createElement("div");
  box.className = "horse-pp-box";

  box.innerHTML = `
    <h3 class="horse-name">${horse.name}</h3>
    <div class="race-info">${horse.raceInfo}</div>

    <div class="compact-calls">
      <table>
        <tr>
          <th>1st</th>
          <th>2nd</th>
          <th>Str</th>
          <th>Fin</th>
        </tr>
        <tr>
          <td class="call-1st">${horse.calls.first}</td>
          <td class="call-2nd">${horse.calls.second}</td>
          <td class="call-str">${horse.calls.stretch}</td>
          <td class="call-fin">${horse.calls.finish}</td>
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
  const total = timesArray.reduce((sum, t) => sum + t, 0);
  return total / timesArray.length;
}

function normalizeSpeed(horseSpeed, fieldAvg) {
  if (fieldAvg === 0) return 0;
  return ((fieldAvg - horseSpeed) / fieldAvg) * 100;
}

function weightedScore(horse, weights) {
  const total =
    horse.speedScore * weights.speed +
    horse.workoutScore * weights.workouts +
    horse.jockeyScore * weights.jockey +
    horse.trainerScore * weights.trainer +
    horse.trackScore * weights.track +
    horse.styleScore * weights.style +
    horse.troubleScore * weights.trouble;

  return Number(total.toFixed(1));
}

// =======================================
// TEMP TEST DATA — REMOVE AFTER PDF INPUT
// =======================================
const raceHorses = [
  {
    name: "Horse A",
    raceInfo: "Test Race — 6f",
    pastTimes: [71.2, 70.8, 72.1],  // seconds
    calls: { first: "2nd", second: "1st", stretch: "1st", finish: "1st" },
    workoutScore: 85,
    jockeyScore: 90,
    trainerScore: 88,
    trackScore: 80,
    styleScore: 75,
    troubleScore: 95
  },
  {
    name: "Horse B",
    raceInfo: "Test Race — 6f",
    pastTimes: [73.1, 72.8, 74.0],
    calls: { first: "5th", second: "3rd", stretch: "2nd", finish: "2nd" },
    workoutScore: 70,
    jockeyScore: 82,
    trainerScore: 90,
    trackScore: 78,
    styleScore: 72,
    troubleScore: 88
  },
  {
    name: "Horse C",
    raceInfo: "Test Race — 6f",
    pastTimes: [75.0, 74.3, 74.9],
    calls: { first: "7th", second: "6th", stretch: "5th", finish: "4th" },
    workoutScore: 65,
    jockeyScore: 70,
    trainerScore: 75,
    trackScore: 72,
    styleScore: 60,
    troubleScore: 80
  }
];
// === MAIN ANALYZER FUNCTION ===
function analyzeRace() {
  // 1. Compute each horse's average time
  raceHorses.forEach(h => {
    h.avgTime = averageSpeed(h.pastTimes);
  });

  // 2. Field average
  const fieldAvg = averageSpeed(raceHorses.map(h => h.avgTime));

  // 3. Speed scores
  raceHorses.forEach(h => {
    const adv = normalizeSpeed(h.avgTime, fieldAvg);
    h.speedScore = 100 + adv;
  });

  // 4. Weighted totals
  raceHorses.forEach(h => {
    h.totalScore = weightedScore(h, weights);
  });

  // 5. Sort by highest score
  raceHorses.sort((a, b) => b.totalScore - a.totalScore);

  // 6. Probability %
  const totalSum = raceHorses.reduce((sum, h) => sum + h.totalScore, 0);
  raceHorses.forEach(h => {
    h.probability = ((h.totalScore / totalSum) * 100).toFixed(1) + "%";
  });

  // 7. Output
  let output = "=== Race Analysis Results ===\n\n";
  raceHorses.forEach((h, i) => {
    output += `${i + 1}. ${h.name}\n`;
    output += `   Score: ${h.totalScore}\n`;
    output += `   Probability: ${h.probability}\n\n`;
  });

  console.log(output);
}

// =========================================================
// === TEST BLOCK (Temporary until PDF reading is added) ===
// =========================================================

let raceHorses = [
  {
    name: "Fast Rocket",
    pastTimes: [70.2, 70.5, 69.8], // seconds
    workoutScore: 80,
    jockeyScore: 85,
    trainerScore: 82,
    trackScore: 78,
    styleScore: 70,
    troubleScore: 90,
    calls: { first: "3rd", second: "2nd", stretch: "1st", finish: "1st" },
    raceInfo: "6f Allowance"
  },
  {
    name: "Silver Thunder",
    pastTimes: [71.4, 71.1, 71.7],
    workoutScore: 88,
    jockeyScore: 80,
    trainerScore: 81,
    trackScore: 79,
    styleScore: 75,
    troubleScore: 70,
    calls: { first: "6th", second: "5th", stretch: "4th", finish: "3rd" },
    raceInfo: "6f Allowance"
  },
  {
    name: "Golden Dash",
    pastTimes: [70.9, 70.7, 70.8],
    workoutScore: 75,
    jockeyScore: 78,
    trainerScore: 83,
    trackScore: 82,
    styleScore: 72,
    troubleScore: 65,
    calls: { first: "4th", second: "3rd", stretch: "3rd", finish: "2nd" },
    raceInfo: "6f Allowance"
  }
];

// Run once on page load
window.onload = analyzeRace;
