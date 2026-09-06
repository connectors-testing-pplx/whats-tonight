# Sentry + Error Triage Pipeline

Real-time runtime error monitoring for What's Tonight and an automated
GitHub Action pipeline that opens a triaged issue whenever a deployment
fails or a critical JavaScript error lands in production.

Every issue includes the stack trace, the session data (replay + trace),
and the specific commit responsible for the regression.

## What was added

| File | Purpose |
| --- | --- |
| sentry.client.config.ts | Browser SDK init - captures client-side crashes, with session replay |
| sentry.server.config.ts | Node server SDK init - captures API route + server component errors |
| sentry.edge.config.ts | Edge runtime SDK init (future-proof) |
| next.config.mjs | Wrapped with withSentryConfig - source-map upload, release tagging |
| src/app/global-error.tsx | Global error boundary with Sentry.ErrorBoundary fallback UI |
| src/app/api/monitoring/route.ts | Tunnel route so ad blockers do not swallow events |
| scripts/sentry-triage.mjs | Bridges Sentry issues to GitHub issues (dedupe + format) |
| .github/workflows/deploy.yml | Build + deploy; tags Sentry release with commit SHA |
| .github/workflows/error-triage.yml | Auto-opens issues on deploy failure / critical error |

## How the pieces connect

```
  browser crash --> @sentry/nextjs (client) --+
  server error  --> @sentry/nextjs (server) --+--> Sentry issue (tagged: release=SHA)
  deploy fails  --> Deploy workflow  --------+
                                                         |
   repository_dispatch (Sentry webhook)   +              |
   schedule (every 15 min poll)           |---> error-triage workflow
   workflow_run (deploy failed)          +              |
                                                         v
                                       scripts/sentry-triage.mjs (dedupe + format)
                                                         |
                                                         v
                                          GitHub issue: stack trace, session replay,
                                          trace explorer, commit SHA + link
```

## 1. Sentry setup (one time)

1. Create a project at https://sentry.io - platform: Next.js.
2. Copy the DSN. The client DSN is public by design (ingest-only).
3. Create an auth token for source-map upload:
   https://sentry.io/settings/account/api/auth-tokens/
   scopes: org:read, project:releases, project:write.
4. Note your org slug and project slug (from the project URL).

Add these as repository secrets (Settings -> Secrets and variables -> Actions):

| Secret | Value |
| --- | --- |
| SENTRY_DSN | server DSN |
| NEXT_PUBLIC_SENTRY_DSN | client DSN (same value) |
| SENTRY_ORG | org slug |
| SENTRY_PROJECT | project slug |
| SENTRY_AUTH_TOKEN | auth token from step 3 |

Optional (only if you deploy from the workflow rather than the Vercel Git
integration): VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID.

SENTRY_RELEASE is set automatically to the commit SHA in the Deploy
workflow - do not add it as a secret.

## 2. Local development

```bash
npm install
npm run dev
```

With no Sentry env vars set, the SDK initialises with a no-op DSN and the app
behaves exactly as before. To test Sentry locally, add to .env.local:

```
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/123
SENTRY_DSN=https://...@sentry.io/123
```

No token means no source-map upload, which is what you want locally.

## 3. How release = commit SHA works

The Deploy workflow sets SENTRY_RELEASE to the commit SHA. The
withSentryConfig build plugin reads this and:

- Tags the release with the commit SHA.
- Uploads source maps for that release (when SENTRY_AUTH_TOKEN is present).
- Injects the release into the client bundle as NEXT_PUBLIC_SENTRY_RELEASE.

Every event Sentry captures - client or server - now carries the commit SHA.
That is the specific commit responsible for the regression that the triage
issue links to.

## 4. The error-triage workflow

Three triggers, all converging on scripts/sentry-triage.mjs:

### a. Deployment failure - workflow_run

When the Deploy workflow finishes with conclusion == failure, the triage
workflow opens an issue titled "Deployment failure @ <short-sha>" with the
build/deploy log tail and a direct link to the failing commit.

### b. Critical Sentry error - repository_dispatch (real-time webhook)

Sentry can fire a webhook on a new critical issue. Because GitHub's
repository_dispatch requires an authenticated POST, set up a tiny bridge
(e.g. a Vercel serverless function, or a Zapier/Make hook) that:

1. Receives the Sentry webhook.
2. POSTs to https://api.github.com/repos/<owner>/<repo>/dispatches with a
   Personal Access Token, event type sentry-critical-error, and the Sentry
   issue payload in client_payload.

The triage script then opens an issue immediately with the stack trace,
session replay link, and commit SHA.

### c. Scheduled poll - schedule (safety net)

Every 15 minutes the workflow polls Sentry for unresolved error/fatal issues
from the last 15 minutes. Anything the webhook missed gets filed here. Adjust
the period via SENTRY_POLL_PERIOD.

Deduplication is handled by a hidden marker in each issue body - the same
Sentry issue never produces two GitHub issues. Re-occurrences comment on the
existing issue instead.

## 5. What a triaged issue looks like

- Title: [sentry:a1b2c3d] TypeError: Cannot read properties of undefined
- Sentry issue: level, environment, first seen, event count, users affected
- Responsible commit: release = a1b2c3d with a link to the commit
- Stack trace: exception type, value, and full frame list (app vs vendor)
- Session data: session replay link, trace explorer link, browser, OS
- Links: Sentry issue, Sentry event, commit

## 6. Verify it works

```bash
npm run typecheck   # SDK configs compile
npm run build       # source maps upload if SENTRY_AUTH_TOKEN is set
```

For an end-to-end smoke test, trigger the workflow manually:
Actions -> Error triage -> Run workflow, then check the run log for the
triage script output.
