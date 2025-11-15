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

function createHorsePPBox(horse) {
  // Create container
  const box = document.createElement("div");
  box.className = "horse-pp-box";

  // Build the PP box HTML
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
    output += `   Probability: ${h.probability}\n`;
}

// Run once on page load
window.onload = analyzeRace;
