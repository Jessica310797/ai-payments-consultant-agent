"""Payments Consultant core: invoice reading (Claude), fee rates, the 1 Oct 2026 RBA reform impact and the
invoice checks. No Streamlit here - shared by the Streamlit app (app.py) and the mobile app's API (api/)."""
import os
import re
import json
import base64
import pandas as pd
import numpy as np
import anthropic
from anthropic import Anthropic

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
INVOICE_PROMPT = """This document (a PDF, or photos of its pages) is a merchant's card-acceptance invoice or statement from their acquirer or payment \
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

IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_PAGES = 20

def extract_invoice(files):
    """Read an acquirer invoice/statement with Claude and return the fee data as a dict.
    `files` is a list of (bytes, media_type): one PDF, or photos of the statement's pages in order."""
    if not files:
        raise InvoiceError("No statement was uploaded.")
    if len(files) > MAX_PAGES:
        raise InvoiceError(f"That's more than {MAX_PAGES} pages - please send the fee pages only.")
    if sum(len(b) for b, _ in files) > MAX_PDF_BYTES:
        raise InvoiceError("The statement is over 30 MB - please send a smaller file or fewer photos.")
    content = []
    for data, media_type in files:
        encoded = base64.standard_b64encode(data).decode("utf-8")
        if media_type == "application/pdf":
            content.append({"type": "document", "source": {"type": "base64", "media_type": media_type, "data": encoded}})
        elif media_type in IMAGE_TYPES:
            content.append({"type": "image", "source": {"type": "base64", "media_type": media_type, "data": encoded}})
        else:
            raise InvoiceError("Please send a PDF or photos (JPEG / PNG) of the statement.")
    data = claude_json(content, INVOICE_PROMPT, INVOICE_SCHEMA,
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


# ---------- ANTHROPIC CLIENT ----------

def clean_api_key(raw):
    """Keys pasted into secrets often pick up a space, line break or quotes, which makes the HTTP
    header invalid. API keys never contain whitespace or quotes, so drop them."""
    return "".join(str(raw).split()).strip("\"'")

def get_client():
    """Client from the ANTHROPIC_API_KEY environment variable. Keys that aren't scoped to a workspace must name
    one on every request: optional ANTHROPIC_WORKSPACE_ID = "wrkspc_..." (a workspace-scoped key needs nothing)."""
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise InvoiceError("No Anthropic API key is set up - add ANTHROPIC_API_KEY to the app's secrets.")
    workspace = os.environ.get("ANTHROPIC_WORKSPACE_ID")
    headers = {"anthropic-workspace-id": clean_api_key(workspace)} if workspace else None
    return Anthropic(api_key=clean_api_key(key), default_headers=headers)

_SECRET_PATTERN = re.compile(r"sk-ant-[A-Za-z0-9_\-]*")

def redact(text):
    """Never show an API key on screen, even inside an error message."""
    return _SECRET_PATTERN.sub("sk-ant-…(hidden)", str(text))

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


# ---------- ONE-CALL REPORT (used by the mobile app's API) ----------

DRAFT_LINE_KEYS = {"scheme": "Scheme", "card_type": "Debit / credit", "value": "Sales $", "transactions": "Transactions",
                   "interchange": "Interchange $", "scheme_fees": "Scheme fees $", "acquiring": "Acquiring $"}
DRAFT_FIELDS = ["merchant_name", "acquirer", "period_start", "period_end", "pricing_model"] + [k for k, _ in TOTAL_FIELDS]

def _clean(v):
    """JSON-safe number: None for missing / NaN, plain float otherwise."""
    if v is None:
        return None
    try:
        v = float(v)
    except (TypeError, ValueError):
        return None
    return None if np.isnan(v) or np.isinf(v) else v

def invoice_to_draft(invoice):
    """The editable form of an extracted invoice: header fields, totals and one line per scheme (fees in dollars)."""
    lines = draft_lines(invoice).rename(columns={v: k for k, v in DRAFT_LINE_KEYS.items()})
    return {**{k: invoice.get(k) for k in DRAFT_FIELDS},
            "lines": [{k: (r[k] if k in ("scheme", "card_type") else _clean(r[k])) for k in DRAFT_LINE_KEYS}
                      for r in lines.to_dict("records")]}

def draft_to_invoice(draft):
    """A confirmed (or edited) draft back to the invoice dict the calculations use."""
    lines = pd.DataFrame([{DRAFT_LINE_KEYS[k]: l.get(k) for k in DRAFT_LINE_KEYS} for l in draft.get("lines", [])],
                         columns=LINE_COLUMNS)
    fields = {k: draft.get(k) for k in DRAFT_FIELDS}
    fields["pricing_model"] = fields.get("pricing_model") or "unknown"
    return invoice_from_draft({"is_card_fee_document": True, "currency": "AUD", "notes": ""}, fields, lines)

def surcharge_base_from_invoice(invoice, months):
    """Monthly card sales on eftpos, Visa and Mastercard - the sales the surcharge ban covers."""
    lines = invoice.get("schemes", [])
    covered = sum(l.get("value") or 0 for l in lines if l["scheme"] in SURCHARGE_BAN_NETWORKS)
    value, _ = invoice_totals(invoice)
    amex = sum(l.get("value") or 0 for l in lines if l["scheme"] == "Amex")
    return (covered if covered else max((value or 0) - amex, 0)) / months

def reform_notes(reform):
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
                     "debit/credit split, so no cap is applied to it.")
    return notes

