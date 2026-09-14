const navPendulum = document.getElementById('navPendulum');
const navEField = document.getElementById('navEField');

const viewPendulum = document.getElementById('viewPendulum');
const viewEField = document.getElementById('viewEField');

const simTitle = document.getElementById('simTitle');
const simSubtitle = document.getElementById('simSubtitle');

navPendulum.addEventListener('click', () => {
  navPendulum.classList.add('active');
  navEField.classList.remove('active');

  viewPendulum.style.display = 'block';
  viewEField.style.display = 'none';

  simTitle.textContent = 'Double Pendulum';
  simSubtitle.textContent = 'A browser-based interactive double-pendulum simulation.';
  
  resizeCanvas();
});

navEField.addEventListener('click', () => {
  navEField.classList.add('active');
  navPendulum.classList.remove('active');

  viewEField.style.display = 'block';
  viewPendulum.style.display = 'none';

  simTitle.textContent = 'Delayed Electric Field';
  simSubtitle.textContent = 'Retarded potential and electrodynamic field propagation model.';

  resizeEFCanvas();
});