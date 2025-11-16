// Sample horse data (you'll replace this with parsed Brisnet data)
const sampleHorse = {
  name: "Total Val",
  jockey: "Flavien Prat",
  post: 4,
  races: [
    { date: "Aug 25", distanceF: 5.5, finalTimeS: 63.4 },
    { date: "Sep 25", distanceF: 5.5, finalTimeS: 63.8 },
    { date: "Oct 25", distanceF: 8.0, finalTimeS: 92.4 }
  ]
};

function renderHorse(horse) {
  const output = document.getElementById("program-output");

  const div = document.createElement("div");
  div.classList.add("race-block");
  div.innerHTML = `
    <h2>#${horse.post} — ${horse.name}</h2>
    <p><strong>Jockey:</strong> ${horse.jockey}</p>
    <canvas id="graph-${horse.post}" width="400" height="100" class="graph-container"></canvas>
  `;
  output.appendChild(div);

  // Extract seconds-per-furlong values
  const times = horse.races.map(r => r.finalTimeS / r.distanceF);
  drawPerformanceGraph(`graph-${horse.post}`, times);
}

// Run on load
window.onload = () => {
  renderHorse(sampleHorse);
};
