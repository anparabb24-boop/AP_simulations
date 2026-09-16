const lorenzContainer = document.getElementById('lorenzCanvas');
const lorenzPlayButton = document.getElementById('lorenzPlayButton');
const lorenzPauseButton = document.getElementById('lorenzPauseButton');
const lorenzResetButton = document.getElementById('lorenzResetButton');
const lorenzDownloadCsvButton = document.getElementById('lorenzDownloadCsvButton');
const lorenzSpeedInput = document.getElementById('lorenzSpeed');
const lorenzTimeDisplay = document.getElementById('lorenzTimeDisplay');
const lorenzSigmaInput = document.getElementById('lorenzSigma');
const lorenzRhoInput = document.getElementById('lorenzRho');
const lorenzBetaInput = document.getElementById('lorenzBeta');
const lorenzEndTimeInput = document.getElementById('lorenzEndTime');
const lorenzSamplingIntervalInput = document.getElementById('lorenzSamplingInterval');
const lorenzSigmaSlider = document.getElementById('lorenzSigmaSlider');
const lorenzRhoSlider = document.getElementById('lorenzRhoSlider');
const lorenzBetaSlider = document.getElementById('lorenzBetaSlider');

let lorenzDt = 0.01;
const lorenzInitialState = [1, 1, 1];
let lorenzScene;
let lorenzCamera;
let lorenzRenderer;
let lorenzControls;
let lorenzLine;
let lorenzMarker;
let lorenzTrajectory = [];
let lorenzTimeSeries = [];
let lorenzDisplayedPoints = [];
let lorenzCurrentIndex = 0;
let lorenzTime = 0;
let lorenzRunning = false;
let lorenzAnimationFrame = null;
let lorenzLastTimestamp = null;
let lorenzPlaybackAccumulator = 0;

function lorenzReadParameters() {
  return {
    sigma: Math.max(0.1, Number.parseFloat(lorenzSigmaInput?.value) || 10),
    rho: Math.max(0.1, Number.parseFloat(lorenzRhoInput?.value) || 28),
    beta: Math.max(0.1, Number.parseFloat(lorenzBetaInput?.value) || 8 / 3),
    endTime: Math.max(1, Number.parseFloat(lorenzEndTimeInput?.value) || 40),
    dt: Math.max(0.001, Math.min(0.05, Number.parseFloat(lorenzSamplingIntervalInput?.value) || 0.01))
  };
}

function lorenzDerivatives(state, parameters) {
  const [x, y, z] = state;
  return [
    parameters.sigma * (y - x),
    x * (parameters.rho - z) - y,
    x * y - parameters.beta * z
  ];
}

function lorenzRK4Step(state, parameters) {
  const first = lorenzDerivatives(state, parameters);
  const secondState = state.map((value, index) => value + parameters.dt * first[index] / 2);
  const second = lorenzDerivatives(secondState, parameters);
  const thirdState = state.map((value, index) => value + parameters.dt * second[index] / 2);
  const third = lorenzDerivatives(thirdState, parameters);
  const fourthState = state.map((value, index) => value + parameters.dt * third[index]);
  const fourth = lorenzDerivatives(fourthState, parameters);

  return state.map((value, index) => value + parameters.dt / 6 * (
    first[index] + 2 * second[index] + 2 * third[index] + fourth[index]
  ));
}

function lorenzBuildTrajectory() {
  const parameters = lorenzReadParameters();
  let state = [...lorenzInitialState];
  const points = [];
  const steps = Math.floor(parameters.endTime / parameters.dt);
  lorenzTimeSeries = [];

  for (let index = 0; index < steps; index += 1) {
    lorenzTimeSeries.push({
      time: index * parameters.dt,
      x: state[0],
      y: state[1],
      z: state[2]
    });
    points.push(new THREE.Vector3(state[0], state[2], state[1]));
    state = lorenzRK4Step(state, parameters);
  }

  return points;
}

function lorenzDownloadCsv() {
  if (lorenzTimeSeries.length === 0) return;

  const header = 'time_s,x,y,z';
  const rows = lorenzTimeSeries.map((point) => [point.time, point.x, point.y, point.z].join(','));
  const csv = [header, ...rows].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'lorenz-attractor-timeseries.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function lorenzUpdateTrajectory() {
  const currentTime = lorenzTime;
  const parameters = lorenzReadParameters();
  lorenzDt = parameters.dt;
  lorenzPlaybackAccumulator = 0;
  lorenzTrajectory = lorenzBuildTrajectory();
  lorenzCurrentIndex = Math.min(Math.floor(currentTime / lorenzDt), lorenzTrajectory.length);
  lorenzDisplayedPoints = lorenzTrajectory.slice(0, lorenzCurrentIndex);
  lorenzLine.geometry.setFromPoints(lorenzDisplayedPoints);
  lorenzUpdateMarker();
  lorenzTime = lorenzCurrentIndex * lorenzDt;
  lorenzTimeDisplay.textContent = `t = ${lorenzTime.toFixed(1)}s`;
  lorenzRender();
}

function lorenzSyncParameter(input, slider) {
  if (!input || !slider) return;
  const value = Number.parseFloat(input.value);
  if (!Number.isFinite(value)) return;
  const minimum = Number.parseFloat(slider.min);
  const maximum = Number.parseFloat(slider.max);
  const clampedValue = Math.max(minimum, Math.min(maximum, value));
  input.value = clampedValue;
  slider.value = clampedValue;
  lorenzUpdateTrajectory();
}

