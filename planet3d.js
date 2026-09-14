const planet3DCanvas = document.getElementById('planet3DCanvas');
const planet3DPlayButton = document.getElementById('planet3DPlayButton');
const planet3DPauseButton = document.getElementById('planet3DPauseButton');
const planet3DResetButton = document.getElementById('planet3DResetButton');
const planet3DTimeDisplay = document.getElementById('planet3DTimeDisplay');
const planet3DMassCountInput = document.getElementById('planet3DMassCount');
const planet3DGravityScaleInput = document.getElementById('planet3DGravityScale');
const planet3DMaxTimeInput = document.getElementById('planet3DMaxTime');
const planet3DObjectDetails = document.getElementById('planet3DObjectDetails');
const planet3DObjectTitle = document.getElementById('planet3DObjectTitle');
const planet3DObjectMass = document.getElementById('planet3DObjectMass');
const planet3DObjectX = document.getElementById('planet3DObjectX');
const planet3DObjectY = document.getElementById('planet3DObjectY');
const planet3DObjectZ = document.getElementById('planet3DObjectZ');
const planet3DObjectVx = document.getElementById('planet3DObjectVx');
const planet3DObjectVy = document.getElementById('planet3DObjectVy');
const planet3DObjectVz = document.getElementById('planet3DObjectVz');
const planet3DSaveObjectButton = document.getElementById('planet3DSaveObjectButton');
const planet3DTrajectoryToggle = document.getElementById('planet3DTrajectoryToggle');

const PLANET3D_GRID_HALF_EXTENT = 6.0;
const PLANET3D_GRID_SPACING = 0.15;
const PLANET3D_CURVATURE_STRENGTH = 0.1;
const PLANET3D_CURVATURE_SOFTENING = 0.5;
const PLANET3D_BASE_RADIUS = 100.0;
let planet3DGravityScale = 1.0;
let planet3DMaxTime = 100.0;
let planet3DMassCount = 2;

let planet3DScene = null;
let planet3DRenderer = null;
let planet3DCamera = null;
let planet3DGrid = null;
let planet3DGroup = null;
let planet3DRunning = false;
let planet3DTime = 0;
let planet3DPreviousTimestamp = 0;
let planet3DAnimationFrame = null;
let planet3DOrbitControls = null;
let planet3DPhysicsBodies = [];
let planet3DBaseBodyStructures = [];
let planet3DSelectedIndex = null;
let planet3DTrajectoryLine = null;
const planet3DRaycaster = new THREE.Raycaster();
const planet3DPointer = new THREE.Vector2();

function planet3DUpdateDetailInput(input, value) {
  if (!input) return;
  if (document.activeElement !== input) input.value = value.toFixed(3);
}

function planet3DUpdateObjectDetails() {
  if (!planet3DObjectDetails) return;
  const body = planet3DSelectedIndex === null ? null : planet3DPhysicsBodies[planet3DSelectedIndex];
  if (!body) {
    planet3DObjectDetails.hidden = true;
    planet3DObjectDetails.style.display = 'none';
    return;
  }

  planet3DObjectDetails.hidden = false;
  planet3DObjectDetails.style.display = 'block';
  planet3DObjectTitle.textContent = `Selected mass ${planet3DSelectedIndex + 1}`;
  planet3DUpdateDetailInput(planet3DObjectMass, body.mass);
  planet3DUpdateDetailInput(planet3DObjectX, body.position.x);
  planet3DUpdateDetailInput(planet3DObjectY, body.position.y);
  planet3DUpdateDetailInput(planet3DObjectZ, body.position.z);
  planet3DUpdateDetailInput(planet3DObjectVx, body.velocity.x);
  planet3DUpdateDetailInput(planet3DObjectVy, body.velocity.y);
  planet3DUpdateDetailInput(planet3DObjectVz, body.velocity.z);
}

function planet3DUpdateSelectionHighlight() {
  if (!planet3DGroup) return;
  planet3DGroup.children.forEach((mesh, index) => {
    mesh.material.emissive?.setHex(index === planet3DSelectedIndex ? 0xffffff : 0x000000);
    if (mesh.material.emissiveIntensity !== undefined) {
      mesh.material.emissiveIntensity = index === planet3DSelectedIndex ? 0.35 : 0;
    }
  });
}

