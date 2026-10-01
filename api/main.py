"""API for the Payments Consultant mobile app.

The app never holds the Anthropic API key: it sends statement photos / PDFs here, this server asks Claude to read
them, and the shared calculations in payments_core.py produce the results.

Environment:
  ANTHROPIC_API_KEY        required
  ANTHROPIC_WORKSPACE_ID   optional (keys not scoped to a workspace)
  APP_ACCESS_KEY           optional but recommended: the app must send it as the X-App-Key header
"""
import os
import sys
import time
import hmac
from collections import defaultdict, deque
from pathlib import Path

from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import payments_core as core  # noqa: E402

app = FastAPI(title="Payments Consultant API", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

READS_PER_HOUR = int(os.environ.get("READS_PER_HOUR", "30"))
_reads = defaultdict(deque)

def check_key(x_app_key: str | None = Header(default=None)):
    expected = os.environ.get("APP_ACCESS_KEY")
    if expected and not hmac.compare_digest(x_app_key or "", expected):
        raise HTTPException(401, "This app isn't authorised to use the server - check the app's access key.")

def limit_reads(request: Request):
    """Each statement read costs Claude usage, so cap reads per device/IP per hour."""
    who = request.headers.get("x-device-id") or (request.client.host if request.client else "unknown")
    now, q = time.time(), _reads[who]
    while q and now - q[0] > 3600:
        q.popleft()
    if len(q) >= READS_PER_HOUR:
        raise HTTPException(429, "Too many statements read in the last hour - please try again later.")
    q.append(now)

class Line(BaseModel):
    scheme: str | None = None
    card_type: str | None = "all"
    value: float | None = None
    transactions: float | None = None
    interchange: float | None = None
    scheme_fees: float | None = None
    acquiring: float | None = None

class Draft(BaseModel):
    merchant_name: str | None = None
    acquirer: str | None = None
    period_start: str | None = None
    period_end: str | None = None
    pricing_model: str | None = "unknown"
    total_card_value: float | None = None
    total_transactions: float | None = None
    interchange_fees: float | None = None
    scheme_fees: float | None = None
    acquiring_fees: float | None = None
    other_fees: float | None = None
    total_fees: float | None = None
    lines: list[Line] = []

def _media_type(f: UploadFile, data: bytes):
    if data[:4] == b"%PDF":
        return "application/pdf"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return f.content_type or "application/octet-stream"

@app.get("/")
def root():
    """Opening the server's address in a browser shows it's running (the app itself uses the /v1 routes)."""
    return {"ok": True, "service": "Payments Consultant API", "health": "/health"}

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/v1/invoice/read", dependencies=[Depends(check_key), Depends(limit_reads)])
async def read_invoice(files: list[UploadFile] = File(...)):
    """Statement → editable draft + checks. Send one PDF, or photos of the pages in order."""
    parts = []
    for f in files:
        data = await f.read()
        parts.append((data, _media_type(f, data)))
    try:
        invoice = core.extract_invoice(parts)
    except core.InvoiceError as e:
        raise HTTPException(422, core.redact(str(e)))
    except Exception as e:
        raise HTTPException(500, f"{type(e).__name__}: {core.redact(str(e))[:200]}")
    if not invoice.get("is_card_fee_document"):
        raise HTTPException(422, "This doesn't look like a card fee invoice or statement.")
    return {"draft": core.invoice_to_draft(invoice), "checks": _checks(core.draft_to_invoice(core.invoice_to_draft(invoice))),
            "notes": invoice.get("notes") or ""}

def _checks(invoice):
    return [{"level": lvl, "message": msg} for lvl, msg in core.invoice_checks(invoice)]

@app.post("/v1/invoice/check", dependencies=[Depends(check_key)])
def check_draft(draft: Draft):
    """Re-run the consistency checks on edited figures."""
    return {"checks": _checks(core.draft_to_invoice(draft.model_dump()))}

@app.post("/v1/report", dependencies=[Depends(check_key)])
def report(draft: Draft):
    """Confirmed figures → the results screen (all figures per month)."""
    return core.invoice_report(core.draft_to_invoice(draft.model_dump()))
