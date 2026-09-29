import json
import pandas as pd
import numpy as np
import streamlit as st
import plotly.express as px
from anthropic import Anthropic
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

st.set_page_config(page_title="Payments Consultant", layout="wide")

# ---------- THEME ----------

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

html, body, [class*="css"] { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }

h1, h2, h3 { letter-spacing: -0.02em !important; font-weight: 700 !important; color: #33513B !important; }

[data-testid="stTabs"] div[data-baseweb="tab-list"] {
    background: #E5E9DC;
    border-radius: 10px;
    padding: 4px;
    gap: 4px;
    display: inline-flex;
    width: fit-content;
}
[data-testid="stTabs"] button[data-baseweb="tab"] {
    border-radius: 8px;
    color: #7C8577;
    font-weight: 500;
    padding: 8px 18px;
}
[data-testid="stTabs"] button[aria-selected="true"] {
    background: #FFFFFF;
    color: #33513B