function planet3DRefreshGrid() {
  if (!planet3DScene || !planet3DGrid) return;
  planet3DGrid.geometry.dispose();
  planet3DScene.remove(planet3DGrid);
  planet3DGrid = planet3DBuildGridGeometry(planet3DPhysicsBodies);
  planet3DScene.add(planet3DGrid);
}

function planet3DRemoveTrajectory() {
  if (!planet3DTrajectoryLine || !planet3DScene) return;
  planet3DScene.remove(planet3DTrajectoryLine);
  planet3DTrajectoryLine.geometry.dispose();
  planet3DTrajectoryLine.material.dispose();
  planet3DTrajectoryLine = null;
}

function planet3DUpdateTrajectory() {
  planet3DRemoveTrajectory();
  if (!planet3DTrajectoryToggle?.checked || planet3DSelectedIndex === null) return;

  const projectedBodies = planet3DPhysicsBodies.map((body) => ({
    ...body,
    position: { ...body.position },
    velocity: { ...body.velocity },
  }));
  const points = [];
  const step = 0.05;
  const steps = Math.ceil(10 / step);

  for (let stepIndex = 0; stepIndex <= steps; stepIndex += 1) {
    const body = projectedBodies[planet3DSelectedIndex];
    points.push(body.position.x, body.position.z, body.position.y);
    planet3DIntegrateRK4(projectedBodies, step, 1.0);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  planet3DTrajectoryLine = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9 })
  );
  planet3DScene.add(planet3DTrajectoryLine);
}

function planet3DReadObjectDetail(input, property, minimum = -Infinity) {
  if (planet3DSelectedIndex === null) return;
  const value = Number.parseFloat(input.value);
  if (!Number.isFinite(value)) return;

  const body = planet3DPhysicsBodies[planet3DSelectedIndex];
  if (property === 'mass') {
    body.mass = Math.max(minimum, value);
    body.radius = planet3DGetRadiusFromMass(body.mass, body.density);
    planet3DSetMeshScale(planet3DGroup.children[planet3DSelectedIndex], body);
  } else if (property === 'position') {
    body.position[input.dataset.axis] = value;
    const mesh = planet3DGroup.children[planet3DSelectedIndex];
    mesh.position.set(body.position.x, body.position.z, body.position.y);
    planet3DRefreshGrid();
  } else {
    body.velocity[property] = value;
  }

  planet3DUpdateObjectDetails();
  planet3DUpdateTrajectory();
  planet3DRenderer?.render(planet3DScene, planet3DCamera);
}

function planet3DSaveObjectDetails() {
  if (planet3DSelectedIndex === null) return;
  planet3DReadObjectDetail(planet3DObjectMass, 'mass', 0.001);
  planet3DReadObjectDetail(planet3DObjectX, 'position');
  planet3DReadObjectDetail(planet3DObjectY, 'position');
  planet3DReadObjectDetail(planet3DObjectZ, 'position');
  planet3DReadObjectDetail(planet3DObjectVx, 'x');
  planet3DReadObjectDetail(planet3DObjectVy, 'y');
  planet3DReadObjectDetail(planet3DObjectVz, 'z');
  planet3DSelectedIndex = null;
  planet3DUpdateSelectionHighlight();
  planet3DUpdateObjectDetails();
  planet3DRenderer?.render(planet3DScene, planet3DCamera);
}

function planet3DSelectAtPointer(event) {
  if (!planet3DRenderer || !planet3DCamera || !planet3DGroup) return;
  const rect = planet3DCanvas.getBoundingClientRect();
  planet3DPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  planet3DPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  planet3DRaycaster.setFromCamera(planet3DPointer, planet3DCamera);

  const intersections = planet3DRaycaster.intersectObjects(planet3DGroup.children, false);
  planet3DSelectedIndex = intersections.length
    ? intersections[0].object.userData.planet3DIndex
    : null;
  planet3DUpdateSelectionHighlight();
  planet3DUpdateObjectDetails();
  planet3DUpdateTrajectory();
  planet3DRenderer.render(planet3DScene, planet3DCamera);
}

function planet3DMakeSphereMaterial(color) {
  return new THREE.MeshLambertMaterial({
    color,
    transparent: false,
    side: THREE.DoubleSide,
  });
}

