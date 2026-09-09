import time

import matplotlib.pyplot as plt
import numpy as np
import streamlit as st

st.set_page_config(page_title="Double Pendulum", page_icon="🕰️", layout="wide")
st.title("🕰️ Double Pendulum")
st.caption("Euler-integrated double pendulum. Same physics as the original script — "
           "parameters are now live sliders instead of hard-coded constants.")

# ---------------------------------------------------------------------
# Sidebar controls (these replace the hard-coded constants in the script)
# ---------------------------------------------------------------------
with st.sidebar:
    st.header("Parameters")

    G = st.slider("Gravity (m/s²)", 1.0, 20.0, 9.8, 0.1)

    st.subheader("Pendulum 1")
    L1 = st.slider("Length L1 (m)", 0.2, 2.0, 1.0, 0.1)
    M1 = st.slider("Mass M1 (kg)", 0.5, 10.0, 5.0, 0.5)
    th1 = st.slider("Initial angle θ1 (deg)", -180.0, 180.0, 90.0, 1.0)
    w1 = st.slider("Initial angular velocity ω1 (deg/s)", -200.0, 200.0, 0.0, 5.0)

    st.subheader("Pendulum 2")
    L2 = st.slider("Length L2 (m)", 0.2, 2.0, 1.0, 0.1)
    M2 = st.slider("Mass M2 (kg)", 0.5, 10.0, 5.0, 0.5)
    th2 = st.slider("Initial angle θ2 (deg)", -180.0, 180.0, 90.0, 1.0)
    w2 = st.slider("Initial angular velocity ω2 (deg/s)", -200.0, 200.0, 0.0, 5.0)

    st.subheader("Simulation")
    t_stop = st.slider("Duration (s)", 2, 30, 10)
    history_len = st.slider("Trace length (points)", 0, 200, 50, 10)
    speed = st.select_slider("Playback speed", options=[0.25, 0.5, 1.0, 2.0, 4.0], value=1.0)

    run = st.button("▶ Run simulation", use_container_width=True)

L = L1 + L2


def derivs(state):
    dydx = np.zeros_like(state)
    dydx[0] = state[1]
    delta = state[2] - state[0]
    den1 = (M1 + M2) * L1 - M2 * L1 * np.cos(delta) * np.cos(delta)
    dydx[1] = (
        (
            M2 * L1 * state[1] * state[1] * np.sin(delta) * np.cos(delta)
            + M2 * G * np.sin(state[2]) * np.cos(delta)
            + M2 * L2 * state[3] * state[3] * np.sin(delta)
            - (M1 + M2) * G * np.sin(state[0])
        )
        / den1
    )
    dydx[2] = state[3]
    den2 = (L2 / L1) * den1
    dydx[3] = (
        (
            -M2 * L2 * state[3] * state[3] * np.sin(delta) * np.cos(delta)
            + (M1 + M2) * G * np.sin(state[0]) * np.cos(delta)
            - (M1 + M2) * L1 * state[1] * state[1] * np.sin(delta)
            - (M1 + M2) * G * np.sin(state[2])
        )
        / den2
    )
    return dydx


@st.cache_data(show_spinner=False)
def integrate(G, L1, L2, M1, M2, th1, w1, th2, w2, t_stop, dt=0.01):
    t = np.arange(0, t_stop, dt)
    state = np.radians([th1, w1, th2, w2])
    y = np.empty((len(t), 4))
    y[0] = state
    for i in range(1, len(t)):
        y[i] = y[i - 1] + derivs(y[i - 1]) * dt

    theta1, theta2 = y[:, 0], y[:, 2]
    x1 = L1 * np.sin(theta1)
    y1 = -L1 * np.cos(theta1)
    x2 = L2 * np.sin(theta2) + x1
    y2 = -L2 * np.cos(theta2) + y1
    return t, x1, y1, x2, y2


dt = 0.01
t, x1, y1, x2, y2 = integrate(G, L1, L2, M1, M2, th1, w1, th2, w2, t_stop, dt)

placeholder = st.empty()

if run:
    fig, ax = plt.subplots(figsize=(5, 5))
    ax.set_xlim(-L, L)
    ax.set_ylim(-L, L + 0.5)
    ax.set_aspect("equal")
    ax.grid()
    (line,) = ax.plot([], [], "o-", lw=2)
    (trace,) = ax.plot([], [], "-", lw=1)
    time_text = ax.text(0.05, 0.9, "", transform=ax.transAxes)

    step = max(1, int(1 / speed))  # crude speed control by frame skipping
    for i in range(0, len(t), step):
        thisx = [0, x1[i], x2[i]]
        thisy = [0, y1[i], y2[i]]
        start = max(0, i - history_len)

        line.set_data(thisx, thisy)
        trace.set_data(x2[start:i], y2[start:i])
        time_text.set_text(f"time = {i * dt:.1f}s")

        placeholder.pyplot(fig)
        time.sleep(dt * step / speed)

    plt.close(fig)
    st.success("Done — adjust parameters in the sidebar and run again.")
else:
    st.info("Set your parameters in the sidebar, then click **Run simulation**.")