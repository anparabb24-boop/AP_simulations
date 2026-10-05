const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');

const playButton = document.getElementById('playButton');
const pauseButton = document.getElementById('pauseButton');
const resetButton = document.getElementById('resetButton');
const downloadCsvButton = document.getElementById('downloadCsvButton');
const timeDisplay = document.getElementById('timeDisplay');
const inputLinkCount = document.getElementById('inputLinkCount');
const linkParameters = document.getElementById('linkParameters');
const inputTStop = document.getElementById('inputTStop');
const inputCsvSampleRate = document.getElementById('inputCsvSampleRate');
const massVelocityPanel = document.getElementById('massVelocityPanel');
const massVelocityTitle = document.getElementById('massVelocityTitle');
const initialTangentialVelocityInput = document.getElementById('initialTangentialVelocity');
const massVelocityVector = document.getElementById('massVelocityVector');
const closeMassVelocityPanelButton = document.getElementById('closeMassVelocityPanel');

const G = 9.8;
const dt = 0.01;
const MAX_LINKS = 20;

let links = [];
let initialAngularVelocities = [];
let renderedMassPositions = [];
let selectedMassIndex = -1;
let tStop = 10;
let csvSampleRate = 100;
let state = [];
let traceHistory = [];
let timeSeriesData = [];
let nextCsvSampleTime = 0;
let simTime = 0;
let isRunning = false;
let animationFrameId = null;

function clampLinkCount(value) {
  return Math.min(MAX_LINKS, Math.max(1, Math.round(Number(value) || 2)));
}

function readLinkSettings() {
  return Array.from(linkParameters.querySelectorAll('.link-parameter')).map((row) => ({
    length: Math.max(parseFloat(row.querySelector('[data-setting="length"]').value) || 1, 0.1),
    angle: (parseFloat(row.querySelector('[data-setting="angle"]').value) || 0) * Math.PI / 180,
    mass: Math.max(parseFloat(row.querySelector('[data-setting="mass"]').value) || 5, 0.1),
  }));
}

function renderLinkInputs(count, previousLinks = readLinkSettings()) {
  const safeCount = clampLinkCount(count);
  const previousVelocities = initialAngularVelocities;
  inputLinkCount.value = safeCount;
  linkParameters.innerHTML = Array.from({ length: safeCount }, (_, index) => {
    const link = previousLinks[index] || { length: 1, angle: Math.PI / 2, mass: 5 };
    const angleDegrees = (link.angle * 180) / Math.PI;
    return `
      <div class="link-parameter">
        <h3>Link ${index + 1}</h3>
        <div class="link-parameter-fields">
          <label>Length (m)<input type="number" data-setting="length" value="${link.length}" step="0.1" min="0.1" /></label>
          <label>Angle (°)<input type="number" data-setting="angle" value="${angleDegrees}" step="1" /></label>
          <label>Mass (kg)<input type="number" data-setting="mass" value="${link.mass}" step="0.5" min="0.1" /></label>
        </div>
      </div>`;
  }).join('');
  initialAngularVelocities = Array.from({ length: safeCount }, (_, index) => previousVelocities[index] || 0);
}

function readInputs() {
  links = readLinkSettings();
  initialAngularVelocities = links.map((_, index) => initialAngularVelocities[index] || 0);
  tStop = Math.max(parseFloat(inputTStop.value) || 10, dt);
  csvSampleRate = Math.min(Math.max(parseFloat(inputCsvSampleRate.value) || 100, 0.1), 1 / dt);
}

function resetSimulation() {
  isRunning = false;
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  readInputs();
  state = links.map((link) => link.angle).concat(initialAngularVelocities);
  traceHistory = [];
  simTime = 0;
  timeSeriesData = [];
  recordTimeSeriesPoint();
  nextCsvSampleTime = 1 / csvSampleRate;
  timeDisplay.textContent = 'time = 0.0s';
  updateMassVelocityReadout();
  renderFrame();
}

function solveLinearSystem(matrix, vector) {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let column = 0; column < size; column++) {
    let pivot = column;
    for (let row = column + 1; row < size; row++) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];

    const divisor = augmented[column][column] || 1e-12;
    for (let entry = column; entry <= size; entry++) augmented[column][entry] /= divisor;

    for (let row = 0; row < size; row++) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let entry = column; entry <= size; entry++) {
        augmented[row][entry] -= factor * augmented[column][entry];
      }
    }
  }

  return augmented.map((row) => row[size]);
}