function lorenzUpdateMarker() {
  if (!lorenzMarker) return;
  const endpoint = lorenzDisplayedPoints[lorenzDisplayedPoints.length - 1] || lorenzTrajectory[0];
  if (endpoint) lorenzMarker.position.copy(endpoint);
}

function lorenzReset() {
  lorenzRunning = false;
  if (lorenzAnimationFrame) cancelAnimationFrame(lorenzAnimationFrame);
  lorenzAnimationFrame = null;
  lorenzLastTimestamp = null;
  lorenzPlaybackAccumulator = 0;
  lorenzDt = lorenzReadParameters().dt;
  lorenzTrajectory = lorenzBuildTrajectory();
  lorenzDisplayedPoints = [];
  lorenzCurrentIndex = 0;
  lorenzTime = 0;
  lorenzLine.geometry.setFromPoints([]);
  lorenzUpdateMarker();
  lorenzTimeDisplay.textContent = 't = 0.0s';
  lorenzRender();
}

function lorenzResize() {
  if (!lorenzRenderer || !lorenzCamera || !lorenzContainer) return;
  const width = Math.max(1, lorenzContainer.clientWidth);
  const height = Math.max(1, lorenzContainer.clientHeight);
  lorenzCamera.aspect = width / height;
  lorenzCamera.updateProjectionMatrix();
  lorenzRenderer.setSize(width, height, false);
  lorenzRenderer.render(lorenzScene, lorenzCamera);
}

function lorenzRender() {
  lorenzRenderer.render(lorenzScene, lorenzCamera);
}

function lorenzAnimate(timestamp) {
  if (!lorenzRunning) return;
  if (lorenzLastTimestamp === null) lorenzLastTimestamp = timestamp;
  const elapsedSeconds = Math.min(0.1, (timestamp - lorenzLastTimestamp) / 1000);
  const playbackSpeed = Number.parseFloat(lorenzSpeedInput?.value) || 1;
  lorenzLastTimestamp = timestamp;
  lorenzPlaybackAccumulator += elapsedSeconds * playbackSpeed / lorenzDt;
  const stepsToAdvance = Math.floor(lorenzPlaybackAccumulator);
  lorenzPlaybackAccumulator -= stepsToAdvance;

  for (let batchIndex = 0; batchIndex < stepsToAdvance && lorenzCurrentIndex < lorenzTrajectory.length; batchIndex += 1) {
    lorenzDisplayedPoints.push(lorenzTrajectory[lorenzCurrentIndex]);
    lorenzCurrentIndex += 1;
  }

  lorenzLine.geometry.setFromPoints(lorenzDisplayedPoints);
  lorenzUpdateMarker();
  lorenzTime = lorenzCurrentIndex * lorenzDt;
  lorenzTimeDisplay.textContent = `t = ${lorenzTime.toFixed(1)}s`;
  lorenzControls.update();
  lorenzRender();

  if (lorenzCurrentIndex >= lorenzTrajectory.length) {
    lorenzRunning = false;
    lorenzAnimationFrame = null;
    return;
  }

  lorenzAnimationFrame = requestAnimationFrame(lorenzAnimate);
}

function lorenzPlay() {
  if (lorenzRunning) return;
  if (lorenzCurrentIndex >= lorenzTrajectory.length) lorenzReset();
  lorenzRunning = true;
  lorenzLastTimestamp = null;
  lorenzAnimationFrame = requestAnimationFrame(lorenzAnimate);
}

function lorenzInit() {
  if (!lorenzContainer) return;
  lorenzScene = new THREE.Scene();
  lorenzScene.background = new THREE.Color(0x05080d);
  lorenzCamera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
  lorenzCamera.position.set(58, 42, 72);
  lorenzCamera.lookAt(0, 24, 0);
  lorenzRenderer = new THREE.WebGLRenderer({ antialias: true });
  lorenzRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  lorenzContainer.appendChild(lorenzRenderer.domElement);
  lorenzControls = new THREE.OrbitControls(lorenzCamera, lorenzRenderer.domElement);
  lorenzControls.enableDamping = true;
  lorenzControls.target.set(0, 24, 0);
  lorenzControls.addEventListener('change', lorenzRender);

  lorenzScene.add(new THREE.GridHelper(100, 10, 0x456773, 0x263b43));
  lorenzLine = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x66e3d3, linewidth: 1 })
  );
  lorenzScene.add(lorenzLine);
  lorenzMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0x66e3d3 })
  );
  lorenzScene.add(lorenzMarker);
  lorenzReset();
  lorenzResize();
}

lorenzPlayButton?.addEventListener('click', lorenzPlay);
lorenzPauseButton?.addEventListener('click', () => {
  lorenzRunning = false;
  if (lorenzAnimationFrame) cancelAnimationFrame(lorenzAnimationFrame);
  lorenzAnimationFrame = null;
  lorenzLastTimestamp = null;
  lorenzPlaybackAccumulator = 0;
});
lorenzResetButton?.addEventListener('click', lorenzReset);
lorenzDownloadCsvButton?.addEventListener('click', lorenzDownloadCsv);
[
  [lorenzSigmaInput, lorenzSigmaSlider],
  [lorenzRhoInput, lorenzRhoSlider],
  [lorenzBetaInput, lorenzBetaSlider]
].forEach(([input, slider]) => {
  input?.addEventListener('input', () => lorenzSyncParameter(input, slider));
  slider?.addEventListener('input', () => {
    input.value = slider.value;
    lorenzUpdateTrajectory();
  });
});
lorenzEndTimeInput?.addEventListener('change', lorenzReset);
lorenzSamplingIntervalInput?.addEventListener('input', lorenzUpdateTrajectory);
window.addEventListener('resize', lorenzResize);

lorenzInit();
