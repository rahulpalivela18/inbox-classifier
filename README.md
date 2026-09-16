# Inbox Classifier

Inbox Classifier organizes Gmail with AI while keeping message content out of the
application database. The app stores Gmail IDs, sender metadata, classifications,
confidence scores, scan state, and aggregate statistics—not email bodies, HTML,
attachments, or OAuth tokens.

## Current status

This repository is a **Phase 1 foundation and working demo**. The UI, API
contracts, database shape, and demo scan flow are started, but live Gmail
connection and live AI classification still need to be completed.

The intended Phase 1 goal is only:

```text
Connect Gmail
    ↓
Fetch Gmail messages
    ↓
Classify messages with TypeSafe AI
    ↓
Store classification metadata
    ↓
Show results in the dashboard
```

### Done

- Responsive dashboard with inbox aggregates and category signal map
- Review queue with sender search, category filtering, inclusion toggles, and
  editable classifications
- Background scan progress UI and demo scan worker
- Gmail label application API/UI flow in demo mode
- Settings page with connection state and privacy explanation
- PostgreSQL schema for users, categories, classifications, scan jobs, and
  unsubscribe actions
- OpenAPI contract, generated React Query hooks, and Zod validation
- Explicit demo mode so the interface can run without Gmail credentials
- Setup notes for Google Cloud OAuth, TypeSafe configuration, and PostgreSQL

### Not done yet for Phase 1

1. Complete the Google OAuth callback in
   `artifacts/api-server/src/routes/inbox.ts`.
2. Add a backend-only Gmail service that exchanges OAuth codes, refreshes
   expired tokens, paginates Gmail message IDs, and retrieves only the minimum
   sender/subject/timestamp/text data needed for classification.
3. Add a dedicated TypeSafe classifier service that sends cleaned and truncated
   content in memory, validates `{ category, subcategory, confidence }`, and
   retries individual failures without stopping the scan.
4. Move demo scan/classification state from
   `artifacts/api-server/src/lib/inbox-state.ts` into PostgreSQL.
5. Replace demo dashboard counts with values calculated from real stored
   metadata and Gmail metadata.

Until those items are complete, keep:

```env
INBOX_CLASSIFIER_DEMO_MODE=true
```

Do not claim live Gmail classification is working just because the demo UI is
working.

## Run locally

1. Copy `.env.example` to `.env` and set `DATABASE_URL`.
2. Keep `INBOX_CLASSIFIER_DEMO_MODE=true` for the local preview.
3. Start the API:

   ```bash
   pnpm --filter @workspace/api-server run dev
   ```

4. Start the web app in a second process:

   ```bash
   pnpm --filter @workspace/inbox-classifier run dev
   ```

The managed Replit workflows start both services automatically. Run
`pnpm run typecheck` for the full workspace check.

## Google Cloud OAuth setup for Phase 1

1. Create or select a Google Cloud project.
2. Enable the Gmail API.
3. Create an OAuth consent screen. Request only the scopes required for the
   product:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.modify`
4. Create a Web application OAuth client.
5. Add the local redirect URI:
   `http://localhost:5000/api/account/callback`
6. Add the Replit preview callback URI that matches the API service's public
   domain and `/api/account/callback` path.
7. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in
   server-side environment variables.
8. Set `INBOX_CLASSIFIER_DEMO_MODE=false` only after the live callback, Gmail
   service, token refresh, and one-message classification flow are verified.

OAuth access tokens must stay on the backend. Do not put them in React state,
browser storage, logs, or API responses.

## TypeSafe classifier configuration for Phase 1

Set:

- `TYPESAFE_API_URL` — server endpoint for structured classification requests
- `TYPESAFE_API_KEY` — server-side credential
- `TYPESAFE_MODEL` — model identifier accepted by the TypeSafe service

The classifier integration should send only the minimum cleaned and truncated
content needed for a decision. Validate the response as:

```json
{
  "category": "NEWSLETTER",
  "subcategory": "TECH",
  "confidence": 0.94
}
```

Classification failures should be isolated to the message, retried with a
bounded policy, and reflected in scan progress rather than stopping the scan.

## PostgreSQL

The schema is managed by Drizzle. Push development changes with:

```bash
pnpm --filter @workspace/db run push
```

The metadata tables intentionally do not contain a body, HTML, attachment, or
full-content column.

## Project map

- `artifacts/inbox-classifier` — React + Vite dashboard
- `artifacts/api-server/src/routes/inbox.ts` — API contract handlers
- `artifacts/api-server/src/lib/inbox-state.ts` — demo state and scan worker
- `lib/api-spec/openapi.yaml` — API source of truth
- `lib/db/src/schema/inbox.ts` — PostgreSQL metadata schema
- `lib/api-client-react/src/generated` — generated frontend hooks
- `lib/api-zod/src/generated` — generated request/response validation

## Phase 2 — later features

Phase 2 is intentionally outside the current Phase 1 scope:

- Classification review backed by real Gmail data
- Creating and applying real Gmail label hierarchies
- Sender statistics and newsletter detection
- `List-Unsubscribe` detection and explicit user confirmation
- Playwright unsubscribe fallback
- Manual/failed unsubscribe states
- No CAPTCHA bypass, authentication bypass, or arbitrary browser actions

Playwright scraping/unsubscribe automation should not be implemented before the
basic Gmail connection and classification loop works reliably.

## Known limitations

- The preview uses explicit demo mode and does not read a real Gmail account.
- The OAuth start route exists, but the callback, token exchange, refresh, and
  Gmail API service still need implementation.
- The TypeSafe environment variables are documented, but no live classifier
  request is wired yet.
- Demo scan state is held in server memory until the Phase 1 persistence work is
  completed.
- Gmail labels and unsubscribe actions are not performed against a real account.