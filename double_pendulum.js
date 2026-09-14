// Canvas & UI elements
const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');

const playButton = document.getElementById('playButton');
const pauseButton = document.getElementById('pauseButton');
const resetButton = document.getElementById('resetButton');
const timeDisplay = document.getElementById('timeDisplay');

// Parameter inputs
const inputL1 = document.getElementById('inputL1');
const inputL2 = document.getElementById('inputL2');
const inputTh1 = document.getElementById('inputTh1');
const inputTh2 = document.getElementById('inputTh2');
const inputM1 = document.getElementById('inputM1');
const inputM2 = document.getElementById('inputM2');
const inputTStop = document.getElementById('inputTStop');

const G = 9.8;
const dt = 0.01;

// Simulation variables
let L1, L2, M1, M2, tStop;
let state = [0, 0, 0, 0];
let traceHistory = [];
let simTime = 0.0;
let isRunning = false;
let animationFrameId = null;

function readInputs() {
  L1 = parseFloat(inputL1.value) || 1.0;
  L2 = parseFloat(inputL2.value) || 1.0;
  M1 = parseFloat(inputM1.value) || 5.0;
  M2 = parseFloat(inputM2.value) || 5.0;
  tStop = parseFloat(inputTStop.value) || 10.0;
}

function resetSimulation() {
  isRunning = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  readInputs();

  const th1Rad = ((parseFloat(inputTh1.value) || 0) * Math.PI) / 180;
  const th2Rad = ((parseFloat(inputTh2.value) || 0) * Math.PI) / 180;

  state = [th1Rad, 0, th2Rad, 0];
  traceHistory = [];
  simTime = 0.0;
  timeDisplay.textContent = 'time = 0.0s';

  renderFrame();
}

function derivs(s) {
  const dydx = [0, 0, 0, 0];
  dydx[0] = s[1];

  const delta = s[2] - s[0];
  const den1 = (M1 + M2) * L1 - M2 * L1 * Math.cos(delta) * Math.cos(delta);

  dydx[1] =
    (M2 * L1 * s[1] * s[1] * Math.sin(delta) * Math.cos(delta) +
      M2 * G * Math.sin(s[2]) * Math.cos(delta) +
      M2 * L2 * s[3] * s[3] * Math.sin(delta) -
      (M1 + M2) * G * Math.sin(s[0])) /
    (den1 || 1e-6);

  dydx[2] = s[3];

  const den2 = (L2 / L1) * den1;

  dydx[3] =
    (-M2 * L2 * s[3] * s[3] * Math.sin(delta) * Math.cos(delta) +
      (M1 + M2) * G * Math.sin(s[0]) * Math.cos(delta) -
      (M1 + M2) * L1 * s[1] * s[1] * Math.sin(delta) -
      (M1 + M2) * G * Math.sin(s[2])) /
    (den2 || 1e-6);

  return dydx;
}

function stepPhysics() {
  const dState = derivs(state);
  for (let j = 0; j < 4; j++) {
    state[j] += dState[j] * dt;
  }
  simTime += dt;
}

function renderFrame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const originX = canvas.width / 2;
  const originY = canvas.height / 2;
  const totalL = (L1 || 1.0) + (L2 || 1.0);
  const scale = Math.min(canvas.width, canvas.height) / (2 * totalL + 1.0);

  const x1 = L1 * Math.sin(state[0]);
  const y1 = -L1 * Math.cos(state[0]);
  const x2 = L2 * Math.sin(state[2]) + x1;
  const y2 = -L2 * Math.cos(state[2]) + y1;

  const px1 = originX + x1 * scale;
  const py1 = originY - y1 * scale;
  const px2 = originX + x2 * scale;
  const py2 = originY - y2 * scale;

  // Track trajectory
  traceHistory.push({ x: px2, y: py2 });
  if (traceHistory.length > 100) traceHistory.shift();

  // 1. Draw Trace
  if (traceHistory.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = '#ff7f0e';
    ctx.lineWidth = 1.5;
    ctx.moveTo(traceHistory[0].x, traceHistory[0].y);
    for (let i = 1; i < traceHistory.length; i++) {
      ctx.lineTo(traceHistory[i].x, traceHistory[i].y);
    }
    ctx.stroke();
  }

  // 2. Draw Rods
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(px1, py1);
  ctx.lineTo(px2, py2);
  ctx.strokeStyle = '#0066ff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 3. Draw Joints
  const drawCircle = (x, y, r, color) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  };

  drawCircle(originX, originY, 4, '#6a6a6a');
  drawCircle(px1, py1, 6, '#0066ff');
  drawCircle(px2, py2, 6, '#0066ff');

  timeDisplay.textContent = `time = ${simTime.toFixed(1)}s`;
}

function animate() {
  if (!isRunning) return;

  stepPhysics();
  renderFrame();

  if (simTime >= tStop) {
    isRunning = false;
    cancelAnimationFrame(animationFrameId);
    return;
  }

  animationFrameId = requestAnimationFrame(animate);
}

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width || 600;
  canvas.height = rect.height || 500;
  renderFrame();
}

// Event Listeners
playButton.addEventListener('click', () => {
  readInputs();
  if (simTime >= tStop) {
    simTime = 0.0;
  }
  if (!isRunning) {
    isRunning = true;
    animate();
  }
});

pauseButton.addEventListener('click', () => {
  isRunning = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
});

resetButton.addEventListener('click', resetSimulation);

[inputL1, inputL2, inputTh1, inputTh2, inputM1, inputM2, inputTStop].forEach((input) => {
  input.addEventListener('change', resetSimulation);
});

window.addEventListener('resize', resizeCanvas);

window.addEventListener('DOMContentLoaded', () => {
  resizeCanvas();
  resetSimulation();
});

// Initial invocation
resizeCanvas();
resetSimulation();