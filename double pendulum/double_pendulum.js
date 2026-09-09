// HTML Canvas & UI Elements
const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');

const playButton = document.getElementById('playButton');
const pauseButton = document.getElementById('pauseButton');
const resetButton = document.getElementById('resetButton');
const timeDisplay = document.getElementById('timeDisplay');

// ---------------------------------------------------------------------
// Constants & Configuration (matching double_pendulum.py)
// ---------------------------------------------------------------------
const G = 9.8;          // acceleration due to gravity, in m/s^2[cite: 4]
const L1 = 1.0;         // length of pendulum 1 in m[cite: 4]
const L2 = 1.0;         // length of pendulum 2 in m[cite: 4]
const L = L1 + L2;      // maximal length of combined pendulum[cite: 4]
const M1 = 5.0;         // mass of pendulum 1 in kg[cite: 4]
const M2 = 5.0;         // mass of pendulum 2 in kg[cite: 4]
const tStop = 10;       // how many seconds to simulate[cite: 4]
const historyLen = 50;  // how many trajectory points to display in the trace[cite: 4]
const dt = 0.01;        // time step[cite: 4]

// Initial state (angles converted from 90° degrees to radians)[cite: 4]
const th1 = (90.0 * Math.PI) / 180.0;
const w1 = 0.0;
const th2 = (90.0 * Math.PI) / 180.0;
const w2 = 0.0;

// ---------------------------------------------------------------------
// Derivatives (exact Python derivs function)
// ---------------------------------------------------------------------
function derivs(state) {
  const dydx = [0, 0, 0, 0];

  dydx[0] = state[1];

  const delta = state[2] - state[0]; // state[2] = theta2, state[0] = theta1[cite: 4]
  const den1 = (M1 + M2) * L1 - M2 * L1 * Math.cos(delta) * Math.cos(delta);

  dydx[1] =
    (M2 * L1 * state[1] * state[1] * Math.sin(delta) * Math.cos(delta) +
      M2 * G * Math.sin(state[2]) * Math.cos(delta) +
      M2 * L2 * state[3] * state[3] * Math.sin(delta) -
      (M1 + M2) * G * Math.sin(state[0])) /
    den1;

  dydx[2] = state[3];

  const den2 = (L2 / L1) * den1;

  dydx[3] =
    (-M2 * L2 * state[3] * state[3] * Math.sin(delta) * Math.cos(delta) +
      (M1 + M2) * G * Math.sin(state[0]) * Math.cos(delta) -
      (M1 + M2) * L1 * state[1] * state[1] * Math.sin(delta) -
      (M1 + M2) * G * Math.sin(state[2])) /
    den2;

  return dydx;
}

// ---------------------------------------------------------------------
// Euler's Integration Pre-computation
// ---------------------------------------------------------------------
const numSteps = Math.floor(tStop / dt);
const t = new Float64Array(numSteps);
const x1 = new Float64Array(numSteps);
const y1 = new Float64Array(numSteps);
const x2 = new Float64Array(numSteps);
const y2 = new Float64Array(numSteps);

let currentState = [th1, w1, th2, w2];

for (let i = 0; i < numSteps; i++) {
  t[i] = i * dt;

  const theta1 = currentState[0];
  const theta2 = currentState[2];

  // Cartesian coordinates (matching y-axis orientation in Python)
  x1[i] = L1 * Math.sin(theta1);
  y1[i] = -L1 * Math.cos(theta1);

  x2[i] = L2 * Math.sin(theta2) + x1[i];
  y2[i] = -L2 * Math.cos(theta2) + y1[i];

  // Euler Integration step: y[i] = y[i-1] + derivs(y[i-1]) * dt
  const dState = derivs(currentState);
  for (let j = 0; j < 4; j++) {
    currentState[j] += dState[j] * dt;
  }
}

// ---------------------------------------------------------------------
// Render & Animation Control
// ---------------------------------------------------------------------
let currentIndex = 0;
let isRunning = false;
let animationFrameId = null;

function renderFrame(i) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const originX = canvas.width / 2;
  const originY = canvas.height / 2;
  
  // Scale meter dimensions to canvas pixels based on maximal pendulum length
  const scale = Math.min(canvas.width, canvas.height) / (2 * L + 1.0);

  // Map physical coordinates (X, Y) to canvas screen space (inverted canvas Y)
  const px1 = originX + x1[i] * scale;
  const py1 = originY - y1[i] * scale;

  const px2 = originX + x2[i] * scale;
  const py2 = originY - y2[i] * scale;

  // 1. Draw Trace History (trace disappears behind the pendulum)[cite: 4]
  const start = Math.max(0, i - historyLen);
  if (i > start) {
    ctx.beginPath();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5;

    for (let k = start; k < i; k++) {
      const tx = originX + x2[k] * scale;
      const ty = originY - y2[k] * scale;

      if (k === start) {
        ctx.moveTo(tx, ty);
      } else {
        ctx.lineTo(tx, ty);
      }
    }
    ctx.stroke();
  }

  // 2. Draw Pendulum Rods ('o-')
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(px1, py1);
  ctx.lineTo(px2, py2);
  ctx.strokeStyle = '#151515';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 3. Draw Joints / Bob Dots ('o')
  const drawCircle = (x, y, r, color) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  };

  drawCircle(originX, originY, 4, '#6a6a6a'); // Pivot
  drawCircle(px1, py1, 6, '#151515');       // Mass 1
  drawCircle(px2, py2, 6, '#151515');       // Mass 2

  // Update UI Time Text
  timeDisplay.textContent = `time = ${(i * dt).toFixed(1)}s`;
}

function animate() {
  if (!isRunning) return;

  renderFrame(currentIndex);
  currentIndex++;

  if (currentIndex >= numSteps) {
    isRunning = false;
    return;
  }

  // Loop around ~100 FPS (dt = 0.01s = 10ms per frame)
  animationFrameId = setTimeout(() => {
    requestAnimationFrame(animate);
  }, dt * 1000);
}

// ---------------------------------------------------------------------
// Event Listeners & Canvas Resizing
// ---------------------------------------------------------------------
function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  renderFrame(currentIndex);
}

playButton.addEventListener('click', () => {
  if (!isRunning && currentIndex < numSteps) {
    isRunning = true;
    animate();
  }
});

pauseButton.addEventListener('click', () => {
  isRunning = false;
  clearTimeout(animationFrameId);
});

resetButton.addEventListener('click', () => {
  isRunning = false;
  clearTimeout(animationFrameId);
  currentIndex = 0;
  renderFrame(0);
});

window.addEventListener('resize', resizeCanvas);

// Initialize canvas
resizeCanvas();