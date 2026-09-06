/**
 * Sentry — browser/client runtime instrumentation.
 *
 * Loaded automatically by @sentry/nextjs for the client bundle. Captures every
 * unhandled exception and crash that happens in the browser in real time:
 * React render failures, hydration errors, fetch explosions in client
 * components, etc.
 *
 * `release` is injected at build time by the Sentry webpack plugin from the
 * SENTRY_RELEASE env var (set to the commit SHA in CI), so every client-side
 * event is tagged with the exact commit that shipped it.
 */
import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  // The client DSN is public by design — it only permits event ingestion,
  // never read access. Exposed via NEXT_PUBLIC_ so it lands in the bundle.
  dsn: SENTRY_DSN,

  // Tag every event with the commit that built this bundle. The plugin
  // defines NEXT_PUBLIC_SENTRY_RELEASE from the release name at build time.
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

  // Environment + dist for filtering in the Sentry UI.
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NODE_ENV,
  dist: process.env.NEXT_PUBLIC_SENTRY_RELEASE?.slice(0, 7),

  // Adjust in production. 1.0 captures every transaction (useful pre-launch);
  // drop to ~0.1 once traffic is real to stay within quota.
  tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || 1.0),

  // Capture a session-replay recording for ~10% of normal sessions, and for
  // 100% of sessions that hit an error. Replays give us the session data
  // (clicks, navigations, console) behind a crash.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  ignoreErrors: [
    // Browser extensions / network noise we never want to triage.
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered frames',
    'Network request failed',
  ],
});
