// Setup Container and UI Controls
const efContainer = document.getElementById('efieldCanvas').parentElement;
const efPlayBtn = document.getElementById('efPlayButton');
const efPauseBtn = document.getElementById('efPauseButton');
const efResetBtn = document.getElementById('efResetButton');
const efTimeDisplay = document.getElementById('efTimeDisplay');

const inputQ = document.getElementById('inputQ');
const inputPosX = document.getElementById('inputPosX');
const inputPosY = document.getElementById('inputPosY');
const inputPosZ = document.getElementById('inputPosZ');
const selectPlane = document.getElementById('selectPlane');

let frame = 0;
let efRunning = false;
let efAnimFrame = null;

// Hardcoded Simulation Constants
const x_l = 50, y_l = 50, z_l = 50;
const k = 9000000000;
const c = 0.4;
const axisColor = 0x337BA4;
const fieldColor = 0x337BA4;
const chargeColor = 0xC32828;

// Hardcoded Visual Sizing Parameters
const axisRadius = 0.25;    // Thickness of solid cylinder axes
const arrowLength = 5.0;    // Overall vector arrow length
const headLength = 1.5;     // Arrowhead length
const headWidth = 1.0;      // Arrowhead width/thickness

// Dynamic Motion Parsers
function getPositionAtTime(t) {
  let qVal = parseFloat(inputQ ? inputQ.value : 2) || 2;
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

// 1. Scene, Camera, Renderer Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x121111);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);

// Set Z as UP vector so Z-axis points straight up
camera.up.set(0, 0, 1);
camera.position.set(50, 50, 30);

const existingCanvas = document.getElementById('efieldCanvas');
if (existingCanvas) existingCanvas.remove();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.domElement.id = 'efieldCanvas';
efContainer.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lighting for 3D Mesh geometries
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
dirLight.position.set(20, 20, 40);
scene.add(dirLight);

// 2. Solid Thick Axes Helper (Cylinders)
function createAxis(p1, p2, color, radius) {
  const direction = new THREE.Vector3().subVectors(p2, p1);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 16);
  const material = new THREE.MeshPhongMaterial({ color: color, flatShading: true });
  const cylinder = new THREE.Mesh(geometry, material);

  const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
  cylinder.position.copy(midpoint);
  cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());

  return cylinder;
}

scene.add(createAxis(new THREE.Vector3(-x_l, 0, 0), new THREE.Vector3(x_l, 0, 0), axisColor, axisRadius));
scene.add(createAxis(new THREE.Vector3(0, -y_l, 0), new THREE.Vector3(0, y_l, 0), axisColor, axisRadius));
scene.add(createAxis(new THREE.Vector3(0, 0, -z_l), new THREE.Vector3(0, 0, z_l), axisColor, axisRadius));

// 3. Point Charge Sphere
const chargeGeo = new THREE.SphereGeometry(1.5, 32, 32);
const chargeMat = new THREE.MeshBasicMaterial({ color: chargeColor });
const chargeMesh = new THREE.Mesh(chargeGeo, chargeMat);
scene.add(chargeMesh);

// 4. Dynamic Vector Grid Construction
let arrows = [];

function rebuildVectorGrid() {
  arrows.forEach(({ arrow }) => scene.remove(arrow));
  arrows = [];

  const plane = selectPlane ? selectPlane.value : 'XY';
  const gridSize = 20;

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      let x = 0, y = 0, z = 0;

      const u = -x_l + (i * (2 * x_l)) / (gridSize - 1);
      const v = -y_l + (j * (2 * y_l)) / (gridSize - 1);

      if (plane === 'XY') {
        x = u; y = v; z = 0;
      } else if (plane === 'YZ') {
        x = 0; y = u; z = v;
      } else if (plane === 'XZ') {
        x = u; y = 0; z = v;
      }

      const dir = new THREE.Vector3(0, 0, 1);
      const origin = new THREE.Vector3(x, y, z);
      
      // Arrow initialized with thick hardcoded proportions
      const arrow = new THREE.ArrowHelper(dir, origin, arrowLength, fieldColor, headLength, headWidth);
      arrow.line.material.transparent = false;
      arrow.line.material.opacity = 1.0;

      scene.add(arrow);
      arrows.push({ arrow, origin });
    }
  }
}

// 5. Update Loop
function updateFrame(currentFrame) {
  const currentPos = getPositionAtTime(currentFrame);
  chargeMesh.position.set(currentPos.x, currentPos.y, currentPos.z);

  arrows.forEach(({ arrow, origin }) => {
    const X = origin.x;
    const Y = origin.y;
    const Z = origin.z;

    const dist_to_center = Math.sqrt(X * X + Y * Y + Z * Z);
    const delay = dist_to_center / c;
    const delayed_frame = currentFrame - delay;

    const retPos = getPositionAtTime(delayed_frame);

    const dx = X - retPos.x;
    const dy = Y - retPos.y;
    const dz = Z - retPos.z;

    const r2 = dx * dx + dy * dy + dz * dz + 0.01;

    let U = (k * currentPos.q * dx) / r2;
    let V = (k * currentPos.q * dy) / r2;
    let W = (k * currentPos.q * dz) / r2;

    const mag = Math.sqrt(U * U + V * V + W * W) || 1e-6;
    U /= mag;
    V /= mag;
    W /= mag;

    const dirVec = new THREE.Vector3(U, V, W).normalize();
    arrow.setDirection(dirVec);
    arrow.setLength(arrowLength, headLength, headWidth);
  });

  if (efTimeDisplay) {
    efTimeDisplay.textContent = `frame = ${Math.floor(currentFrame)}`;
  }
}

function animateEF() {
  if (efRunning) {
    frame += 1;
    updateFrame(frame);
  }
  controls.update(); // Keeps full mouse drag/orbit controls active
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
  rebuildVectorGrid();
  updateFrame(0);
}

// Event Listeners
if (efPlayBtn) efPlayBtn.addEventListener('click', () => { efRunning = true; });
if (efPauseBtn) efPauseBtn.addEventListener('click', () => { efRunning = false; });
if (efResetBtn) efResetBtn.addEventListener('click', resetEFSimulation);

[inputQ, inputPosX, inputPosY, inputPosZ, selectPlane].forEach((input) => {
  if (input) input.addEventListener('change', resetEFSimulation);
});

window.addEventListener('resize', resizeEFCanvas);

// Startup Initialization
resizeEFCanvas();
resetEFSimulation();
animateEF();