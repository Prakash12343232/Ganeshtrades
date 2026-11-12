# Ganesh Trades — AI Features

## Summary

Ganesh Trades includes an admin-facing **Ganesh AI Business Assistant** that
answers natural-language questions about live store data. It is restricted to
`admin` and `manager` roles.

The assistant combines:

1. A server-side aggregation snapshot of real MongoDB data.
2. Google Gemini (`gemini-2.5-flash`) when `GEMINI_API_KEY` or
   `GOOGLE_GENAI_API_KEY` is configured.
3. A deterministic, rule-based answer generator that uses the same live snapshot
   when Gemini is unavailable, unconfigured, times out, or returns no text.

The deterministic fallback ensures the assistant never depends on an external
AI service to produce a useful answer.

## Architecture

```
Admin UI (AiBusinessAssistant.jsx)
        |
        | GET /api/ai/snapshot
        | POST /api/ai/assistant { query }
        v
backend/routes/ai.js  (protect + authorize admin/manager)
        |
        v
backend/services/aiAssistantService.js
        |
        +--> getBusinessSnapshot()  ---> MongoDB aggregations
        |
        +--> Gemini API (optional, 10s timeout, 800 max output tokens)
        |
        +--> generateDeterministicAnswer()  (fallback)
```

### Backend

- `backend/routes/ai.js`
  - `GET /api/ai/snapshot` — returns the live aggregated snapshot.
  - `POST /api/ai/assistant` — accepts `{ query }` and returns
    `{ success, answer, snapshot, aiPowered }`.
  - Both routes require a valid JWT and role `admin` or `manager`.
  - Invalid or empty queries return HTTP 400.
- `backend/services/aiAssistantService.js`
  - Builds the snapshot from `Order`, `Product`, `User`, and `Delivery`.
  - Calls Gemini only when an API key is configured.
  - Uses `AbortSignal.timeout(10000)` and `maxOutputTokens: 800`,
    `temperature: 0.2`.
  - Falls back to deterministic answers on any error or empty response.

### Frontend

- `frontend/src/components/admin/AiBusinessAssistant.jsx`
  - Chat-style modal with message history.
  - Loads a fresh snapshot each time it opens.
  - Provides quick prompts:
    - "What are today's orders?"
    - "Which products are low in stock?"
    - "What are the top-selling products?"
    - "Which payments are pending?"
    - "What deliveries are scheduled today?"
    - "Give me a sales summary for the last 30 days."
  - Displays whether an answer was AI-powered and shows a clear error message if
    the request fails.
  - API calls are defined in `frontend/src/services/api.js`
    (`getAiSnapshot`, `askAiAssistant`).

## Live snapshot contents

`getBusinessSnapshot()` returns:

| Section | Data |
| --- | --- |
| `timestamp` | Snapshot generation time (ISO). |
| `today` | Order count, non-cancelled revenue, status breakdown, five most recent orders (order number, customer name, total, order/payment status). |
| `inventory` | Active product count, low-stock count, up to 10 critical items (name, stock, minStock, unit, price), top 6 products by `totalSold`. |
| `finance` | Pending-payment order count, outstanding Khata credit, customers with credit, 30-day order/revenue/AOV summary. |
| `deliveries` | Today's delivery totals: assigned, out for delivery, delivered. |
| `customers` | Total registered customers. |

Low-stock definition: `stock <= minStock` or `stock <= 5`, excluding inactive
products.

Outstanding credit uses `creditBalance` when present, falling back to
`pendingAmount` for legacy data.

## Deterministic fallback

`generateDeterministicAnswer(query, snapshot)` matches common intents:

- Today's orders and revenue.
- Low stock / restock / inventory alerts.
- Top-selling products.
- Pending payments and Khata credit.
- Deliveries and dispatch status.
- 30-day sales performance.
- Default executive overview for unmatched queries.

Answers use Markdown, Indian Rupee formatting, and real values from the snapshot.
The fallback is fully server-side and does not expose raw database queries to the
client.

## Configuration

Add to the root `.env` (see `.env.example`):

```
GEMINI_API_KEY=
```

`GOOGLE_GENAI_API_KEY` is also accepted as an alias. Without either key, the
assistant runs entirely on the deterministic fallback.

Optional tuning is currently fixed in code: 10-second Gemini timeout, 800 output
tokens, temperature 0.2.

## Security and privacy

- Endpoints are protected by JWT and restricted to `admin`/`manager`.
- The assistant receives only aggregated snapshot data plus customer names and
  mobile numbers for a small number of recent/pending orders.
- The Gemini API key is read from server environment variables and never sent to
  the browser.
- The client never receives raw Mongo queries or credentials.
- Errors are sanitized with `clientErrorMessage`.
- AI calls are read-only; the assistant cannot create, update, or delete data.

## Non-AI automation

These features are rule-based, not LLM-driven:

- `GET /api/dashboard/auto-reorder` — suggests restock items when stock is at or
  below `minStock`, or when `totalSold > 100` and `stock < 50`.
- Low-stock alerts on the dashboard and product listing.
- Scheduled delivery tracking and late-delivery virtual field.
- Notification generation for order, payment, stock, and delivery events.

## Testing

`backend/tests/bulkImportAndAI.test.js` covers AI snapshot/assistant behavior and
bulk import flows. Frontend tests cover the surrounding admin UI. The full suite
is documented in `docs/TEST_REPORT.md`.

## Limitations and out of scope

- No recipe-generation or recipe-suggestion AI is implemented.
- No 60-day receivables aging AI/report is implemented (Phase 2+ was not
  approved or started).
- No autonomous actions: the assistant only reports and recommends.
- No conversation persistence; chat history is client-side and resets on reload.
- Gemini output quality depends on the external service; the deterministic
  fallback is the guaranteed path.
- No live payment or production-data mutations are performed by AI features.
