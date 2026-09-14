const navPendulum = document.getElementById('navPendulum');
const navEField = document.getElementById('navEField');
const navPlanet = document.getElementById('navPlanet');

const viewPendulum = document.getElementById('viewPendulum');
const viewEField = document.getElementById('viewEField');
const viewPlanet = document.getElementById('viewPlanet');

const simTitle = document.getElementById('simTitle');
const simSubtitle = document.getElementById('simSubtitle');

navPendulum.addEventListener('click', () => {
  navPendulum.classList.add('active');
  navEField.classList.remove('active');
  navPlanet.classList.remove('active');

  viewPendulum.style.display = 'block';
  viewEField.style.display = 'none';
  viewPlanet.style.display = 'none';

  simTitle.textContent = 'Double Pendulum';
  simSubtitle.textContent = 'A browser-based interactive double-pendulum simulation.';
  
  resizeCanvas();
});

navEField.addEventListener('click', () => {
  navEField.classList.add('active');
  navPendulum.classList.remove('active');
  navPlanet.classList.remove('active');

  viewEField.style.display = 'block';
  viewPendulum.style.display = 'none';
  viewPlanet.style.display = 'none';

  simTitle.textContent = 'Delayed Electric Field';
  simSubtitle.textContent = 'Retarded potential and electrodynamic field propagation model.';

  resizeEFCanvas();
});

navPlanet.addEventListener('click', () => {
  navPlanet.classList.add('active');
  navPendulum.classList.remove('active');
  navEField.classList.remove('active');

  viewPlanet.style.display = 'block';
  viewPendulum.style.display = 'none';
  viewEField.style.display = 'none';

  simTitle.textContent = 'Planetary Bodies';
  simSubtitle.textContent = 'A five-body gravity simulation with RK4 integration and elastic collisions.';

  planetResize();
});