function planet3DMakeSphereMesh(radius, color) {
  const geometry = new THREE.SphereGeometry(radius, 24, 24);
  const material = planet3DMakeSphereMaterial(color);
  return new THREE.Mesh(geometry, material);
}

function planet3DGetRadiusFromMass(mass, density) {
  const pi = Math.PI;
  return Math.cbrt((3 * mass) / (4 * pi * density));
}

function planet3DReadInputs() {
  planet3DMassCount = Math.min(20, Math.max(2, Number.parseInt(planet3DMassCountInput?.value, 10) || 2));
  const requestedGravityScale = Number.parseFloat(planet3DGravityScaleInput?.value);
  planet3DGravityScale = Math.max(0, Number.isFinite(requestedGravityScale) ? requestedGravityScale : 1.0);
  planet3DMaxTime = Math.max(1, Number.parseFloat(planet3DMaxTimeInput?.value) || 100.0);

  if (planet3DMassCountInput) planet3DMassCountInput.value = planet3DMassCount;
  if (planet3DGravityScaleInput) planet3DGravityScaleInput.value = planet3DGravityScale;
  if (planet3DMaxTimeInput) planet3DMaxTimeInput.value = planet3DMaxTime;
}

function planet3DCreateBodyState() {
  const sphereMass = 50.0;
  const sphereRadius = PLANET3D_BASE_RADIUS;
  const sphereDensity = (3 * sphereMass) / (4 * Math.PI * sphereRadius * sphereRadius * sphereRadius);

  const bodies = [
    { position: { x: -2, y: 0, z: 0 }, velocity: { x: 0, y: 3, z: 0 }, mass: sphereMass, density: sphereDensity, color: 0xff0000 },
    { position: { x: 2, y: 0, z: 0 }, velocity: { x: 0, y: -3, z: 0 }, mass: sphereMass, density: sphereDensity, color: 0xff0000 },
  ];

  while (bodies.length < planet3DMassCount) {
    const index = bodies.length;
    const angle = (index / planet3DMassCount) * Math.PI * 2;
    bodies.push({
      position: { x: 4 * Math.cos(angle), y: 4 * Math.sin(angle), z: 0 },
      velocity: { x: -2.5 * Math.sin(angle), y: 2.5 * Math.cos(angle), z: 0 },
      mass: 0.1 * sphereMass,
      density: sphereDensity,
      color: 0xff0000,
    });
  }

  return bodies.slice(0, planet3DMassCount).map((body, index) => ({
    ...body,
    index,
    radius: planet3DGetRadiusFromMass(body.mass, body.density),
  }));
}

function planet3DGridHeight(x, y, bodies) {
  let z = 0;
  for (const body of bodies) {
    const dx = x - body.position.x;
    const dy = y - body.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy + PLANET3D_CURVATURE_SOFTENING * PLANET3D_CURVATURE_SOFTENING);
    if (distance === 0) continue;
    z -= PLANET3D_CURVATURE_STRENGTH * body.mass / distance;
  }
  return z;
}

function planet3DBuildGridGeometry(bodies) {
  const points = [];

  for (let x = -PLANET3D_GRID_HALF_EXTENT; x < PLANET3D_GRID_HALF_EXTENT; x += PLANET3D_GRID_SPACING) {
    for (let y = -PLANET3D_GRID_HALF_EXTENT; y < PLANET3D_GRID_HALF_EXTENT; y += PLANET3D_GRID_SPACING) {
      const xNext = Math.min(x + PLANET3D_GRID_SPACING, PLANET3D_GRID_HALF_EXTENT);
      const yNext = Math.min(y + PLANET3D_GRID_SPACING, PLANET3D_GRID_HALF_EXTENT);
      const z1 = planet3DGridHeight(x, y, bodies);
      const z2 = planet3DGridHeight(x, yNext, bodies);
      const z3 = planet3DGridHeight(xNext, y, bodies);
      const z4 = planet3DGridHeight(xNext, yNext, bodies);

      points.push(x, z1, y, x, z2, yNext);
      points.push(x, z1, y, xNext, z3, y);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0x7f8ea3,
    linewidth: 1,
  });

  return new THREE.LineSegments(geometry, material);
}

