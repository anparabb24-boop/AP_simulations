const planetCanvas = document.getElementById('planetCanvas');
const planetContext = planetCanvas ? planetCanvas.getContext('2d') : null;
const planetPlayButton = document.getElementById('planetPlayButton');
const planetPauseButton = document.getElementById('planetPauseButton');
const planetResetButton = document.getElementById('planetResetButton');
const planetTimeDisplay = document.getElementById('planetTimeDisplay');
const planetTStopInput = document.getElementById('planetTStop');
const planetMassCountInput = document.getElementById('planetMassCount');
const planetHoverInfo = document.getElementById('planetHoverInfo');

const planetGravity = 1.0;
const planetRestitution = 0.97;
const planetRadius = 15;
const planetInitialState = [
  { x: 0.95, y: 0.95, vx: 0, vy: -0.5, mass: 1 },
  { x: 0.95, y: -0.95, vx: -0.5, vy: 0, mass: 1 },
  { x: 0, y: 0, vx: 0, vy: 0, mass: 1 },
  { x: -0.95, y: 0.95, vx: 0.5, vy: 0, mass: 1 },
  { x: -0.95, y: -0.95, vx: 0, vy: 0.5, mass: 1 }
];

let planetBodies = [];
let planetTime = 0;
let planetStopTime = 50;
let planetRunning = false;
let planetAnimationFrame = null;
let planetPreviousTimestamp = 0;
let planetHoveredIndex = null;

function planetReadInputs() {
  planetStopTime = Math.max(1, Number.parseFloat(planetTStopInput?.value) || 50);
}

function planetCreateInitialBodies(count) {
  if (count === planetInitialState.length) {
    return planetInitialState.map((body) => ({ ...body }));
  }

  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const radius = 0.62;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      vx: -Math.sin(angle) * 0.28,
      vy: Math.cos(angle) * 0.28,
      mass: 1
    };
  });
}

function planetReset() {
  planetReadInputs();
  const requestedCount = Math.min(20, Math.max(2, Number.parseInt(planetMassCountInput?.value, 10) || 5));
  if (planetMassCountInput) planetMassCountInput.value = requestedCount;
  planetBodies = planetCreateInitialBodies(requestedCount);
  planetTime = 0;
  planetRunning = false;
  planetHoveredIndex = null;
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

      acceleration.x += planetGravity * (otherPosition.mass || 1) * dx / (distanceSquared * distance);
      acceleration.y += planetGravity * (otherPosition.mass || 1) * dy / (distanceSquared * distance);
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
    y: body.y + derivative[index].y * scale,
    mass: body.mass
  }));
}

function planetIntegrate(dt) {
  const positions = planetBodies.map(({ x, y, mass }) => ({ x, y, mass }));
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
  const firstMass = first.mass || 1;
  const secondMass = second.mass || 1;
  const inverseMassTotal = 1 / firstMass + 1 / secondMass;
  const firstCorrection = (1 / firstMass) / inverseMassTotal;
  const secondCorrection = (1 / secondMass) / inverseMassTotal;
  first.x -= normalX * overlap * firstCorrection / scaleX;
  first.y -= normalY * overlap * firstCorrection / scaleY;
  second.x += normalX * overlap * secondCorrection / scaleX;
  second.y += normalY * overlap * secondCorrection / scaleY;

  const relativeVelocityX = (second.vx - first.vx) * scaleX;
  const relativeVelocityY = (second.vy - first.vy) * scaleY;
  const velocityAlongNormal = relativeVelocityX * normalX + relativeVelocityY * normalY;
  if (velocityAlongNormal >= 0) return;

  const impulseMagnitude = -(1 + planetRestitution) * velocityAlongNormal / inverseMassTotal;
  const impulseX = impulseMagnitude * normalX;
  const impulseY = impulseMagnitude * normalY;
  first.vx -= impulseX / scaleX / firstMass;
  first.vy -= impulseY / scaleY / firstMass;
  second.vx += impulseX / scaleX / secondMass;
  second.vy += impulseY / scaleY / secondMass;
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

    if (index === planetHoveredIndex) {
      planetContext.beginPath();
      planetContext.arc(x, y, planetRadius + 5, 0, Math.PI * 2);
      planetContext.strokeStyle = '#ffffff';
      planetContext.lineWidth = 2;
      planetContext.stroke();
    }
  });

  if (planetTimeDisplay) {
    planetTimeDisplay.textContent = `time = ${planetTime.toFixed(1)}s`;
  }
}

function planetFormatVector(x, y) {
  return `(${x.toFixed(3)}, ${y.toFixed(3)})`;
}

function planetHandlePointerMove(event) {
  if (!planetCanvas || !planetHoverInfo) return;
  const rect = planetCanvas.getBoundingClientRect();
  const scaleX = planetCanvas.width / 2;
  const scaleY = planetCanvas.height / 2;
  const pointerX = (event.clientX - rect.left) * (planetCanvas.width / rect.width);
  const pointerY = (event.clientY - rect.top) * (planetCanvas.height / rect.height);
  let closestIndex = null;
  let closestDistance = Infinity;

  planetBodies.forEach((body, index) => {
    const bodyX = planetCanvas.width / 2 + body.x * scaleX;
    const bodyY = planetCanvas.height / 2 - body.y * scaleY;
    const distance = Math.hypot(pointerX - bodyX, pointerY - bodyY);
    if (distance <= 24 && distance < closestDistance) {
      closestIndex = index;
      closestDistance = distance;
    }
  });

  planetHoveredIndex = closestIndex;
  if (closestIndex === null) {
    planetHoverInfo.style.display = 'none';
    planetRender();
    return;
  }

  const body = planetBodies[closestIndex];
  planetHoverInfo.innerHTML = [
    `<strong>Mass ${closestIndex + 1}</strong>`,
    `Position: ${planetFormatVector(body.x, body.y)}`,
    `Velocity: ${planetFormatVector(body.vx, body.vy)}`,
    `Mass: ${body.mass.toFixed(2)}`
  ].join('<br>');
  const tooltipWidth = 205;
  const tooltipHeight = 94;
  const left = Math.min(Math.max(8, event.clientX - rect.left + 14), rect.width - tooltipWidth - 8);
  const top = Math.min(Math.max(8, event.clientY - rect.top + 14), rect.height - tooltipHeight - 8);
  planetHoverInfo.style.left = `${left}px`;
  planetHoverInfo.style.top = `${top}px`;
  planetHoverInfo.style.display = 'block';
  planetRender();
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
planetMassCountInput?.addEventListener('change', planetReset);
planetCanvas?.addEventListener('mousemove', planetHandlePointerMove);
planetCanvas?.addEventListener('mouseleave', () => {
  planetHoveredIndex = null;
  if (planetHoverInfo) planetHoverInfo.style.display = 'none';
  planetRender();
});
window.addEventListener('resize', planetResize);
planetResize();
planetReset();
