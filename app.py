
import json
from datetime import date
import pandas as pd
import numpy as np
import streamlit as st
import plotly.express as px
from anthropic import Anthropic
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

st.set_page_config(page_title="Payments Consultant", layout="wide")

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
TINTS = {ORANGE: "#FBE3C6", MAGENTA: "#F5D4E8", BLUE: "#D7E7F8", BROWN: "#E9DDD0", TEAL: "#D5E3E0"}

st.markdown(f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');

.hero, .card-pill, .stat, .donut-wrap, .highlight, .bar-row, .side-list, .site-footer, .empty-state {{
    font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif !important;
}}
.stApp {{ background: {CREAM}; }}
.block-container {{ padding-top: 0 !important; padding-bottom: 3rem; max-width: 1440px; }}
header[data-testid="stHeader"] {{ background: transparent; }}
footer {{ visibility: hidden; }}
h1, h2, h3, h4 {{ color: {INK} !important; letter-spacing: -0.01em; }}

/* Header bar (a keyed container so it can hold the data-source picker) */
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
.highlight .num {{ font-weight: 800; font-size: 28px; }}

.side-list {{ display: flex; flex-direction: column; justify-content: center; gap: 18px; padding: 8px 0; }}
.side-list .row {{ display: flex; justify-content: space-between; font-size: 14px; color: {INK}; }}
.side-list .row b {{ font-weight: 700; }}

/* Cards in the same row stretch to equal height */
[data-testid="stColumn"] > [data-testid="stVerticalBlock"]:has(> div > [class*="st-key-card"]) {{ height: 100%; }}
[data-testid="stColumn"] > [data-testid="stVerticalBlock"] > div:has(> [class*="st-key-card"]) {{
    flex: 1; display: flex; flex-direction: column;
}}
[class*="st-key-card"] {{ flex: 1; }}
.st-key-card_metrics > div:last-child, .st-key-card_growth > div:last-child {{ margin-bottom: auto; }}
.st-key-card_metrics > div:nth-child(2) {{ margin-top: auto; }}

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

def progress_rows(items):
    """items: list of (label, pct, colour). Label and % are always shown as text."""
    html = "".join(
        f'<div class="bar-row"><span>{label}</span><span class="pct">{pct:.0f}%</span>'
        f'<div class="bar-track" style="background:{TINTS.get(colour, "#EEE")}">'
        f'<div class="bar-fill" style="width:{max(min(pct, 100), 0):.1f}%; background:{colour}"></div></div></div>'
        for label, pct, colour in items)
    st.markdown(html, unsafe_allow_html=True)

def donut_html(pct, colour, big, small):
    p = max(min(pct, 100), 0)
    return (f'<div class="donut-wrap"><div class="donut" style="background:conic-gradient({colour} {p}%, '
            f'{TINTS.get(colour, "#EEE")} 0)"><div class="hole">{pct:.0f}%</div></div>'
            f'<div class="big">{big}</div><div class="small">{small}</div></div>')

def stat_grid(stats):
    """stats: list of (value, label)."""
    cells = "".join(f'<div class="stat"><div class="num">{v}</div><div class="lbl">{l}</div></div>' for v, l in stats)
    st.markdown(f'<div class="stat-grid">{cells}</div>', unsafe_allow_html=True)

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
def get_client():
    return Anthropic(api_key=st.secrets["ANTHROPIC_API_KEY"])

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

REQUIRED_COLUMNS = ["date", "amount", "payment_method", "status", "decline_reason"]

def load_uploaded_csv(uploaded):
    """Read and validate an uploaded CSV. Returns (df, error_message)."""
    try:
        df = pd.read_csv(uploaded)
    except Exception as e:
        return None, f"Could not read the file as a CSV: {e}"
    df.columns = [c.strip().lower() for c in df.columns]
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        return None, f"CSV is missing required column(s): {', '.join(missing)}."
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
    df["status"] = df["status"].astype(str).str.strip().str.lower()
    df = df.dropna(subset=["date", "amount"])
    if df.empty:
        return None, "No rows with a valid date and amount were found."
    if not df["status"].isin(["approved", "declined"]).any():
        return None, "The 'status' column must contain 'approved' or 'declined' values."
    return df, None

def run_agent(df, question, max_iterations=5):
    client = get_client()
    stats = build_data_summary(df)
    messages = [{"role": "user", "content": (
        f"MERCHANT DATA:\n{stats['summary_text']}\n\n"
        f"Average transaction value: ${stats['avg_transaction_value']:.2f}\n"
        f"Approx monthly transactions: {stats['monthly_txn_count']:.0f}\n\n"
        f"QUESTION: {question}\n\nUse tools for any exact figures or facts - do not guess.")}]
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

@st.cache_data(show_spinner=False)
def generate_demo_data(seed, healthy=False):
    np.random.seed(seed)
    dates = pd.date_range(start="2026-01-01", end="2026-06-30", freq="D")
    payment_methods = ["Visa", "Mastercard", "Amex", "Apple Pay", "Eftpos"]
    rows = []
    for date in dates:
        n = np.random.randint(150, 300)
        if healthy:
            base_rate, weights = 0.97, {"Insufficient Funds": 0.3, "Card Expired": 0.25, "Invalid CVV": 0.2, "Fraud Suspected": 0.15, "Issuer Timeout": 0.1}
        else:
            month = date.month
            if month <= 2: base_rate, weights = 0.94, {"Insufficient Funds": 0.3, "Card Expired": 0.25, "Invalid CVV": 0.2, "Fraud Suspected": 0.15, "Issuer Timeout": 0.1}
            elif month <= 4: base_rate, weights = 0.90, {"Insufficient Funds": 0.25, "Card Expired": 0.2, "Invalid CVV": 0.15, "Fraud Suspected": 0.15, "Issuer Timeout": 0.25}
            else: base_rate, weights = 0.83, {"Insufficient Funds": 0.15, "Card Expired": 0.1, "Invalid CVV": 0.1, "Fraud Suspected": 0.25, "Issuer Timeout": 0.4}
        reasons, w = list(weights.keys()), list(weights.values())
        for _ in range(n):
            approved = np.random.random() < base_rate
            rows.append({"date": date, "amount": round(np.random.uniform(5, 500), 2),
                         "payment_method": np.random.choice(payment_methods, p=[0.35, 0.3, 0.15, 0.1, 0.1]),
                         "status": "approved" if approved else "declined",
                         "decline_reason": None if approved else np.random.choice(reasons, p=w)})
    return pd.DataFrame(rows)

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
    "date,amount,payment_method,status,decline_reason\n"
    "2026-01-01,42.50,Visa,approved,\n"
    "2026-01-01,18.00,Eftpos,declined,Insufficient Funds\n"
)
METHOD_COLOURS = [ORANGE, MAGENTA, BLUE, BROWN, TEAL]