function planet3DCalculateAccelerations(bodies, positions, G) {
  const accelerations = bodies.map(() => ({ x: 0, y: 0, z: 0 }));

  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = 0; j < bodies.length; j += 1) {
      if (i === j) continue;

      const dx = positions[j].x - positions[i].x;
      const dy = positions[j].y - positions[i].y;
      const dz = positions[j].z - positions[i].z;
      const distanceSq = dx * dx + dy * dy + dz * dz;
      if (distanceSq <= 0) continue;

      const distance = Math.sqrt(distanceSq);
      const normalX = dx / distance;
      const normalY = dy / distance;
      const normalZ = dz / distance;
      const gravity = (planet3DGravityScale * G * bodies[j].mass) / distanceSq;
      accelerations[i].x += gravity * normalX;
      accelerations[i].y += gravity * normalY;
      accelerations[i].z += gravity * normalZ;
    }
  }

  return accelerations;
}

function planet3DIntegrateRK4(bodies, dt, G) {
  const count = bodies.length;
  const initialPositions = bodies.map((body) => ({ ...body.position }));
  const initialVelocities = bodies.map((body) => ({ ...body.velocity }));

  const k1Position = initialVelocities.map((velocity) => ({ ...velocity }));
  const k1Velocity = planet3DCalculateAccelerations(bodies, initialPositions, G);

  const midpointPositions = Array.from({ length: count }, (_, index) => ({
    x: initialPositions[index].x + 0.5 * dt * k1Position[index].x,
    y: initialPositions[index].y + 0.5 * dt * k1Position[index].y,
    z: initialPositions[index].z + 0.5 * dt * k1Position[index].z,
  }));
  const midpointVelocities = Array.from({ length: count }, (_, index) => ({
    x: initialVelocities[index].x + 0.5 * dt * k1Velocity[index].x,
    y: initialVelocities[index].y + 0.5 * dt * k1Velocity[index].y,
    z: initialVelocities[index].z + 0.5 * dt * k1Velocity[index].z,
  }));

  const k2Position = midpointVelocities.map((velocity) => ({ ...velocity }));
  const k2Velocity = planet3DCalculateAccelerations(bodies, midpointPositions, G);

  const midpointPositions2 = Array.from({ length: count }, (_, index) => ({
    x: initialPositions[index].x + 0.5 * dt * k2Position[index].x,
    y: initialPositions[index].y + 0.5 * dt * k2Position[index].y,
    z: initialPositions[index].z + 0.5 * dt * k2Position[index].z,
  }));
  const midpointVelocities2 = Array.from({ length: count }, (_, index) => ({
    x: initialVelocities[index].x + 0.5 * dt * k2Velocity[index].x,
    y: initialVelocities[index].y + 0.5 * dt * k2Velocity[index].y,
    z: initialVelocities[index].z + 0.5 * dt * k2Velocity[index].z,
  }));

  const k3Position = midpointVelocities2.map((velocity) => ({ ...velocity }));
  const k3Velocity = planet3DCalculateAccelerations(bodies, midpointPositions2, G);

  const finalPositions = Array.from({ length: count }, (_, index) => ({
    x: initialPositions[index].x + dt * k3Position[index].x,
    y: initialPositions[index].y + dt * k3Position[index].y,
    z: initialPositions[index].z + dt * k3Position[index].z,
  }));
  const finalVelocities = Array.from({ length: count }, (_, index) => ({
    x: initialVelocities[index].x + dt * k3Velocity[index].x,
    y: initialVelocities[index].y + dt * k3Velocity[index].y,
    z: initialVelocities[index].z + dt * k3Velocity[index].z,
  }));

  const k4Position = finalVelocities.map((velocity) => ({ ...velocity }));
  const k4Velocity = planet3DCalculateAccelerations(bodies, finalPositions, G);

  for (let i = 0; i < count; i += 1) {
    bodies[i].position.x = initialPositions[i].x + (dt / 6.0) * (
      k1Position[i].x + 2 * k2Position[i].x + 2 * k3Position[i].x + k4Position[i].x
    );
    bodies[i].position.y = initialPositions[i].y + (dt / 6.0) * (
      k1Position[i].y + 2 * k2Position[i].y + 2 * k3Position[i].y + k4Position[i].y
    );
    bodies[i].position.z = initialPositions[i].z + (dt / 6.0) * (
      k1Position[i].z + 2 * k2Position[i].z + 2 * k3Position[i].z + k4Position[i].z
    );

    bodies[i].velocity.x = initialVelocities[i].x + (dt / 6.0) * (
      k1Velocity[i].x + 2 * k2Velocity[i].x + 2 * k3Velocity[i].x + k4Velocity[i].x
    );
    bodies[i].velocity.y = initialVelocities[i].y + (dt / 6.0) * (
      k1Velocity[i].y + 2 * k2Velocity[i].y + 2 * k3Velocity[i].y + k4Velocity[i].y
    );
    bodies[i].velocity.z = initialVelocities[i].z + (dt / 6.0) * (
      k1Velocity[i].z + 2 * k2Velocity[i].z + 2 * k3Velocity[i].z + k4Velocity[i].z
    );
  }
}

