const planetCanvas = document.getElementById('planetCanvas');
const planetContext = planetCanvas ? planetCanvas.getContext('2d') : null;
const planetPlayButton = document.getElementById('planetPlayButton');
const planetPauseButton = document.getElementById('planetPauseButton');
const planetResetButton = document.getElementById('planetResetButton');
const planetTimeDisplay = document.getElementById('planetTimeDisplay');
const planetTStopInput = document.getElementById('planetTStop');

const planetGravity = 1.0;
const planetRestitution = 0.97;
const planetRadius = 15;
const planetInitialState = [
  { x: 0.95, y: 0.95, vx: 0, vy: -0.5 },
  { x: 0.95, y: -0.95, vx: -0.5, vy: 0 },
  { x: 0, y: 0, vx: 0, vy: 0 },
  { x: -0.95, y: 0.95, vx: 0.5, vy: 0 },
  { x: -0.95, y: -0.95, vx: 0, vy: 0.5 }
];

let planetBodies = [];
let planetTime = 0;
let planetStopTime = 50;
let planetRunning = false;
let planetAnimationFrame = null;
let planetPreviousTimestamp = 0;

function planetReadInputs() {
  planetStopTime = Math.max(1, Number.parseFloat(planetTStopInput?.value) || 50);
}

function planetReset() {
  planetReadInputs();
  planetBodies = planetInitialState.map((body) => ({ ...body }));
  planetTime = 0;
  planetRunning = false;
  if (planetAnimationFrame) cancelAnimationFrame(planetAnimationFrame);
  planetAnimationFrame = null;
  planetRender();
}

function planetAccelerations(positions) {
  return positions.map((position, firstIndex) => {
    const acceleration = { x: 0, y: 0 };

    positions.forEach((otherPosition, secondIndex) => {
      if (firstIndex === secondIndex) return;
      const dx = otherPosition.x - position.x;
      const dy = otherPosition.y - position.y;
      const distanceSquared = dx * dx + dy * dy;
      const distance = Math.sqrt(distanceSquared);
      if (distance === 0) return;

      acceleration.x += planetGravity * dx / (distanceSquared * distance);
      acceleration.y += planetGravity * dy / (distanceSquared * distance);
    });

    return acceleration;
  });
}

function planetDerivative(positions, velocities) {
  return {
    positions: velocities.map((velocity) => ({ ...velocity })),
    velocities: planetAccelerations(positions)
  };
}

function planetAddScaled(base, derivative, scale) {
  return base.map((body, index) => ({
    x: body.x + derivative[index].x * scale,
    y: body.y + derivative[index].y * scale
  }));
}

function planetIntegrate(dt) {
  const positions = planetBodies.map(({ x, y }) => ({ x, y }));
  const velocities = planetBodies.map(({ vx, vy }) => ({ x: vx, y: vy }));
  const first = planetDerivative(positions, velocities);
  const second = planetDerivative(
    planetAddScaled(positions, first.positions, dt / 2),
    planetAddScaled(velocities, first.velocities, dt / 2)
  );
  const third = planetDerivative(
    planetAddScaled(positions, second.positions, dt / 2),
    planetAddScaled(velocities, second.velocities, dt / 2)
  );
  const fourth = planetDerivative(
    planetAddScaled(positions, third.positions, dt),
    planetAddScaled(velocities, third.velocities, dt)
  );

  planetBodies.forEach((body, index) => {
    body.x = positions[index].x + dt / 6 * (
      first.positions[index].x + 2 * second.positions[index].x +
      2 * third.positions[index].x + fourth.positions[index].x
    );
    body.y = positions[index].y + dt / 6 * (
      first.positions[index].y + 2 * second.positions[index].y +
      2 * third.positions[index].y + fourth.positions[index].y
    );
    body.vx = velocities[index].x + dt / 6 * (
      first.velocities[index].x + 2 * second.velocities[index].x +
      2 * third.velocities[index].x + fourth.velocities[index].x
    );
    body.vy = velocities[index].y + dt / 6 * (
      first.velocities[index].y + 2 * second.velocities[index].y +
      2 * third.velocities[index].y + fourth.velocities[index].y
    );
  });
}

