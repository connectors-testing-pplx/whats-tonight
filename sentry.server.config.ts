/**
 * Sentry — server (Node.js) runtime instrumentation.
 *
 * Loaded automatically by @sentry/nextjs for the Node server bundle (route
 * handlers, server components, server actions). Captures unhandled errors
 * thrown during server-side rendering and /src/app/api/* route handlers in
 * real time.
 *
 * `release` is injected at build time by the Sentry webpack plugin from
 * SENTRY_RELEASE (set to the commit SHA in CI), so every server event is
 * tagged with the exact commit responsible for the regression.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Tag every event with the commit that built this server bundle.
  release: process.env.SENTRY_RELEASE,

  environment: process.env.SENTRY_ENV || process.env.NODE_ENV,
  dist: process.env.SENTRY_RELEASE?.slice(0, 7),

  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 1.0),

  // Profiles are server-side CPU samples; keep cheap until traffic is real.
  profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE || 0.1),

  integrations: [
    // Capture outgoing HTTP requests to TMDB / OMDb as breadcrumbs, so a
    // provider failure shows up in the timeline leading to the crash.
    Sentry.httpIntegration(),
  ],

  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Network request failed',
  ],
});