function planet3DResolveSphereCollision(first, second) {
  const screenScale = Math.min(planet3DCanvas.width, planet3DCanvas.height) / 2;
  const dx = (second.position.x - first.position.x) * screenScale;
  const dy = (second.position.y - first.position.y) * screenScale;
  const dz = (second.position.z - first.position.z) * screenScale;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const minDistance = first.radius + second.radius;

  if (distance <= 0 || distance >= minDistance) return;

  const normalX = dx / distance;
  const normalY = dy / distance;
  const normalZ = dz / distance;
  const overlap = minDistance - distance;

  first.position.x -= normalX * (overlap * 0.5) / screenScale;
  first.position.y -= normalY * (overlap * 0.5) / screenScale;
  first.position.z -= normalZ * (overlap * 0.5) / screenScale;
  second.position.x += normalX * (overlap * 0.5) / screenScale;
  second.position.y += normalY * (overlap * 0.5) / screenScale;
  second.position.z += normalZ * (overlap * 0.5) / screenScale;

  const relativeVelocity = {
    x: (second.velocity.x - first.velocity.x) * screenScale,
    y: (second.velocity.y - first.velocity.y) * screenScale,
    z: (second.velocity.z - first.velocity.z) * screenScale,
  };
  const velocityAlongNormal = relativeVelocity.x * normalX + relativeVelocity.y * normalY + relativeVelocity.z * normalZ;
  if (velocityAlongNormal >= 0) return;

  const restitution = 0.97;
  const impulseMagnitude = -(1 + restitution) * velocityAlongNormal / 2;
  const impulseX = impulseMagnitude * normalX;
  const impulseY = impulseMagnitude * normalY;
  const impulseZ = impulseMagnitude * normalZ;

  first.velocity.x -= impulseX / screenScale;
  first.velocity.y -= impulseY / screenScale;
  first.velocity.z -= impulseZ / screenScale;
  second.velocity.x += impulseX / screenScale;
  second.velocity.y += impulseY / screenScale;
  second.velocity.z += impulseZ / screenScale;
}

function planet3DSetMeshScale(mesh, body) {
  const screenScale = Math.min(planet3DCanvas.width, planet3DCanvas.height) / 2;
  const uniformScale = body.radius / screenScale;
  mesh.scale.setScalar(uniformScale);
}

function planet3DApplyBoundary(body) {
  const screenScale = Math.min(planet3DCanvas.width, planet3DCanvas.height) / 2;
  const radius = body.radius / screenScale;

  if (body.position.x + radius > PLANET3D_GRID_HALF_EXTENT) {
    body.position.x = PLANET3D_GRID_HALF_EXTENT - radius;
    body.velocity.x = -Math.abs(body.velocity.x) * 0.97;
  } else if (body.position.x - radius < -PLANET3D_GRID_HALF_EXTENT) {
    body.position.x = -PLANET3D_GRID_HALF_EXTENT + radius;
    body.velocity.x = Math.abs(body.velocity.x) * 0.97;
  }

  if (body.position.y + radius > PLANET3D_GRID_HALF_EXTENT) {
    body.position.y = PLANET3D_GRID_HALF_EXTENT - radius;
    body.velocity.y = -Math.abs(body.velocity.y) * 0.97;
  } else if (body.position.y - radius < -PLANET3D_GRID_HALF_EXTENT) {
    body.position.y = -PLANET3D_GRID_HALF_EXTENT + radius;
    body.velocity.y = Math.abs(body.velocity.y) * 0.97;
  }
}

