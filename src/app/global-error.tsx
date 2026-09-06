'use client';

/**
 * global-error.tsx — Next.js App Router global error boundary.
 *
 * Catches errors thrown during root layout / template rendering that the
 * normal error.tsx cannot (an error.tsx is itself rendered inside the layout,
 * so it cannot catch a layout-level crash). This file replaces the entire
 * document, which is why it re-renders <html> and <body>.
 *
 * The Sentry Error Boundary inside automatically captures the crash as a
 * Sentry event (stack trace + session/replay) before this fallback UI shows.
 */
import * as Sentry from '@sentry/nextjs';
import type { ReactNode } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <Sentry.ErrorBoundary
          fallback={<ErrorFallback error={error} reset={reset} />}
          showDialog
        >
          {/*
            Re-throw here is intentional: this GlobalError only renders when a
            child of the root layout already crashed, so the ErrorBoundary
            fallback below is what the user actually sees.
          */}
          <ErrorFallback error={error} reset={reset} />
        </Sentry.ErrorBoundary>
      </body>
    </html>
  );
}

function ErrorFallback({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        background: '#F6F4F0',
        color: '#1a1a1a',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: 20, margin: 0 }}>Something went wrong</h1>
      <p style={{ margin: 0, maxWidth: 360, lineHeight: 1.5 }}>
        The page hit an unexpected error. We've already been notified —
        the team will see the stack trace and the exact change that caused it.
      </p>
      {error.digest ? (
        <p style={{ margin: 0, fontSize: 13, opacity: 0.6 }}>
          Error ID: {error.digest}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        style={{
          padding: '10px 20px',
          borderRadius: 8,
          border: '1px solid #1a1a1a',
          background: '#1a1a1a',
          color: '#F6F4F0',
          fontSize: 15,
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}
