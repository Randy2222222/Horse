// ===============================
// HORSE RACING ANALYZER ENGINE
// Phase 1: Core Calculations
// ===============================

// === CONFIGURATION ===
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

// === CORE FUNCTIONS ===
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

// === TEMP TEST DATA ===
const raceHorses = [
  {
    name: "Bold Crusader",
    pastTimes: [95.3, 96.2, 94.8],
    workoutScore: 82,
    jockeyScore: 85,
    trainerScore: 80,
    trackScore: 88,
    styleScore: 90,
    troubleScore: 70
  },
  {
    name: "River Master",
    pastTimes: [96.8, 97.2, 95.9],
    workoutScore: 79,
    jockeyScore: 90,
    trainerScore: 84,
    trackScore: 85,
    styleScore: 88,
    troubleScore: 80
  },
  {
    name: "Iron Wind",
    pastTimes: [97.5, 96.7, 97.2],
    workoutScore: 84,
    jockeyScore: 77,
    trainerScore: 83,
    trackScore: 86,
    styleScore: 82,
    troubleScore: 75
  }
];

// === MAIN ANALYZER FUNCTION ===
function analyzeRace() {
  // 1. Compute average times
  raceHorses.forEach(h => h.avgTime = averageSpeed(h.pastTimes));

  // 2. Find field average
  const fieldAvg = averageSpeed(raceHorses.map(h => h.avgTime));

  // 3. Compute speed scores
  raceHorses.forEach(h => {
    const advantage = normalizeSpeed(h.avgTime, fieldAvg);
    h.speedScore = 100 + advantage;
  });

  // 4. Weighted totals
  raceHorses.forEach(h => h.totalScore = weightedScore(h, weights));

  // 5. Sort by score
  raceHorses.sort((a, b) => b.totalScore - a.totalScore);

  // 6. Probability share
  const totalSum = raceHorses.reduce((sum, h) => sum + h.totalScore, 0);
  raceHorses.forEach(h => {
    h.probability = ((h.totalScore / totalSum) * 100).toFixed(1) + "%";
  });

  // 7. Build output
  let output = "=== Race Analysis Results ===\n\n";
  raceHorses.forEach((h, i) => {
    output += `${i + 1}. ${h.name}\n`;
    output += `   Score: ${h.totalScore}\n`;
    output += `   Probability: ${h.probability}\n\n`;
  });

  document.getElementById("output").textContent = output;
}

// Run once on page load
window.onload = analyzeRace;
