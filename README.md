# AP Physics Simulations

An interactive, browser-based collection of AP Physics-inspired simulations. The app is a single-page site built with vanilla JavaScript, HTML5 Canvas, and Three.js; it has no build step or package installation requirement.

## Simulations

### Double Pendulum

A 2D chaotic double-pendulum model with adjustable rod lengths, initial angles, bob masses, and maximum duration. It draws the second bob's trail and uses a fixed `0.01 s` physics timestep.

The CSV export includes the initial state and sampled simulation data:

`time_s, x1_m, y1_m, x2_m, y2_m, theta1_rad, theta2_rad`

The CSV sample rate is user-configurable in Hz, up to the 100 Hz physics-update limit.

### Planetary Bodies (2D)

A configurable two-dimensional many-body gravity simulation. It uses fourth-order Runge–Kutta integration, boundary bouncing, and elastic circle collisions. Users can choose 2–20 masses, set the maximum time, select an object, and edit its position, velocity, and mass.

Its CSV export records the initial scene and every animation update. The headers adapt to the number of bodies, for example:

`time_s, object_1_x, object_1_y, object_2_x, object_2_y, ...`

### Lorenz Attractor

A Three.js 3D visualization of the Lorenz chaotic system. Sigma, rho, beta, duration, and integration timestep are adjustable; the trajectory is computed with a fourth-order Runge–Kutta solver and can be viewed at different playback speeds.

The CSV export contains:

`time_s, x, y, z`

It produces one row for each configured integration timestep (`dt`).

### 3D Planet Simulation

A Three.js browser implementation of a three-dimensional gravity model. It supports 2–20 masses, configurable gravity strength and duration, object selection/editing, collision and boundary handling, and an optional projected trajectory for the selected mass.

The CSV export records the initial scene and every animation update. Its columns adapt to the active mass count:

`time_s, mass_1_x, mass_1_y, mass_1_z, mass_2_x, mass_2_y, mass_2_z, ...`

### Delayed Electric Field

A Three.js visualization of the electric field from a moving point charge, including propagation delay (retarded potentials). Enter the charge trajectory as JavaScript expressions for `x(t)`, `y(t)`, and `z(t)`, choose the charge magnitude and grid plane, then animate the result.

## Run locally

Open `index.html` in a modern browser, or serve the directory locally:

```bash
python3 -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000). Use the navigation buttons to switch among simulations.

## Repository layout

| File | Purpose |
| --- | --- |
| `index.html` | Application layout, navigation, controls, and script loading |
| `style.css` | Shared application and simulation styling |
| `app_router.js` | Navigation between simulation views |
| `double_pendulum.js` | Double-pendulum physics, rendering, and CSV export |
| `planet_simulation.js` | 2D many-body gravity simulation and CSV export |
| `lorenz_attractor.js` | Lorenz attractor solver, renderer, and CSV export |
| `planet3d.js` | 3D gravity simulation, renderer, and CSV export |
| `electric_field.js` | Delayed electric-field visualization |
| `planet.cpp` | Native C++/OpenGL source related to the 2D planetary model |
| `planet3d.cpp` | Native C++/OpenGL source related to the 3D planetary model |

## Technology

- Vanilla JavaScript
- HTML5 Canvas 2D
- [Three.js r128](https://threejs.org/), loaded from CDNs for 3D scenes
- No framework, bundler, or installed runtime dependencies

## Notes

- CSV files are generated in the browser and download locally; no simulation data is sent to a server.
- The electric-field trajectory expressions are evaluated from text input. They are suitable for local educational use, but should not be exposed to untrusted users without a safer expression parser.