function derivs(currentState) {
  const count = links.length;
  const angles = currentState.slice(0, count);
  const velocities = currentState.slice(count);
  const downstreamMass = Array(count).fill(0);
  let runningMass = 0;
  for (let index = count - 1; index >= 0; index--) {
    runningMass += links[index].mass;
    downstreamMass[index] = runningMass;
  }

  const massMatrix = Array.from({ length: count }, () => Array(count).fill(0));
  for (let row = 0; row < count; row++) {
    for (let column = 0; column < count; column++) {
      const sharedMass = downstreamMass[Math.max(row, column)];
      massMatrix[row][column] = links[row].length * links[column].length * sharedMass *
        Math.cos(angles[row] - angles[column]);
    }
  }

  const massDerivative = (row, column, coordinate) => {
    const coefficient = links[row].length * links[column].length * downstreamMass[Math.max(row, column)];
    const indexDifference = Number(row === coordinate) - Number(column === coordinate);
    return -coefficient * Math.sin(angles[row] - angles[column]) * indexDifference;
  };

  const forces = Array(count).fill(0);
  for (let i = 0; i < count; i++) {
    forces[i] = G * links[i].length * downstreamMass[i] * Math.sin(angles[i]);
    for (let j = 0; j < count; j++) {
      for (let k = 0; k < count; k++) {
        const christoffel = 0.5 * (
          massDerivative(i, j, k) + massDerivative(i, k, j) - massDerivative(j, k, i)
        );
        forces[i] += christoffel * velocities[j] * velocities[k];
      }
    }
  }

  const accelerations = solveLinearSystem(massMatrix, forces.map((force) => -force));
  return velocities.concat(accelerations);
}

function addScaledState(base, derivative, scale) {
  return base.map((value, index) => value + derivative[index] * scale);
}

function stepPhysics() {
  const k1 = derivs(state);
  const k2 = derivs(addScaledState(state, k1, dt / 2));
  const k3 = derivs(addScaledState(state, k2, dt / 2));
  const k4 = derivs(addScaledState(state, k3, dt));
  state = state.map((value, index) => value + (dt / 6) * (
    k1[index] + 2 * k2[index] + 2 * k3[index] + k4[index]
  ));
  simTime += dt;

  if (simTime + Number.EPSILON >= nextCsvSampleTime) {
    recordTimeSeriesPoint();
    const samplePeriod = 1 / csvSampleRate;
    do {
      nextCsvSampleTime += samplePeriod;
    } while (nextCsvSampleTime <= simTime + Number.EPSILON);
  }
}

function getPendulumCoordinates() {
  let x = 0;
  let y = 0;
  return links.map((link, index) => {
    x += link.length * Math.sin(state[index]);
    y -= link.length * Math.cos(state[index]);
    return { x, y };
  });
}

function getMassVelocity(index) {
  let vx = 0;
  let vy = 0;
  for (let linkIndex = 0; linkIndex <= index; linkIndex++) {
    const angularVelocity = initialAngularVelocities[linkIndex] || 0;
    const angle = links[linkIndex].angle;
    vx += links[linkIndex].length * Math.cos(angle) * angularVelocity;
    vy += links[linkIndex].length * Math.sin(angle) * angularVelocity;
  }
  return { vx, vy };
}

function updateMassVelocityReadout() {
  if (selectedMassIndex < 0 || selectedMassIndex >= links.length) return;
  const link = links[selectedMassIndex];
  initialTangentialVelocityInput.value = (initialAngularVelocities[selectedMassIndex] * link.length).toFixed(3);
  const { vx, vy } = getMassVelocity(selectedMassIndex);
  massVelocityVector.textContent = `vx = ${vx.toFixed(3)}, vy = ${vy.toFixed(3)} m/s`;
}

function openMassVelocityPanel(index) {
  selectedMassIndex = index;
  massVelocityTitle.textContent = `Mass ${index + 1} initial velocity`;
  massVelocityPanel.hidden = false;
  updateMassVelocityReadout();
  renderFrame();
}

function recordTimeSeriesPoint() {
  timeSeriesData.push({
    time: simTime,
    coordinates: getPendulumCoordinates(),
    angles: state.slice(0, links.length),
  });
}

