/**
 * next.config.mjs — What's Tonight?
 *
 * Wrapped with @sentry/nextjs so the SDK config files (sentry.client.config.ts,
 * sentry.server.config.ts, sentry.edge.config.ts) are injected into the right
 * bundles, source maps are uploaded to Sentry at build time, and the release
 * is tagged with the commit SHA that shipped it.
 */
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { withSentryConfig } from '@sentry/nextjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // TMDB serves all poster/backdrop imagery from image.tmdb.org.
    // Add further hosts here if you plug in another metadata provider.
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Sentry
// ---------------------------------------------------------------------------
//
// `release.name` is the commit SHA (set to SENTRY_RELEASE in CI). Tagging
// every event with it is what lets the error-triage workflow file a GitHub
// issue against the specific commit responsible for a regression.
//
// Source maps are uploaded only when SENTRY_AUTH_TOKEN is present — so local
// `next build` runs without a token still succeed; they just don't upload
// maps.
export default withSentryConfig(nextConfig, {
  // Sentry org + project the maps and releases belong to.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // The release name. Set SENTRY_RELEASE=<commit-sha> in CI. When unset
  // (local dev) no release is created and nothing is uploaded.
  release: { name: process.env.SENTRY_RELEASE },

  // Only upload source maps when a token is available.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Route browser events through a first-party URL to dodge ad blockers.
  tunnelRoute: '/monitoring',

  // Quiet in local dev, chatty in CI.
  silent: !process.env.CI,

  // Tree-shake Sentry logger from the production bundle.
  disableLogger: true,

  // Let Vercel cron + the Next runtime report automatically.
  automaticVercelMonitors: true,

  // Make sure @sentry/nextjs is not externalised, so tree-shaking works.
  widenClientFileUpload: true,

  // Transpile these so source maps resolve cleanly.
  transpileClientSDKs: true,
});