def empty_state(title, body):
    st.markdown(f'<div class="empty-state"><div class="big">{title}</div>{body}</div>', unsafe_allow_html=True)

# ----- Header bar with data source -----
with st.container(key="hero"):
    h_left, h_right = st.columns([3, 2], vertical_alignment="center")
    with h_left:
        st.markdown(f"""
        <div class="hero">
            <div class="title">Payments Consultant</div>
            <div class="subtitle">Performance analysis and routing strategy, grounded in real calculation.</div>
            <div class="pill">{reform_pill}</div>
        </div>""", unsafe_allow_html=True)
    with h_right:
        source = st.segmented_control(
            "Merchant data", ["Demo: Declining merchant", "Demo: Healthy merchant", "Upload CSV"],
            default="Demo: Declining merchant", key="source",
            format_func={"Demo: Declining merchant": "Declining demo", "Demo: Healthy merchant": "Healthy demo",
                         "Upload CSV": "Upload CSV"}.get,
        ) or "Demo: Declining merchant"

df = None
if source == "Upload CSV":
    up_col, tmpl_col = st.columns([4, 1], vertical_alignment="bottom")
    with up_col:
        uploaded = st.file_uploader("CSV with columns: date, amount, payment_method, status, decline_reason",
                                    type=["csv"])
    with tmpl_col:
        st.download_button("Download template", CSV_TEMPLATE, file_name="transactions_template.csv",
                           mime="text/csv", width="stretch")
    if uploaded:
        df, error = load_uploaded_csv(uploaded)
        if error:
            st.error(error)
