// Setup Container and Controls
const efContainer = document.getElementById('efieldCanvas').parentElement;
const efPlayBtn = document.getElementById('efPlayButton');
const efPauseBtn = document.getElementById('efPauseButton');
const efResetBtn = document.getElementById('efResetButton');
const efTimeDisplay = document.getElementById('efTimeDisplay');

let efTime = 0;
let frame = 0;
let efRunning = false;
let efAnimFrame = null;

// Constants from Python Script
const x_l = 30, y_l = 30, z_l = 30;
const freq = 1 / 4;
const q = 2;
const k = 9000000000;
const R = 5;
const c = 0.4;
const axisColor = 0x337BA4;
const fieldColor = 0x337BA4;
const chargeColor = 0xC32828;

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

// 3. Point Charge Sphere
const chargeGeo = new THREE.SphereGeometry(1.2, 32, 32);
const chargeMat = new THREE.MeshBasicMaterial({ color: chargeColor });
const chargeMesh = new THREE.Mesh(chargeGeo, chargeMat);
scene.add(chargeMesh);

// 4. Create XY Grid Sampling Points for Field Vectors
const gridSize = 20; // 20x20 grid matching meshgrid density
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

// 5. Initialize Arrow Helpers for Quiver Plot
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
  // 1. Position oscillating charge along Z axis
  const x_pos = 0;
  const y_pos = 0;
  const z_pos = R * Math.sin(freq * currentFrame);
  chargeMesh.position.set(x_pos, y_pos, z_pos);

  // 2. Update Vector Field (Lienard-Wiechert / Retarded Potential logic from Python script)
  arrows.forEach(({ arrow, origin }, idx) => {
    const X = origin.x;
    const Y = origin.y;
    const Z = origin.z;

    const dist_to_center = Math.sqrt(X * X + Y * Y + Z * Z);
    const delay = dist_to_center / c;
    const delayed_frame = currentFrame - delay;

    // Retarded charge offset calculation
    const x_del = R * Math.cos(freq * delayed_frame);

    const dx = X - 0;
    const dy = Y - 0;
    const dz = Z - x_del;

    const r2 = dx * dx + dy * dy + dz * dz + 0.01;
    const r = Math.sqrt(r2);

    let U = (k * q * dx) / r2;
    let V = (k * q * dy) / r2;
    let W = (k * q * dz) / r2;

    const mag = Math.sqrt(U * U + V * V + W * W) || 1e-6;
    U /= mag;
    V /= mag;
    W /= mag;

    const dirVec = new THREE.Vector3(U, V, W).normalize();
    arrow.setDirection(dirVec);
    arrow.setLength(3);
  });

  // 3. Camera Rotation Matching Matplotlib's view_init(elev, azim)
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

window.addEventListener('resize', resizeEFCanvas);

// Startup Initialization
resizeEFCanvas();
updateFrame(0);
animateEF();