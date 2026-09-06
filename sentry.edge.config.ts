/**
 * Sentry — edge runtime instrumentation.
 *
 * Loaded automatically by @sentry/nextjs for the edge bundle (middleware,
 * edge route handlers). The What's Tonight app does not currently ship edge
 * functions, but wiring this keeps Sentry coverage complete the moment one
 * is added.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  release: process.env.SENTRY_RELEASE,

  environment: process.env.SENTRY_ENV || process.env.NODE_ENV,
  dist: process.env.SENTRY_RELEASE?.slice(0, 7),

  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 1.0),
});
