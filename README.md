# AP Physics Simulations

A browser-based, interactive workspace for physics simulations — built with vanilla JavaScript, HTML5 Canvas, and Three.js. Currently includes a **Double Pendulum** simulation and a **Delayed Electric Field** (retarded potential) visualizer.

## Overview

This is a lightweight single-page web app that lets you switch between different physics simulations from a shared navigation bar, each with live-adjustable parameters and play/pause/reset controls — no build step or server required.

## Repository Contents

```
double pendulum/
├── index.html            # Main page — layout, controls, and simulation switcher
├── style.css              # Styling for the workspace UI
├── app_router.js          # Handles switching between simulation views
├── double_pendulum.js     # Double pendulum physics + Canvas 2D rendering
└── electric_field.js      # Delayed E-field physics + Three.js 3D rendering
```

## Simulations

### 1. Double Pendulum
A classic chaotic double pendulum, simulated on a 2D HTML5 Canvas.

- Numerically integrates the coupled equations of motion for two connected pendulum arms under gravity.
- Adjustable in real time:
  - Rod lengths (`L1`, `L2`)
  - Initial angles (`θ1`, `θ2`)
  - Bob masses (`M1`, `M2`)
  - Max simulation duration
- Displays a live trace of the second bob's trajectory and a running simulation clock.
- Play, pause, and reset controls.

### 2. Delayed Electric Field
A 3D visualization of the electric field from a moving point charge, accounting for field propagation delay (retarded potentials), rendered with **Three.js**.

- Define the charge's motion as arbitrary functions of time — `x(t)`, `y(t)`, `z(t)` — entered directly as JavaScript expressions (e.g. `5 * Math.sin(0.05 * t)`).
- Configurable charge magnitude (`q`).
- Choose which coordinate plane (XY, YZ, or XZ) the field grid is drawn on.
- Play, pause, and reset controls with a live time readout.

## Tech Stack

- **HTML5 Canvas 2D** — double pendulum rendering
- **[Three.js](https://threejs.org/) (r128)** — 3D rendering for the electric field simulation, loaded via CDN (cdnjs + jsDelivr)
- **Vanilla JavaScript** — no framework, no build tools, no dependencies to install

## Usage

No installation needed. Just open the page in a browser:

```bash
cd "double pendulum"
open index.html      # macOS
# or just double-click index.html in Finder/Explorer
```

Alternatively, serve it locally (recommended, since some browsers restrict local file access for scripts):

```bash
cd "double pendulum"
python3 -m http.server 8000
```

Then visit `http://localhost:8000` in your browser.

Use the **Double Pendulum** / **Delayed E-Field** buttons at the top to switch simulations.

## Notes & Limitations

- The `electric_field.js` motion functions (`x(t)`, `y(t)`, `z(t)`) are evaluated via `new Function(...)` from raw text input — fine for local personal use, but not something you'd want to expose to untrusted input if this is ever deployed publicly.
- Simulation constants (Coulomb's constant, propagation speed `c`, visual scaling factors) are currently hardcoded in `electric_field.js` rather than exposed as UI controls.
- This folder currently lives inside a general `AP_simulations` repo — if more simulations are added later, consider giving each its own subfolder with a similar structure.
