# ai-payments-consultant-agent

## Transaction data

Upload a CSV with `date, amount, payment_method, status, decline_reason`. Two optional columns unlock the
payment-mix and routing views:

- `card_type`: `debit` or `credit`
- `network`: the network the transaction was actually processed on (`eftpos`, `visa`, `mastercard`, `amex`)

## Logos

Card scheme logos in `assets/logos/` come from [Simple Icons](https://simpleicons.org) (CC0), cropped to the
artwork. They are trademarks of their owners and are used only to identify each scheme. Simple Icons has no
eftpos mark: place the official file at `assets/logos/eftpos.svg` and the app uses it instead of the text badge.

## Invoice / statement PDFs

Upload a merchant's acquirer invoice or statement (PDF) in the sidebar under **Actual fees**. Claude reads it
(model `claude-opus-5-5`, structured JSON output) and extracts the period, pricing model, fee totals and per-scheme
rates. Those rates pre-fill the Fee Assumptions table (rows marked `Invoice`), so the ledger's Total cost uses them,
and the ledger also shows the invoice's actual total. Requires `ANTHROPIC_API_KEY` in the app's secrets, like the
other AI features. Each PDF is sent once and cached.
