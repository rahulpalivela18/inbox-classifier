# Inbox Classifier

Inbox Classifier uses AI to organize Gmail metadata into reviewable categories and labels without storing email bodies.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/inbox-classifier run dev` — run the React dashboard
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string; see `.env.example` for optional live Gmail and TypeSafe configuration.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/inbox-classifier` — React/Vite dashboard and routes
- `artifacts/api-server/src/routes/inbox.ts` — account, dashboard, scans, review, and labels endpoints
- `artifacts/api-server/src/lib/inbox-state.ts` — explicit demo state and scan progress worker
- `lib/api-spec/openapi.yaml` — source of truth for API contracts
- `lib/db/src/schema/inbox.ts` — privacy-safe PostgreSQL metadata schema
- `README.md` — setup, Google Cloud OAuth, TypeSafe configuration, limitations, and next steps

## Architecture decisions

- The API contract is OpenAPI-first; React Query hooks and Zod validators are generated from `lib/api-spec/openapi.yaml`.
- Demo mode is explicit and isolated in `inbox-state.ts`; live mode should never silently fall back to fake Gmail data.
- Email bodies, HTML, attachments, and OAuth tokens are excluded from the database model and application logs.
- Gmail integration, classifier integration, label application, and unsubscribe automation remain separate service boundaries.

## Product

- Dashboard overview of message totals, unread count, recurring senders, and category shares
- Scan inbox flow with background progress
- Review queue for filtering, editing, and excluding classifications
- Gmail label application preview
- Settings and privacy explanation

## User preferences

- Privacy is a first-class product requirement: do not persist email bodies or full content.

## Gotchas

- Run API codegen after every OpenAPI change before using generated hooks or Zod exports.
- Use `INBOX_CLASSIFIER_DEMO_MODE=true` for preview work until live Gmail and TypeSafe credentials are configured.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