function planetResolveCollision(first, second, scaleX, scaleY) {
  const dx = (second.x - first.x) * scaleX;
  const dy = (second.y - first.y) * scaleY;
  const distance = Math.hypot(dx, dy);
  const minimumDistance = planetRadius * 2;
  if (distance <= 0 || distance >= minimumDistance) return;

  const normalX = dx / distance;
  const normalY = dy / distance;
  const overlap = minimumDistance - distance;
  first.x -= normalX * overlap * 0.5 / scaleX;
  first.y -= normalY * overlap * 0.5 / scaleY;
  second.x += normalX * overlap * 0.5 / scaleX;
  second.y += normalY * overlap * 0.5 / scaleY;

  const relativeVelocityX = (second.vx - first.vx) * scaleX;
  const relativeVelocityY = (second.vy - first.vy) * scaleY;
  const velocityAlongNormal = relativeVelocityX * normalX + relativeVelocityY * normalY;
  if (velocityAlongNormal >= 0) return;

  const impulseMagnitude = -(1 + planetRestitution) * velocityAlongNormal / 2;
  const impulseX = impulseMagnitude * normalX;
  const impulseY = impulseMagnitude * normalY;
  first.vx -= impulseX / scaleX;
  first.vy -= impulseY / scaleY;
  second.vx += impulseX / scaleX;
  second.vy += impulseY / scaleY;
}

function planetApplyBoundaries(body, scaleX, scaleY) {
  const radiusX = planetRadius / scaleX;
  const radiusY = planetRadius / scaleY;

  if (body.x + radiusX > 1) {
    body.x = 1 - radiusX;
    body.vx = -Math.abs(body.vx) * planetRestitution;
  } else if (body.x - radiusX < -1) {
    body.x = -1 + radiusX;
    body.vx = Math.abs(body.vx) * planetRestitution;
  }

  if (body.y + radiusY > 1) {
    body.y = 1 - radiusY;
    body.vy = -Math.abs(body.vy) * planetRestitution;
  } else if (body.y - radiusY < -1) {
    body.y = -1 + radiusY;
    body.vy = Math.abs(body.vy) * planetRestitution;
  }
}

function planetStep(dt) {
  const scaleX = planetCanvas.width / 2;
  const scaleY = planetCanvas.height / 2;
  planetIntegrate(dt);
  planetBodies.forEach((body) => planetApplyBoundaries(body, scaleX, scaleY));
  for (let first = 0; first < planetBodies.length; first += 1) {
    for (let second = first + 1; second < planetBodies.length; second += 1) {
      planetResolveCollision(planetBodies[first], planetBodies[second], scaleX, scaleY);
    }
  }
  planetTime += dt;
}

function planetRender() {
  if (!planetContext || !planetCanvas) return;

  const width = planetCanvas.width;
  const height = planetCanvas.height;
  const scaleX = width / 2;
  const scaleY = height / 2;
  planetContext.clearRect(0, 0, width, height);
  planetContext.fillStyle = '#05080d';
  planetContext.fillRect(0, 0, width, height);

  planetBodies.forEach((body, index) => {
    const x = width / 2 + body.x * scaleX;
    const y = height / 2 - body.y * scaleY;
    const glow = planetContext.createRadialGradient(x - 4, y - 4, 2, x, y, planetRadius * 1.5);
    glow.addColorStop(0, index === 2 ? '#ffe9a8' : '#d9f5ff');
    glow.addColorStop(1, index === 2 ? '#df8c32' : '#3286b8');
    planetContext.beginPath();
    planetContext.arc(x, y, planetRadius, 0, Math.PI * 2);
    planetContext.fillStyle = glow;
    planetContext.fill();
  });

  if (planetTimeDisplay) {
    planetTimeDisplay.textContent = `time = ${planetTime.toFixed(1)}s`;
  }
}

function planetResize() {
  if (!planetCanvas?.parentElement) return;
  const rect = planetCanvas.parentElement.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  planetCanvas.width = Math.max(1, Math.floor((rect.width || 600) * pixelRatio));
  planetCanvas.height = Math.max(1, Math.floor((rect.height || 500) * pixelRatio));
  planetRender();
}

function planetAnimate(timestamp) {
  if (!planetRunning) return;
  const elapsed = Math.min((timestamp - planetPreviousTimestamp) / 1000, 0.05);
  planetPreviousTimestamp = timestamp;
  planetStep(elapsed);
  planetRender();

  if (planetTime >= planetStopTime) {
    planetRunning = false;
    planetAnimationFrame = null;
    return;
  }
  planetAnimationFrame = requestAnimationFrame(planetAnimate);
}

planetPlayButton?.addEventListener('click', () => {
  planetReadInputs();
  if (planetTime >= planetStopTime) planetReset();
  if (!planetRunning) {
    planetRunning = true;
    planetPreviousTimestamp = performance.now();
    planetAnimationFrame = requestAnimationFrame(planetAnimate);
  }
});

planetPauseButton?.addEventListener('click', () => {
  planetRunning = false;
  if (planetAnimationFrame) cancelAnimationFrame(planetAnimationFrame);
  planetAnimationFrame = null;
});

planetResetButton?.addEventListener('click', planetReset);
planetTStopInput?.addEventListener('change', planetReset);
window.addEventListener('resize', planetResize);
planetResize();
planetReset();
