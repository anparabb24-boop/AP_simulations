const efCanvas = document.getElementById('efieldCanvas');
const efCtx = efCanvas.getContext('2d');

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

function getEFParams() {
  return {
    q: (parseFloat(inputCharge.value) || 1.0) * 1e-6,
    beta: parseFloat(inputVel.value) || 0.5,
    c: parseFloat(inputSpeedC.value) || 150
  };
}

function resetEFSimulation() {
  efRunning = false;
  if (efAnimFrame) cancelAnimationFrame(efAnimFrame);
  efTime = 0.0;
  efTimeDisplay.textContent = 't = 0.0s';
  renderEFFrame();
}

function renderEFFrame() {
  efCtx.clearRect(0, 0, efCanvas.width, efCanvas.height);
  const { q, beta, c } = getEFParams();

  const centerX = efCanvas.width / 2;
  const centerY = efCanvas.height / 2;
  
  // Moving point charge position along X axis
  const qx = centerX + beta * c * (efTime - 2);
  const qy = centerY;

  // Render Vector Grid
  const gridSize = 30;
  for (let x = gridSize; x < efCanvas.width; x += gridSize) {
    for (let y = gridSize; y < efCanvas.height; y += gridSize) {
      const dx = x - qx;
      const dy = y - qy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 15) continue;

      // Retarded time vector field estimation
      const retFactor = 1 - (beta * dx) / dist;
      const EMag = (Math.sign(q) * 8000) / (dist * dist * (retFactor * retFactor || 1));
      
      const ex = (dx / dist) * EMag;
      const ey = (dy / dist) * EMag;

      const len = Math.min(Math.sqrt(ex * ex + ey * ey), gridSize * 0.8);
      const angle = Math.atan2(ey, ex);

      // Draw vector arrows
      efCtx.save();
      efCtx.translate(x, y);
      efCtx.rotate(angle);
      efCtx.beginPath();
      efCtx.moveTo(0, 0);
      efCtx.lineTo(len, 0);
      efCtx.strokeStyle = '#0066ff';
      efCtx.lineWidth = 1.5;
      efCtx.stroke();

      // Arrowhead
      efCtx.beginPath();
      efCtx.moveTo(len, 0);
      efCtx.lineTo(len - 4, -3);
      efCtx.lineTo(len - 4, 3);
      efCtx.fillStyle = '#0066ff';
      efCtx.fill();
      efCtx.restore();
    }
  }

  // Draw point charge
  efCtx.beginPath();
  efCtx.arc(qx, qy, 8, 0, 2 * Math.PI);
  efCtx.fillStyle = q >= 0 ? '#ff4d4d' : '#0066ff';
  efCtx.fill();

  efTimeDisplay.textContent = `t = ${efTime.toFixed(2)}s`;
}

function animateEF() {
  if (!efRunning) return;
  efTime += efDt;
  renderEFFrame();
  efAnimFrame = requestAnimationFrame(animateEF);
}

function resizeEFCanvas() {
  const rect = efCanvas.parentElement.getBoundingClientRect();
  efCanvas.width = rect.width || 600;
  efCanvas.height = rect.height || 500;
  renderEFFrame();
}

efPlayBtn.addEventListener('click', () => {
  if (!efRunning) {
    efRunning = true;
    animateEF();
  }
});

efPauseBtn.addEventListener('click', () => {
  efRunning = false;
  if (efAnimFrame) cancelAnimationFrame(efAnimFrame);
});

efResetBtn.addEventListener('click', resetEFSimulation);

[inputCharge, inputVel, inputSpeedC].forEach((elem) => {
  elem.addEventListener('change', resetEFSimulation);
});

window.addEventListener('resize', resizeEFCanvas);