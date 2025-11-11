// Creates a horizontal "wave" line graph based on times (in seconds)
function drawPerformanceGraph(canvasId, times) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Normalize times (faster = higher)
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const scale = (t) => h - ((t - minT) / (maxT - minT)) * (h * 0.8) - h * 0.1;

  ctx.beginPath();
  ctx.moveTo(0, scale(times[0]));

  const step = w / (times.length - 1);
  for (let i = 1; i < times.length; i++) {
    ctx.lineTo(i * step, scale(times[i]));
  }

  ctx.strokeStyle = "#0077cc";
  ctx.lineWidth = 2;
  ctx.stroke();
}
