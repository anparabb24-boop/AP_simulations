import streamlit as st

st.set_page_config(page_title="Simulation Hub", page_icon="🎛️", layout="wide")

st.title("🎛️ Simulation Hub")
st.write(
    "A collection of physics / dynamical-systems simulations. "
    "Pick one from the sidebar to open it and play with the parameters."
)

st.markdown("---")

col1, col2, col3 = st.columns(3)

with col1:
    st.subheader("🕰️ Double Pendulum")
    st.write("Chaotic motion of a two-link pendulum. Toggle masses, "
             "lengths, gravity, and initial angles.")
    st.page_link("pages/1_Double_Pendulum.py", label="Open simulation ➜")

with col2:
    st.subheader("➕ Your next sim")
    st.write("Add more simulations by dropping a new file into `pages/`.")

with col3:
    st.subheader("➕ Your next sim")
    st.write("Same pattern: sliders in the sidebar, render loop in the body.")