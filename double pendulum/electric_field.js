// Container and UI Setup
const efContainer = document.getElementById('efieldCanvas').parentElement;
const efPlayBtn = document.getElementById('efPlayButton');
const efPauseBtn = document.getElementById('efPauseButton');
const efResetBtn = document.getElementById('efResetButton');
const efTimeDisplay = document.getElementById('efTimeDisplay');

const inputCharge = document.getElementById('inputCharge');
const inputVel = document.getElementById('inputVel');
const inputSpeedC = document.getElementById('inputSpeedC');

let efTime = 0.0;
let efRunning = false;
let efAnimFrame = null;
const efDt = 0.02;

// 1. Scene, Camera, and Renderer Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f172a); // Dark themed background

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
camera.position.set(200, 150, 200);

// Replace existing canvas with Three.js webgl renderer
const existingCanvas = document.getElementById('efieldCanvas');
if (existingCanvas) existingCanvas.remove();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.domElement.id = 'efieldCanvas';
efContainer.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

// 2. Objects Creation: Charge and 3D Vector Grid
const chargeGeo = new THREE.SphereGeometry(6, 32, 32);
const chargeMat = new THREE.MeshBasicMaterial({ color: 0xff4d4d });
const chargeMesh = new THREE.Mesh(chargeGeo, chargeMat);
scene.add(chargeMesh);

// Create 3D grid of vector arrows
const arrowHelpers = [];
const gridBounds = 120;
const step = 40;

for (let x = -gridBounds; x <= gridBounds; x += step) {
  for (let y = -gridBounds; y <= gridBounds; y += step) {
    for (let z = -gridBounds; z <= gridBounds; z += step) {
      if (x === 0 && y === 0 && z === 0) continue;

      const dir = new THREE.Vector3(x, y, z).normalize();
      const origin = new THREE.Vector3(x, y, z);
      const arrow = new THREE.ArrowHelper(dir, origin, 15, 0x0066ff, 4, 2);
      
      scene.add(arrow);
      arrowHelpers.push({ arrow, origin });
    }
  }
}

function getEFParams() {
  return {
    q: (parseFloat(inputCharge.value) || 1.0) * 1e-6,
    beta: parseFloat(inputVel.value) || 0.5,
    c: parseFloat(inputSpeedC.value) || 150
  };
}

// 3. Math Update Loop
function update3DEField() {
  const { q, beta, c } = getEFParams();

  // Position of moving charge in 3D along X axis
  const qx = beta * c * (efTime - 2);
  const qy = 0;
  const qz = 0;

  chargeMesh.position.set(qx, qy, qz);
  chargeMat.color.setHex(q >= 0 ? 0xff4d4d : 0x0066ff);

  // Update vector field arrows
  arrowHelpers.forEach(({ arrow, origin }) => {
    const rx = origin.x - qx;
    const ry = origin.y - qy;
    const rz = origin.z - qz;
    const dist = Math.sqrt(rx * rx + ry * ry + rz * rz);

    if (dist < 10) return;

    // Retarded time factor calculation in 3D
    const retFactor = 1 - (beta * rx) / dist;
    const EMag = (Math.sign(q) * 120000) / (dist * dist * (retFactor * retFactor || 1));

    const ex = (rx / dist) * EMag;
    const ey = (ry / dist) * EMag;
    const ez = (rz / dist) * EMag;

    const vec = new THREE.Vector3(ex, ey, ez);
    const len = Math.min(vec.length(), 25);

    arrow.setDirection(vec.normalize());
    arrow.setLength(len, Math.min(len * 0.3, 5), Math.min(len * 0.2, 3));
  });

  efTimeDisplay.textContent = `t = ${efTime.toFixed(2)}s`;
}

function renderEFFrame() {
  controls.update();
  renderer.render(scene, camera);
}

function animateEF() {
  if (efRunning) {
    efTime += efDt;
    update3DEField();
  }
  renderEFFrame();
  efAnimFrame = requestAnimationFrame(animateEF);
}

function resizeEFCanvas() {
  const width = efContainer.clientWidth || 600;
  const height = efContainer.clientHeight || 500;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderEFFrame();
}

function resetEFSimulation() {
  efRunning = false;
  efTime = 0.0;
  update3DEField();
  renderEFFrame();
}

// Event Listeners
efPlayBtn.addEventListener('click', () => { efRunning = true; });
efPauseBtn.addEventListener('click', () => { efRunning = false; });
efResetBtn.addEventListener('click', resetEFSimulation);

[inputCharge, inputVel, inputSpeedC].forEach((elem) => {
  elem.addEventListener('change', resetEFSimulation);
});

window.addEventListener('resize', resizeEFCanvas);

// Initialize
resizeEFCanvas();
update3DEField();
animateEF();