def invoice_report(invoice):
    """Everything the mobile results screen shows, per month, as plain JSON-safe data."""
    months = invoice_months(invoice)
    value, txns = invoice_totals(invoice)
    def per_month(key):
        return _clean(invoice[key] / months) if invoice.get(key) is not None else None
    rates = default_fee_table(sorted({l["scheme"] for l in invoice.get("schemes", [])}), invoice_rates(invoice))
    reform = reform_analysis(costs_from_invoice(invoice, rates), rates, months)
    mix = invoice_mix(invoice)
    mix_out = []
    for ct in ["debit", "credit", "all"]:
        part = mix[mix["card_type"] == ct].groupby("scheme")[["value", "count"]].sum().sort_values("value", ascending=False)
        if part.empty:
            continue
        mix_out.append({"card_type": ct, "share": _clean(part["value"].sum() / max(mix["value"].sum(), 1) * 100),
                        "schemes": [{"scheme": s, "value": _clean(r["value"] / months), "count": _clean(r["count"] / months),
                                     "share": _clean(r["value"] / part["value"].sum() * 100)} for s, r in part.iterrows()]})
    def routing(column):
        if not reform:
            return []
        return [{"scheme": m, "value": _clean(v), "shares": {k: _clean(s) for k, s in sh.items()}}
                for m, v, sh in debit_routing_rows(reform["frame"], column, months)]
    out = {
        "merchant_name": invoice.get("merchant_name"), "acquirer": invoice.get("acquirer"),
        "period_start": invoice.get("period_start"), "period_end": invoice.get("period_end"), "months": months,
        "pricing_model": invoice.get("pricing_model"),
        "headline": {"revenue": _clean(value / months) if value else None,
                     "volume": _clean(txns / months) if txns else None,
                     "atv": _clean(value / txns) if (value and txns) else None,
                     "total_cost": per_month("total_fees"),
                     "interchange": per_month("interchange_fees"), "scheme_fees": per_month("scheme_fees"),
                     "acquiring": per_month("acquiring_fees"), "other": per_month("other_fees"),
                     "effective_rate": _clean(invoice["total_fees"] / value * 100)
                     if (invoice.get("total_fees") is not None and value) else None},
        "mix": mix_out,
        "routing_now": routing("net_now"), "routing_suggested": routing("suggested"),
        "eftpos_share_now": _clean(debit_network_shares(reform["frame"], "net_now").get("Eftpos", 0)) if reform else None,
        "eftpos_share_suggested": _clean(debit_network_shares(reform["frame"], "suggested").get("Eftpos", 0)) if reform else None,
        "reform": None,
        "surcharge_base": _clean(surcharge_base_from_invoice(invoice, months)),
        "checks": [{"level": lvl, "message": msg} for lvl, msg in invoice_checks(invoice)],
    }
    if reform:
        out["reform"] = {"stages": {k: {kk: _clean(vv) for kk, vv in st_.items()} for k, st_ in reform["stages"].items()},
                         "saving": _clean(reform["saving"]), "routing_saving": _clean(reform["routing_saving"]),
                         "notes": reform_notes(reform)}
    return out
