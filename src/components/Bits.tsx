'use client';

import { useEffect, useState } from 'react';
import {
  LANGUAGE_LABELS,
  PROVIDER_LABELS,
  type Availability,
  type Title,
} from '@/lib/types';
import { hashHue, initials } from '@/lib/utils/format';

/** Shared pieces used across cards, lists and search. */

// ---------------------------------------------------------------- Poster
/**
 * Real posters arrive with TMDB or OMDb. Until then this draws a deterministic
 * panel from the title itself — same title, same colours, every time — rather
 * than a grey box with a broken-image icon.
 */
export function Poster({
  title,
  className = '',
  showHint = true,
}: {
  title: Title;
  className?: string;
  showHint?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (title.posterUrl && !failed) {
    return (
      // Plain <img>: poster hosts vary by provider and next/image's
      // remotePatterns would reject an unexpected one outright.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={title.posterUrl}
        alt={`${title.title} poster`}
        className={`h-full w-full object-cover ${className}`}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }

  const h = hashHue(title.id);
  const h2 = (h + 40) % 360;

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center ${className}`}
      style={{
        background: `linear-gradient(160deg, hsl(${h} 36% 36%), hsl(${h2} 32% 17%))`,
      }}
      role="img"
      aria-label={`${title.title} — artwork not available`}
    >
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(155deg, rgba(255,255,255,.22), rgba(255,255,255,0) 45%)',
        }}
      />
      <span
        className="relative font-display text-[30px] font-semibold text-white/90"
        style={{ textShadow: '0 2px 16px rgba(0,0,0,.5)' }}
      >
        {initials(title.title)}
      </span>
      {showHint && (
        <span className="absolute inset-x-0 bottom-0 bg-black/25 py-1 text-center text-[8.5px] uppercase tracking-[0.08em] text-white/55">
          poster
        </span>
      )}
    </div>
  );
}

// ------------------------------------------------------------- Language
/**
 * The label Papa checks first. Plain words, never a language code — and when
 * we can't confirm a dub exists, it says so instead of overclaiming.
 */
export function LanguageBadge({ title }: { title: Title }) {
  const label = LANGUAGE_LABELS[title.viewingLanguage];
  const tone = label.tone === 'good' ? 'badge-hindi' : 'badge-english';
  return (
    <span className={`badge ${tone}`}>
      <span aria-hidden>{label.flag}</span>
      {label.text}
    </span>
  );
}

export function ProviderBadges({ availability }: { availability: Availability[] }) {
  const unique = [...new Set(availability.map((a) => a.provider))];
  if (unique.length === 0) {
    return (
      <span className="text-[13px] italic text-ink-3">Availability not confirmed</span>
    );
  }
  const dot: Record<string, string> = {
    netflix: '#E50914',
    prime: '#00A8E1',
    jiohotstar: '#7C5CFF',
  };
  return (
    <>
      {unique.map((p) => (
        <span key={p} className="badge">
          <i
            className="inline-block h-[7px] w-[7px] rounded-sm"
            style={{ background: dot[p] }}
            aria-hidden
          />
          {PROVIDER_LABELS[p]}
        </span>
      ))}
    </>
  );
}

export function RatingPlate({ title }: { title: Title }) {
  const { imdbRating, imdbVoteCount } = title.ratings;
  if (imdbRating == null) {
    return (
      <span className="inline-flex items-center rounded-[10px] bg-surface-2 px-2.5 py-1.5 text-[13.5px] italic text-ink-3">
        IMDb rating not available
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-baseline gap-1.5 rounded-[10px] border px-2.5 py-1.5"
      style={{
        background: 'linear-gradient(180deg, #FEFAF0, #FBF4E6)',
        borderColor: 'rgba(201,151,27,.24)',
      }}
    >
      <span className="text-[14px]" aria-hidden>
        ⭐
      </span>
      <span className="text-[22px] font-bold tracking-tight" style={{ color: '#6B4E08' }}>
        {imdbRating.toFixed(1)}
      </span>
      <span className="text-[12.5px]" style={{ color: '#96793A' }}>
        /10
      </span>
      {imdbVoteCount != null && (
        <span className="text-[12px]" style={{ color: '#96793A' }}>
          {formatVotes(imdbVoteCount)}
        </span>
      )}
    </span>
  );
}

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card mt-6 px-6 py-12 text-center">
      <div className="text-[38px]" aria-hidden>
        {icon}
      </div>
      <h2 className="mt-3 font-display text-[21px] font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-[32ch] text-[15px] leading-relaxed text-ink-2">
        {body}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const LOAD_STEPS = [
  'Removing everything you’ve already seen',
  'Checking ratings and reviews',
  'Looking for Hindi and Hindi dubbed versions',
  'Keeping only what’s genuinely worth it',
];

export function Loading({ headline }: { headline?: string }) {
  const [step, setStep] = useState(0);

  // useEffect, not useState. A useState initialiser runs once to compute the
  // initial value and ignores any returned function — so the interval below
  // was never cleared, leaking a timer on every mount and calling setState on
  // unmounted components.
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % LOAD_STEPS.length), 900);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="py-14 text-center" role="status">
      <div className="relative mx-auto mb-4 h-11 w-11">
        <span className="absolute inset-0 rounded-full border-[2.5px] border-line" />
        <span className="absolute inset-0 animate-spin rounded-full border-[2.5px] border-transparent border-t-accent-2" />
      </div>
      <p className="text-[16px] font-medium">
        {headline ?? 'Searching Netflix, Prime and JioHotstar…'}
      </p>
      <p className="mt-1 text-[14px] text-ink-3">{LOAD_STEPS[step]}</p>
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  return (
    <div
      className={`pointer-events-none fixed left-1/2 z-[60] -translate-x-1/2 whitespace-nowrap
                  rounded-full px-5 py-3 text-[15px] font-medium text-white shadow-lift
                  transition-all duration-300 ${
                    message ? 'opacity-100' : 'translate-y-5 opacity-0'
                  }`}
      style={{ background: '#1B1E24', bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}
      role="status"
      aria-live="polite"
    >
      {message ?? ''}
    </div>
  );
}
