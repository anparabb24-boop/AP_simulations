// Setup Container and Controls
const efContainer = document.getElementById('efieldCanvas').parentElement;
const efPlayBtn = document.getElementById('efPlayButton');
const efPauseBtn = document.getElementById('efPauseButton');
const efResetBtn = document.getElementById('efResetButton');
const efTimeDisplay = document.getElementById('efTimeDisplay');

// Parameter UI Elements
const inputQ = document.getElementById('inputQ');
const inputPosX = document.getElementById('inputPosX');
const inputPosY = document.getElementById('inputPosY');
const inputPosZ = document.getElementById('inputPosZ');

let frame = 0;
let efRunning = false;
let efAnimFrame = null;

// Constants
const x_l = 30, y_l = 30, z_l = 30;
const k = 9000000000;
const c = 0.4;
const axisColor = 0x337BA4;
const fieldColor = 0x337BA4;
const chargeColor = 0xC32828;

// Dynamic Motion Parsers
function getPositionAtTime(t) {
  let qVal = parseFloat(inputQ.value) || 2;
  let x = 0, y = 0, z = 0;

  try {
    x = new Function('t', 'Math', `return ${inputPosX.value};`)(t, Math);
  } catch (e) { x = 0; }

  try {
    y = new Function('t', 'Math', `return ${inputPosY.value};`)(t, Math);
  } catch (e) { y = 0; }

  try {
    z = new Function('t', 'Math', `return ${inputPosZ.value};`)(t, Math);
  } catch (e) { z = 0; }

  return {
    q: qVal,
    x: Number.isNaN(x) ? 0 : x,
    y: Number.isNaN(y) ? 0 : y,
    z: Number.isNaN(z) ? 0 : z
  };
}

// 1. Scene, Camera, Renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x121111);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
camera.position.set(30, 30, 30);

const existingCanvas = document.getElementById('efieldCanvas');
if (existingCanvas) existingCanvas.remove();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.domElement.id = 'efieldCanvas';
efContainer.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// 2. Solid Axes Setup (-x_l to x_l)
function createAxis(p1, p2, color) {
  const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
  const mat = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
  return new THREE.Line(geom, mat);
}

scene.add(createAxis(new THREE.Vector3(-x_l, 0, 0), new THREE.Vector3(x_l, 0, 0), axisColor));
scene.add(createAxis(new THREE.Vector3(0, -y_l, 0), new THREE.Vector3(0, y_l, 0), axisColor));
scene.add(createAxis(new THREE.Vector3(0, 0, -z_l), new THREE.Vector3(0, 0, z_l), axisColor));

// 3. Point Charge
const chargeGeo = new THREE.SphereGeometry(1.2, 32, 32);
const chargeMat = new THREE.MeshBasicMaterial({ color: chargeColor });
const chargeMesh = new THREE.Mesh(chargeGeo, chargeMat);
scene.add(chargeMesh);

// 4. Create Grid Sampling Points
const gridSize = 20;
const gridPoints = [];
const xVals = [];
const yVals = [];

for (let i = 0; i < gridSize; i++) {
  xVals.push(-x_l + (i * (2 * x_l)) / (gridSize - 1));
  yVals.push(-y_l + (i * (2 * y_l)) / (gridSize - 1));
}

for (let i = 0; i < gridSize; i++) {
  for (let j = 0; j < gridSize; j++) {
    gridPoints.push({ x: xVals[i], y: yVals[j], z: 0 });
  }
}

// 5. Initialize Arrow Helpers
const arrows = [];
gridPoints.forEach((pt) => {
  const dir = new THREE.Vector3(0, 0, 1);
  const origin = new THREE.Vector3(pt.x, pt.y, pt.z);
  const arrow = new THREE.ArrowHelper(dir, origin, 3, fieldColor, 0.8, 0.5);
  arrow.line.material.transparent = true;
  arrow.line.material.opacity = 0.5;
  scene.add(arrow);
  arrows.push({ arrow, origin });
});

// 6. Vector Math & Frame Update Logic
function updateFrame(currentFrame) {
  // Current position of charge derived from user equations
  const currentPos = getPositionAtTime(currentFrame);
  chargeMesh.position.set(currentPos.x, currentPos.y, currentPos.z);

  // Update Vector Field
  arrows.forEach(({ arrow, origin }) => {
    const X = origin.x;
    const Y = origin.y;
    const Z = origin.z;

    const dist_to_center = Math.sqrt(X * X + Y * Y + Z * Z);
    const delay = dist_to_center / c;
    const delayed_frame = currentFrame - delay;

    // Retarded charge state
    const retPos = getPositionAtTime(delayed_frame);

    const dx = X - retPos.x;
    const dy = Y - retPos.y;
    const dz = Z - retPos.z;

    const r2 = dx * dx + dy * dy + dz * dz + 0.01;
    const r = Math.sqrt(r2);

    let U = (k * currentPos.q * dx) / r2;
    let V = (k * currentPos.q * dy) / r2;
    let W = (k * currentPos.q * dz) / r2;

    const mag = Math.sqrt(U * U + V * V + W * W) || 1e-6;
    U /= mag;
    V /= mag;
    W /= mag;

    const dirVec = new THREE.Vector3(U, V, W).normalize();
    arrow.setDirection(dirVec);
    arrow.setLength(3);
  });

  // Camera Orbit
  const elev = ((15 + Math.sin(currentFrame / 63) * 21) * Math.PI) / 180;
  const azim = ((45 + currentFrame / 2) * Math.PI) / 180;
  const radius = 60;

  camera.position.x = radius * Math.cos(elev) * Math.sin(azim);
  camera.position.y = radius * Math.sin(elev);
  camera.position.z = radius * Math.cos(elev) * Math.cos(azim);
  camera.lookAt(0, 0, 0);

  efTimeDisplay.textContent = `frame = ${Math.floor(currentFrame)}`;
}

function animateEF() {
  if (efRunning) {
    frame += 1;
    updateFrame(frame);
  }
  controls.update();
  renderer.render(scene, camera);
  efAnimFrame = requestAnimationFrame(animateEF);
}

function resizeEFCanvas() {
  const width = efContainer.clientWidth || 600;
  const height = efContainer.clientHeight || 500;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function resetEFSimulation() {
  efRunning = false;
  frame = 0;
  updateFrame(0);
}

// Event Listeners
efPlayBtn.addEventListener('click', () => { efRunning = true; });
efPauseBtn.addEventListener('click', () => { efRunning = false; });
efResetBtn.addEventListener('click', resetEFSimulation);

[inputQ, inputPosX, inputPosY, inputPosZ].forEach((input) => {
  input.addEventListener('change', resetEFSimulation);
});

window.addEventListener('resize', resizeEFCanvas);

// Startup Initialization
resizeEFCanvas();
updateFrame(0);
animateEF();