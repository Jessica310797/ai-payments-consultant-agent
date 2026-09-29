
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
    padding: 10px 0;
    border-bottom: 0.5px solid #DCE1D3;
    font-size: 14px;
}
.ledger-row:last-child { border-bottom: none; }
.ledger-row .label { color: #7C8577; }
.ledger-row .value { font-weight: 600; color: #33513B; }
.ledger-row .value .improved { color: #7FA671; }
</style>
""", unsafe_allow_html=True)

GREEN_COLORWAY = ["#4F7A52", "#7FA671", "#33513B", "#A9BFA0"]

def metric_tile(value, label, accent=False):
    accent_class = " accent" if accent else ""
    st.markdown(f"""
    <div class="metric-tile">
        <div class="value{accent_class}">{value}</div>
        <div class="label">{label}</div>
    </div>
    """, unsafe_allow_html=True)

# ---------- ONE-TIME SETUP (cached) ----------

@st.cache_resource
def get_client():
    return Anthropic(api_key=st.secrets["ANTHROPIC_API_KEY"])

@st.cache_resource
def get_embed_model():
    return SentenceTransformer('all-MiniLM-L6-v2')

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
    embed_model = get_embed_model()
    embeddings = embed_model.encode([d["text"] for d in documents])
    return documents, embeddings

def retrieve_relevant_docs(query, top_k=2):
    documents, doc_embeddings = get_knowledge_base()
    embed_model = get_embed_model()
    query_embedding = embed_model.encode([query])
    similarities = cosine_similarity(query_embedding, doc_embeddings)[0]
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
            return response.content[0].text, tool_log
        messages.append({"role": "assistant", "content": response.content})
        results = []
        for block in response.content:
            if block.type == "tool_use":
                tool_log.append(f"{block.name}({block.input})")
                result = TOOL_FUNCTIONS[block.name](**block.input)
                results.append({"type": "tool_result", "tool_use_id": block.id, "content": json.dumps(result)})
        messages.append({"role": "user", "content": results})
    return "Reached iteration limit without a final answer.", tool_log

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
    return routing_result, response.content[0].text

# ---------- UI ----------

st.markdown("""
<div style="margin-bottom: 6px;">
    <div style="font-size: 30px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 6px;">Payments Consultant</div>
    <div style="font-size: 15px; color: #7C8577;">Performance analysis and routing strategy, grounded in real calculation.</div>
</div>
""", unsafe_allow_html=True)

tab1, tab2 = st.tabs(["Performance analysis", "Routing advisor"])

with tab1:
    st.sidebar.header("Data source")
    source = st.sidebar.radio("Choose data", ["Demo: Declining merchant", "Demo: Healthy merchant", "Upload CSV"])
    if source == "Upload CSV":
        uploaded = st.sidebar.file_uploader("CSV with columns: date, amount, payment_method, status, decline_reason")
        df = pd.read_csv(uploaded) if uploaded else None
    elif source == "Demo: Declining merchant":
        df = generate_demo_data(seed=42, healthy=False)
    else:
        df = generate_demo_data(seed=99, healthy=True)

    if df is not None:
        stats = build_data_summary(df)
        c1, c2, c3 = st.columns(3)
        with c1: metric_tile(f"{(df['status']=='approved').mean()*100:.1f}%", "Approval rate", accent=True)
        with c2: metric_tile(f"${stats['avg_transaction_value']:.0f}", "Avg transaction")
        with c3: metric_tile(f"{stats['monthly_txn_count']:.0f}", "Monthly volume")

        st.write("")
        cc1, cc2 = st.columns(2)
        with cc1:
            fig = px.line(stats["monthly"], x="month", y="approval_rate", markers=True, title="Approval rate trend",
                           color_discrete_sequence=GREEN_COLORWAY)
            fig.update_layout(plot_bgcolor="#F7F5EF", paper_bgcolor="#F7F5EF", font_color="#33513B")
            st.plotly_chart(fig, use_container_width=True)
        with cc2:
            fig2 = px.bar(stats["declines"], title="Decline reasons", color_discrete_sequence=GREEN_COLORWAY)
            fig2.update_layout(plot_bgcolor="#F7F5EF", paper_bgcolor="#F7F5EF", font_color="#33513B", showlegend=False)
            st.plotly_chart(fig2, use_container_width=True)

        st.subheader("Ask the agent")
        default_q = "Analyse this merchant's payment performance, quantify the revenue impact of any decline, and give prioritised recommendations."
        question = st.text_area("Question", value=default_q, height=100)

        if st.button("Run analysis", type="primary"):
            with st.spinner("Agent is analysing..."):
                answer, tool_log = run_agent(df, question)
            if tool_log:
                with st.expander(f"Tool calls made ({len(tool_log)})"):
                    for t in tool_log:
                        st.code(t)
            st.markdown(answer)
    else:
        st.info("Upload a CSV or select a demo dataset from the sidebar to begin.")

with tab2:
    st.subheader("Routing advisor — post-reform interchange impact")
    st.caption("A quick assessment of whether a merchant's current debit routing mix across eftpos, Visa, and Mastercard will still be optimal after the 1 October 2026 RBA reform.")

    with st.form("routing_form"):
        merchant_name = st.text_input("Merchant name", value="Merchant A")
        monthly_turnover = st.number_input("Monthly card turnover ($)", min_value=0.0, value=100000.0, step=1000.0)
        debit_pct = st.slider("% of turnover that is debit (dual-network eligible)", 0, 100, 60)
        avg_debit_value = st.number_input("Average debit transaction value ($)", min_value=1.0, value=45.0)

        st.markdown("**Current debit routing split** (should add up to 100%)")
        c1, c2, c3 = st.columns(3)
        eftpos_share_pct = c1.number_input("Eftpos %", min_value=0, max_value=100, value=35)
        visa_share_pct = c2.number_input("Visa Debit %", min_value=0, max_value=100, value=40)
        mastercard_share_pct = c3.number_input("Mastercard Debit %", min_value=0, max_value=100, value=25)

        total_pct = eftpos_share_pct + visa_share_pct + mastercard_share_pct
        if total_pct != 100:
            st.warning(f"These currently add up to {total_pct}%, not 100%. Adjust before submitting.")

        is_surcharging = st.checkbox("Merchant currently surcharges card payments")
        submitted = st.form_submit_button("Generate recommendation", type="primary")

    if submitted:
        if total_pct != 100:
            st.error("Routing percentages must add up to 100% - please correct and resubmit.")
        else:
            with st.spinner("Calculating and drafting recommendation..."):
                routing_result, recommendation = run_routing_advisor(
                    merchant_name, monthly_turnover, debit_pct, avg_debit_value,
                    eftpos_share_pct, visa_share_pct, mastercard_share_pct, is_surcharging
                )

            c1, c2 = st.columns(2)
            with c1: metric_tile(f"${routing_result['monthly_cost_current_routing_before_reform']:,.0f}", "Cost today", accent=True)
            with c2: metric_tile(f"${routing_result['monthly_cost_current_routing_after_reform']:,.0f}", "Cost post-reform (same routing)")

            st.write("")
            b = routing_result["breakdown_before_reform"]
            a = routing_result["breakdown_after_reform"]
            rows_html = "".join([
                f'<div class="ledger-row"><span class="label">{scheme}</span>'
                f'<span class="value">${b[key]:,.0f} \u2192 <span class="improved">${a[key]:,.0f}</span></span></div>'
                for scheme, key in [("Eftpos", "eftpos"), ("Visa debit", "visa_debit"), ("Mastercard debit", "mastercard_debit")]
            ])
            st.markdown(f'<div class="metric-tile"><div style="font-weight:600; margin-bottom:8px;">Routing cost by scheme</div>{rows_html}</div>', unsafe_allow_html=True)

            st.write("")
            st.markdown(recommendation)
toml
[theme]
base="light"
backgroundColor="#F7F5EF"
secondaryBackgroundColor="#EDF0E4"
textColor="#33513B"
primaryColor="#4F7A52"
font="sans serif"
