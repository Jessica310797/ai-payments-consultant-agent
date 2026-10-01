
import csv
import io
import json
import re
import hashlib
import base64
from pathlib import Path
from datetime import date
import pandas as pd
import numpy as np
import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import anthropic
from anthropic import Anthropic
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

st.set_page_config(page_title="Payments Consultant", layout="wide", initial_sidebar_state="expanded")

# ---------- THEME ----------

TEAL = "#1D4B45"
CREAM = "#FBF4E6"
CARD = "#FFFDF8"
INK = "#1D2B29"
MUTED = "#6B6A63"
ORANGE = "#E07B0E"
MAGENTA = "#C8338F"
BLUE = "#3F87D4"
BROWN = "#5A3A1E"
# Validated categorical order for chart series (CVD-safe on the card surface).
SERIES = [ORANGE, MAGENTA, BLUE]
AQUA = "#1BAF7A"
VIOLET = "#4A3AA7"
# One colour per card scheme, used everywhere schemes appear (validated for colour-vision deficiency).
SCHEME_COLOURS = {"Eftpos": ORANGE, "Visa": BLUE, "Mastercard": MAGENTA, "Amex": AQUA, "Apple Pay": VIOLET}
TINTS = {ORANGE: "#FBE3C6", MAGENTA: "#F5D4E8", BLUE: "#D7E7F8", BROWN: "#E9DDD0", TEAL: "#D5E3E0"}