elif source == "Demo: Declining merchant":
    df = generate_demo_data(seed=42, healthy=False)
else:
    df = generate_demo_data(seed=99, healthy=True)

# ----- Rows 1 & 2: performance -----
if df is not None:
    stats = build_data_summary(df)
    monthly = stats["monthly"]
    overall_rate = (df["status"] == "approved").mean() * 100
    first_rate, last_rate = monthly["approval_rate"].iloc[0], monthly["approval_rate"].iloc[-1]
    first_label = pd.Period(monthly["month"].iloc[0]).strftime("%b %Y")
    last_label = pd.Period(monthly["month"].iloc[-1]).strftime("%b %Y")
    first_count, last_count = monthly["transactions"].iloc[0], monthly["transactions"].iloc[-1]
    change = last_rate - first_rate
    at_risk = max(calculate_revenue_impact(last_rate, first_rate, stats["monthly_txn_count"],
                                           stats["avg_transaction_value"])["estimated_monthly_revenue_impact"], 0)

    r1c1, r1c2, r1c3 = st.columns(3, gap="medium")
    with r1c1:
        with st.container(key="card_metrics"):
            card_title("Key Metrics")
            stat_grid([
                (f"{overall_rate:.1f}%", "Approval rate"),
                (f"${stats['avg_transaction_value']:.0f}", "Avg transaction"),
                (f"{stats['monthly_txn_count']/1000:.1f}k", "Monthly txns"),
                (f"${at_risk/1000:,.0f}k" if at_risk >= 1000 else f"${at_risk:,.0f}", "Revenue lost / mo"),
            ])
    with r1c2:
        with st.container(key="card_growth"):
            card_title("Approval Change")
            st.markdown('<div class="donuts">'
                        + donut_html(first_rate, MAGENTA, f"{first_count:,.0f}", f"txns · {first_label}")
                        + donut_html(last_rate, BLUE, f"{last_count:,.0f}", f"txns · {last_label}")
                        + '</div>', unsafe_allow_html=True)
            st.markdown(f'<div class="highlight"><span class="lbl">Change in<br>approval rate:</span>'
                        f'<span class="num">{change:+.1f} pts</span></div>', unsafe_allow_html=True)
    with r1c3:
        with st.container(key="card_methods"):
            card_title("Payment Methods")
            methods = stats["methods"].sort_values(ascending=False)
            progress_rows([(m, v, METHOD_COLOURS[i % len(METHOD_COLOURS)])
                           for i, (m, v) in enumerate(methods.items())])
            st.caption("Approval rate by payment method")

    r2c1, r2c2, r2c3 = st.columns(3, gap="medium")
    with r2c1:
        with st.container(key="card_trend"):
            card_title("Approval Trend")
            fig = px.area(monthly, x="month", y="approval_rate", markers=True, color_discrete_sequence=[ORANGE])
            fig.update_traces(line_width=2, marker_size=8, fillcolor="rgba(224,123,14,0.25)",
                              hovertemplate="%{x}<br><b>%{y:.1f}%</b> approved<extra></extra>")
            style_chart(fig, height=300).update_yaxes(ticksuffix="%",
                                                      range=[max(monthly["approval_rate"].min() - 3, 0), 100])
            fig.update_xaxes(tickvals=monthly["month"],
                             ticktext=[pd.Period(m).strftime("%b") for m in monthly["month"]])
            st.plotly_chart(fig, width="stretch", config={"displayModeBar": False})
    with r2c2:
        with st.container(key="card_declines"):
            card_title("Decline Reasons")
            declines = stats["declines"]
            d = declines.sort_values().reset_index()
            d.columns = ["reason", "count"]
            total = declines.sum() or 1
            d["share"] = d["count"] / total * 100
            fig2 = px.bar(d, x="count", y="reason", orientation="h", text=d["share"].map(lambda v: f"{v:.0f}%"),
                          color_discrete_sequence=[ORANGE])
            fig2.update_traces(marker_line_width=0, textposition="outside", cliponaxis=False,
                               textfont=dict(color=INK, size=12),
                               hovertemplate="%{y}<br><b>%{x:,}</b> declines<extra></extra>")
            style_chart(fig2, height=300).update_layout(bargap=0.35)
            fig2.update_xaxes(showgrid=True, gridcolor="#EFE6D6", range=[0, d["count"].max() * 1.2])
            st.plotly_chart(fig2, width="stretch", config={"displayModeBar": False})
    with r2c3:
        with st.container(key="card_agent"):
            card_title("Ask the Agent")
            default_q = "Analyse this merchant's payment performance, quantify the revenue impact of any decline, and give prioritised recommendations."
            question = st.text_area("Question", value=default_q, height=80, label_visibility="collapsed")
            if st.button("Run analysis", type="primary", width="stretch"):
                with st.spinner("Agent is analysing..."):
                    answer, tool_log = run_agent(df, question)
                st.session_state["analysis"] = {"source": source, "answer": answer, "tool_log": tool_log}
            analysis = st.session_state.get("analysis")
            with st.container(height=170, border=False):
                if analysis and analysis["source"] == source:
                    st.markdown(analysis["answer"])
                    if analysis["tool_log"]:
                        with st.expander(f"How this was calculated ({len(analysis['tool_log'])} tool calls)"):
                            for t in analysis["tool_log"]:
                                st.code(t)
                else:
                    st.caption("Ask a question about this merchant's data and the agent's answer will appear here.")