function planet3DUpdateBodies(dt) {
  const G = 1.0;
  if (!planet3DPhysicsBodies.length) return;

  planet3DIntegrateRK4(planet3DPhysicsBodies, dt, G);

  for (const body of planet3DPhysicsBodies) {
    planet3DApplyBoundary(body);
  }

  for (let i = 0; i < planet3DPhysicsBodies.length; i += 1) {
    for (let j = i + 1; j < planet3DPhysicsBodies.length; j += 1) {
      planet3DResolveSphereCollision(planet3DPhysicsBodies[i], planet3DPhysicsBodies[j]);
    }
  }

  for (let i = 0; i < planet3DPhysicsBodies.length; i += 1) {
    const body = planet3DPhysicsBodies[i];
    const mesh = planet3DGroup.children[i];
    mesh.position.set(body.position.x, body.position.z, body.position.y);
    planet3DSetMeshScale(mesh, body);
  }

  planet3DUpdateObjectDetails();
  planet3DUpdateTrajectory();

  planet3DRefreshGrid();
}

function planet3DInitScene() {
  if (!planet3DCanvas) return;

  planet3DReadInputs();

  const parent = planet3DCanvas.parentElement;
  if (!parent) return;

  planet3DScene = new THREE.Scene();
  planet3DScene.background = new THREE.Color(0x05080d);

  planet3DCamera = new THREE.PerspectiveCamera(50, parent.clientWidth / parent.clientHeight, 0.1, 1000);
  planet3DCamera.position.set(0, 0, 18);

  planet3DRenderer = new THREE.WebGLRenderer({
    canvas: planet3DCanvas,
    antialias: true,
    alpha: false,
  });
  planet3DRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  planet3DOrbitControls = new THREE.OrbitControls(planet3DCamera, planet3DRenderer.domElement);
  planet3DOrbitControls.enableDamping = true;
  planet3DOrbitControls.enablePan = true;
  planet3DOrbitControls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  planet3DOrbitControls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  planet3DOrbitControls.minDistance = 8;
  planet3DOrbitControls.maxDistance = 35;
  planet3DOrbitControls.addEventListener('change', () => {
    planet3DRenderer.render(planet3DScene, planet3DCamera);
  });

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  planet3DScene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
  directionalLight.position.set(-2, 2, 3);
  planet3DScene.add(directionalLight);

  planet3DGroup = new THREE.Group();
  planet3DScene.add(planet3DGroup);

  planet3DPhysicsBodies = planet3DCreateBodyState();

  for (const [index, body] of planet3DPhysicsBodies.entries()) {
    const mesh = planet3DMakeSphereMesh(1, body.color);
    mesh.userData.planet3DIndex = index;
    mesh.position.set(body.position.x, body.position.z, body.position.y);
    planet3DSetMeshScale(mesh, body);
    planet3DGroup.add(mesh);
  }

  planet3DGrid = planet3DBuildGridGeometry(planet3DPhysicsBodies);
  planet3DScene.add(planet3DGrid);

  planet3DUpdateBodies(0.016);
  planet3DResize();
}

function planet3DResize() {
  if (!planet3DCanvas || !planet3DRenderer || !planet3DCamera) return;

  const parent = planet3DCanvas.parentElement;
  if (!parent) return;

  const width = parent.clientWidth;
  const height = parent.clientHeight;
  planet3DRenderer.setSize(width, height, false);
  planet3DCamera.aspect = width / height;
  planet3DCamera.updateProjectionMatrix();
}

