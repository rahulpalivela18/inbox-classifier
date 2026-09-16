# Inbox Classifier

Inbox Classifier organizes Gmail with AI while keeping message content out of the
application database. The app stores Gmail IDs, sender metadata, classifications,
confidence scores, scan state, and aggregate statistics—not email bodies, HTML,
attachments, or OAuth tokens.

## Current build

The first working build includes:

- Responsive dashboard with inbox aggregates and category signal map
- Review queue with sender search, category filtering, inclusion toggles, and
  editable classifications
- Background scan progress with persistent scan route
- Gmail label application preview flow
- Settings page with connection state and privacy boundary explanation
- PostgreSQL schema for users, categories, classifications, scan jobs, and
  unsubscribe actions
- Generated OpenAPI client hooks shared between the frontend and API
- Explicit demo mode for local development, with no fake data used once live mode
  is enabled

Live Gmail fetching and TypeSafe classification are kept behind configuration
boundaries for the next implementation pass. The server modules and API contract
are intentionally separated so those integrations can be added without moving
email content into PostgreSQL.

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

## Google Cloud OAuth setup

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
8. Set `INBOX_CLASSIFIER_DEMO_MODE=false` only after the live callback and Gmail
   service are configured.

OAuth access tokens must stay on the backend. Do not put them in React state,
browser storage, logs, or API responses.

## TypeSafe classifier configuration

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

## Known limitations

- The preview uses explicit demo mode so the product can be inspected without
  Gmail credentials.
- Live Gmail fetch, token refresh, structured TypeSafe calls, and durable
  background workers are the next integration pass.
- Unsubscribe automation is intentionally not enabled. When implemented, it must
  require explicit confirmation, prefer `List-Unsubscribe`, and never bypass
  CAPTCHA or authentication.

## Next steps

1. Add the backend Gmail OAuth callback and encrypted/token-safe session storage.
2. Implement the modular Gmail, TypeSafe classifier, and Gmail label services.
3. Move scan state and classification mutations from demo memory to PostgreSQL.
4. Add retry/backoff and Gmail pagination handling for thousands of messages.
5. Add the confirmed unsubscribe flow behind a feature flag.