else:
    with st.container(key="card_nodata"):
        card_title("Performance")
        empty_state("Upload a transaction CSV to begin",
                    "Needs columns: date, amount, payment_method, status, decline_reason. "
                    "Download the template above for an example.")

# ----- Row 3: routing advisor -----
r3c1, r3c2, r3c3 = st.columns(3, gap="medium")

with r3c1:
    with st.container(key="card_merchant"):
        card_title("Routing Advisor")
        with st.form("routing_form", border=False):
            f1, f2 = st.columns(2)
            merchant_name = f1.text_input("Merchant name", value="Merchant A")
            monthly_turnover = f2.number_input("Monthly turnover ($)", min_value=0.0, value=100000.0, step=1000.0)
            f3, f4 = st.columns(2)
            debit_pct = f3.number_input("Dual-network debit %", min_value=0, max_value=100, value=60)
            avg_debit_value = f4.number_input("Avg debit txn ($)", min_value=1.0, value=45.0)
            c1, c2, c3 = st.columns(3)
            eftpos_share_pct = c1.number_input("Eftpos %", min_value=0, max_value=100, value=35)
            visa_share_pct = c2.number_input("Visa %", min_value=0, max_value=100, value=40)
            mastercard_share_pct = c3.number_input("Mastercard %", min_value=0, max_value=100, value=25)
            is_surcharging = st.checkbox("Merchant currently surcharges card payments")
            submitted = st.form_submit_button("Generate recommendation", type="primary", width="stretch")

        total_pct = eftpos_share_pct + visa_share_pct + mastercard_share_pct
        if submitted and total_pct != 100:
            st.error(f"Routing split adds up to {total_pct}%, not 100%.")

if submitted and total_pct == 100:
    with r3c2:
        with st.spinner("Calculating and drafting recommendation..."):
            routing_result, recommendation = run_routing_advisor(
                merchant_name, monthly_turnover, debit_pct, avg_debit_value,
                eftpos_share_pct, visa_share_pct, mastercard_share_pct, is_surcharging
            )
    st.session_state["routing"] = {"merchant": merchant_name, "result": routing_result,
                                   "recommendation": recommendation}

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
            st.markdown(f'<div class="highlight"><span class="lbl">Today ${r["monthly_cost_current_routing_before_reform"]:,.0f}'
                        f' → post-reform ${r["monthly_cost_current_routing_after_reform"]:,.0f}<br>'
                        f'Saving via eftpos routing:</span>'
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

st.markdown('<div class="site-footer">Payments Consultant · analysis grounded in real calculation</div>',
            unsafe_allow_html=True)