st.markdown(f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');

.hero, .card-pill, .ledger, .donut-wrap, .highlight, .bar-row, .side-list, .site-footer, .empty-state {{
    font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif !important;
}}
.stApp {{ background: {CREAM}; }}
.block-container {{ padding-top: 0 !important; padding-bottom: 3rem; max-width: 1440px; }}
header[data-testid="stHeader"] {{ background: transparent; }}
footer {{ visibility: hidden; }}
h1, h2, h3, h4 {{ color: {INK} !important; letter-spacing: -0.01em; }}

/* Header bar (a keyed container so it can hold the invoice and CSV uploaders) */
.st-key-hero {{
    background: {TEAL}; border-radius: 0 0 24px 24px; padding: 54px 28px 18px; margin-bottom: 4px;
}}
.st-key-hero p, .st-key-hero label, .st-key-hero span {{ color: #FFFFFF !important; }}
.st-key-hero [data-testid="stWidgetLabel"] p {{ color: #D5E3E0 !important; font-size: 12px; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase; }}
.st-key-hero [data-testid="stButtonGroup"] button {{
    background: transparent; border: 1.5px solid rgba(255,255,255,0.45); color: #FFFFFF;
}}
.st-key-hero [data-testid="stButtonGroup"] button[kind*="Active"],
.st-key-hero [data-testid="stButtonGroup"] button[aria-checked="true"] {{ background: {ORANGE}; border-color: {ORANGE}; }}
.st-key-hero [data-testid="stButtonGroup"] button:hover {{ border-color: #FFFFFF; }}
.st-key-hero [data-testid="stButtonGroup"] > div {{ flex-wrap: wrap; row-gap: 6px; }}
.st-key-inv_edit button {{ background: transparent; border: 1.5px solid #FFFFFF; border-radius: 12px; }}
.st-key-inv_edit button:hover {{ border-color: {ORANGE}; }}
.st-key-hero [data-testid="stAlert"] p, .st-key-hero [data-testid="stAlert"] span {{ color: {INK} !important; }}
.hero .title {{ font-size: 32px; font-weight: 800; line-height: 1.1; color: #FFFFFF; }}
.hero .subtitle {{ font-size: 14px; color: #D5E3E0 !important; margin-top: 4px; }}
.hero .pill {{
    display: inline-block; margin-top: 10px; background: {ORANGE}; color: #FFFFFF;
    border-radius: 999px; padding: 4px 14px; font-size: 12px; font-weight: 600;
}}

/* Section cards with a pill label sitting on the top border */
[class*="st-key-card"] {{
    background: {CARD}; border: 1.5px solid {TEAL}; border-radius: 20px;
    padding: 30px 18px 16px; margin-top: 24px; overflow: visible;
}}
.card-pill {{ text-align: center; margin-top: -48px; margin-bottom: 4px; }}
.card-pill span {{
    display: inline-block; background: {TEAL}; color: #FFFFFF; font-weight: 600; font-size: 14px;
    border-radius: 12px; padding: 6px 24px; min-width: 60%;
}}

button[kind="primary"], button[kind="primaryFormSubmit"] {{
    background-color: {TEAL} !important; color: #FFFFFF !important; border: none !important;
    border-radius: 12px !important; font-weight: 600 !important;
}}
div[data-testid="stForm"] {{ border: none; padding: 0; }}

/* Progress-bar rows */
.bar-row {{ display: grid; grid-template-columns: 1fr auto; gap: 3px 12px; margin: 4px 0 10px; font-size: 13px; color: {INK}; }}
.bar-row .pct {{ font-weight: 600; }}
.bar-track {{ grid-column: 1 / -1; height: 10px; border-radius: 999px; }}
.bar-fill {{ height: 100%; border-radius: 999px; }}

/* Big stat numbers */
.stat-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 18px 12px; text-align: center; padding: 6px 0; }}
.stat .num {{ font-size: 30px; font-weight: 700; color: {ORANGE}; line-height: 1.1; }}
.stat .lbl {{ font-size: 14px; color: {INK}; margin-top: 2px; }}

/* Donut rings */
.donuts {{ display: flex; justify-content: space-around; gap: 12px; padding: 6px 0 10px; }}
.donut-wrap {{ text-align: center; }}
.donut {{
    width: 100px; height: 100px; border-radius: 50%; margin: 0 auto;
    display: flex; align-items: center; justify-content: center;
}}
.donut .hole {{
    width: 72px; height: 72px; border-radius: 50%; background: {CARD};
    display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 18px; color: {INK};
}}
.donut-wrap .big {{ font-weight: 700; font-size: 17px; margin-top: 8px; color: {INK}; }}
.donut-wrap .small {{ font-size: 13px; color: {MUTED}; }}

.highlight {{
    background: {ORANGE}; color: #FFFFFF; border-radius: 14px; padding: 12px 18px;
    display: flex; align-items: center; justify-content: space-between; margin-top: 6px;
}}
.highlight .lbl {{ font-weight: 600; font-size: 15px; line-height: 1.2; }}
.highlight .num {{ font-weight: 800; font-size: 28px; white-space: nowrap; }}
.highlight {{ gap: 12px; }}

.side-list {{ display: flex; flex-direction: column; justify-content: center; gap: 18px; padding: 8px 0; }}
.side-list .row {{ display: flex; justify-content: space-between; font-size: 14px; color: {INK}; }}
.side-list .row b {{ font-weight: 700; }}

/* Cards in the same row stretch to equal height */
[data-testid="stColumn"] > [data-testid="stVerticalBlock"]:has(> div > [class*="st-key-card"]) {{ height: 100%; }}
[data-testid="stColumn"] > [data-testid="stVerticalBlock"] > div:has(> [class*="st-key-card"]) {{
    flex: 1; display: flex; flex-direction: column;
}}
[class*="st-key-card"] {{ flex: 1; }}
.st-key-card_growth > div:last-child {{ margin-bottom: auto; }}

/* Key-metrics ledger in the sidebar (stays the same on every page) */
[data-testid="stSidebar"] {{ background: {TEAL}; min-width: 290px !important; max-width: 290px !important; }}
[data-testid="stSidebar"] [data-testid="stSidebarHeader"] button, [data-testid="stSidebar"] [data-testid="stSidebarHeader"] span {{ color: #FFFFFF !important; }}
[data-testid="stExpandSidebarButton"], [data-testid="stSidebarCollapsedControl"] button {{
    background: {ORANGE} !important; color: #FFFFFF !important; border-radius: 999px !important;
    padding: 4px 12px !important; width: auto !important; box-shadow: 0 2px 6px rgba(0,0,0,0.15);
}}
[data-testid="stExpandSidebarButton"]::after, [data-testid="stSidebarCollapsedControl"] button::after {{
    content: "Key metrics"; font-size: 13px; font-weight: 600; margin-left: 4px;
}}
[data-testid="stExpandSidebarButton"] *, [data-testid="stSidebarCollapsedControl"] button * {{ color: #FFFFFF !important; }}
.ledger {{ color: #FFFFFF; padding: 4px 4px 0; }}
.ledger-upload {{ font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
    color: #D5E3E0; border-top: 1px solid rgba(255,255,255,0.18); padding-top: 16px; margin: 8px 4px 0; }}
[data-testid="stSidebar"] [data-testid="stFileUploader"] label p,
.st-key-hero [data-testid="stFileUploader"] label p,
[data-testid="stSidebar"] [data-testid="stFileUploader"] small,
.st-key-hero [data-testid="stFileUploader"] small,
[data-testid="stSidebar"] [data-testid="stFileUploaderFileName"], .st-key-hero [data-testid="stFileUploaderFileName"] {{ color: #FFFFFF !important; }}
[data-testid="stSidebar"] [data-testid="stFileUploaderDropzone"], .st-key-hero [data-testid="stFileUploaderDropzone"] {{
    background: rgba(255,255,255,0.08); border: 1px dashed rgba(255,255,255,0.45); color: #FFFFFF;
}}
[data-testid="stSidebar"] [data-testid="stFileUploaderDropzone"] *, .st-key-hero [data-testid="stFileUploaderDropzone"] * {{ color: #FFFFFF; }}
[data-testid="stSidebar"] [data-testid="stExpander"] details, .st-key-hero [data-testid="stExpander"] details {{ background: {CREAM}; border-radius: 10px; border: none; }}
[data-testid="stSidebar"] [data-testid="stExpander"] summary,
.st-key-hero [data-testid="stExpander"] summary,
[data-testid="stSidebar"] [data-testid="stExpander"] summary *, .st-key-hero [data-testid="stExpander"] summary * {{ color: {INK} !important; font-weight: 600; }}
[data-testid="stSidebar"] [data-testid="stExpander"] [data-testid="stCaptionContainer"] *, .st-key-hero [data-testid="stExpander"] [data-testid="stCaptionContainer"] * {{ color: {MUTED} !important; }}
[data-testid="stSidebar"] [data-testid="stFileUploaderDropzone"] button, .st-key-hero [data-testid="stFileUploaderDropzone"] button {{
    background: {ORANGE}; border: none; color: #FFFFFF;
}}
.ledger .head {{ font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #D5E3E0; }}
.ledger .merchant {{ font-size: 20px; font-weight: 700; margin: 2px 0 14px; }}
.ledger .item {{ padding: 16px 0; border-top: 1px solid rgba(255,255,255,0.18); }}
.ledger .item .lbl {{ font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #D5E3E0; }}
.ledger .item .val {{ font-size: 30px; font-weight: 800; color: {ORANGE}; line-height: 1.15; margin-top: 2px; }}
.ledger .item .val small {{ font-size: 14px; font-weight: 600; color: #FFFFFF; margin-left: 4px; }}
.ledger .item .sub {{ font-size: 12px; color: #D5E3E0; margin-top: 4px; line-height: 1.4; }}
.ledger .brk {{ display: flex; justify-content: space-between; font-size: 13px; color: #FFFFFF; padding: 3px 0; }}
.ledger .brk span:first-child {{ color: #D5E3E0; }}
.ledger .brk.rate {{ border-top: 1px dashed rgba(255,255,255,0.25); margin-top: 4px; padding-top: 6px; }}

/* Scheme logos and routing rows */
.logo {{ height: 18px; width: auto; vertical-align: -4px; }}
.logo-eftpos {{
    display: inline-block; font-weight: 800; font-size: 12px; letter-spacing: -0.02em; color: #FFFFFF;
    background: #0B3A53; border-radius: 4px; padding: 1px 6px; vertical-align: 1px; line-height: 16px;
}}
.scheme-legend {{ display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 16px; font-size: 13px; color: {INK}; margin-bottom: 6px; }}
.scheme-legend .sw {{ display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: 0; }}
.route-row {{ padding: 8px 0 10px; border-bottom: 1px solid #EFE6D6; }}
.route-row:last-of-type {{ border-bottom: none; }}
.route-head {{ display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: {INK}; }}
.route-head .muted {{ color: {MUTED}; font-size: 12px; }}
.split {{ display: flex; height: 12px; border-radius: 999px; overflow: hidden; margin: 6px 0 4px; gap: 2px; background: {CARD}; }}
.split div {{ height: 100%; }}
.route-to {{ font-size: 12px; color: {INK}; display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; }}
.route-to b {{ font-weight: 700; }}
.route-note {{ font-size: 12px; color: {MUTED}; margin-top: 6px; }}
.impact {{ margin-top: 10px; font-size: 13px; color: {INK}; }}
.impact .line {{ display: flex; justify-content: space-between; padding: 4px 0; }}
.impact .line .neg {{ color: #A4502F; font-weight: 700; }}
.impact .line .pos {{ color: #1D6B3A; font-weight: 700; }}

table.reform {{ width: 100%; border-collapse: collapse; font-size: 13px; color: {INK}; margin: 10px 0 6px; }}
table.reform th {{ text-align: right; font-weight: 600; color: {MUTED}; font-size: 12px; padding: 4px 6px; }}
table.reform td {{ text-align: right; padding: 4px 6px; border-top: 1px solid #EFE6D6; }}
table.reform td:first-child, table.reform th:first-child {{ text-align: left; }}
table.reform td.same {{ color: {MUTED}; }}
table.reform tr.tot td {{ font-weight: 700; border-top: 1.5px solid {INK}; }}
table.reform tr.rate td {{ font-weight: 700; color: {ORANGE}; border-top: none; }}

.empty-state {{ text-align: center; color: {MUTED}; font-size: 14px; padding: 28px 12px; }}
.empty-state .big {{ font-size: 17px; font-weight: 600; color: {INK}; margin-bottom: 6px; }}

/* Footer with corner triangles */
.site-footer {{
    position: relative; text-align: center; font-size: 13px; font-weight: 600; color: {INK};
    margin-top: 40px; padding: 28px 0 18px; overflow: hidden;
}}
.site-footer:before, .site-footer:after {{
    content: ""; position: absolute; bottom: 0; width: 0; height: 0; border-style: solid;
}}
.site-footer:before {{ left: 0; border-width: 46px 0 0 46px; border-color: transparent transparent transparent {ORANGE}; }}
.site-footer:after {{ right: 0; border-width: 0 0 46px 46px; border-color: transparent transparent {ORANGE} transparent; }}

@media (max-width: 640px) {{
    [class*="st-key-card"] [data-testid="stHorizontalBlock"] {{ gap: 0.25rem; }}
    .st-key-hero {{ padding: 50px 16px 14px; }}
    .hero .title {{ font-size: 26px; }}
    .stat .num {{ font-size: 28px; }}
    .donut {{ width: 96px; height: 96px; }}
    .donut .hole {{ width: 68px; height: 68px; }}
}}
</style>
""", unsafe_allow_html=True)

def card_title(text):
    st.markdown(f'<div class="card-pill"><span>{text}</span></div>', unsafe_allow_html=True)

def donut_html(pct, colour, big, small):
    p = max(min(pct, 100), 0)
    return (f'<div class="donut-wrap"><div class="donut" style="background:conic-gradient({colour} {p}%, '
            f'{TINTS.get(colour, "#EEE")} 0)"><div class="hole">{pct:.0f}%</div></div>'
            f'<div class="big">{big}</div><div class="small">{small}</div></div>')

LOGO_DIR = (Path(__file__).parent if "__file__" in globals() else Path.cwd()) / "assets" / "logos"
# Brand marks from Simple Icons (CC0). eftpos isn't in Simple Icons: drop the official file at
# assets/logos/eftpos.svg and it is used automatically; otherwise a text badge is shown.
LOGO_FILES = {"Visa": ("visa.svg", "#1A1F71"), "Mastercard": ("mastercard.svg", "#EB001B"),
              "Amex": ("americanexpress.svg", "#2E77BC"), "Apple Pay": ("applepay.svg", "#000000"),
              "Eftpos": ("eftpos.svg", None)}

@st.cache_data(show_spinner=False)
def _logo_data_uri(name, mtime=None):  # mtime is part of the cache key
    file, colour = LOGO_FILES.get(name, (None, None))
    path = LOGO_DIR / file if file else None
    if not path or not path.exists():
        return None
    svg = path.read_text()
    if colour:
        svg = svg.replace("<svg ", f'<svg fill="{colour}" ', 1)
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()

def logo(name, height=18):
    file = LOGO_FILES.get(name, (None,))[0]
    path = LOGO_DIR / file if file else None
    uri = _logo_data_uri(name, path.stat().st_mtime if path and path.exists() else None)
    if uri:
        return f'<img class="logo" src="{uri}" alt="{name}" title="{name}" style="height:{height}px">'
    if name == "Eftpos":
        return '<span class="logo-eftpos" title="eftpos">eftpos</span>'
    return f"<b>{name}</b>"

def fmt_money(v):
    if abs(v) >= 1_000_000:
        return f"${v/1_000_000:,.2f}M"
    if abs(v) >= 10_000:
        return f"${v/1_000:,.1f}k"
    return f"${v:,.0f}"

# Illustrative starting rates only - edit in the Fee Assumptions card to match the merchant's pricing.
# Percentages apply to approved transaction value; cents apply per approved transaction.
FEE_COLUMNS = ["Interchange %", "Interchange ¢", "Scheme fee %", "Acquiring %", "Processing ¢"]
DEFAULT_FEES = {
    "Visa":       [0.50, 0.0, 0.10, 0.30, 5.0],
    "Mastercard": [0.50, 0.0, 0.10, 0.30, 5.0],
    "Apple Pay":  [0.50, 0.0, 0.10, 0.30, 5.0],
    "Eftpos":     [0.00, 5.0, 0.02, 0.30, 5.0],
    "Amex":       [0.00, 0.0, 0.00, 1.40, 5.0],
    "Other":      [0.50, 0.0, 0.10, 0.30, 5.0],
}

def default_fee_table(methods, overrides=None):
    """One row per payment method. `overrides` (scheme -> rates from an invoice) replace the illustrative
    defaults; a missing rate in an override keeps the default."""
    overrides = overrides or {}
    names = list(dict.fromkeys(list(methods) + ["Other"]))
    rows = []
    for m in names:
        base = DEFAULT_FEES.get(m, DEFAULT_FEES["Other"])
        if m in overrides:
            vals = [round(o, 4) if o is not None else b for o, b in zip(overrides[m], base)]
            rows.append([m, "Invoice"] + vals)
        else:
            rows.append([m, "Assumed"] + base)
    return pd.DataFrame(rows, columns=["Payment method", "Source"] + FEE_COLUMNS)

def compute_fees(df, fee_table, n_months):
    """Monthly interchange, scheme and acquiring/processing fees on approved transactions."""
    approved = df[df["status"] == "approved"]
    by_method = approved.groupby("payment_method")["amount"].agg(["count", "sum"])
    rates = fee_table.set_index("Payment method")[FEE_COLUMNS].apply(pd.to_numeric, errors="coerce").fillna(0)
    fallback = rates.loc["Other"] if "Other" in rates.index else pd.Series(0.0, index=FEE_COLUMNS)
    totals = {"interchange": 0.0, "scheme": 0.0, "acquiring": 0.0}
    for method, row in by_method.iterrows():
        r = rates.loc[method] if method in rates.index else fallback
        totals["interchange"] += row["sum"] * r["Interchange %"] / 100 + row["count"] * r["Interchange ¢"] / 100
        totals["scheme"] += row["sum"] * r["Scheme fee %"] / 100
        totals["acquiring"] += row["sum"] * r["Acquiring %"] / 100 + row["count"] * r["Processing ¢"] / 100
    monthly = {k: v / n_months for k, v in totals.items()}
    monthly["total"] = sum(monthly.values())
    return monthly

def ledger_html(merchant, items):
    """items: list of (label, value, unit, sub)."""
    rows = "".join(
        f'<div class="item"><div class="lbl">{lbl}</div>'
        f'<div class="val">{val}<small>{unit}</small></div><div class="sub">{sub}</div></div>'
        for lbl, val, unit, sub in items)
    return f'<div class="ledger"><div class="head">Key metrics</div><div class="merchant">{merchant}</div>{rows}</div>'

def style_chart(fig, height=260, legend=False):
    fig.update_layout(
        height=height, margin=dict(l=4, r=4, t=30 if legend else 6, b=4),
        plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
        font=dict(family="Poppins, sans-serif", color=INK, size=12),
        hoverlabel=dict(bgcolor="#FFFFFF", bordercolor=TEAL, font_color=INK),
        showlegend=legend, legend=dict(orientation="h", yanchor="bottom", y=1.02, x=0.5, xanchor="center", title=None),
        xaxis_title=None, yaxis_title=None,
    )
    fig.update_xaxes(showgrid=False, linecolor="#D9CFBD", tickfont_color=MUTED)
    fig.update_yaxes(gridcolor="#EFE6D6", zeroline=False, tickfont_color=MUTED)
    return fig

# ---------- ONE-TIME SETUP (cached) ----------

@st.cache_resource
def clean_api_key(raw):
    """Keys pasted into Streamlit secrets often pick up a space, line break or quotes, which makes the HTTP
    header invalid. API keys never contain whitespace or quotes, so drop them."""
    return "".join(str(raw).split()).strip("\"'")

def get_client():
    # Keys that aren't scoped to a workspace must name one on every request. Optional secret:
    # ANTHROPIC_WORKSPACE_ID = "wrkspc_..." (a workspace-scoped key needs nothing extra).
    workspace = st.secrets.get("ANTHROPIC_WORKSPACE_ID")
    headers = {"anthropic-workspace-id": clean_api_key(workspace)} if workspace else None
    return Anthropic(api_key=clean_api_key(st.secrets["ANTHROPIC_API_KEY"]), default_headers=headers)

_SECRET_PATTERN = re.compile(r"sk-ant-[A-Za-z0-9_\-]*")

def redact(text):
    """Never show an API key on screen, even inside an error message."""
    return _SECRET_PATTERN.sub("sk-ant-…(hidden)", str(text))

@st.cache_resource
def get_knowledge_base():
    documents = [
        {"id": "decline_codes", "title": "Card Decline Codes Reference",
         "text": ("Common card decline reasons include: Insufficient Funds (cardholder's "
                  "account lacks available balance), Fraud Suspected (issuer's fraud "
                  "detection flagged the transaction as high-risk), Card Expired (the "
                  "card's expiry date has passed), Invalid CVV (checkout form errors or "
                  "stored outdated card data), and Issuer Timeout (issuing bank failed to "
                  "respond within the authorization window, often linked to acquirer or "
                  "gateway routing configuration issues).")},
        {"id": "least_cost_routing", "title": "Least-Cost Routing Explained",
         "text": ("Least-cost routing (LCR) directs a card transaction through whichever "
                  "eligible network processes it at the lowest cost to the merchant, since "
                  "many debit cards can be routed via more than one network. Regulators, "
                  "including in Australia, have pushed for wider LCR availability.")},
        {"id": "3ds_fraud_liability", "title": "3D Secure and Fraud Liability Shift",
         "text": ("3D Secure (3DS2) is an authentication protocol adding an extra "
                  "verification step for online card payments. Successful 3DS "
                  "authentication typically shifts fraud chargeback liability from "
                  "merchant to issuer. High fraud-suspected decline rates are often "
                  "addressed by implementing or tuning 3DS2.")},
        {"id": "au_interchange_reform_2026", "title": "Australia RBA Interchange and Surcharging Reform (2026)",
         "text": ("The RBA's reforms mostly take effect 1 October 2026. Surcharging on "
                  "debit, prepaid, and credit cards across eftpos, Mastercard, and Visa "
                  "networks is banned. Debit and prepaid interchange is capped at a flat "
                  "8 cents; consumer credit is capped at 0.3%; commercial credit stays at "
                  "0.8%. A 1.0% cap for foreign-issued cards follows from 1 April 2027. "
                  "Acquirers/PSPs face new fee transparency duties.")},
        {"id": "least_cost_routing_costs", "title": "Eftpos vs Scheme Debit: Cost Structure and the 2026 Reform",
         "text": ("Eftpos prices interchange in cents-based (flat-fee) terms; international "
                  "scheme networks price ad-valorem (percentage-based), typically more "
                  "expensive for higher-value transactions. The 1 Oct 2026 flat 8-cent "
                  "debit/prepaid cap narrows this gap, though eftpos generally remains "
                  "cheaper, especially for lower-value transactions.")},
    ]
    # TF-IDF keyword search: instant to build and plenty for a small knowledge base,
    # without the large PyTorch/sentence-transformers download at startup.
    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
    doc_matrix = vectorizer.fit_transform([f"{d['title']}. {d['text']}" for d in documents])
    return documents, vectorizer, doc_matrix

def retrieve_relevant_docs(query, top_k=2):
    documents, vectorizer, doc_matrix = get_knowledge_base()
    similarities = cosine_similarity(vectorizer.transform([query]), doc_matrix)[0]
    top_indices = similarities.argsort()[::-1][:top_k]
    return [{"title": documents[i]["title"], "text": documents[i]["text"]} for i in top_indices]

# ---------- INVOICE / STATEMENT PDF EXTRACTION ----------

INVOICE_MODEL = "claude-opus-5-5"
MAX_PDF_BYTES = 30 * 1024 * 1024        # API request limit is 32 MB including the base64 overhead headroom
_NUM = {"anyOf": [{"type": "number"}, {"type": "null"}]}
_STR = {"anyOf": [{"type": "string"}, {"type": "null"}]}
_SCHEME_LINE = {
    "type": "object",
    "properties": {
        "scheme": {"type": "string", "enum": ["Visa", "Mastercard", "Eftpos", "Amex", "Other"]},
        "card_type": {"type": "string", "enum": ["debit", "credit", "all"]},
        "value": _NUM, "transactions": _NUM,
        "interchange_pct": _NUM, "interchange_cents": _NUM, "scheme_fee_pct": _NUM,
        "acquiring_pct": _NUM, "processing_cents": _NUM,
        "interchange_amount": _NUM, "scheme_fee_amount": _NUM, "acquiring_amount": _NUM, "total_fees_amount": _NUM,
    },
    "required": ["scheme", "card_type", "value", "transactions", "interchange_pct", "interchange_cents",
                 "scheme_fee_pct", "acquiring_pct", "processing_cents", "interchange_amount",
                 "scheme_fee_amount", "acquiring_amount", "total_fees_amount"],
    "additionalProperties": False,
}
INVOICE_SCHEMA = {
    "type": "object",
    "properties": {
        "is_card_fee_document": {"type": "boolean"},
        "merchant_name": _STR, "acquirer": _STR, "period_start": _STR, "period_end": _STR, "currency": _STR,
        "pricing_model": {"type": "string", "enum": ["interchange_plus_plus", "blended", "unknown"]},
        "total_card_value": _NUM, "total_transactions": _NUM, "total_fees": _NUM,
        "interchange_fees": _NUM, "scheme_fees": _NUM, "acquiring_fees": _NUM, "other_fees": _NUM,
        "schemes": {"type": "array", "items": _SCHEME_LINE},
        "notes": {"type": "string"},
    },
    "required": ["is_card_fee_document", "merchant_name", "acquirer", "period_start", "period_end", "currency",
                 "pricing_model", "total_card_value", "total_transactions", "total_fees", "interchange_fees",
                 "scheme_fees", "acquiring_fees", "other_fees", "schemes", "notes"],
    "additionalProperties": False,
}
INVOICE_PROMPT = """This PDF is a merchant's card-acceptance invoice or statement from their acquirer or payment \
provider (for example in Australia: a bank, Tyro, Square, Stripe or similar).

Extract the fees into the JSON schema:
- Set is_card_fee_document to false if this isn't a card fee invoice or statement, and leave the rest null/empty.
- Amounts are in the statement currency, excluding GST where the document separates it. Dates as YYYY-MM-DD.
- pricing_model: "interchange_plus_plus" if interchange and scheme fees are itemised separately from the \
acquirer's margin; "blended" if each card type has a single merchant service fee (MSF) rate; else "unknown".
- schemes: one line per scheme and card type the document breaks out (use card_type "all" when it doesn't split \
debit and credit). Map eftpos / EFTPOS / CHQ / SAV to Eftpos. Wallets such as Apple Pay belong to the card's scheme.
  * Rates as percentages (0.5 means 0.5%) and per-transaction fees in cents (5 means 5c).
  * For blended pricing, put the MSF rate in acquiring_pct and its fixed per-transaction fee in processing_cents.
  * Terminal rental, chargeback and other non-transaction fees go in other_fees, not in scheme lines.
- Use null for anything the document doesn't state. Never estimate or invent a figure.
- notes: one or two short sentences on anything a consultant should know (e.g. figures that look inconsistent, \
fees you couldn't place)."""

INVOICE_FALLBACK_MODEL = "claude-sonnet-4-6"   # the model the rest of the app already uses

class InvoiceError(Exception):
    pass

def _describe_api_error(e):
    """Short, specific message for the sidebar - specific enough to diagnose from a screenshot."""
    if isinstance(e, anthropic.AuthenticationError):
        return "The app's Anthropic API key was rejected - check ANTHROPIC_API_KEY in the app's secrets."
    if isinstance(e, anthropic.RateLimitError):
        return "Too many requests right now - please try again in a minute."
    if isinstance(e, anthropic.APITimeoutError):
        return "The request to the AI service timed out - please try again."
    if isinstance(e, anthropic.APIConnectionError):
        cause = e.__cause__
        if cause is not None and "header" in str(cause).lower():
            return ("The Anthropic API key in the app's secrets isn't valid as written - re-paste it in "
                    "Settings → Secrets as ANTHROPIC_API_KEY = \"sk-ant-…\" on a single line.")
        return ("Couldn't reach the AI service"
                + (f" ({type(cause).__name__}: {redact(str(cause))[:120]})" if cause else "") + " - please try again.")
    if isinstance(e, anthropic.APIStatusError):
        detail = ""
        if isinstance(e.body, dict):
            detail = (e.body.get("error") or {}).get("message", "")
        if "anthropic-workspace-id" in detail:
            return ("This API key isn't linked to a workspace. Either create a new key inside a workspace in the "
                    "Claude Console and use that, or add ANTHROPIC_WORKSPACE_ID = \"wrkspc_…\" (the workspace's ID) "
                    "to the app's secrets alongside the key.")
        return f"The AI service returned an error ({e.status_code}{': ' + redact(detail)[:400] if detail else ''})."
    return f"Unexpected error: {type(e).__name__}: {redact(str(e))[:160]}"

def _json_from_text(text):
    """Parse a JSON object from model text, tolerating ```json fences or a sentence around it."""
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise InvoiceError("No fee data came back from the document.")
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError as e:
        raise InvoiceError("The fee data that came back wasn't readable - please try again.") from e

def claude_json(content, prompt, schema, too_long="The document is too long to process in one go."):
    """Ask Claude for JSON matching `schema` about `content` (a list of content blocks).
    Streamed, so bytes keep flowing while Claude works - a long silent request can be cut off by the hosting
    platform's network. Falls back to a plain request on the app's existing model if the newer parameters,
    model or beta aren't available, or the connection drops."""
    client = get_client()
    try:
        with client.beta.messages.stream(
            model=INVOICE_MODEL,
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",    # if a safety classifier declines, re-run on Anthropic's recommended fallback
            output_config={"effort": "low",     # simple extraction: low effort keeps it quick
                           "format": {"type": "json_schema", "schema": schema}},
            messages=[{"role": "user", "content": content + [{"type": "text", "text": prompt}]}],
        ) as stream:
            response = stream.get_final_message()
    except (TypeError, anthropic.NotFoundError, anthropic.PermissionDeniedError, anthropic.BadRequestError,
            anthropic.APIConnectionError, anthropic.InternalServerError):
        try:
            with client.messages.stream(
                model=INVOICE_FALLBACK_MODEL,
                max_tokens=16000,
                messages=[{"role": "user", "content": content + [{"type": "text", "text": (
                    prompt + "\n\nReply with only a JSON object matching this JSON schema, no other text:\n"
                    + json.dumps(schema))}]}],
            ) as stream:
                response = stream.get_final_message()
        except anthropic.APIError as e:
            raise InvoiceError(_describe_api_error(e)) from e
    except anthropic.APIError as e:
        raise InvoiceError(_describe_api_error(e)) from e
    if response.stop_reason == "refusal":
        raise InvoiceError("The document couldn't be processed.")
    if response.stop_reason == "max_tokens":
        raise InvoiceError(too_long)
    return _json_from_text("".join(b.text for b in response.content if b.type == "text"))

@st.cache_data(show_spinner=False, max_entries=20)
def extract_invoice(pdf_bytes):
    """Read an acquirer invoice/statement PDF with Claude and return the fee data as a dict.
    Cached on the file's bytes, so each invoice is only sent once."""
    document = {"type": "document", "source": {"type": "base64", "media_type": "application/pdf",
                                               "data": base64.standard_b64encode(pdf_bytes).decode("utf-8")}}
    data = claude_json([document], INVOICE_PROMPT, INVOICE_SCHEMA,
                       too_long="The invoice is too long to extract in one go - try uploading fewer pages.")
    data.setdefault("schemes", [])
    data.setdefault("is_card_fee_document", True)
    return data

def _weighted(lines, field, weight):
    vals = [(l[field], l.get(weight) or 0) for l in lines if l.get(field) is not None]
    if not vals:
        return None
    total_w = sum(w for _, w in vals)
    return sum(v * w for v, w in vals) / total_w if total_w else sum(v for v, _ in vals) / len(vals)

def invoice_rates(invoice):
    """Per-scheme rates (FEE_COLUMNS order) derived from an extracted invoice: stated rates first,
    otherwise fee amount / value. Blended MSF goes under Acquiring, with interchange/scheme at 0."""
    blended = invoice.get("pricing_model") == "blended"
    rates = {}
    for scheme in ["Visa", "Mastercard", "Eftpos", "Amex"]:
        lines = [l for l in invoice.get("schemes", []) if l["scheme"] == scheme]
        if not lines:
            continue
        value = sum(l["value"] or 0 for l in lines)
        def pct(rate_field, amount_field):
            r = _weighted(lines, rate_field, "value")
            if r is None and value:
                amounts = [l[amount_field] for l in lines if l[amount_field] is not None]
                r = sum(amounts) / value * 100 if amounts else None
            return r
        ic, sf, aq = pct("interchange_pct", "interchange_amount"), pct("scheme_fee_pct", "scheme_fee_amount"), \
            pct("acquiring_pct", "acquiring_amount")
        if blended and aq is None and value:
            totals = [l["total_fees_amount"] for l in lines if l["total_fees_amount"] is not None]
            aq = sum(totals) / value * 100 if totals else None
        ic_c = _weighted(lines, "interchange_cents", "transactions")
        pr_c = _weighted(lines, "processing_cents", "transactions")
        row = [ic, ic_c, sf, aq, pr_c]
        if all(v is None for v in row):
            continue
        # Once the invoice states any part of a fee (its % or its cents), the other part is 0, not the default -
        # e.g. an acquiring rate derived from a dollar amount already includes any per-transaction charge.
        if ic is not None or ic_c is not None:
            row[0], row[1] = ic or 0.0, ic_c or 0.0
        if aq is not None or pr_c is not None:
            row[3], row[4] = aq or 0.0, pr_c or 0.0
        if blended:
            row = [0.0 if v is None else v for v in row]
        rates[scheme] = row
    return rates

# ---------- MODE 1 TOOLS ----------

def calculate_revenue_impact(current_approval_rate, baseline_approval_rate,
                               monthly_transactions, average_transaction_value):
    current_approved = monthly_transactions * (current_approval_rate / 100)
    baseline_approved = monthly_transactions * (baseline_approval_rate / 100)
    diff = baseline_approved - current_approved
    revenue = diff * average_transaction_value
    return {"additional_failed_transactions_per_month": round(diff, 1),
            "estimated_monthly_revenue_impact": round(revenue, 2),
            "estimated_annual_revenue_impact": round(revenue * 12, 2)}

def retrieve_docs_tool(query, top_k=2):
    return {"documents": retrieve_relevant_docs(query, top_k)}

# ---------- SHARED: routing calculation ----------

EFTPOS_FLAT_FEE = 0.05
VISA_DEBIT_ADVALOREM = 0.005
MASTERCARD_DEBIT_ADVALOREM = 0.005
POST_REFORM_DEBIT_CAP = 0.08

def evaluate_routing_position(monthly_dual_network_debit_volume, eftpos_share_pct,
                                visa_share_pct, mastercard_share_pct, avg_debit_transaction_value):
    txn_count = monthly_dual_network_debit_volume / avg_debit_transaction_value
    eftpos_count = txn_count * (eftpos_share_pct / 100)
    visa_count = txn_count * (visa_share_pct / 100)
    mc_count = txn_count * (mastercard_share_pct / 100)

    eftpos_cost_before = eftpos_count * EFTPOS_FLAT_FEE
    visa_cost_before = visa_count * avg_debit_transaction_value * VISA_DEBIT_ADVALOREM
    mc_cost_before = mc_count * avg_debit_transaction_value * MASTERCARD_DEBIT_ADVALOREM
    current_cost_before = eftpos_cost_before + visa_cost_before + mc_cost_before
    optimal_cost_before = txn_count * EFTPOS_FLAT_FEE

    visa_fee_after = min(avg_debit_transaction_value * VISA_DEBIT_ADVALOREM, POST_REFORM_DEBIT_CAP)
    mc_fee_after = min(avg_debit_transaction_value * MASTERCARD_DEBIT_ADVALOREM, POST_REFORM_DEBIT_CAP)
    eftpos_cost_after = eftpos_count * EFTPOS_FLAT_FEE
    visa_cost_after = visa_count * visa_fee_after
    mc_cost_after = mc_count * mc_fee_after
    current_cost_after = eftpos_cost_after + visa_cost_after + mc_cost_after
    optimal_cost_after = txn_count * EFTPOS_FLAT_FEE

    return {
        "breakdown_before_reform": {"eftpos": round(eftpos_cost_before, 2), "visa_debit": round(visa_cost_before, 2), "mastercard_debit": round(mc_cost_before, 2)},
        "breakdown_after_reform": {"eftpos": round(eftpos_cost_after, 2), "visa_debit": round(visa_cost_after, 2), "mastercard_debit": round(mc_cost_after, 2)},
        "monthly_cost_current_routing_before_reform": round(current_cost_before, 2),
        "monthly_cost_fully_optimised_before_reform": round(optimal_cost_before, 2),
        "monthly_savings_available_now": round(current_cost_before - optimal_cost_before, 2),
        "monthly_cost_current_routing_after_reform": round(current_cost_after, 2),
        "monthly_cost_fully_optimised_after_reform": round(optimal_cost_after, 2),
        "monthly_savings_available_after_reform": round(current_cost_after - optimal_cost_after, 2),
        "still_worth_optimising_post_reform": (current_cost_after - optimal_cost_after) > 1.0
    }

ALL_TOOLS = [
    {"name": "calculate_revenue_impact", "description": "Calculates exact monthly/annual revenue impact of an approval rate decline.",
     "input_schema": {"type": "object", "properties": {
         "current_approval_rate": {"type": "number"}, "baseline_approval_rate": {"type": "number"},
         "monthly_transactions": {"type": "integer"}, "average_transaction_value": {"type": "number"}},
         "required": ["current_approval_rate", "baseline_approval_rate", "monthly_transactions", "average_transaction_value"]}},
    {"name": "retrieve_docs", "description": "Searches payments reference documentation for relevant grounding content.",
     "input_schema": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}},
    {"name": "evaluate_routing_position", "description": "Evaluates a merchant's debit routing mix across eftpos, Visa, and Mastercard before/after the Oct 2026 reform.",
     "input_schema": {"type": "object", "properties": {
         "monthly_dual_network_debit_volume": {"type": "number"}, "eftpos_share_pct": {"type": "number"},
         "visa_share_pct": {"type": "number"}, "mastercard_share_pct": {"type": "number"},
         "avg_debit_transaction_value": {"type": "number"}},
         "required": ["monthly_dual_network_debit_volume", "eftpos_share_pct", "visa_share_pct", "mastercard_share_pct", "avg_debit_transaction_value"]}},
]
TOOL_FUNCTIONS = {"calculate_revenue_impact": calculate_revenue_impact,
                   "retrieve_docs": retrieve_docs_tool,
                   "evaluate_routing_position": evaluate_routing_position}

# ---------- SHARED: routing mix analysis (from transaction data) ----------

SURCHARGE_BAN_NETWORKS = ["Eftpos", "Visa", "Mastercard"]

def surcharge_base_from_df(df, n_months):
    """Monthly approved value on the networks covered by the 1 Oct surcharge ban."""
    approved = df[df["status"] == "approved"]
    if approved["network"].notna().any():
        banned = approved["network"].isin(SURCHARGE_BAN_NETWORKS)
    else:
        banned = approved["payment_method"] != "Amex"
    return approved.loc[banned, "amount"].sum() / n_months

def surcharge_impact(base, revenue, saving, surcharging, rate_pct):
    """Monthly surcharge income lost to the 1 Oct ban, the routing saving, and the net effect."""
    lost = base * rate_pct / 100 if surcharging else 0.0
    net = saving - lost
    return {"base": base, "lost": lost, "saving": saving, "net": net,
            "price_rise_pct": (-net / revenue * 100) if (net < 0 and revenue) else 0.0}

# ---------- 1 OCT REFORM IMPACT ON THE MERCHANT'S ACTUAL FEES ----------
# Cost per transaction (or per invoice line) is split into interchange, scheme fees and processing. The reform caps
# interchange only; scheme fees and processing stay the same. Least-cost routing then sends dual-network debit via
# eftpos where eftpos's interchange + scheme fee is cheaper than the card scheme's post-reform cost.
REFORM_DEBIT_CAP = 0.08                # $ per debit / prepaid transaction on eftpos, Visa and Mastercard
REFORM_CONSUMER_CREDIT_CAP = 0.003     # 0.3% of value, consumer credit (commercial 0.8% can't be told apart)
REFORM_NETWORKS = {"Eftpos", "Visa", "Mastercard"}   # Amex isn't covered by the caps

def _rate_columns(rates, methods):
    """Per-row rates (FEE_COLUMNS) for a sequence of payment methods, falling back to the 'Other' row."""
    table = rates.set_index("Payment method")[FEE_COLUMNS].apply(pd.to_numeric, errors="coerce").fillna(0)
    fallback = table.loc["Other"] if "Other" in table.index else pd.Series(0.0, index=FEE_COLUMNS)
    return table.reindex(list(methods)).apply(lambda col: col.fillna(fallback[col.name]))

def _estimated_fees(rates, methods, amount, count):
    r = _rate_columns(rates, methods)
    ic = amount * r["Interchange %"].to_numpy() / 100 + count * r["Interchange ¢"].to_numpy() / 100
    sc = amount * r["Scheme fee %"].to_numpy() / 100
    pr = amount * r["Acquiring %"].to_numpy() / 100 + count * r["Processing ¢"].to_numpy() / 100
    return ic, sc, pr

def costs_from_transactions(df, rates):
    """One row per approved transaction: scheme, debit/credit, the network it ran on, value, and its fees split
    into interchange / scheme / processing - actual from the file's fee columns where it has them."""
    a = df[df["status"] == "approved"].copy()
    has_network = "network" in a.columns and a["network"].notna().any()
    f = pd.DataFrame({"payment_method": a["payment_method"].to_numpy(), "card_type": a["card_type"].to_numpy(),
                      "amount": a["amount"].to_numpy(dtype=float), "count": 1.0})
    # No network column: the scheme shown on a debit transaction is the network it ran on
    f["net_now"] = (a["network"].fillna(a["payment_method"]) if has_network else a["payment_method"]).to_numpy()
    est_ic, est_sc, est_pr = _estimated_fees(rates, f["payment_method"], f["amount"].to_numpy(), f["count"].to_numpy())
    def col(name):
        return a[name].to_numpy(dtype=float) if name in a.columns else np.zeros(len(a))
    file_ic, file_sc = col("fee_interchange"), col("fee_scheme")
    file_pr, file_total = col("fee_acquiring") + col("fee_other"), col("fee_total")
    if (file_ic + file_sc + file_pr).sum() > 0:
        f["ic"] = file_ic if file_ic.sum() > 0 else est_ic
        f["sc"] = file_sc if file_sc.sum() > 0 else est_sc
        f["pr"] = file_pr
        source = "transactions file" + ("" if file_ic.sum() > 0 else " (interchange estimated from rates)")
    elif file_total.sum() > 0:
        f["ic"], f["sc"] = est_ic, est_sc
        f["pr"] = np.maximum(file_total - est_ic - est_sc, 0)
        source = "transactions file total, split using the rate table"
    else:
        f["ic"], f["sc"], f["pr"] = est_ic, est_sc, est_pr
        source = "rate table (estimates)"
    f.attrs.update(source=source, network_inferred=not has_network)
    return f

def costs_from_invoice(invoice, rates):
    """One row per invoice scheme line, with the same columns as costs_from_transactions."""
    value_total, txn_total = invoice_totals(invoice)
    avg_ticket = (value_total / txn_total) if (value_total and txn_total) else None
    rows = []
    for l in invoice.get("schemes", []):
        value = l.get("value")
        if not value:
            continue
        count = l.get("transactions") or (value / avg_ticket if avg_ticket else 0)
        ct = l["card_type"] if l["card_type"] != "all" else {"Eftpos": "debit", "Amex": "credit"}.get(l["scheme"], "all")
        def part(amount_key, pct_key, cents_key=None):
            if l.get(amount_key) is not None:
                return l[amount_key]
            if l.get(pct_key) is not None or (cents_key and l.get(cents_key) is not None):
                return (l.get(pct_key) or 0) * value / 100 + ((l.get(cents_key) or 0) * count / 100 if cents_key else 0)
            return None
        ic, sc = part("interchange_amount", "interchange_pct", "interchange_cents"), part("scheme_fee_amount", "scheme_fee_pct")
        pr = part("acquiring_amount", "acquiring_pct", "processing_cents")
        est_ic, est_sc, est_pr = (v[0] for v in _estimated_fees(rates, [l["scheme"]], np.array([value]), np.array([count])))
        if ic is None and pr is not None and invoice.get("pricing_model") == "blended":
            # Blended MSF includes interchange and scheme fees: estimate those, the rest is the acquirer's margin
            ic, sc, pr = est_ic, est_sc, max(pr - est_ic - est_sc, 0)
        rows.append({"payment_method": l["scheme"], "card_type": ct, "net_now": l["scheme"], "amount": value,
                     "count": count, "ic": est_ic if ic is None else ic, "sc": est_sc if sc is None else sc,
                     "pr": est_pr if pr is None else pr})
    if invoice.get("other_fees"):
        rows.append({"payment_method": "Other fees", "card_type": "n/a", "net_now": "n/a", "amount": 0.0,
                     "count": 0.0, "ic": 0.0, "sc": 0.0, "pr": invoice["other_fees"]})
    f = pd.DataFrame(rows, columns=["payment_method", "card_type", "net_now", "amount", "count", "ic", "sc", "pr"])
    f.attrs.update(source="invoice", network_inferred=False, blended=invoice.get("pricing_model") == "blended")
    return f

def reform_analysis(f, rates, months):
    """Monthly interchange / scheme / processing and effective rate: today, after the 1 Oct caps on the same
    routing, and after the caps plus least-cost routing of dual-network debit via eftpos."""
    if f is None or f.empty or f["amount"].sum() <= 0:
        return None
    f = f.copy()
    debit, credit = (f["card_type"] == "debit").to_numpy(), (f["card_type"] == "credit").to_numpy()
    capped = f["net_now"].isin(REFORM_NETWORKS).to_numpy()
    ic, cnt, amt = f["ic"].to_numpy(float), f["count"].to_numpy(float), f["amount"].to_numpy(float)
    ic_after = ic.copy()
    ic_after[debit & capped] = np.minimum(ic, REFORM_DEBIT_CAP * cnt)[debit & capped]
    ic_after[credit & capped] = np.minimum(ic, REFORM_CONSUMER_CREDIT_CAP * amt)[credit & capped]
    f["ic_after"] = ic_after
    # What a debit payment costs via eftpos: the merchant's own eftpos costs if it has eftpos debit, else the rate table
    e = f[debit & (f["net_now"] == "Eftpos").to_numpy() & (cnt > 0)]
    if len(e) and e["count"].sum() > 0 and e["amount"].sum() > 0:
        e_ic_txn = e["ic_after"].sum() / e["count"].sum()
        e_sc_rate = e["sc"].sum() / e["amount"].sum()
        eftpos_basis = "the merchant's own eftpos transactions"
    else:
        r = _rate_columns(rates, ["Eftpos"]).iloc[0]
        avg_debit = amt[debit].sum() / max(cnt[debit].sum(), 1)
        e_ic_txn = r["Interchange ¢"] / 100 + r["Interchange %"] / 100 * avg_debit
        e_sc_rate = r["Scheme fee %"] / 100
        eftpos_basis = "the eftpos row of the rate table"
    e_ic_txn = min(e_ic_txn, REFORM_DEBIT_CAP)
    dual = debit & f["net_now"].isin(["Visa", "Mastercard"]).to_numpy()
    via_scheme = ic_after + f["sc"].to_numpy(float)
    via_eftpos = e_ic_txn * cnt + e_sc_rate * amt
    move = dual & (via_eftpos < via_scheme)
    f["suggested"] = np.where(move, "Eftpos", f["net_now"])
    f["ic_lcr"] = np.where(move, e_ic_txn * cnt, ic_after)
    f["sc_lcr"] = np.where(move, e_sc_rate * amt, f["sc"])
    revenue = amt.sum() / months
    stages = {}
    for name, icc, scc in [("today", "ic", "sc"), ("after", "ic_after", "sc"), ("lcr", "ic_lcr", "sc_lcr")]:
        t = {"interchange": f[icc].sum() / months, "scheme": f[scc].sum() / months, "processing": f["pr"].sum() / months}
        t["total"] = sum(t.values())
        t["rate"] = t["total"] / revenue * 100 if revenue else 0.0
        stages[name] = t
    return {"frame": f, "stages": stages, "revenue": revenue, "saving": stages["today"]["total"] - stages["lcr"]["total"],
            "routing_saving": stages["after"]["total"] - stages["lcr"]["total"], "eftpos_ic_txn": e_ic_txn,
            "eftpos_sc_rate": e_sc_rate, "eftpos_basis": eftpos_basis, "source": f.attrs.get("source", ""),
            "network_inferred": f.attrs.get("network_inferred", False), "blended": f.attrs.get("blended", False),
            "unsplit_value": amt[(~f["card_type"].isin(["debit", "credit"]) & f["net_now"].isin(REFORM_NETWORKS)
                                 ).to_numpy()].sum() / months}

def debit_routing_rows(f, column, months):
    """[(scheme, debit $/mo, {network: % of that scheme's debit value})] for the routing cards."""
    d = f[(f["card_type"] == "debit") & f["payment_method"].isin(["Visa", "Mastercard", "Eftpos"])]
    rows = []
    for m in [x for x in ["Visa", "Mastercard", "Eftpos"] if x in set(d["payment_method"])]:
        sub = d[d["payment_method"] == m]
        shares = (sub.groupby(column)["amount"].sum() / sub["amount"].sum() * 100).to_dict()
        rows.append((m, sub["amount"].sum() / months, shares))
    return rows

def debit_network_shares(f, column):
    d = f[(f["card_type"] == "debit") & f[column].isin(["Visa", "Mastercard", "Eftpos"])]
    return (d.groupby(column)["amount"].sum() / max(d["amount"].sum(), 1e-9) * 100).to_dict()

# ---------- INVOICE-DRIVEN ANALYSIS (when there's no transaction CSV) ----------

# ----- "Check the invoice figures": editable draft, checks, and back to an invoice dict -----
LINE_COLUMNS = ["Scheme", "Debit / credit", "Sales $", "Transactions", "Interchange $", "Scheme fees $", "Acquiring $"]
TOTAL_FIELDS = [("total_card_value", "Card sales $"), ("total_transactions", "Transactions"),
                ("interchange_fees", "Interchange $"), ("scheme_fees", "Scheme fees $"),
                ("acquiring_fees", "Acquiring / processing $"), ("other_fees", "Other fees $"), ("total_fees", "Total fees $")]

def _line_dollars(l, amount_key, pct_key, cents_key=None):
    """A line's fee in dollars: the stated amount, else worked out from its rate (% of sales, cents per txn)."""
    if l.get(amount_key) is not None:
        return float(l[amount_key])
    pct = l.get(pct_key)
    cents = l.get(cents_key) if cents_key else None
    if pct is None and cents is None:
        return None
    return (pct or 0) * (l.get("value") or 0) / 100 + (cents or 0) * (l.get("transactions") or 0) / 100

def draft_lines(invoice):
    rows = []
    for l in invoice.get("schemes", []):
        acquiring = _line_dollars(l, "acquiring_amount", "acquiring_pct", "processing_cents")
        if acquiring is None and invoice.get("pricing_model") == "blended":
            acquiring = l.get("total_fees_amount")
        rows.append({"Scheme": l["scheme"], "Debit / credit": l["card_type"], "Sales $": l.get("value"),
                     "Transactions": l.get("transactions"),
                     "Interchange $": _line_dollars(l, "interchange_amount", "interchange_pct", "interchange_cents"),
                     "Scheme fees $": _line_dollars(l, "scheme_fee_amount", "scheme_fee_pct"),
                     "Acquiring $": acquiring})
    return pd.DataFrame(rows, columns=LINE_COLUMNS)

def invoice_from_draft(base, fields, lines):
    """The invoice dict the rest of the app uses, rebuilt from the confirmed figures (fees as dollar amounts)."""
    def num(v):
        try:
            return None if v is None or pd.isna(v) else float(v)
        except (TypeError, ValueError):
            return None
    schemes = []
    for _, r in lines.iterrows():
        if not isinstance(r["Scheme"], str) or not r["Scheme"]:
            continue
        schemes.append({"scheme": r["Scheme"], "card_type": r["Debit / credit"] or "all", "value": num(r["Sales $"]),
                        "transactions": num(r["Transactions"]), "interchange_pct": None, "interchange_cents": None,
                        "scheme_fee_pct": None, "acquiring_pct": None, "processing_cents": None,
                        "interchange_amount": num(r["Interchange $"]), "scheme_fee_amount": num(r["Scheme fees $"]),
                        "acquiring_amount": num(r["Acquiring $"]), "total_fees_amount": None})
    out = {**base, **{k: num(fields.get(k)) for k, _ in TOTAL_FIELDS}, "schemes": schemes,
           "merchant_name": fields.get("merchant_name") or None, "acquirer": fields.get("acquirer") or None,
           "period_start": fields.get("period_start"), "period_end": fields.get("period_end"),
           "pricing_model": fields.get("pricing_model", base.get("pricing_model", "unknown")), "confirmed": True}
    return out

def invoice_checks(inv):
    """Things that suggest a figure was misread: (level, message), level 'warn' or 'info'."""
    out = []
    lines = inv.get("schemes", [])
    def total(key):
        vals = [l.get(key) for l in lines if l.get(key) is not None]
        return sum(vals) if vals else None
    def close(a, b, tol=0.015):
        return a is None or b is None or abs(a - b) <= max(abs(b) * tol, 1)
    lines_sales, card_sales = total("value"), inv.get("total_card_value")
    if not close(lines_sales, card_sales):
        out.append(("warn", f"Scheme lines add up to {fmt_money(lines_sales)} of sales, but card sales total is "
                            f"{fmt_money(card_sales)}."))
    parts = [inv.get(k) for k in ("interchange_fees", "scheme_fees", "acquiring_fees", "other_fees")]
    if inv.get("total_fees") is not None and any(p is not None for p in parts):
        parts_sum = sum(p or 0 for p in parts)
        if not close(parts_sum, inv["total_fees"]):
            out.append(("warn", f"Interchange + scheme + acquiring + other = {fmt_money(parts_sum)}, but total fees "
                                f"is {fmt_money(inv['total_fees'])}."))
    for key, line_key, label in [("interchange_fees", "interchange_amount", "Interchange"),
                                 ("scheme_fees", "scheme_fee_amount", "Scheme fees"),
                                 ("acquiring_fees", "acquiring_amount", "Acquiring")]:
        if not close(total(line_key), inv.get(key)):
            out.append(("warn", f"{label} on the scheme lines adds up to {fmt_money(total(line_key))}, but the "
                                f"{label.lower()} total is {fmt_money(inv[key])}."))
    value = card_sales or lines_sales
    if inv.get("total_fees") is not None and value:
        rate = inv["total_fees"] / value * 100
        if rate < 0.2 or rate > 4:
            out.append(("warn", f"Effective rate of {rate:.2f}% is unusual for card acceptance - check total fees "
                                "and card sales."))
    if not inv.get("period_start") or not inv.get("period_end"):
        out.append(("info", "No statement period - figures will be treated as one month."))
    if lines and not any(l.get("transactions") for l in lines):
        out.append(("info", "No transaction counts - the 8c debit cap and routing are less accurate without them."))
    if lines and not any(l.get("card_type") in ("debit", "credit") for l in lines if l["scheme"] in ("Visa", "Mastercard")):
        out.append(("info", "Visa/Mastercard aren't split into debit and credit - the reform caps and routing need "
                            "that split. Set 'Debit / credit' on those lines if the statement shows it."))
    if not lines:
        out.append(("warn", "No scheme lines were found - add them from the statement for the payment mix and routing."))
    return out

def invoice_months(invoice):
    """Length of the invoice period in months (at least 1), used to express figures per month."""
    try:
        start, end = pd.to_datetime(invoice.get("period_start")), pd.to_datetime(invoice.get("period_end"))
        return max(round(((end - start).days + 1) / 30.44), 1)
    except Exception:
        return 1

def invoice_totals(invoice):
    lines = invoice.get("schemes", [])
    value = invoice.get("total_card_value") or sum(l.get("value") or 0 for l in lines) or None
    txns = invoice.get("total_transactions") or sum(l.get("transactions") or 0 for l in lines) or None
    return value, txns

def invoice_mix(invoice):
    """Scheme lines as rows (scheme, card_type, value, count) for the Payment Mix pies."""
    rows = []
    for l in invoice.get("schemes", []):
        if not l.get("value"):
            continue
        ct = l["card_type"]
        if ct == "all":
            ct = {"Eftpos": "debit", "Amex": "credit"}.get(l["scheme"], "all")
        rows.append({"scheme": l["scheme"], "card_type": ct, "value": l["value"], "count": l.get("transactions") or 0})
    return pd.DataFrame(rows, columns=["scheme", "card_type", "value", "count"])

# ---------- DATA HELPERS ----------

@st.cache_data(show_spinner=False)
def build_data_summary(df):
    overall_rate = (df["status"] == "approved").mean() * 100
    df = df.copy()
    df["month"] = pd.to_datetime(df["date"]).dt.to_period("M").astype(str)
    monthly = df.groupby("month").apply(
        lambda x: pd.Series({"transactions": len(x), "approval_rate": round((x["status"] == "approved").mean() * 100, 1)}),
        include_groups=False).reset_index()
    declines = df[df["status"] == "declined"]["decline_reason"].value_counts()
    methods = df.groupby("payment_method").apply(
        lambda x: round((x["status"] == "approved").mean() * 100, 1), include_groups=False)
    summary_text = f"""Overall approval rate: {overall_rate:.1f}%
Monthly trend:\n{monthly.to_string(index=False)}
Decline reasons:\n{declines.to_string()}
By payment method:\n{methods.to_string()}"""
    return {"summary_text": summary_text, "monthly": monthly, "declines": declines, "methods": methods,
            "avg_transaction_value": df["amount"].mean(), "monthly_txn_count": len(df) / df["month"].nunique()}

def response_text(response):
    """Join all text blocks; the first block is not guaranteed to be text."""
    text = "\n\n".join(b.text for b in response.content if b.type == "text").strip()
    return text or "The model returned no text. Please try again."

# ---------- TRANSACTION FILES IN ANY LAYOUT ----------
# Read CSV / TSV / Excel / JSON exports, work out which column is which (by name, then by content, then by asking
# Claude with just the header and a few rows), and convert to the app's standard columns:
# date, amount, payment_method, status, decline_reason, card_type, network.

TRANSACTION_FILE_TYPES = ["csv", "tsv", "txt", "xlsx", "xlsm", "json"]
_FIELD_ALIASES = {
    "date": ["date", "txndate", "transactiondate", "datetime", "timestamp", "createdat", "created", "transactiontime",
             "settlementdate", "processeddate", "processedat", "tradingdate", "time"],
    "amount": ["amount", "txnamount", "transactionamount", "saleamount", "purchaseamount", "grossamount", "gross",
               "amountaud", "grosssales", "netsales", "sales", "salesamount", "chargeamount", "totalcollected",
               "value", "total", "amt", "salevalue"],
    "payment_method": ["paymentmethod", "scheme", "cardscheme", "cardbrand", "brand", "cardtype", "tendertype",
                       "paymenttype", "card", "cardnetwork", "method"],
    "status": ["status", "result", "outcome", "transactionstatus", "approvalstatus", "response", "responsetext", "state"],
    "decline_reason": ["declinereason", "reason", "responsetext", "responsemessage", "errormessage", "failurereason",
                       "failuremessage", "declinecode", "responsecode", "message"],
    "card_type": ["fundingtype", "funding", "fundingsource", "cardfundingtype", "cardfunding", "accounttype",
                  "cardcategory", "debitcredit", "creditdebit", "debitorcredit", "creditordebit", "drcr", "crdr",
                  "dc", "cd", "debitcreditindicator", "cardproduct", "producttype", "product", "cardclass",
                  "cardtype", "type"],
    "network": ["network", "routednetwork", "processingnetwork", "routedvia", "routing", "acquirernetwork"],
}
_APPROVED = re.compile(r"approv|succe(ss|ed)|settled|captur|authori[sz]ed|complete|paid|accept|^ok$|^00$|^y(es)?$", re.I)
_DECLINED = re.compile(r"declin|fail|reject|error|denied|refus|unsuccess|^n(o)?$", re.I)
_SKIP_STATUS = re.compile(r"refund|void|revers|cancel|chargeback|pending", re.I)

_MONEY = re.compile(r"\(?\s*-?\s*(AUD|A\$|\$)?\s*-?[\d,]*\.?\d+\s*(AUD)?\s*\)?", re.I)

class TransactionFileError(Exception):
    pass

def _norm(name):
    return re.sub(r"[^a-z0-9]", "", str(name).lower())

_SCHEME_RULES = [  # (substrings, whole-word codes, scheme) - checked in order
    (("apple",), (), "Apple Pay"), (("google", "gpay"), (), "Google Pay"), (("samsung",), (), "Samsung Pay"),
    (("amex", "american"), ("ax", "amx", "ae"), "Amex"),
    (("master", "maestro"), ("mc", "mcd", "dmc", "mcc", "mcard", "mstr", "m/c"), "Mastercard"),
    (("visa",), ("vi", "vs", "vsa", "dvi", "vd", "vc"), "Visa"),
    (("eftpos", "cheque", "savings"), ("ep", "efp", "eft", "chq", "sav", "cheq"), "Eftpos"),
    (("diners",), ("din",), "Diners"), (("jcb",), (), "JCB"), (("union",), ("cup",), "UnionPay"),
]

def _tokens(text):
    t = str(text).lower().replace("m/c", " mc ")
    return t, set(re.findall(r"[a-z]+", t))

def parse_scheme(text):
    """Card scheme from free text or codes: 'VISA DEBIT', 'MC', 'MC Debit', 'M/C', 'DMC', 'EFTPOS SAV', 'Apple Pay'."""
    t, words = _tokens(text)
    for subs, codes, name in _SCHEME_RULES:
        if any(k in t for k in subs) or words & set(codes):
            return name
    return "Other"

def parse_funding(text, letters=False):
    """Debit / credit from text or codes. With letters=True (a column known to hold debit/credit) a bare 'D' or
    'C' counts too."""
    t, words = _tokens(text)
    if letters and t.strip() in ("d", "c"):
        return "debit" if t.strip() == "d" else "credit"
    if "debit" in t or "prepaid" in t or "cheque" in t or "savings" in t or words & {"dr", "db", "deb", "dmc", "dvi", "vd", "sav", "chq"}:
        return "debit"
    if "credit" in t or "charge card" in t or words & {"cr", "vc", "commercial", "corporate", "business"}:
        return "credit"
    return "unknown"

# Fee / cost columns in a transactions file: (category, name pattern), checked in order.
# Surcharge is income for the merchant, not a cost, so it's kept separate.
_FEE_RULES = [
    ("surcharge", r"surcharg"),
    ("total", r"total.*(fee|cost|charge)|(fee|cost|charge)s?\W*total"),
    ("interchange", r"interchange|\bic\b"),
    ("scheme", r"scheme\W*fee|network\W*fee|assessment|brand\W*fee"),
    ("other", r"terminal|rental|chargeback|statement\W*fee|monthly\W*fee|minimum|account\W*fee"),
    ("acquiring", r"msf|merchant\W*(service|fee)|processing|acquir|transaction\W*fee|txn\W*fee|commission|"
                  r"\bfees?\b|\bcosts?\b"),
]
_FEE_EXCLUDE = re.compile(r"\brate\b|%|percent|pct|\bnet\b|gross|\bgst\b|\btax\b|\bcode\b|\btype\b", re.I)
FEE_CATEGORIES = ["interchange", "scheme", "acquiring", "other", "total", "surcharge"]

def find_fee_columns(table, used):
    """Columns holding money amounts whose names say they're fees/costs (or surcharges)."""
    found = {}
    for col in table.columns:
        name = re.sub(r"[_\-]+", " ", str(col).lower())
        if col in used or _FEE_EXCLUDE.search(name):
            continue
        for category, pattern in _FEE_RULES:
            if re.search(pattern, name):
                vals = table[col].dropna().astype(str).str.strip()
                vals = vals[vals != ""]
                if len(vals) and vals.head(200).map(lambda v: bool(_MONEY.fullmatch(v))).mean() >= 0.8:
                    found[col] = category
                break
    return found

def parse_amounts(series, in_cents=False):
    s = series.astype(str).str.strip()
    negative = s.str.startswith("(") & s.str.endswith(")")
    s = s.str.replace(r"[^0-9.\-]", "", regex=True)
    out = pd.to_numeric(s, errors="coerce")
    out = out.where(~negative, -out.abs())
    return out / 100 if in_cents else out

def parse_dates(series, day_first=True, fmt=None):
    """Dates in any common layout. ISO (2026-08-15) is never read day-first; compact 8-digit dates (15082026 /
    20260815) are tried both ways and the reading that works for more rows wins."""
    if pd.api.types.is_datetime64_any_dtype(series):
        return series
    s = series.astype(str).str.strip()
    if fmt:
        parsed = pd.to_datetime(s, errors="coerce", format=fmt)
        if parsed.notna().mean() >= 0.5:
            return parsed
    sample = s.head(200)
    if sample.str.match(r"^\d{4}-\d{2}-\d{2}").mean() >= 0.8:
        return pd.to_datetime(s, errors="coerce", format="mixed", dayfirst=False)
    if sample.str.fullmatch(r"\d{8}").mean() >= 0.8:
        options = [pd.to_datetime(s, errors="coerce", format=f) for f in ("%d%m%Y", "%Y%m%d", "%m%d%Y")]
        return max(options, key=lambda o: o.notna().sum())
    return pd.to_datetime(s, errors="coerce", dayfirst=day_first, format="mixed")

def _share(series, test):
    vals = series.dropna().astype(str).str.strip()
    vals = vals[vals != ""].head(200)
    return (vals.map(test).mean() if len(vals) else 0.0)

def read_table(name, data):
    """Load an uploaded file into a DataFrame of raw values, finding the header row if there are title lines."""
    lower = name.lower()
    if lower.endswith((".xlsx", ".xlsm")):
        sheets = pd.read_excel(io.BytesIO(data), sheet_name=None, header=None, dtype=object)
        raw = max(sheets.values(), key=len)
    elif lower.endswith(".json"):
        parsed = json.loads(data.decode("utf-8-sig"))
        if isinstance(parsed, dict):   # e.g. {"transactions": [...]}
            parsed = next((v for v in parsed.values() if isinstance(v, list)), [parsed])
        return pd.json_normalize(parsed)
    else:
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = data.decode("latin-1")
        if lower.endswith(".tsv"):
            sep = "\t"
        else:
            try:
                sep = csv.Sniffer().sniff(text[:5000], delimiters=",;\t|").delimiter
            except csv.Error:
                sep = ","
        raw = pd.read_csv(io.StringIO(text), sep=sep, engine="python", header=None, dtype=str,
                          skip_blank_lines=True, on_bad_lines="skip")
    raw = raw.dropna(how="all").dropna(axis=1, how="all").reset_index(drop=True)
    if raw.empty:
        raise TransactionFileError("The file is empty.")
    # Header = the first of the top rows that is mostly filled with text (exports often start with title lines)
    width = raw.shape[1]
    header_row = 0
    for i in range(min(20, len(raw))):
        cells = raw.iloc[i].dropna().astype(str).str.strip()
        texty = cells[~cells.str.fullmatch(r"[-\d.,$()\s/:]+")]
        if len(cells) >= max(2, width * 0.6) and len(texty) >= len(cells) * 0.7:
            header_row = i
            break
    names, seen = [], {}
    for c in raw.iloc[header_row]:
        n = str(c).strip() if pd.notna(c) and str(c).strip() else f"column_{len(names) + 1}"
        seen[n] = seen.get(n, 0) + 1
        names.append(n if seen[n] == 1 else f"{n}_{seen[n]}")
    table = raw.iloc[header_row + 1:].reset_index(drop=True)
    table.columns = names
    return table

def guess_mapping(table):
    """Map standard fields to columns by name, checked against the values; fill gaps by looking at values."""
    cols = list(table.columns)
    by_norm = {_norm(c): c for c in cols}
    checks = {
        "date": lambda col: parse_dates(table[col].head(200)).notna().mean() >= 0.8,
        "amount": lambda col: _share(table[col], lambda v: bool(_MONEY.fullmatch(v))) >= 0.8,
        "payment_method": lambda col: _share(table[col], lambda v: parse_scheme(v) != "Other") >= 0.6,
        "status": lambda col: _share(table[col], lambda v: bool(_APPROVED.search(v) or _DECLINED.search(v)
                                                                or _SKIP_STATUS.search(v))) >= 0.6,
        "card_type": lambda col: (_share(table[col], lambda v: parse_funding(v, letters=True) != "unknown") >= 0.6
                                  and table[col].nunique() <= 12),
        "network": lambda col: _share(table[col], lambda v: parse_scheme(v) in ("Eftpos", "Visa", "Mastercard",
                                                                               "Amex")) >= 0.6,
        "decline_reason": lambda col: True,
    }
    mapping, used = {}, set()
    for field in ["date", "amount", "payment_method", "status", "card_type", "network", "decline_reason"]:
        for alias in _FIELD_ALIASES[field]:
            col = by_norm.get(alias)
            if col and col not in used:
                try:
                    ok = checks[field](col)
                except Exception:
                    ok = False
                if ok:
                    mapping[field], _ = col, used.add(col)
                    break
    for field in ["date", "amount", "payment_method", "status", "card_type"]:   # by content
        if field in mapping:
            continue
        for col in cols:
            if col in used:
                continue
            try:
                if checks[field](col):
                    mapping[field], _ = col, used.add(col)
                    break
            except Exception:
                continue
    return mapping

_MAPPING_SCHEMA = {
    "type": "object",
    "properties": {
        **{f"{f}_column": {"anyOf": [{"type": "string"}, {"type": "null"}]}
           for f in ["date", "amount", "scheme", "status", "decline_reason", "card_type", "network"]},
        "approved_values": {"type": "array", "items": {"type": "string"}},
        "declined_values": {"type": "array", "items": {"type": "string"}},
        "scheme_codes": {"type": "array", "items": {"type": "object", "properties": {
            "raw": {"type": "string"},
            "scheme": {"type": "string", "enum": ["Visa", "Mastercard", "Eftpos", "Amex", "Apple Pay", "Google Pay",
                                                  "Other"]}},
            "required": ["raw", "scheme"], "additionalProperties": False}},
        "card_type_codes": {"type": "array", "items": {"type": "object", "properties": {
            "raw": {"type": "string"}, "card_type": {"type": "string", "enum": ["debit", "credit", "unknown"]}},
            "required": ["raw", "card_type"], "additionalProperties": False}},
        "fee_columns": {"type": "array", "items": {"type": "object", "properties": {
            "column": {"type": "string"},
            "type": {"type": "string", "enum": FEE_CATEGORIES}},
            "required": ["column", "type"], "additionalProperties": False}},
        "date_format": {"anyOf": [{"type": "string"}, {"type": "null"}]},
        "amount_in_cents": {"type": "boolean"},
        "day_first": {"type": "boolean"},
        "is_transaction_data": {"type": "boolean"},
        "notes": {"type": "string"},
    },
    "required": ["date_column", "amount_column", "scheme_column", "status_column", "decline_reason_column",
                 "card_type_column", "network_column", "approved_values", "declined_values", "scheme_codes",
                 "card_type_codes", "fee_columns", "date_format", "amount_in_cents",
                 "day_first", "is_transaction_data", "notes"],
    "additionalProperties": False,
}

@st.cache_data(show_spinner=False, max_entries=50)
def map_columns_with_claude(columns, sample_csv, distinct_values):
    """Ask Claude which column is which, from the header, a few (masked) sample rows, and the distinct values of
    short code-like columns - never the whole file."""
    prompt = (
        "These are the column names and first rows of a merchant's card transaction export:\n\n"
        f"{sample_csv}\n\nDistinct values of the short-list columns:\n{distinct_values}\n\n"
        "Identify, using the exact column names shown (or null if there is none): the transaction date, the "
        "amount, the card scheme or brand (Visa / Mastercard / eftpos / Amex...), the approval status or response, "
        "the decline reason, the funding type (debit / credit), and the network the payment was processed on. "
        "List the exact status values that mean approved and those that mean declined. Set amount_in_cents if "
        "amounts are whole cents, day_first if dates are written day before month (Australian format), and "
        "is_transaction_data false if this isn't a list of card transactions. List every column that holds a fee or "
        "cost charged to the merchant in fee_columns, typed interchange / scheme / acquiring (MSF, processing, "
        "merchant fee) / other (terminal, chargeback...) / total (a total of the others) / surcharge (charged to "
        "the customer). Give date_format as a Python strptime "
        "pattern for the date column if it's unusual (e.g. %d%m%Y), else null. If schemes or debit/credit are "
        "written as codes (e.g. VI, MC, EP, D, C), list what each distinct code means in scheme_codes and "
        "card_type_codes; otherwise leave those lists empty.")
    return claude_json([], prompt, _MAPPING_SCHEMA)

def _mask_card_numbers(text):
    return re.sub(r"\b\d{12,19}\b", lambda m: m.group()[:4] + "…" + m.group()[-4:], text)

def _doubtful(table, mapping):
    """True when the automatic match found the columns but can't be trusted to read them correctly, so Claude
    should check: status codes it can't classify (e.g. '05'), or whole-number amounts that may be in cents."""
    if "status" in mapping:
        vals = table[mapping["status"]].dropna().astype(str).str.strip()
        vals = vals[vals != ""]
        unknown = vals.map(lambda v: not (_APPROVED.search(v) or _DECLINED.search(v) or _SKIP_STATUS.search(v)
                                          or re.search(r"\bnot\b", v.lower())))
        if len(vals) and unknown.mean() > 0.05:
            return True
    amounts = table[mapping["amount"]].dropna().astype(str).str.strip().head(500)
    if len(amounts) and not amounts.str.contains(r"[.$]").any():
        numbers = parse_amounts(amounts).dropna()
        if len(numbers) and numbers.median() >= 100:     # e.g. 11448 for $114.48
            return True
    return False

@st.cache_data(show_spinner=False, max_entries=10)
def load_transactions(name, data, overrides=()):
    """Returns (df, report). Raises TransactionFileError with a plain-English message if it can't be read.
    `overrides` is ((field, column or ""), ...) chosen by the user in "Adjust column matching"."""
    try:
        table = read_table(name, data)
    except TransactionFileError:
        raise
    except Exception as e:
        raise TransactionFileError(f"Couldn't open the file ({type(e).__name__}). Supported: CSV, TSV, Excel (.xlsx), JSON.") from e
    mapping, method, notes = guess_mapping(table), "matched automatically", ""
    approved_vals, declined_vals, in_cents, day_first, date_fmt = [], [], False, True, None
    scheme_codes, card_type_codes, ai_fees = {}, {}, None
    if not {"date", "amount", "payment_method"} <= set(mapping) or _doubtful(table, mapping):
        sample = _mask_card_numbers(table.head(15).to_csv(index=False))
        distinct = "\n".join(
            f"{c}: " + ", ".join(map(str, table[c].dropna().astype(str).str.strip().unique()[:30]))
            for c in table.columns if 0 < table[c].nunique() <= 30)
        ai = map_columns_with_claude(tuple(table.columns), sample, _mask_card_numbers(distinct) or "(none)")
        if not ai.get("is_transaction_data", True):
            raise TransactionFileError("This doesn't look like a list of card transactions.")
        ai_map = {"date": ai.get("date_column"), "amount": ai.get("amount_column"),
                  "payment_method": ai.get("scheme_column"), "status": ai.get("status_column"),
                  "decline_reason": ai.get("decline_reason_column"), "card_type": ai.get("card_type_column"),
                  "network": ai.get("network_column")}
        mapping = {f: c for f, c in ai_map.items() if c in table.columns}
        approved_vals = [v.strip().lower() for v in ai.get("approved_values", [])]
        declined_vals = [v.strip().lower() for v in ai.get("declined_values", [])]
        in_cents, day_first = bool(ai.get("amount_in_cents")), bool(ai.get("day_first", True))
        date_fmt = ai.get("date_format")
        scheme_codes = {c["raw"].strip().lower(): c["scheme"] for c in ai.get("scheme_codes", [])}
        card_type_codes = {c["raw"].strip().lower(): c["card_type"] for c in ai.get("card_type_codes", [])}
        ai_fees = {f["column"]: f["type"] for f in ai.get("fee_columns", []) if f["column"] in table.columns}
        method, notes = "mapped by Claude", ai.get("notes", "")
    auto_mapping = dict(mapping)
    for field, col in overrides:
        if col == "":
            mapping.pop(field, None)
        elif col in table.columns:
            mapping = {f: c for f, c in mapping.items() if c != col}   # a column can only mean one thing
            mapping[field] = col
    missing = [f for f in ["date", "amount"] if f not in mapping]
    if missing:
        raise TransactionFileError(f"Couldn't find a {' or '.join(missing)} column. Columns found: "
                                   + ", ".join(map(str, table.columns[:12])))
    out = pd.DataFrame({"date": parse_dates(table[mapping["date"]], day_first, date_fmt),
                        "amount": parse_amounts(table[mapping["amount"]], in_cents)})
    scheme_src = table[mapping["payment_method"]] if "payment_method" in mapping else pd.Series("Other", index=table.index)
    out["payment_method"] = scheme_src.map(lambda v: scheme_codes.get(str(v).strip().lower()) or parse_scheme(v))
    if "status" in mapping:
        raw_status = table[mapping["status"]].astype(str).str.strip()
        def status_of(v):
            lv = v.lower()
            if lv in approved_vals:
                return "approved"
            if lv in declined_vals:
                return "declined"
            if _SKIP_STATUS.search(v):
                return None
            if _DECLINED.search(v) or re.search(r"\bnot\b", lv):   # before approved: "Unsuccessful", "Not approved"
                return "declined"
            return "approved" if _APPROVED.search(v) else None
        out["status"] = raw_status.map(status_of)
    else:
        out["status"] = "approved"    # e.g. settlement reports only list successful payments
    out["decline_reason"] = (table[mapping["decline_reason"]].where(out["status"] == "declined")
                             if "decline_reason" in mapping else None)
    if "card_type" in mapping:
        out["card_type"] = table[mapping["card_type"]].map(
            lambda v: card_type_codes.get(str(v).strip().lower()) or parse_funding(v, letters=True))
    else:
        out["card_type"] = scheme_src.map(parse_funding)
    if "network" in mapping:
        out["network"] = table[mapping["network"]].map(parse_scheme).where(
            lambda n: n.isin(["Eftpos", "Visa", "Mastercard", "Amex"]))
    fee_cols = find_fee_columns(table, set(mapping.values()))
    if ai_fees:
        fee_cols.update(ai_fees)
    for category in FEE_CATEGORIES:
        cols = [c for c, cat in fee_cols.items() if cat == category]
        out[f"fee_{category}"] = (sum(parse_amounts(table[c], in_cents).fillna(0).abs() for c in cols)
                                  if cols else 0.0)
    card_type_unread = []
    if "card_type" in mapping:
        raw_ct = table[mapping["card_type"]].astype(str).str.strip()
        unread = raw_ct[(out["card_type"] == "unknown") & (raw_ct != "") & (raw_ct.str.lower() != "nan")]
        card_type_unread = [(v, int(n)) for v, n in unread.value_counts().head(5).items()]
    rows_read = len(out)
    refunds = int((out["amount"] <= 0).sum())
    other_status = int(out["status"].isna().sum())
    out = out[(out["amount"] > 0) & out["status"].notna()].dropna(subset=["date", "amount"])
    if out.empty:
        raise TransactionFileError("No usable transactions were found (need a date and a positive amount).")
    out["card_type"] = out["card_type"].replace("unknown", pd.NA)
    df = normalise_card_columns(out.assign(card_type=out["card_type"].fillna("unknown")).reset_index(drop=True))
    report = {"rows_read": rows_read, "rows_used": len(df), "refunds_or_zero": refunds,
              "other_status": other_status, "mapping": mapping, "method": method, "notes": notes,
              "no_status": "status" not in mapping, "fee_columns": fee_cols,
              "columns": [str(c) for c in table.columns], "auto_mapping": auto_mapping,
              "card_type_unread": card_type_unread}
    return df, report

def actual_fees_from_file(df, n_months):
    """Monthly fees actually charged, from fee columns in the transactions file (None if there are none).
    Component columns are used when present; a 'total' column only when there are no components."""
    if df is None or not any(c.startswith("fee_") for c in df.columns):
        return None
    parts = {k: df[f"fee_{k}"].sum() / n_months for k in ["interchange", "scheme", "acquiring", "other"]}
    total_col = df["fee_total"].sum() / n_months
    components = sum(parts.values())
    if components == 0 and total_col == 0:
        return None
    total = components if components > 0 else total_col
    return {**parts, "total": total, "total_only": components == 0, "surcharge": df["fee_surcharge"].sum() / n_months}

WALLETS = {"Apple Pay", "Google Pay", "Samsung Pay"}
NETWORK_ALIASES = {"eftpos": "Eftpos", "visa": "Visa", "mastercard": "Mastercard", "mc": "Mastercard",
                   "amex": "Amex", "american express": "Amex"}

def normalise_card_columns(df):
    """Optional columns: card_type (debit/credit) and network (the network the transaction was routed on)."""
    df = df.copy()
    if "network" in df.columns:
        df["network"] = df["network"].astype(str).str.strip().str.lower().map(NETWORK_ALIASES)
    else:
        df["network"] = None
    # Wallets aren't schemes: report them under the network they ran on, when known
    is_wallet = df["payment_method"].isin(WALLETS)
    df["wallet"] = df["payment_method"].where(is_wallet)
    df.loc[is_wallet & df["network"].notna(), "payment_method"] = df["network"]
    if "card_type" in df.columns:
        df["card_type"] = df["card_type"].astype(str).str.strip().str.lower().where(
            lambda c: c.isin(["debit", "credit"]), "unknown")
    else:
        df["card_type"] = "unknown"
    # eftpos is always debit and Amex always credit, whatever the file said (or didn't)
    implied = df["payment_method"].map({"Eftpos": "debit", "Amex": "credit"})
    df["card_type"] = implied.fillna(df["card_type"])
    return df

def run_agent(df, question, invoice=None, max_iterations=5):
    client = get_client()
    context = []
    if df is not None:
        stats = build_data_summary(df)
        context.append(f"TRANSACTION DATA:\n{stats['summary_text']}\n\n"
                       f"Average transaction value: ${stats['avg_transaction_value']:.2f}\n"
                       f"Approx monthly transactions: {stats['monthly_txn_count']:.0f}")
    if invoice:
        context.append("ACQUIRER INVOICE (extracted figures, null = not stated):\n" + json.dumps(invoice, indent=1))
    messages = [{"role": "user", "content": (
        "\n\n".join(context) + f"\n\nQUESTION: {question}\n\nUse tools for any exact figures or facts - do not guess.")}]
    tool_log = []
    for _ in range(max_iterations):
        response = client.messages.create(model="claude-sonnet-4-6", max_tokens=1500,
                                            tools=ALL_TOOLS, messages=messages)
        if response.stop_reason != "tool_use":
            return response_text(response), tool_log
        messages.append({"role": "assistant", "content": response.content})
        results = []
        for block in response.content:
            if block.type == "tool_use":
                tool_log.append(f"{block.name}({block.input})")
                try:
                    result = TOOL_FUNCTIONS[block.name](**block.input)
                    results.append({"type": "tool_result", "tool_use_id": block.id, "content": json.dumps(result)})
                except Exception as e:
                    results.append({"type": "tool_result", "tool_use_id": block.id,
                                    "content": f"Tool error: {e}", "is_error": True})
        messages.append({"role": "user", "content": results})
    return "Reached iteration limit without a final answer.", tool_log

REFORM_CONTEXT = """
RBA INTERCHANGE AND SURCHARGING REFORM - KEY FACTS (effective mostly 1 October 2026):
- Surcharging on debit, prepaid, and credit card payments across eftpos, Mastercard,
  and Visa networks is BANNED from 1 October 2026.
- Debit and prepaid card interchange is capped at a flat 8 cents per transaction
  (down from ad-valorem/percentage-based rates on Visa/Mastercard debit).
- Consumer credit card interchange is capped at 0.3%; commercial credit remains at 0.8%.
- A 1.0% interchange cap for foreign-issued cards follows from 1 April 2027.
- Acquirers/PSPs face new fee transparency duties (publishing merchant fees clearly).
- Eftpos prices interchange in cents-based (flat) terms; Visa/Mastercard debit has
  historically used ad-valorem (percentage) pricing - typically more expensive,
  especially for higher-value transactions. The 8-cent cap narrows this gap but
  eftpos generally remains the cheaper routing option, particularly for lower-value
  transactions. Least-cost routing (LCR) availability is an existing RBA "expectation"
  on PSPs, unchanged by this reform.
"""

def run_routing_advisor(merchant_name, monthly_turnover, debit_pct, avg_debit_value,
                          eftpos_share_pct, visa_share_pct, mastercard_share_pct, is_surcharging):
    client = get_client()
    monthly_debit_volume = monthly_turnover * (debit_pct / 100)
    routing_result = evaluate_routing_position(
        monthly_dual_network_debit_volume=monthly_debit_volume,
        eftpos_share_pct=eftpos_share_pct, visa_share_pct=visa_share_pct,
        mastercard_share_pct=mastercard_share_pct, avg_debit_transaction_value=avg_debit_value
    )
    prompt = f"""You are a payments consultant preparing a short, client-ready routing
recommendation for a small merchant. Be concise, concrete, and avoid jargon.

MERCHANT: {merchant_name}
Monthly card turnover: ${monthly_turnover:,.0f}
Monthly dual-network debit volume: ${monthly_debit_volume:,.0f} ({debit_pct}% of turnover)
Average debit transaction value: ${avg_debit_value:.2f}
Current routing split: {eftpos_share_pct}% eftpos, {visa_share_pct}% Visa Debit, {mastercard_share_pct}% Mastercard Debit
Currently applying card surcharges: {"Yes" if is_surcharging else "No"}

{REFORM_CONTEXT}

EXACT CALCULATED ROUTING COSTS PER SCHEME (do not recalculate, use these figures exactly):
{json.dumps(routing_result, indent=2)}

Write a short recommendation (under 300 words) covering:
1. Which scheme(s) they're overusing today relative to cost, and how much it's costing them
2. Whether this will still be true after 1 October 2026, and how the magnitude changes
3. If they are currently surcharging: a clear compliance note that this must stop by 1 October
4. One clear, specific next action
"""
    response = client.messages.create(model="claude-sonnet-4-6", max_tokens=700, messages=[{"role": "user", "content": prompt}])
    return routing_result, response_text(response)

# ---------- UI ----------

REFORM_DATE = date(2026, 10, 1)
days_to_reform = (REFORM_DATE - date.today()).days
if days_to_reform > 1:
    reform_pill = f"RBA reform in {days_to_reform} days"
elif days_to_reform == 1:
    reform_pill = "RBA reform starts tomorrow"
else:
    reform_pill = "RBA reform in effect since 1 Oct 2026"

CSV_TEMPLATE = (
    "date,amount,payment_method,status,decline_reason,card_type,network\n"
    "2026-01-01,42.50,Visa,approved,,debit,eftpos\n"
    "2026-01-01,120.00,Mastercard,approved,,credit,mastercard\n"
    "2026-01-01,18.00,Eftpos,declined,Insufficient Funds,debit,eftpos\n"
)

def empty_state(title, body):
    st.markdown(f'<div class="empty-state"><div class="big">{title}</div>{body}</div>', unsafe_allow_html=True)

# ----- Header bar: invoice PDF (primary) and transactions CSV (optional) -----
with st.container(key="hero"):
    h_left, h_right = st.columns([5, 4], vertical_alignment="center")
    with h_left:
        st.markdown(f"""
        <div class="hero">
            <div class="title">Payments Consultant</div>
            <div class="subtitle">Performance analysis and routing strategy, grounded in real calculation.</div>
            <div class="pill">{reform_pill}</div>
        </div>""", unsafe_allow_html=True)
    with h_right:
        u1, u2 = st.columns(2)
        invoice_pdf = u1.file_uploader("Merchant invoice / statement (PDF)", type=["pdf"], key="invoice_pdf")
        uploaded = u2.file_uploader("Transactions (CSV / Excel, optional)", type=TRANSACTION_FILE_TYPES,
                                    key="transactions_csv")
        invoice_status = st.container()
        txn_status = st.container()

# ----- Read the invoice (Claude) -----
invoice, invoice_key = None, "none"
if invoice_pdf is not None:
    pdf_bytes = invoice_pdf.getvalue()
    with invoice_status:
        if len(pdf_bytes) > MAX_PDF_BYTES:
            st.error("That PDF is over 30 MB - please upload a smaller file.")
        else:
            with st.status("Reading invoice with Claude - this can take up to a minute…") as status:
                try:
                    invoice = extract_invoice(pdf_bytes)
                except InvoiceError as e:
                    status.update(label="Couldn't read the invoice", state="error", expanded=True)
                    st.error(redact(str(e)))
                except Exception as e:   # e.g. no ANTHROPIC_API_KEY in the app's secrets
                    status.update(label="Couldn't read the invoice", state="error", expanded=True)
                    st.error(f"{type(e).__name__}: {redact(str(e))[:200]}")
                if invoice is not None and not invoice.get("is_card_fee_document"):
                    status.update(label="Not a card fee invoice", state="error", expanded=True)
                    st.warning("This doesn't look like a card fee invoice or statement.")
                    invoice = None
                if invoice is not None:
                    found = (f"total fees {fmt_money(invoice['total_fees'])}" if invoice.get("total_fees") is not None
                             else "no fee total found")
                    status.update(label=f"Invoice read ✓ {found}", state="complete", expanded=False)
                    st.caption(f"{len(invoice.get('schemes', []))} scheme line(s) found.")
    if invoice is not None:
        invoice_key = hashlib.sha1(pdf_bytes).hexdigest()[:12]
invoice_overrides = invoice_rates(invoice) if invoice else {}

# ----- Read the transactions file (optional, any common layout) -----
df = None
if uploaded is not None:
    with txn_status:
        override_key = f"colmap_{uploaded.file_id}"
        overrides = st.session_state.get(override_key, {})
        labels = {"date": "Date", "amount": "Amount", "payment_method": "Card scheme", "card_type": "Debit / credit",
                  "status": "Status", "decline_reason": "Decline reason", "network": "Network"}
        report = None
        with st.status("Reading transactions…") as tstatus:
            try:
                df, report = load_transactions(uploaded.name, uploaded.getvalue(), tuple(sorted(overrides.items())))
                tstatus.update(label=f"Transactions read ✓ {report['rows_used']:,} rows ({report['method']})",
                               state="complete", expanded=False)
                st.caption(" · ".join(f"{labels[f]} ← {c}" for f, c in report["mapping"].items()))
                if report.get("card_type_unread"):
                    st.caption("Couldn't read as debit or credit: " + ", ".join(
                        f"'{v}' ({n:,} rows)" for v, n in report["card_type_unread"]) + ". Tell us what these mean.")
                if "card_type" not in report["mapping"]:
                    st.caption("No debit/credit column found, so debit/credit comes from the scheme text "
                               "(e.g. 'Visa Debit'). Use Adjust column matching to pick one.")
                if report.get("fee_columns"):
                    st.caption("Fees ← " + " · ".join(f"{c} ({cat})" for c, cat in report["fee_columns"].items()))
                skipped = []
                if report["refunds_or_zero"]:
                    skipped.append(f"{report['refunds_or_zero']:,} negative or zero amounts (refunds)")
                if report["other_status"]:
                    skipped.append(f"{report['other_status']:,} voided, refunded or pending rows")
                if skipped:
                    st.caption("Left out: " + ", ".join(skipped) + ".")
                if report["no_status"]:
                    st.caption("No status column, so every row is treated as approved.")
                if report["notes"]:
                    st.caption(report["notes"])
            except (TransactionFileError, InvoiceError) as e:
                tstatus.update(label="Couldn't read the transactions file", state="error", expanded=True)
                st.error(redact(str(e)))
            except Exception as e:
                tstatus.update(label="Couldn't read the transactions file", state="error", expanded=True)
                st.error(f"{type(e).__name__}: {redact(str(e))[:200]}")
        if report is not None:
            with st.popover("Adjust column matching", width="stretch"):
                st.caption("Pick the column for each item if the automatic match is wrong.")
                options = ["(none)"] + report["columns"]
                changed = dict(overrides)
                for field, label in labels.items():
                    current = report["mapping"].get(field)
                    choice = st.selectbox(label, options, index=options.index(current) if current in options else 0,
                                          key=f"{override_key}_{field}")
                    if choice != (current or "(none)"):
                        changed[field] = "" if choice == "(none)" else choice
                if overrides and st.button("Reset to automatic", key=f"{override_key}_reset"):
                    changed = {}
                    for field in labels:
                        st.session_state.pop(f"{override_key}_{field}", None)
                if changed != overrides:
                    st.session_state[override_key] = changed
                    st.rerun()
data_key = f"{invoice_key}|{uploaded.file_id if uploaded is not None else 'none'}"

# ----- Check the invoice figures before anything is worked out from them -----
def _as_date(v):
    try:
        return pd.to_datetime(v).date() if v else None
    except Exception:
        return None

if invoice is not None:
    confirmed_key, draft_key = f"inv_confirmed_{invoice_key}", f"inv_draft_{invoice_key}"
    confirmed = st.session_state.get(confirmed_key)
    if confirmed is None:
        draft = st.session_state.get(draft_key, invoice)
        with st.container(key="card_confirm"):
            card_title("Check the Invoice Figures")
            st.markdown('<div class="route-note" style="text-align:center;font-size:13px">Claude has read the '
                        'statement. Check these figures against it and correct anything that\'s wrong - the '
                        'dashboard only uses what you confirm here.</div>', unsafe_allow_html=True)
            checks = invoice_checks(draft)
            if checks:
                for level, msg in checks:
                    (st.warning if level == "warn" else st.info)(msg, icon="⚠️" if level == "warn" else "ℹ️")
            else:
                st.success("The totals and scheme lines agree with each other.", icon="✅")
            with st.form(f"confirm_form_{invoice_key}", border=False):
                c1, c2, c3, c4, c5 = st.columns([3, 3, 2, 2, 2])
                fields = {
                    "merchant_name": c1.text_input("Merchant", value=draft.get("merchant_name") or ""),
                    "acquirer": c2.text_input("Acquirer / provider", value=draft.get("acquirer") or ""),
                    "period_start": c3.date_input("Period from", value=_as_date(draft.get("period_start")),
                                                  format="DD/MM/YYYY"),
                    "period_end": c4.date_input("Period to", value=_as_date(draft.get("period_end")),
                                                format="DD/MM/YYYY"),
                }
                models = ["interchange_plus_plus", "blended", "unknown"]
                model_names = {"interchange_plus_plus": "Interchange++ (itemised)", "blended": "Blended (one MSF rate)",
                               "unknown": "Not clear"}
                fields["pricing_model"] = c5.selectbox(
                    "Pricing", models, format_func=model_names.get,
                    index=models.index(draft.get("pricing_model")) if draft.get("pricing_model") in models else 2)
                for k in ("period_start", "period_end"):
                    fields[k] = fields[k].isoformat() if fields[k] else None
                st.markdown("**Statement totals**")
                tcols = st.columns(4) + st.columns(4)[:3]
                for col, (k, label) in zip(tcols, TOTAL_FIELDS):
                    v = draft.get(k)
                    if k == "total_transactions":
                        fields[k] = col.number_input(label, min_value=0, step=1,
                                                     value=None if v is None else int(round(v)))
                    else:
                        fields[k] = col.number_input(label, min_value=0.0, step=0.01, format="%.2f",
                                                     value=None if v is None else float(v))
                st.markdown("**Scheme lines** (fees in dollars - add or delete rows as needed)")
                money = st.column_config.NumberColumn(format="dollar", min_value=0.0)
                lines = st.data_editor(
                    draft_lines(draft), num_rows="dynamic", width="stretch", hide_index=True,
                    key=f"confirm_lines_{invoice_key}_{st.session_state.get(f'{draft_key}_v', 0)}",
                    column_config={
                        "Scheme": st.column_config.SelectboxColumn(
                            options=["Visa", "Mastercard", "Eftpos", "Amex", "Other"], required=True),
                        "Debit / credit": st.column_config.SelectboxColumn(options=["debit", "credit", "all"],
                                                                           default="all", required=True),
                        "Sales $": money, "Interchange $": money, "Scheme fees $": money, "Acquiring $": money,
                        "Transactions": st.column_config.NumberColumn(format="localized", min_value=0, step=1),
                    })
                b1, b2 = st.columns(2)
                recheck = b1.form_submit_button("Re-check", width="stretch")
                confirm = b2.form_submit_button("Confirm figures", type="primary", width="stretch")
            if recheck or confirm:
                new = invoice_from_draft(invoice, fields, lines)
                if confirm:
                    st.session_state[confirmed_key] = new
                    st.session_state.pop(draft_key, None)
                else:
                    st.session_state[draft_key] = new
                    st.session_state[f"{draft_key}_v"] = st.session_state.get(f"{draft_key}_v", 0) + 1
                st.rerun()
        st.sidebar.markdown('<div class="ledger"><div class="head">Key metrics</div><div class="item"><div class="sub">'
                            'Check and confirm the invoice figures to fill in the key metrics.</div></div></div>',
                            unsafe_allow_html=True)
        st.stop()
    invoice = confirmed
    with invoice_status:
        e1, e2 = st.columns([3, 2], vertical_alignment="center")
        e1.caption("Figures confirmed ✓ - the dashboard uses what you checked.")
        if e2.container(key="inv_edit").button("Edit figures", key=f"edit_{invoice_key}", width="stretch"):
            st.session_state[draft_key] = st.session_state.pop(confirmed_key)
            st.session_state[f"{draft_key}_v"] = st.session_state.get(f"{draft_key}_v", 0) + 1
            st.rerun()
    invoice_overrides = invoice_rates(invoice)
    invoice_key = f"{invoice_key}-{hashlib.sha1(json.dumps(invoice, sort_keys=True, default=str).encode()).hexdigest()[:8]}"
    data_key = f"{invoice_key}|{uploaded.file_id if uploaded is not None else 'none'}"

# ----- Headline figures: transactions when available, otherwise the invoice -----
inv_months = invoice_months(invoice) if invoice else 1
if df is not None:
    n_months = max(pd.to_datetime(df["date"]).dt.to_period("M").nunique(), 1)
    monthly_revenue = df.loc[df["status"] == "approved", "amount"].sum() / n_months
    monthly_volume = len(df) / n_months
    atv = df["amount"].mean()
elif invoice:
    n_months = inv_months
    _value, _txns = invoice_totals(invoice)
    monthly_revenue = _value / n_months if _value else None
    monthly_volume = _txns / n_months if _txns else None
    atv = _value / _txns if (_value and _txns) else None
else:
    n_months, monthly_revenue, monthly_volume, atv = 1, None, None, None

merchant_label = ((invoice or {}).get("merchant_name") or ("Uploaded data" if df is not None else
                  "Upload an invoice to begin"))

def invoice_cost_item(invoice):
    """Ledger 'Total cost' straight from the invoice (per month)."""
    def m(key):
        return invoice[key] / inv_months if invoice.get(key) is not None else None
    lines = "".join(f'<div class="brk"><span>{label}</span><span>{fmt_money(v)}</span></div>'
                    for label, v in [("Interchange", m("interchange_fees")), ("Scheme fees", m("scheme_fees")),
                                     ("Acquiring / processing", m("acquiring_fees")), ("Other", m("other_fees"))]
                    if v is not None)
    value, _ = invoice_totals(invoice)
    rate = (f'<div class="brk rate"><span>Effective rate</span><span>'
            f'{invoice["total_fees"] / value * 100:.2f}% of revenue</span></div>'
            if invoice.get("total_fees") is not None and value else "")
    total = m("total_fees")
    return ("Total cost", fmt_money(total) if total is not None else "—", "/ mo",
            lines + rate + '<div class="brk"><span>Source</span><span>Invoice</span></div>')

def build_ledger_items(fees, overall_rate=None, at_risk=0):
    if df is None and invoice:
        cost = invoice_cost_item(invoice)
    else:
        inv_line = ""
        if invoice and invoice.get("total_fees") is not None:
            value, _ = invoice_totals(invoice)
            rate = f' · {invoice["total_fees"] / value * 100:.2f}%' if value else ""
            inv_line = (f'<div class="brk rate"><span>Invoice actual</span>'
                        f'<span>{fmt_money(invoice["total_fees"] / inv_months)}{rate}</span></div>')
        actual = actual_fees_from_file(df, n_months)
        if actual:   # the file's own fee columns beat estimates from rates
            fees = actual
        cost = ("Total cost", fmt_money(fees["total"]) if fees else "—", "/ mo",
                (("" if fees.get("total_only") else
                  f'<div class="brk"><span>Interchange</span><span>{fmt_money(fees["interchange"])}</span></div>'
                  f'<div class="brk"><span>Scheme fees</span><span>{fmt_money(fees["scheme"])}</span></div>'
                  f'<div class="brk"><span>Acquiring / processing</span><span>{fmt_money(fees["acquiring"])}</span></div>'
                  + (f'<div class="brk"><span>Other</span><span>{fmt_money(fees["other"])}</span></div>'
                     if fees.get("other") else ""))
                 + f'<div class="brk rate"><span>Effective rate</span><span>'
                 f'{(fees["total"] / monthly_revenue * 100 if monthly_revenue else 0):.2f}% of revenue</span></div>'
                 + f'<div class="brk"><span>Source</span><span>{"Transactions file" if actual else "Estimated from rates"}'
                 f'</span></div>' + inv_line)
                if fees else ("Calculating…" if df is not None else "Upload an invoice to see fees") + inv_line)
    volume_sub = (f"Approval rate {overall_rate:.1f}%" if overall_rate is not None
                  else ("From the invoice" if invoice else "Upload an invoice to populate"))
    return [
        ("Revenue", fmt_money(monthly_revenue) if monthly_revenue is not None else "—", "/ mo",
         ("Approved card sales" if df is not None else "Card sales on the invoice" if invoice else "Card sales")
         + (f" · est. {fmt_money(at_risk)} lost to declines" if at_risk > 0 else "")),
        ("Volume", f"{monthly_volume:,.0f}" if monthly_volume is not None else "—", "txns / mo", volume_sub),
        ("ATV", f"${atv:,.2f}" if atv is not None else "—", "", "Average transaction value"),
        cost,
    ]

# Sidebar ledger is drawn straight away so it's always there, then refreshed at the end with fees
ledger_slot = st.sidebar.empty()
ledger_slot.markdown(ledger_html(merchant_label, build_ledger_items(
    None, (df["status"] == "approved").mean() * 100 if df is not None else None)), unsafe_allow_html=True)

# ----- Shared renderers -----
def split_bar(shares):
    ordered = sorted(shares.items(), key=lambda kv: kv[0] != "Eftpos")
    segs = "".join(f'<div style="width:{v:.1f}%;background:{SCHEME_COLOURS.get(n, MUTED)}" title="{n} {v:.0f}%"></div>'
                   for n, v in ordered if v >= 0.5)
    to = "".join(f'<span>→ {logo(n, 16)} <b>{v:.0f}%</b></span>' for n, v in ordered if v >= 0.5)
    return f'<div class="split">{segs}</div><div class="route-to">{to}</div>'

def render_payment_mix(mix, n_months, caption):
    """Donut per card type (debit / credit, or 'all' when the source doesn't split them) by scheme value."""
    types = [t for t in ["debit", "credit", "all"] if t in set(mix["card_type"])]
    total = max(mix["value"].sum(), 1)
    fig = make_subplots(rows=1, cols=max(len(types), 1), specs=[[{"type": "domain"}] * max(len(types), 1)])
    present = []
    for i, ct in enumerate(types):
        part = mix[mix["card_type"] == ct].groupby("scheme")[["value", "count"]].sum().sort_values("value", ascending=False)
        present += [m for m in part.index if m not in present]
        fig.add_trace(go.Pie(
            labels=part.index, values=part["value"], hole=0.58, sort=False, direction="clockwise",
            marker=dict(colors=[SCHEME_COLOURS.get(m, MUTED) for m in part.index], line=dict(color=CARD, width=2)),
            texttemplate="%{percent:.0%}", textposition="inside", insidetextorientation="horizontal",
            textfont=dict(color="#FFFFFF", size=11), customdata=part["count"] / n_months,
            hovertemplate="%{label}<br><b>%{percent}</b> of " + ct + " value<br>%{customdata:,.0f} txns/mo<extra></extra>"),
            1, i + 1)
        share = mix.loc[mix["card_type"] == ct, "value"].sum() / total * 100
        x = sum(fig.data[-1].domain.x) / 2      # centre of this donut, so the label sits in its hole
        fig.add_annotation(text=f"<b>{'All cards' if ct == 'all' else ct.title()}</b><br>{share:.0f}%", showarrow=False,
                           x=x, y=0.5, xref="paper", yref="paper", font=dict(size=13, color=INK))
    style_chart(fig, height=250)
    fig.update_layout(margin=dict(l=0, r=0, t=4, b=4))
    st.plotly_chart(fig, width="stretch", config={"displayModeBar": False})
    st.markdown('<div class="scheme-legend">' + "".join(
        f'<span><span class="sw" style="background:{SCHEME_COLOURS.get(m, MUTED)}"></span>{logo(m, 18)} {m}</span>'
        for m in present) + "</div>", unsafe_allow_html=True)
    st.caption(caption)

# ----- Welcome (nothing uploaded yet) -----
if df is None and invoice is None:
    with st.container(key="card_welcome"):
        card_title("Get Started")
        st.markdown(
            '<div class="empty-state"><div class="big">Upload a merchant invoice or statement (PDF) above</div>'
            "Claude reads the fees, card mix and routing from it, fills in the key-metrics ledger, and works out "
            "the merchant's position under the 1 October 2026 RBA reform.<br><br>"
            "Optionally add a transactions export (CSV, Excel or JSON, any column layout) for approval rates, "
            "decline analysis and transaction-level routing.</div>",
            unsafe_allow_html=True)
        st.download_button("Download transactions CSV template", CSV_TEMPLATE, file_name="transactions_template.csv",
                           mime="text/csv")

# ----- Row 1: payment mix, current and suggested routing -----
is_surcharging, surcharge_rate = False, 0.0
overall_rate, at_risk = None, 0
reform = None

def current_rate_table(methods):
    """The Fee Assumptions table as it stands, including any edits made in the card below (kept in its widget state)."""
    table = default_fee_table(methods, invoice_overrides)
    edits = st.session_state.get(f"fees_{data_key}", {}) or {}
    for idx, changes in (edits.get("edited_rows", {}) if isinstance(edits, dict) else {}).items():
        for column, value in changes.items():
            if column in FEE_COLUMNS and int(idx) < len(table):
                table.loc[int(idx), column] = value
    return table

if df is not None:
    stats = build_data_summary(df)
    overall_rate = (df["status"] == "approved").mean() * 100
    rates_now = current_rate_table(sorted(df["payment_method"].dropna().unique()))
    reform = reform_analysis(costs_from_transactions(df, rates_now), rates_now, n_months)
elif invoice:
    rates_now = current_rate_table(sorted({l["scheme"] for l in invoice.get("schemes", [])}))
    reform = reform_analysis(costs_from_invoice(invoice, rates_now), rates_now, inv_months)

if df is not None or invoice:
    r1c1, r1c2, r1c3 = st.columns(3, gap="medium")
    with r1c1:
        with st.container(key="card_mix"):
            card_title("Payment Mix")
            if df is not None:
                approved = df[df["status"] == "approved"]
                known = approved[approved["card_type"].isin(["debit", "credit"])]
                mix = known.groupby(["payment_method", "card_type"])["amount"].agg(["sum", "count"]).reset_index()
                mix.columns = ["scheme", "card_type", "value", "count"]
                unknown = (approved["card_type"] == "unknown").mean() * 100
                wallet_share = approved["wallet"].notna().mean() * 100 if "wallet" in approved else 0
                caption = ("Share of approved transaction value by scheme."
                           + (f" Apple Pay ({wallet_share:.0f}% of transactions) is counted under the card's scheme."
                              if wallet_share > 0 else "")
                           + (f" {unknown:.0f}% of transactions have no card type - add a `card_type` column."
                              if unknown > 0 else ""))
            else:
                mix = invoice_mix(invoice)
                caption = "Share of card sales by scheme, from the invoice."
            if mix.empty:
                empty_state("No scheme breakdown", "The data doesn't split sales by card scheme.")
            else:
                render_payment_mix(mix, n_months, caption)

    with r1c2:
        with st.container(key="card_routing_now"):
            card_title("Current Debit Routing")
            rows = debit_routing_rows(reform["frame"], "net_now", n_months) if reform else []
            if rows:
                st.markdown("".join(
                    f'<div class="route-row"><div class="route-head"><span>{logo(m, 20)}&nbsp; {m} debit</span>'
                    f'<span class="muted">{fmt_money(v)}/mo</span></div>{split_bar(sh)}</div>' for m, v, sh in rows),
                    unsafe_allow_html=True)
                eftpos_now = debit_network_shares(reform["frame"], "net_now").get("Eftpos", 0)
                st.markdown(f'<div class="highlight"><span class="lbl">Debit value routed<br>via eftpos today:</span>'
                            f'<span class="num">{eftpos_now:.0f}%</span></div>', unsafe_allow_html=True)
                if reform["network_inferred"]:
                    st.markdown('<div class="route-note">No network column in the file, so each debit '
                                'transaction\'s network is taken from its card scheme (EFTPOS = routed via eftpos, '
                                'VISA/MC DEBIT = routed via the scheme). Credit always runs on its own scheme.</div>',
                                unsafe_allow_html=True)
            else:
                empty_state("No debit breakdown", "Routing needs debit sales split by network - an invoice that "
                            "itemises eftpos / Visa debit / Mastercard debit, or a transactions file with a "
                            "debit/credit column.")

    with r1c3:
        with st.container(key="card_routing_next"):
            card_title("Suggested Routing · 1 Oct")
            if reform:
                rows = debit_routing_rows(reform["frame"], "suggested", n_months)
                if rows:
                    st.markdown("".join(
                        f'<div class="route-row"><div class="route-head"><span>{logo(m, 20)}&nbsp; {m} debit</span>'
                        f'<span class="muted">{fmt_money(v)}/mo</span></div>{split_bar(sh)}</div>' for m, v, sh in rows),
                        unsafe_allow_html=True)
                t, a1, l = reform["stages"]["today"], reform["stages"]["after"], reform["stages"]["lcr"]
                def cell(v, base=None):
                    same = base is not None and abs(v - base) < 0.5
                    return f'<td class="{"same" if same else ""}">{fmt_money(v)}</td>'
                st.markdown(
                    '<table class="reform"><tr><th></th><th>Today</th><th>1 Oct</th><th>+ routing</th></tr>'
                    + "".join(f'<tr><td>{label}</td>{cell(t[k])}{cell(a1[k], t[k])}{cell(l[k], a1[k])}</tr>'
                              for label, k in [("Interchange", "interchange"), ("Scheme fees", "scheme"),
                                               ("Processing", "processing")])
                    + f'<tr class="tot"><td>Total</td>{cell(t["total"])}{cell(a1["total"])}{cell(l["total"])}</tr>'
                    + f'<tr class="rate"><td>Effective rate</td><td>{t["rate"]:.2f}%</td><td>{a1["rate"]:.2f}%</td>'
                      f'<td>{l["rate"]:.2f}%</td></tr></table>', unsafe_allow_html=True)
                st.markdown(f'<div class="highlight"><span class="lbl">Fee saving<br>from 1 Oct:</span>'
                            f'<span class="num">{fmt_money(reform["saving"])}/mo</span></div>', unsafe_allow_html=True)
                notes = [f"Fees from the {reform['source']}. Interchange moves to the caps (debit "
                         f"{REFORM_DEBIT_CAP * 100:.0f}¢, consumer credit {REFORM_CONSUMER_CREDIT_CAP * 100:.1f}%); scheme "
                         "fees and processing stay the same. Amex isn't capped.",
                         f"Routing moves dual-network debit to eftpos where eftpos interchange + scheme fee "
                         f"(≈{reform['eftpos_ic_txn'] * 100:.1f}¢ + {reform['eftpos_sc_rate'] * 100:.2f}%, from "
                         f"{reform['eftpos_basis']}) is cheaper: {fmt_money(reform['routing_saving'])}/mo of the saving."]
                if reform["blended"]:
                    notes.append("Blended pricing: interchange and scheme fees are estimated within the MSF, and the "
                                 "merchant only gets the saving if the acquirer passes it through.")
                if reform["unsplit_value"]:
                    notes.append(f"{fmt_money(reform['unsplit_value'])}/mo of eftpos/Visa/Mastercard sales has no "
                                 "debit/credit information, so no cap is applied to it - add or pick a debit/credit "
                                 "column to include it.")
                st.markdown('<div class="route-note">' + " ".join(notes) + '</div>', unsafe_allow_html=True)
            else:
                empty_state("No fee data", "Upload an invoice or a transactions file to see the reform's effect.")

    # Surcharge impact of the 1 Oct ban, net of the routing saving
    with st.container(key="card_surcharge"):
        card_title("Surcharge Impact · 1 Oct")
        i1, i2, i3 = st.columns([2, 3, 3], gap="large", vertical_alignment="center")
        file_surcharge = None
        if df is not None and "fee_surcharge" in df and df["fee_surcharge"].sum() > 0:
            banned = (df["network"].isin(SURCHARGE_BAN_NETWORKS) if df["network"].notna().any()
                      else df["payment_method"] != "Amex")
            file_surcharge = df.loc[banned, "fee_surcharge"].sum() / n_months
        with i1:
            is_surcharging = st.checkbox("Merchant surcharges today", value=True, key="surcharging")
            if file_surcharge is not None:
                surcharge_rate = 0.0
                st.caption(f"Using the surcharges in the transactions file: {fmt_money(file_surcharge)}/mo "
                           "collected on eftpos, Visa and Mastercard.")
            else:
                surcharge_rate = st.number_input("Current surcharge %", min_value=0.0, max_value=5.0, value=1.0,
                                                 step=0.1, disabled=not is_surcharging, key="surcharge_rate")
        saving = reform["saving"] if reform else 0.0
        if df is not None:
            base = surcharge_base_from_df(df, n_months)
        else:
            lines = invoice.get("schemes", [])
            covered = sum(l.get("value") or 0 for l in lines if l["scheme"] in SURCHARGE_BAN_NETWORKS)
            value, _ = invoice_totals(invoice)
            amex = sum(l.get("value") or 0 for l in lines if l["scheme"] == "Amex")
            base = (covered if covered else max((value or 0) - amex, 0)) / n_months
        imp = surcharge_impact(base, monthly_revenue, saving, is_surcharging, surcharge_rate)
        if file_surcharge is not None:
            lost = file_surcharge if is_surcharging else 0.0
            imp = {**imp, "lost": lost, "net": saving - lost,
                   "price_rise_pct": ((lost - saving) / monthly_revenue * 100) if (lost > saving and monthly_revenue) else 0.0}
        with i2:
            st.markdown(
                f'<div class="impact">'
                f'<div class="line"><span>Revenue covered ({logo("Eftpos", 14)} {logo("Visa", 12)} '
                f'{logo("Mastercard", 14)})</span><span>{fmt_money(imp["base"])}/mo</span></div>'
                f'<div class="line"><span>Surcharge income lost</span>'
                f'<span class="neg">−{fmt_money(imp["lost"])}/mo</span></div>'
                f'<div class="line"><span>Fee saving from 1 Oct (caps + routing)</span>'
                f'<span class="pos">+{fmt_money(imp["saving"])}/mo</span></div>'
                f'<div class="route-note">Amex ({logo("Amex", 14)}) surcharges aren\'t covered by the ban.</div></div>',
                unsafe_allow_html=True)
        with i3:
            st.markdown(
                f'<div class="highlight"><span class="lbl">Net impact<br>from 1 Oct:</span>'
                f'<span class="num">{"−" if imp["net"] < 0 else "+"}{fmt_money(abs(imp["net"]))}/mo</span></div>'
                + (f'<div class="route-note">≈ {imp["price_rise_pct"]:.2f}% price rise needed to offset.</div>'
                   if imp["net"] < 0 else '<div class="route-note">Routing savings cover the change.</div>'),
                unsafe_allow_html=True)

# ----- Row 2: approval performance (needs transaction-level data) -----
if df is not None:
    monthly = stats["monthly"]
    first_rate, last_rate = monthly["approval_rate"].iloc[0], monthly["approval_rate"].iloc[-1]
    first_label = pd.Period(monthly["month"].iloc[0]).strftime("%b %Y")
    last_label = pd.Period(monthly["month"].iloc[-1]).strftime("%b %Y")
    first_count, last_count = monthly["transactions"].iloc[0], monthly["transactions"].iloc[-1]
    change = last_rate - first_rate
    at_risk = max(calculate_revenue_impact(last_rate, first_rate, stats["monthly_txn_count"],
                                           stats["avg_transaction_value"])["estimated_monthly_revenue_impact"], 0)
    r2c1, r2c2, r2c3 = st.columns(3, gap="medium")
    with r2c1:
        with st.container(key="card_growth"):
            card_title("Approval Change")
            st.markdown('<div class="donuts">'
                        + donut_html(first_rate, MAGENTA, f"{first_count:,.0f}", f"txns · {first_label}")
                        + donut_html(last_rate, BLUE, f"{last_count:,.0f}", f"txns · {last_label}")
                        + '</div>', unsafe_allow_html=True)
            st.markdown(f'<div class="highlight"><span class="lbl">Change in<br>approval rate:</span>'
                        f'<span class="num">{change:+.1f} pts</span></div>', unsafe_allow_html=True)
    with r2c2:
        with st.container(key="card_trend"):
            card_title("Approval Trend")
            fig = px.area(monthly, x="month", y="approval_rate", markers=True, color_discrete_sequence=[ORANGE])
            fig.update_traces(line_width=2, marker_size=8, fillcolor="rgba(224,123,14,0.25)",
                              hovertemplate="%{x}<br><b>%{y:.1f}%</b> approved<extra></extra>")
            style_chart(fig, height=260).update_yaxes(ticksuffix="%",
                                                      range=[max(monthly["approval_rate"].min() - 3, 0), 100])
            fig.update_xaxes(tickvals=monthly["month"],
                             ticktext=[pd.Period(m).strftime("%b") for m in monthly["month"]])
            st.plotly_chart(fig, width="stretch", config={"displayModeBar": False})
    with r2c3:
        with st.container(key="card_declines"):
            card_title("Decline Reasons")
            declines = stats["declines"]
            if declines.empty:
                empty_state("No declines", "No declined transactions in the data.")
            else:
                d = declines.sort_values().reset_index()
                d.columns = ["reason", "count"]
                d["share"] = d["count"] / (declines.sum() or 1) * 100
                fig2 = px.bar(d, x="count", y="reason", orientation="h", text=d["share"].map(lambda v: f"{v:.0f}%"),
                              color_discrete_sequence=[ORANGE])
                fig2.update_traces(marker_line_width=0, textposition="outside", cliponaxis=False,
                                   textfont=dict(color=INK, size=12),
                                   hovertemplate="%{y}<br><b>%{x:,}</b> declines<extra></extra>")
                style_chart(fig2, height=260).update_layout(bargap=0.35)
                fig2.update_xaxes(showgrid=True, gridcolor="#EFE6D6", range=[0, d["count"].max() * 1.2])
                st.plotly_chart(fig2, width="stretch", config={"displayModeBar": False})

# ----- Ask the agent (invoice and/or transactions) -----
if df is not None or invoice:
    with st.container(key="card_agent"):
        card_title("Ask the Agent")
        a1, a2 = st.columns([2, 3], gap="medium")
        with a1:
            default_q = ("Analyse this merchant's payment performance, quantify the revenue impact of any decline, "
                         "and give prioritised recommendations." if df is not None else
                         "Review this merchant's fees and debit routing ahead of the 1 October reform, quantify the "
                         "savings available, and give prioritised recommendations.")
            question = st.text_area("Question", value=default_q, height=110, label_visibility="collapsed",
                                    key=f"question_{df is not None}")
            if st.button("Run analysis", type="primary", width="stretch"):
                try:
                    with st.spinner("Agent is analysing..."):
                        answer, tool_log = run_agent(df, question, invoice)
                    st.session_state["analysis"] = {"key": data_key, "answer": answer, "tool_log": tool_log}
                except Exception as e:
                    st.error(_describe_api_error(e) if isinstance(e, anthropic.APIError)
                             else f"The analysis couldn't run ({type(e).__name__}: {redact(str(e))[:160]}).")
        with a2:
            analysis = st.session_state.get("analysis")
            with st.container(height=200, border=False):
                if analysis and analysis["key"] == data_key:
                    st.markdown(analysis["answer"])
                    if analysis["tool_log"]:
                        with st.expander(f"How this was calculated ({len(analysis['tool_log'])} tool calls)"):
                            for t in analysis["tool_log"]:
                                st.code(t)
                else:
                    st.caption("Ask a question about this merchant and the agent's answer will appear here.")

# Routing Advisor defaults from the data, so every section describes the same merchant
def _int_split(shares):
    vals = [int(round(v)) for v in shares]
    vals[-1] = 100 - sum(vals[:-1])
    return vals

adv_eftpos, adv_visa, adv_mc, adv_debit_pct = 35, 40, 25, 60
adv_avg_debit = float(round(atv, 2)) if atv else 45.0
if reform and monthly_revenue:
    _fr = reform["frame"]
    _deb = _fr[(_fr["card_type"] == "debit") & _fr["net_now"].isin(["Eftpos", "Visa", "Mastercard"])]
    if not _deb.empty:
        _sh = debit_network_shares(_fr, "net_now")
        adv_eftpos, adv_visa, adv_mc = _int_split([_sh.get("Eftpos", 0), _sh.get("Visa", 0), _sh.get("Mastercard", 0)])
        adv_debit_pct = min(int(round(_deb["amount"].sum() / n_months / monthly_revenue * 100)), 100)
        if _deb["count"].sum():
            adv_avg_debit = float(round(_deb["amount"].sum() / _deb["count"].sum(), 2))

# ----- Row 3: routing advisor -----
r3c1, r3c2, r3c3 = st.columns(3, gap="medium")

with r3c1:
    with st.container(key="card_merchant"):
        card_title("Routing Advisor")
        with st.form(f"routing_form_{data_key}", border=False):
            merchant_name = st.text_input("Merchant name", value=(invoice or {}).get("merchant_name") or "Merchant A")
            monthly_turnover = st.number_input("Monthly turnover ($)", min_value=0.0, step=1000.0, format="%.0f",
                                               value=float(round(monthly_revenue, -3)) if monthly_revenue else 100000.0)
            f3, f4 = st.columns(2)
            debit_pct = f3.number_input("Dual-network debit %", min_value=0, max_value=100, value=adv_debit_pct)
            avg_debit_value = f4.number_input("Avg debit txn ($)", min_value=1.0, value=max(adv_avg_debit, 1.0))
            c1, c2, c3 = st.columns(3)
            eftpos_share_pct = c1.number_input("Eftpos %", min_value=0, max_value=100, value=adv_eftpos)
            visa_share_pct = c2.number_input("Visa %", min_value=0, max_value=100, value=adv_visa)
            mastercard_share_pct = c3.number_input("Mastercard %", min_value=0, max_value=100, value=adv_mc)
            if df is None and not invoice:
                is_surcharging = st.checkbox("Merchant currently surcharges card payments")
            else:
                st.caption("Surcharging is set in the Surcharge Impact card.")
            submitted = st.form_submit_button("Generate recommendation", type="primary", width="stretch")

        total_pct = eftpos_share_pct + visa_share_pct + mastercard_share_pct
        if submitted and total_pct != 100:
            st.error(f"Routing split adds up to {total_pct}%, not 100%.")

if submitted and total_pct == 100:
    with r3c2:
        try:
            with st.spinner("Calculating and drafting recommendation..."):
                routing_result, recommendation = run_routing_advisor(
                    merchant_name, monthly_turnover, debit_pct, avg_debit_value,
                    eftpos_share_pct, visa_share_pct, mastercard_share_pct, is_surcharging
                )
            st.session_state["routing"] = {"merchant": merchant_name, "result": routing_result,
                                           "recommendation": recommendation}
        except Exception as e:
            st.error(_describe_api_error(e) if isinstance(e, anthropic.APIError)
                     else f"The recommendation couldn't be generated ({type(e).__name__}: {redact(str(e))[:160]}).")

routing = st.session_state.get("routing")

with r3c2:
    with st.container(key="card_routing_costs"):
        if not routing:
            card_title("Routing Costs")
            empty_state("No routing check yet", "Fill in the merchant details and generate a recommendation.")
        else:
            r = routing["result"]
            card_title(f"Routing Costs · {routing['merchant']}")
            schemes = [("Eftpos", "eftpos"), ("Visa debit", "visa_debit"), ("Mastercard debit", "mastercard_debit")]
            b, a = r["breakdown_before_reform"], r["breakdown_after_reform"]
            cost_df = pd.DataFrame([{"period": p, "scheme": name, "cost": src[key]}
                                    for p, src in [("Today", b), ("Post-reform", a)] for name, key in schemes])
            fig3 = px.bar(cost_df, x="period", y="cost", color="scheme", color_discrete_sequence=SERIES,
                          category_orders={"scheme": [n for n, _ in schemes]})
            fig3.update_traces(marker_line_color=CARD, marker_line_width=2,
                               hovertemplate="%{fullData.name}<br><b>$%{y:,.0f}</b>/mo<extra></extra>")
            style_chart(fig3, height=230, legend=True).update_layout(bargap=0.45)
            fig3.update_yaxes(tickprefix="$")
            st.plotly_chart(fig3, width="stretch", config={"displayModeBar": False})
            st.caption(f"Debit routing cost: \\${r['monthly_cost_current_routing_before_reform']:,.0f}/mo today → "
                       f"\\${r['monthly_cost_current_routing_after_reform']:,.0f}/mo post-reform")
            st.markdown(f'<div class="highlight"><span class="lbl">Saving via<br>eftpos routing:</span>'
                        f'<span class="num">${r["monthly_savings_available_after_reform"]:,.0f}/mo</span></div>',
                        unsafe_allow_html=True)

with r3c3:
    with st.container(key="card_recommendation"):
        card_title("Recommendation")
        with st.container(height=380, border=False):
            if routing:
                st.markdown(routing["recommendation"])
            else:
                st.caption("The consultant's written recommendation will appear here.")

# ----- Row 4: invoice actuals (when a PDF has been uploaded) -----
if invoice:
    with st.container(key="card_invoice"):
        card_title(f"Invoice · {invoice.get('acquirer') or invoice_pdf.name}")
        v1, v2, v3 = st.columns([2, 3, 3], gap="large", vertical_alignment="center")
        period = " – ".join(p for p in [invoice.get("period_start"), invoice.get("period_end")] if p) or "not stated"
        pricing = {"interchange_plus_plus": "Interchange++ (itemised)", "blended": "Blended MSF",
                   "unknown": "Not clear"}.get(invoice.get("pricing_model", "unknown"), "Not clear")
        inv_value, _ = invoice_totals(invoice)
        with v1:
            st.markdown(
                f'<div class="impact"><div class="line"><span>Merchant</span><b>{invoice.get("merchant_name") or "—"}</b></div>'
                f'<div class="line"><span>Period</span><b>{period}</b></div>'
                f'<div class="line"><span>Pricing</span><b>{pricing}</b></div>'
                f'<div class="line"><span>Card sales</span><b>{fmt_money(inv_value) if inv_value else "—"}</b></div>'
                f'</div>', unsafe_allow_html=True)
        with v2:
            def _amt(key):
                return fmt_money(invoice[key]) if invoice.get(key) is not None else "—"
            st.markdown(
                f'<div class="impact">'
                f'<div class="line"><span>Interchange</span><span>{_amt("interchange_fees")}</span></div>'
                f'<div class="line"><span>Scheme fees</span><span>{_amt("scheme_fees")}</span></div>'
                f'<div class="line"><span>Acquiring / processing</span><span>{_amt("acquiring_fees")}</span></div>'
                f'<div class="line"><span>Other (terminals, chargebacks…)</span><span>{_amt("other_fees")}</span></div>'
                f'<div class="line"><span><b>Total fees</b></span><b>{_amt("total_fees")}</b></div></div>',
                unsafe_allow_html=True)
        with v3:
            if invoice.get("total_fees") is not None and inv_value:
                st.markdown(f'<div class="highlight"><span class="lbl">Effective<br>rate:</span>'
                            f'<span class="num">{invoice["total_fees"] / inv_value * 100:.2f}%</span>'
                            f'</div>', unsafe_allow_html=True)
            note = (f"Rates applied to the fee table: {', '.join(invoice_overrides) or 'none'}." if df is not None
                    else "Add a transactions CSV to estimate fees transaction by transaction.")
            st.markdown(f'<div class="route-note">{note}'
                        + (f' {invoice["notes"]}' if invoice.get("notes") else "") + '</div>',
                        unsafe_allow_html=True)

# ----- Row 5: fee assumptions (estimates from transactions; needs the CSV) -----
fees = None
if df is not None:
    with st.container(key="card_fees"):
        card_title("Fee Assumptions")
        if actual_fees_from_file(df, n_months):
            st.caption("The ledger's Total cost uses the actual fees in your transactions file. This table is only "
                       "used for estimates where the file has no fee columns.")
        st.caption("Rates used to estimate monthly fees on approved transactions. "
                   + ("Rows marked 'Invoice' come from the uploaded invoice; the rest are illustrative. "
                      if invoice_overrides else
                      "Starting values are illustrative - upload an invoice above or edit them to match the "
                      "merchant's actual pricing. ")
                   + "% applies to transaction value, ¢ per transaction. Unlisted payment methods use the 'Other' row.")
        fee_table = st.data_editor(
            default_fee_table(sorted(df["payment_method"].dropna().unique()), invoice_overrides),
            key=f"fees_{data_key}", hide_index=True, width="stretch", num_rows="fixed",
            disabled=["Payment method", "Source"],
            column_config={c: st.column_config.NumberColumn(c, min_value=0.0, step=0.01, format="%.2f")
                           for c in FEE_COLUMNS})
        fees = compute_fees(df, fee_table, n_months)

# ----- Key-metrics ledger (sidebar, so it stays put on every page) -----
ledger_slot.markdown(ledger_html(merchant_label, build_ledger_items(fees, overall_rate, at_risk)),
                     unsafe_allow_html=True)

st.markdown('<div class="site-footer">Payments Consultant · analysis grounded in real calculation</div>',
            unsafe_allow_html=True)
