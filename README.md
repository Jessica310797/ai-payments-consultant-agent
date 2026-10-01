# ai-payments-consultant-agent

## Getting started

Upload a merchant's acquirer **invoice or statement (PDF)** in the header. That alone drives the dashboard:
the key-metrics ledger, payment mix, current and suggested debit routing, surcharge impact, the agent and the
Routing Advisor. Add a **transactions CSV** (optional) for approval rates, decline analysis and transaction-level
routing and fee estimates.

## How the 1 October reform impact is worked out

The Suggested Routing card splits the merchant's fees into **interchange**, **scheme fees** and **processing**, using
the best source available: fee columns in the transactions file, else the invoice, else the Fee Assumptions rates.

1. **Today** - fees as they are.
2. **1 Oct** - interchange moves to the caps (debit/prepaid 8c per transaction, consumer credit 0.3% of value;
   Amex isn't capped). Scheme fees and processing stay the same.
3. **+ routing** - each dual-network debit payment on Visa/Mastercard moves to eftpos where eftpos interchange +
   scheme fee is cheaper than the scheme's post-reform interchange + scheme fee. Eftpos costs come from the
   merchant's own eftpos transactions when there are any, else the rate table. Processing stays the same.

Each column shows the total and effective rate (total fees / card sales). On blended pricing, interchange and
scheme fees are estimated within the MSF, and the saving depends on the acquirer passing it through.

## Transaction data

Optional. Upload a transactions export as **CSV, TSV, Excel (.xlsx) or JSON**, in whatever layout your bank,
gateway or POS produces. The app finds the header row (skipping title lines), then matches the date, amount,
card scheme, status, decline reason, debit/credit and network columns by name and by their contents. If it can't
match the essentials it asks Claude, sending only the column names, the first 15 rows (card numbers masked) and the
distinct values of short code-like columns, never the whole file. Values are standardised: "VISA DEBIT" → Visa +
debit, "$1,234.50" → 1234.50, Australian day-first dates, codes such as VI/MC/EP decoded. Refunds, voids and pending
rows are left out. Scheme codes such as MC, M/C, DMC, VI, EP and AX are recognised as words within the text. A debit/credit
column is found under names like Debit/Credit, Dr/Cr, D/C, Funding (Source), Account Type or Card Product, with
values such as Debit/Credit, DR/CR or just D/C. If any column is matched wrongly, open **Adjust column matching**
under the status line and pick the right one (or "Reset to automatic").

**Fees in the file:** columns such as Interchange Fee, Scheme Fee, MSF / Merchant Fee, Processing, Terminal
Rental and Total Fees are found and added up, and the ledger's Total cost then uses these actual fees (labelled
"Transactions file") instead of estimates. A total-fees column is only used when there are no component columns,
so nothing is double counted; rate %, net amount and GST columns are ignored. A Surcharge column is treated as
income and used in the Surcharge Impact card. The status line under the uploader shows which column was used for
what.

The downloadable template shows the app's own column names
(`date, amount, payment_method, status, decline_reason, card_type, network`).

## Logos

Card scheme logos in `assets/logos/` come from [Simple Icons](https://simpleicons.org) (CC0), cropped to the
artwork. They are trademarks of their owners and are used only to identify each scheme. Simple Icons has no
eftpos mark: place the official file at `assets/logos/eftpos.svg` and the app uses it instead of the text badge.

## Invoice / statement PDFs

Upload a merchant's acquirer invoice or statement (PDF) in the header. Claude reads it
(model `claude-opus-5-5`, structured JSON output) and extracts the period, pricing model, fee totals and per-scheme
rates. Those rates pre-fill the Fee Assumptions table (rows marked `Invoice`), so the ledger's Total cost uses them,
and the ledger also shows the invoice's actual total. Requires `ANTHROPIC_API_KEY` in the app's secrets, like the
other AI features. Each PDF is sent once and cached.

## Secrets

In Streamlit **Settings → Secrets**:

```toml
ANTHROPIC_API_KEY = "sk-ant-..."
# Only needed if the key isn't scoped to a workspace:
# ANTHROPIC_WORKSPACE_ID = "wrkspc_..."
```
