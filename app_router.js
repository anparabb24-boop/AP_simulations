const navPendulum = document.getElementById('navPendulum');
const navEField = document.getElementById('navEField');
const navPlanet = document.getElementById('navPlanet');
const navPlanet3D = document.getElementById('navPlanet3D');
const navLorenz = document.getElementById('navLorenz');

const viewPendulum = document.getElementById('viewPendulum');
const viewEField = document.getElementById('viewEField');
const viewPlanet = document.getElementById('viewPlanet');
const viewPlanet3D = document.getElementById('viewPlanet3D');
const viewLorenz = document.getElementById('viewLorenz');

const simTitle = document.getElementById('simTitle');
const simSubtitle = document.getElementById('simSubtitle');

function trackSimulationSelection(simulation) {
  if (typeof gtag === 'function') {
    gtag('event', 'select_content', {
      content_type: 'simulation',
      item_id: simulation
    });
  }
}

navPendulum.addEventListener('click', () => {
  trackSimulationSelection('double_pendulum');
  navPendulum.classList.add('active');
  navEField.classList.remove('active');
  navPlanet.classList.remove('active');
  navPlanet3D.classList.remove('active');
  navLorenz.classList.remove('active');

  viewPendulum.style.display = 'block';
  viewEField.style.display = 'none';
  viewPlanet.style.display = 'none';
  viewPlanet3D.style.display = 'none';
  viewLorenz.style.display = 'none';

  simTitle.textContent = 'Double Pendulum';
  simSubtitle.textContent = 'A browser-based interactive double-pendulum simulation.';
  
  resizeCanvas();
});

navEField.addEventListener('click', () => {
  trackSimulationSelection('delayed_e_field');
  navEField.classList.add('active');
  navPendulum.classList.remove('active');
  navPlanet.classList.remove('active');
  navPlanet3D.classList.remove('active');
  navLorenz.classList.remove('active');

  viewEField.style.display = 'block';
  viewPendulum.style.display = 'none';
  viewPlanet.style.display = 'none';
  viewPlanet3D.style.display = 'none';
  viewLorenz.style.display = 'none';

  simTitle.textContent = 'Delayed Electric Field';
  simSubtitle.textContent = 'Retarded potential and electrodynamic field propagation model.';

  resizeEFCanvas();
});

navPlanet.addEventListener('click', () => {
  trackSimulationSelection('planetary_bodies');
  navPlanet.classList.add('active');
  navPendulum.classList.remove('active');
  navEField.classList.remove('active');
  navPlanet3D.classList.remove('active');
  navLorenz.classList.remove('active');

  viewPlanet.style.display = 'block';
  viewPendulum.style.display = 'none';
  viewEField.style.display = 'none';
  viewPlanet3D.style.display = 'none';
  viewLorenz.style.display = 'none';

  simTitle.textContent = 'Planetary Bodies';
  simSubtitle.textContent = 'A five-body gravity simulation with RK4 integration and elastic collisions.';

  planetResize();
});

navPlanet3D.addEventListener('click', () => {
  trackSimulationSelection('planet_3d');
  navPlanet3D.classList.add('active');
  navPendulum.classList.remove('active');
  navEField.classList.remove('active');
  navPlanet.classList.remove('active');
  navLorenz.classList.remove('active');

  viewPlanet3D.style.display = 'block';
  viewPlanet.style.display = 'none';
  viewPendulum.style.display = 'none';
  viewEField.style.display = 'none';
  viewLorenz.style.display = 'none';

  simTitle.textContent = '3D Planet Simulation';
  simSubtitle.textContent = 'A browser-port of the native OpenGL 3D gravity model.';

  if (typeof planet3DResize === 'function') planet3DResize();
});

navLorenz.addEventListener('click', () => {
  trackSimulationSelection('lorenz_attractor');
  navLorenz.classList.add('active');
  navPendulum.classList.remove('active');
  navEField.classList.remove('active');
  navPlanet.classList.remove('active');
  navPlanet3D.classList.remove('active');

  viewLorenz.style.display = 'block';
  viewPendulum.style.display = 'none';
  viewEField.style.display = 'none';
  viewPlanet.style.display = 'none';
  viewPlanet3D.style.display = 'none';

  simTitle.textContent = 'Lorenz Attractor';
  simSubtitle.textContent = 'A three-dimensional chaotic system integrated with a fourth-order Runge-Kutta solver.';

  if (typeof lorenzResize === 'function') lorenzResize();
});