function planet3DReset() {
  planet3DReadInputs();
  planet3DRunning = false;
  planet3DTime = 0;
  planet3DSelectedIndex = null;
  planet3DUpdateSelectionHighlight();
  planet3DRemoveTrajectory();
  if (planet3DAnimationFrame) cancelAnimationFrame(planet3DAnimationFrame);
  planet3DAnimationFrame = null;
  planet3DPhysicsBodies = planet3DCreateBodyState();

  if (planet3DGroup) {
    while (planet3DGroup.children.length) {
      planet3DGroup.remove(planet3DGroup.children[0]);
    }
    for (const [index, body] of planet3DPhysicsBodies.entries()) {
      const mesh = planet3DMakeSphereMesh(1, body.color);
      mesh.userData.planet3DIndex = index;
      mesh.position.set(body.position.x, body.position.z, body.position.y);
      planet3DSetMeshScale(mesh, body);
      planet3DGroup.add(mesh);
    }
  }

  if (planet3DScene && planet3DGrid) {
    planet3DRefreshGrid();
  }

  if (planet3DTimeDisplay) {
    planet3DTimeDisplay.textContent = 'time = 0.0s';
  }
  planet3DUpdateObjectDetails();
  planet3DUpdateTrajectory();

  if (planet3DRenderer && planet3DScene && planet3DCamera) {
    planet3DRenderer.render(planet3DScene, planet3DCamera);
  }
}

function planet3DAnimate(timestamp) {
  if (!planet3DRunning) return;

  const elapsed = Math.min((timestamp - planet3DPreviousTimestamp) / 1000 || 0.016, 0.05);
  planet3DPreviousTimestamp = timestamp;

  planet3DUpdateBodies(elapsed);
  planet3DTime += elapsed;

  if (planet3DTimeDisplay) {
    planet3DTimeDisplay.textContent = `time = ${planet3DTime.toFixed(1)}s`;
  }

  planet3DOrbitControls.update();
  planet3DRenderer.render(planet3DScene, planet3DCamera);

  if (planet3DTime >= planet3DMaxTime) {
    planet3DRunning = false;
    planet3DAnimationFrame = null;
    return;
  }

  planet3DAnimationFrame = requestAnimationFrame(planet3DAnimate);
}

planet3DPlayButton?.addEventListener('click', () => {
  if (!planet3DScene) planet3DInitScene();
  if (planet3DTime >= planet3DMaxTime) planet3DReset();
  if (!planet3DRunning) {
    planet3DRunning = true;
    planet3DPreviousTimestamp = performance.now();
    planet3DAnimationFrame = requestAnimationFrame(planet3DAnimate);
  }
});

planet3DPauseButton?.addEventListener('click', () => {
  planet3DRunning = false;
  if (planet3DAnimationFrame) cancelAnimationFrame(planet3DAnimationFrame);
  planet3DAnimationFrame = null;
});

planet3DResetButton?.addEventListener('click', planet3DReset);
planet3DMassCountInput?.addEventListener('change', planet3DReset);
planet3DGravityScaleInput?.addEventListener('change', planet3DReset);
planet3DMaxTimeInput?.addEventListener('change', planet3DReset);
planet3DObjectMass?.addEventListener('change', () => planet3DReadObjectDetail(planet3DObjectMass, 'mass', 0.001));
planet3DObjectX?.setAttribute('data-axis', 'x');
planet3DObjectY?.setAttribute('data-axis', 'y');
planet3DObjectZ?.setAttribute('data-axis', 'z');
planet3DObjectX?.addEventListener('change', () => planet3DReadObjectDetail(planet3DObjectX, 'position'));
planet3DObjectY?.addEventListener('change', () => planet3DReadObjectDetail(planet3DObjectY, 'position'));
planet3DObjectZ?.addEventListener('change', () => planet3DReadObjectDetail(planet3DObjectZ, 'position'));
planet3DObjectVx?.addEventListener('change', () => planet3DReadObjectDetail(planet3DObjectVx, 'x'));
planet3DObjectVy?.addEventListener('change', () => planet3DReadObjectDetail(planet3DObjectVy, 'y'));
planet3DObjectVz?.addEventListener('change', () => planet3DReadObjectDetail(planet3DObjectVz, 'z'));
planet3DSaveObjectButton?.addEventListener('click', planet3DSaveObjectDetails);
planet3DTrajectoryToggle?.addEventListener('change', () => {
  planet3DUpdateTrajectory();
  planet3DRenderer?.render(planet3DScene, planet3DCamera);
});
planet3DCanvas?.addEventListener('click', planet3DSelectAtPointer);
window.addEventListener('resize', planet3DResize);

if (planet3DCanvas) {
  planet3DInitScene();
}
