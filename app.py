
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
    color: #33513B !important;
    font-weight: 600;
}
[data-baseweb="tab-highlight"] { display: none; }
[data-baseweb="tab-border"] { display: none; }

div[data-testid="stForm"] {
    border: 0.5px solid #DCE1D3;
    border-radius: 16px;
    background: #EDF0E4;
    padding: 1.6rem;
}
button[kind="primary"] {
    background-color: #4F7A52 !important;
    color: #FFFFFF !important;
    border: none !important;
    border-radius: 10px !important;
    font-weight: 600 !important;
}

.metric-tile {
    background: #EDF0E4;
    border-radius: 16px;
    padding: 20px;
}
.metric-tile .value {
    font-size: 30px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #33513B;
}
.metric-tile .value.accent { color: #4F7A52; }
.metric-tile .label {
    font-size: 13px;
    color: #7C8577;
    margin-top: 4px;
}

.ledger-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 10px 0;
    border-bottom: 0.5px solid #DCE1D3;
    font-size: 14px;
}
.ledger-row:last-child { border-bottom: none; }
.ledger-row .label { color: #7C8577; }
.metric-tile .ledger-row .value { font-size: 14px; letter-spacing: 0; font-weight: 600; color: #33513B; }
.ledger-row .value .improved { color: #4F7A52; }

.block-container { padding-top: 3.5rem; max-width: 1200px; }
footer { visibility: hidden; }

.hero {
    display: flex; justify-content: space-between; align-items: flex-end;
    flex-wrap: wrap; gap: 12px; margin-bottom: 18px;
}
.hero .eyebrow {
    font-size: 12px; font-weight: 600; letter-spacing: 0.08em;
    text-transform: uppercase; color: #7C8577; margin-bottom: 6px;
}
.hero .title { font-size: 32px; font-weight: 700; letter-spacing: -0.02em; color: #33513B; line-height: 1.1; }
.hero .subtitle { font-size: 15px; color: #7C8577; margin-top: 6px; }
.pill {
    display: inline-block; background: #E5E9DC; color: #33513B;
    border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 600;
}
.pill .dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%;
    background: #4F7A52; margin-right: 8px; vertical-align: 1px;
}

.metric-tile { height: 100%; }
.metric-tile .sub { font-size: 12px; margin-top: 8px; color: #7C8577; }
.metric-tile .sub.down { color: #A4502F; font-weight: 600; }
.metric-tile .sub.up { color: #4F7A52; font-weight: 600; }

.section-label {
    font-size: 12px; font-weight: 600; letter-spacing: 0.08em;
    text-transform: uppercase; color: #7C8577; margin: 18px 0 8px;
}
.empty-state {
    border: 1px dashed #C9D1BE; border-radius: 16px; padding: 48px 24px;
    text-align: center; color: #7C8577; font-size: 14px;
}
.empty-state .big { font-size: 17px; font-weight: 600; color: #33513B; margin-bottom: 6px; }
</style>
""", unsafe_allow_html=True)

GREEN_COLORWAY = ["#4F7A52", "#7FA671", "#33513B", "#A9BFA0"]

def metric_tile(value, label, accent=False, sub=None, sub_tone=None):
    accent_class = " accent" if accent else ""
    sub_html = f'<div class="sub {sub_tone or ""}">{sub}</div>' if sub else ""
    st.markdown(f"""
    <div class="metric-tile">
        <div class="value{accent_class}">{value}</div>
        <div class="label">{label}</div>
        {sub_html}
    </div>
    """, unsafe_allow_html=True)

def style_chart(fig, height=300):
    fig.update_layout(
        height=height, margin=dict(l=8, r=8, t=8, b=8),
        plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
        font=dict(family="Inter, sans-serif", color="#33513B", size=12),
        hoverlabel=dict(bgcolor="#FFFFFF", bordercolor="#DCE1D3", font_color="#33513B"),
        showlegend=False, xaxis_title=None, yaxis_title=None,
    )
    fig.update_xaxes(showgrid=False, linecolor="#DCE1D3", tickfont_color="#7C8577")
    fig.update_yaxes(gridcolor="#E5E9DC", zeroline=False, tickfont_color="#7C8577")
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

st.markdown(f"""
<div class="hero">
    <div>
        <div class="eyebrow">AI payments advisory</div>
        <div class="title">Payments Consultant</div>
        <div class="subtitle">Performance analysis and routing strategy, grounded in real calculation.</div>
    </div>
    <div class="pill"><span class="dot"></span>{reform_pill}</div>
</div>
""", unsafe_allow_html=True)

tab1, tab2 = st.tabs(["Performance analysis", "Routing advisor"])

CSV_TEMPLATE = (
    "date,amount,payment_method,status,decline_reason\n"
    "2026-01-01,42.50,Visa,approved,\n"
    "2026-01-01,18.00,Eftpos,declined,Insufficient Funds\n"
)

with tab1:
    source = st.radio("Data source", ["Demo: Declining merchant", "Demo: Healthy merchant", "Upload CSV"],
                      horizontal=True, label_visibility="collapsed")
    df = None
    if source == "Upload CSV":
        up_col, tmpl_col = st.columns([3, 1])
        with up_col:
            uploaded = st.file_uploader("CSV with columns: date, amount, payment_method, status, decline_reason",
                                        type=["csv"])
        with tmpl_col:
            st.write("")
            st.download_button("Download CSV template", CSV_TEMPLATE, file_name="transactions_template.csv",
                               mime="text/csv", width="stretch")
        if uploaded:
            df, error = load_uploaded_csv(uploaded)
            if error:
                st.error(error)
    elif source == "Demo: Declining merchant":
        df = generate_demo_data(seed=42, healthy=False)
    else:
        df = generate_demo_data(seed=99, healthy=True)

    if df is not None:
        stats = build_data_summary(df)
        monthly = stats["monthly"]
        overall_rate = (df["status"] == "approved").mean() * 100
        first_rate, last_rate = monthly["approval_rate"].iloc[0], monthly["approval_rate"].iloc[-1]
        change = last_rate - first_rate
        at_risk = max(calculate_revenue_impact(last_rate, first_rate, stats["monthly_txn_count"],
                                               stats["avg_transaction_value"])["estimated_monthly_revenue_impact"], 0)

        c1, c2, c3, c4 = st.columns(4)
        with c1:
            tone = "down" if change < -0.5 else "up" if change > 0.5 else None
            metric_tile(f"{overall_rate:.1f}%", "Approval rate", accent=True,
                        sub=f"{change:+.1f} pts since {pd.Period(monthly['month'].iloc[0]).strftime('%b %Y')}", sub_tone=tone)
        with c2: metric_tile(f"${stats['avg_transaction_value']:.0f}", "Avg transaction")
        with c3: metric_tile(f"{stats['monthly_txn_count']:,.0f}", "Monthly transactions")
        with c4: metric_tile(f"${at_risk:,.0f}", "Est. revenue lost / month",
                             sub="vs. first month's approval rate")

        st.markdown('<div class="section-label">Trends</div>', unsafe_allow_html=True)
        cc1, cc2 = st.columns(2)
        with cc1:
            with st.container(border=True):
                st.markdown("**Approval rate by month**")
                fig = px.line(monthly, x="month", y="approval_rate", markers=True,
                              color_discrete_sequence=GREEN_COLORWAY)
                fig.update_traces(line_width=2, marker_size=8,
                                  hovertemplate="%{x}<br><b>%{y:.1f}%</b> approved<extra></extra>")
                style_chart(fig).update_yaxes(ticksuffix="%")
                st.plotly_chart(fig, width="stretch", config={"displayModeBar": False})
        with cc2:
            with st.container(border=True):
                st.markdown("**Decline reasons**")
                declines = stats["declines"].sort_values().reset_index()
                declines.columns = ["reason", "count"]
                fig2 = px.bar(declines, x="count", y="reason", orientation="h",
                              color_discrete_sequence=GREEN_COLORWAY)
                fig2.update_traces(marker_line_width=0,
                                   hovertemplate="%{y}<br><b>%{x:,}</b> declines<extra></extra>")
                style_chart(fig2).update_layout(bargap=0.35)
                fig2.update_xaxes(showgrid=True, gridcolor="#E5E9DC")
                fig2.update_yaxes(showgrid=False)
                st.plotly_chart(fig2, width="stretch", config={"displayModeBar": False})

        st.markdown('<div class="section-label">Ask the agent</div>', unsafe_allow_html=True)
        with st.container(border=True):
            default_q = "Analyse this merchant's payment performance, quantify the revenue impact of any decline, and give prioritised recommendations."
            question = st.text_area("Question", value=default_q, height=90, label_visibility="collapsed")
            if st.button("Run analysis", type="primary"):
                with st.spinner("Agent is analysing..."):
                    answer, tool_log = run_agent(df, question)
                st.session_state["analysis"] = {"source": source, "answer": answer, "tool_log": tool_log}

        analysis = st.session_state.get("analysis")
        if analysis and analysis["source"] == source:
            with st.container(border=True):
                st.markdown(analysis["answer"])
                if analysis["tool_log"]:
                    with st.expander(f"How this was calculated ({len(analysis['tool_log'])} tool calls)"):
                        for t in analysis["tool_log"]:
                            st.code(t)
    elif source == "Upload CSV":
        st.markdown("""
        <div class="empty-state">
            <div class="big">Upload a transaction CSV to begin</div>
            Needs columns: date, amount, payment_method, status, decline_reason.
            Download the template above for an example.
        </div>""", unsafe_allow_html=True)

with tab2:
    st.markdown("**Post-reform routing check** — will this merchant's debit routing mix across eftpos, "
                "Visa and Mastercard still be cost-optimal after the 1 October 2026 RBA reform?")

    form_col, result_col = st.columns([5, 7], gap="large")

    with form_col:
        with st.form("routing_form"):
            merchant_name = st.text_input("Merchant name", value="Merchant A")
            monthly_turnover = st.number_input("Monthly card turnover ($)", min_value=0.0, value=100000.0, step=1000.0)
            debit_pct = st.slider("% of turnover that is dual-network debit", 0, 100, 60)
            avg_debit_value = st.number_input("Average debit transaction ($)", min_value=1.0, value=45.0)

            st.markdown("**Current debit routing split**")
            c1, c2, c3 = st.columns(3)
            eftpos_share_pct = c1.number_input("Eftpos %", min_value=0, max_value=100, value=35)
            visa_share_pct = c2.number_input("Visa %", min_value=0, max_value=100, value=40)
            mastercard_share_pct = c3.number_input("Mastercard %", min_value=0, max_value=100, value=25)

            is_surcharging = st.checkbox("Merchant currently surcharges card payments")
            submitted = st.form_submit_button("Generate recommendation", type="primary", width="stretch")

    total_pct = eftpos_share_pct + visa_share_pct + mastercard_share_pct
    if submitted:
        if total_pct != 100:
            with form_col:
                st.error(f"Routing split adds up to {total_pct}%, not 100%. Please adjust and resubmit.")
        else:
            with result_col:
                with st.spinner("Calculating and drafting recommendation..."):
                    routing_result, recommendation = run_routing_advisor(
                        merchant_name, monthly_turnover, debit_pct, avg_debit_value,
                        eftpos_share_pct, visa_share_pct, mastercard_share_pct, is_surcharging
                    )
            st.session_state["routing"] = {"merchant": merchant_name, "result": routing_result,
                                           "recommendation": recommendation}

    with result_col:
        routing = st.session_state.get("routing")
        if not routing:
            st.markdown("""
            <div class="empty-state">
                <div class="big">No recommendation yet</div>
                Enter the merchant's details and routing split, then generate a recommendation.
            </div>""", unsafe_allow_html=True)
        else:
            r = routing["result"]
            st.markdown(f"#### {routing['merchant']}")
            c1, c2, c3 = st.columns(3)
            with c1: metric_tile(f"${r['monthly_cost_current_routing_before_reform']:,.0f}", "Monthly cost today")
            with c2: metric_tile(f"${r['monthly_cost_current_routing_after_reform']:,.0f}", "Cost post-reform")
            with c3: metric_tile(f"${r['monthly_savings_available_after_reform']:,.0f}", "Saving via eftpos routing",
                                 accent=True)

            st.write("")
            b, a = r["breakdown_before_reform"], r["breakdown_after_reform"]
            rows_html = "".join([
                f'<div class="ledger-row"><span class="label">{scheme}</span>'
                f'<span class="value">${b[key]:,.0f} → <span class="improved">${a[key]:,.0f}</span></span></div>'
                for scheme, key in [("Eftpos", "eftpos"), ("Visa debit", "visa_debit"), ("Mastercard debit", "mastercard_debit")]
            ])
            st.markdown(f'<div class="metric-tile"><div style="font-weight:600; margin-bottom:8px;">'
                        f'Monthly routing cost by scheme <span style="font-weight:400; color:#7C8577;">'
                        f'(today → post-reform)</span></div>{rows_html}</div>', unsafe_allow_html=True)

            st.write("")
            with st.container(border=True):
                st.markdown(routing["recommendation"])
