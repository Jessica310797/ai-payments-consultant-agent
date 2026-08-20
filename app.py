import json
import pandas as pd
import numpy as np
import streamlit as st
import plotly.express as px
from anthropic import Anthropic
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

st.set_page_config(page_title="AI Payments Consultant Agent", layout="wide")

# ---------- ONE-TIME SETUP (cached so it doesn't re-run on every click) ----------

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

# ---------- TOOLS ----------

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

EFTPOS_FLAT_FEE = 0.05
SCHEME_DEBIT_ADVALOREM = 0.005
POST_REFORM_DEBIT_CAP = 0.08

def evaluate_routing_position(monthly_dual_network_debit_volume, current_eftpos_share_pct,
                                avg_debit_transaction_value):
    txn_count = monthly_dual_network_debit_volume / avg_debit_transaction_value
    eftpos_count = txn_count * (current_eftpos_share_pct / 100)
    scheme_count = txn_count - eftpos_count
    current_before = (eftpos_count * EFTPOS_FLAT_FEE) + (scheme_count * avg_debit_transaction_value * SCHEME_DEBIT_ADVALOREM)
    optimal_before = txn_count * EFTPOS_FLAT_FEE
    scheme_fee_after = min(avg_debit_transaction_value * SCHEME_DEBIT_ADVALOREM, POST_REFORM_DEBIT_CAP)
    current_after = (eftpos_count * EFTPOS_FLAT_FEE) + (scheme_count * scheme_fee_after)
    optimal_after = txn_count * EFTPOS_FLAT_FEE
    return {"monthly_cost_current_routing_before_reform": round(current_before, 2),
            "monthly_cost_fully_optimised_before_reform": round(optimal_before, 2),
            "monthly_savings_available_now": round(current_before - optimal_before, 2),
            "monthly_cost_current_routing_after_reform": round(current_after, 2),
            "monthly_cost_fully_optimised_after_reform": round(optimal_after, 2),
            "monthly_savings_available_after_reform": round(current_after - optimal_after, 2),
            "still_worth_optimising_post_reform": (current_after - optimal_after) > 1.0}

ALL_TOOLS = [
    {"name": "calculate_revenue_impact",
     "description": "Calculates exact monthly/annual revenue impact of an approval rate decline.",
     "input_schema": {"type": "object", "properties": {
         "current_approval_rate": {"type": "number"}, "baseline_approval_rate": {"type": "number"},
         "monthly_transactions": {"type": "integer"}, "average_transaction_value": {"type": "number"}},
         "required": ["current_approval_rate", "baseline_approval_rate", "monthly_transactions", "average_transaction_value"]}},
    {"name": "retrieve_docs",
     "description": "Searches payments reference documentation for relevant grounding content.",
     "input_schema": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}},
    {"name": "evaluate_routing_position",
     "description": "Evaluates a merchant's debit routing mix (eftpos vs scheme) before/after the Oct 2026 reform.",
     "input_schema": {"type": "object", "properties": {
         "monthly_dual_network_debit_volume": {"type": "number"}, "current_eftpos_share_pct": {"type": "number"},
         "avg_debit_transaction_value": {"type": "number"}},
         "required": ["monthly_dual_network_debit_volume", "current_eftpos_share_pct", "avg_debit_transaction_value"]}},
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

# ---------- UI ----------

st.title("💳 AI Payments Consultant Agent")
st.caption("An AI agent that analyses merchant payment performance, grounds recommendations in payments documentation, and quantifies financial impact with real calculations.")

with st.sidebar:
    st.header("Data source")
    source = st.radio("Choose data", ["Demo: Declining merchant", "Demo: Healthy merchant", "Upload CSV"])
    if source == "Upload CSV":
        uploaded = st.file_uploader("CSV with columns: date, amount, payment_method, status, decline_reason")
        df = pd.read_csv(uploaded) if uploaded else None
    elif source == "Demo: Declining merchant":
        df = generate_demo_data(seed=42, healthy=False)
    else:
        df = generate_demo_data(seed=99, healthy=True)

if df is not None:
    stats = build_data_summary(df)
    col1, col2, col3 = st.columns(3)
    col1.metric("Overall Approval Rate", f"{(df['status']=='approved').mean()*100:.1f}%")
    col2.metric("Avg Transaction Value", f"${stats['avg_transaction_value']:.2f}")
    col3.metric("Monthly Transactions (avg)", f"{stats['monthly_txn_count']:.0f}")

    c1, c2 = st.columns(2)
    with c1:
        fig = px.line(stats["monthly"], x="month", y="approval_rate", markers=True, title="Approval Rate Trend")
        st.plotly_chart(fig, use_container_width=True)
    with c2:
        fig2 = px.bar(stats["declines"], title="Decline Reasons")
        st.plotly_chart(fig2, use_container_width=True)

    st.subheader("Ask the Agent")
    default_q = ("Analyse this merchant's payment performance, quantify the revenue impact of any "
                 "decline, and give prioritised recommendations.")
    question = st.text_area("Question", value=default_q, height=100)

    if st.button("Run Analysis", type="primary"):
        with st.spinner("Agent is analysing... (may call multiple tools)"):
            answer, tool_log = run_agent(df, question)
        if tool_log:
            with st.expander(f"🔧 Tool calls made ({len(tool_log)})"):
                for t in tool_log:
                    st.code(t)
        st.markdown(answer)
else:
    st.info("Upload a CSV or select a demo dataset from the sidebar to begin.")