function downloadTimeSeriesCsv() {
  if (timeSeriesData.length === 0) return;

  const columns = ['time_s'];
  links.forEach((_, index) => {
    columns.push(`link_${index + 1}_x_m`, `link_${index + 1}_y_m`, `link_${index + 1}_angle_rad`);
  });
  const rows = timeSeriesData.map((point) => {
    const values = [point.time];
    point.coordinates.forEach((coordinate, index) => {
      values.push(coordinate.x, coordinate.y, point.angles[index]);
    });
    return values.join(',');
  });
  const csv = [columns.join(','), ...rows].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'pendulum-timeseries.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderFrame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const originX = canvas.width / 2;
  const originY = canvas.height / 2;
  const totalLength = links.reduce((sum, link) => sum + link.length, 0) || 1;
  const scale = Math.min(canvas.width, canvas.height) / (2 * totalLength + 1);
  const points = getPendulumCoordinates().map((point) => ({
    x: originX + point.x * scale,
    y: originY - point.y * scale,
  }));
  renderedMassPositions = points;
  const tip = points[points.length - 1] || { x: originX, y: originY };

  traceHistory.push(tip);
  if (traceHistory.length > 100) traceHistory.shift();

  if (traceHistory.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = '#ff7f0e';
    ctx.lineWidth = 1.5;
    ctx.moveTo(traceHistory[0].x, traceHistory[0].y);
    for (let index = 1; index < traceHistory.length; index++) {
      ctx.lineTo(traceHistory[index].x, traceHistory[index].y);
    }
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(originX, originY);
  points.forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.strokeStyle = '#0066ff';
  ctx.lineWidth = 2;
  ctx.stroke();

  const drawCircle = (x, y, radius, color) => {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  };
  drawCircle(originX, originY, 4, '#6a6a6a');
  points.forEach((point, index) => {
    drawCircle(point.x, point.y, 6, '#0066ff');
    if (index === selectedMassIndex) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 10, 0, 2 * Math.PI);
      ctx.strokeStyle = '#66e3d3';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
  timeDisplay.textContent = `time = ${simTime.toFixed(1)}s`;
}

function findMassAtPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) * canvas.width / rect.width;
  const y = (clientY - rect.top) * canvas.height / rect.height;
  let closestIndex = -1;
  let closestDistance = 18 ** 2;

  renderedMassPositions.forEach((point, index) => {
    const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });
  return closestIndex;
}

function animate() {
  if (!isRunning) return;

  stepPhysics();
  renderFrame();
  if (simTime >= tStop) {
    isRunning = false;
    animationFrameId = null;
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

canvas.addEventListener('click', (event) => {
  const massIndex = findMassAtPoint(event.clientX, event.clientY);
  if (massIndex >= 0) openMassVelocityPanel(massIndex);
});

canvas.addEventListener('pointermove', (event) => {
  canvas.style.cursor = findMassAtPoint(event.clientX, event.clientY) >= 0 ? 'pointer' : 'default';
});

canvas.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    selectedMassIndex = selectedMassIndex < 0
      ? (direction > 0 ? 0 : links.length - 1)
      : (selectedMassIndex + direction + links.length) % links.length;
    renderFrame();
  } else if (event.key === 'Enter' && selectedMassIndex >= 0) {
    openMassVelocityPanel(selectedMassIndex);
  }
});

initialTangentialVelocityInput.addEventListener('change', () => {
  if (selectedMassIndex < 0) return;
  const speed = parseFloat(initialTangentialVelocityInput.value) || 0;
  initialAngularVelocities[selectedMassIndex] = speed / links[selectedMassIndex].length;
  resetSimulation();
});

closeMassVelocityPanelButton.addEventListener('click', () => {
  massVelocityPanel.hidden = true;
  canvas.focus({ preventScroll: true });
});

inputLinkCount.addEventListener('change', () => {
  const previousLinks = readLinkSettings();
  renderLinkInputs(inputLinkCount.value, previousLinks);
  resetSimulation();
});
linkParameters.addEventListener('change', resetSimulation);
[inputTStop, inputCsvSampleRate].forEach((input) => input.addEventListener('change', resetSimulation));

playButton.addEventListener('click', () => {
  readInputs();
  if (simTime >= tStop) simTime = 0;
  if (!isRunning) {
    isRunning = true;
    animate();
  }
});

pauseButton.addEventListener('click', () => {
  isRunning = false;
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
});

resetButton.addEventListener('click', resetSimulation);
downloadCsvButton.addEventListener('click', downloadTimeSeriesCsv);
window.addEventListener('resize', resizeCanvas);

renderLinkInputs(2, [
  { length: 1, angle: Math.PI / 2, mass: 5 },
  { length: 1, angle: Math.PI / 2, mass: 5 },
]);
resizeCanvas();
resetSimulation();