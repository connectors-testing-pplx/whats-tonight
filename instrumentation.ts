/**
 * instrumentation.ts — the Next.js instrumentation hook.
 *
 * Next.js calls register() once per server instance at startup, before any
 * route handler or server component runs. We use it to import the Sentry
 * server config so server-side Sentry initialisation happens exactly once
 * and before the first request is served.
 *
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
