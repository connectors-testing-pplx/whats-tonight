'use client';

import { useState } from 'react';
import {
  ERA_LABELS,
  INDUSTRY_LABELS,
  LANGUAGE_LABELS,
  SLOTS,
  type Recommendation,
  type UserActionType,
} from '@/lib/types';
import { LanguageBadge, Poster, ProviderBadges, RatingPlate } from './Bits';
import { WhyThisSheet } from './WhyThisSheet';
import { formatCount, formatSeasons, formatTitleRuntime, hashHue, initials } from '@/lib/utils/format';

/**
 * The recommendation card.
 *
 * Collapsed it shows four things: poster, title, IMDb rating, and where plus
 * in what language. That is the minimum to decide, and it is deliberately all
 * that competes for attention.
 *
 * Everything else — runtime, genre, ratings detail, plot, cast, reception, and
 * why we picked it — sits behind Read more.
 *
 * The coloured spine down the left edge encodes language: green when Hindi is
 * available, purple when it is English only. Readable before a word is parsed.
 */

const CONFIRMATION: Partial<Record<UserActionType, string>> = {
  WATCH_TODAY: 'Enjoy it 🍿',
  MAYBE_LATER: 'Saved to Later',
  SEEN_IT: 'Marked as seen',
  NOT_INTERESTED: 'Removed — just this title',
};

export function RecommendationCard({
  recommendation,
  index,
  chosen,
  onAction,
  onUndo,
  onFindSimilar,
  leaving,
}: {
  recommendation: Recommendation;
  index: number;
  chosen: boolean;
  onAction: (action: UserActionType) => void;
  onUndo: () => void;
  onFindSimilar: () => void;
  leaving?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const { title, slot, whyWePicked, languageException } = recommendation;
  const slotMeta = SLOTS.find((s) => s.id === slot);
  const lang = LANGUAGE_LABELS[title.viewingLanguage];
  const spine = lang.tone === 'good' ? '#0C7355' : '#6D4FA8';

  const facts = [
    title.type === 'movie' ? 'Film' : title.type === 'limited-series' ? 'Limited series' : 'Series',
    title.releaseYear != null ? String(title.releaseYear) : null,
    formatTitleRuntime(title),
    formatSeasons(title),
    title.era ? ERA_LABELS[title.era] : null,
    INDUSTRY_LABELS[title.industry],
    title.genres.slice(0, 3).join(', ') || null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <article
        className={`card mb-4 ${leaving ? 'animate-leave' : 'animate-rise'}`}
        style={{ animationDelay: leaving ? '0ms' : `${Math.min(index, 5) * 70}ms` }}
      >
        <span
          className="absolute inset-y-0 left-0 w-1"
          style={{ background: spine }}
          aria-hidden
        />

        {/* Slot line */}
        <div className="flex items-center gap-2.5 py-3 pl-5 pr-4">
          <span className="font-display text-[22px] leading-none text-ink-3">{index + 1}</span>
          <span className="truncate text-[11.5px] font-bold uppercase tracking-[0.1em] text-accent">
            {slotMeta?.label}
          </span>
          {languageException && (
            <span
              className="ml-auto shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] font-semibold"
              style={{ background: '#FCF4E1', borderColor: 'rgba(201,151,27,.3)', color: '#8A6510' }}
            >
              ⭐ Worth the exception
            </span>
          )}
        </div>

        {/* Poster + headline */}
        <div className="flex gap-4 pb-0.5 pl-5 pr-4">
          <div className="h-[147px] w-[98px] shrink-0 overflow-hidden rounded-xl bg-surface-2 shadow-soft">
            <Poster title={title} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[21px] font-semibold leading-[1.16] text-balance">
              {title.title}
            </h2>
            {title.releaseYear != null && (
              <p className="mt-0.5 text-[13.5px] text-ink-3">{title.releaseYear}</p>
            )}
            <div className="mt-2.5">
              <RatingPlate title={title} />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <LanguageBadge title={title} />
              <ProviderBadges availability={title.availability} />
            </div>
          </div>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-h-[48px] w-full items-center gap-2 pl-5 pr-4 text-left text-[15.5px] font-medium text-accent"
        >
          {open ? 'Show less' : 'Read more'}
          <span
            className={`text-[10px] transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
            aria-hidden
          >
            ▼
          </span>
        </button>

        {open && (
          <div className="border-t border-line-2 pl-5 pr-4">
            <div className="border-b border-line-2 py-3.5 text-[14.5px] text-ink-2">{facts}</div>

            {/* Ratings — every metric shown, absent ones named as absent. */}
            <div className="border-b border-line-2 py-3.5">
              <h3 className="rule-heading mb-2">Ratings</h3>
              <div className="flex flex-wrap gap-1.5">
                <Score
                  label="⭐ IMDb"
                  value={
                    title.ratings.imdbRating != null
                      ? `${title.ratings.imdbRating.toFixed(1)}${
                          title.ratings.imdbVoteCount
                            ? ` · ${formatCount(title.ratings.imdbVoteCount)} ratings`
                            : ''
                        }`
                      : null
                  }
                />
                <Score
                  label="🍅 Critics"
                  value={
                    title.ratings.rtCriticScore != null
                      ? `${title.ratings.rtCriticScore}%${
                          title.ratings.rtCriticReviewCount
                            ? ` · ${title.ratings.rtCriticReviewCount} reviews`
                            : ''
                        }`
                      : null
                  }
                />
                <Score
                  label="🍿 Audience"
                  value={
                    title.ratings.rtAudienceScore != null
                      ? `${title.ratings.rtAudienceScore}%`
                      : null
                  }
                />
              </div>
            </div>

            <div className="border-b border-line-2 py-3.5">
              <h3 className="rule-heading mb-2">Language</h3>
              <p className="text-[15px] leading-relaxed">
                {lang.flag} <strong>{lang.text}</strong> — {lang.detail}
              </p>
            </div>

            {title.synopsis && (
              <div className="border-b border-line-2 py-3.5">
                <h3 className="rule-heading mb-2">What it&apos;s about</h3>
                <p className="text-[15.5px] leading-relaxed">{title.synopsis}</p>
              </div>
            )}

            {title.cast.length > 0 && (
              <div className="border-b border-line-2 py-3.5">
                <h3 className="rule-heading mb-2.5">Cast</h3>
                <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                  {title.cast.slice(0, 6).map((name) => {
                    const h = hashHue(name);
                    return (
                      <div key={name} className="w-[66px] shrink-0 text-center">
                        <div
                          className="mx-auto mb-1.5 flex h-[54px] w-[54px] items-center justify-center rounded-full font-display text-[18px] font-semibold text-white"
                          style={{
                            background: `linear-gradient(150deg, hsl(${h} 42% 52%), hsl(${(h + 30) % 360} 38% 38%))`,
                          }}
                        >
                          {initials(name)}
                        </div>
                        <div className="text-[11.5px] leading-tight text-ink-2">{name}</div>
                      </div>
                    );
                  })}
                </div>
                {title.director && (
                  <p className="mt-2 text-[13.5px] text-ink-3">Directed by {title.director}</p>
                )}
              </div>
            )}

            <div className="border-b border-line-2 py-3.5">
              <h3 className="rule-heading mb-2">What people are saying</h3>
              {title.reception.summary ? (
                <p className="text-[15.5px] leading-relaxed">{title.reception.summary}</p>
              ) : (
                <p className="text-[15.5px] italic leading-relaxed text-ink-3">
                  Not enough published reviews were found to summarise reception for this
                  title.
                </p>
              )}
            </div>

            <div className="border-b border-line-2 py-3.5">
              <h3 className="rule-heading mb-2">Why we picked this</h3>
              <p className="text-[15.5px] leading-relaxed">{whyWePicked}</p>
              <button
                onClick={() => setShowWhy(true)}
                className="mt-2.5 text-[15px] text-accent underline underline-offset-4"
              >
                See the full reasoning
              </button>
            </div>

            <div className="py-3.5">
              <button onClick={onFindSimilar} className="tap-quiet px-4 text-[15px]">
                🎬 Find more like this
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        {chosen ? (
          <div
            className="mx-4 mb-4 ml-5 mt-3 flex items-center gap-3 rounded-xl border px-4 py-3.5"
            style={{
              background: 'linear-gradient(135deg,#FCF3E3,#FAEDDA)',
              borderColor: 'rgba(161,78,20,.28)',
            }}
          >
            <span className="flex-1 text-[15.5px] font-semibold text-accent">
              ▶ Watching this tonight
            </span>
            <button onClick={onUndo} className="text-[14.5px] text-ink-2 underline underline-offset-4">
              Undo
            </button>
          </div>
        ) : (
          <div className="border-t border-line-2 pb-4 pl-5 pr-4 pt-3.5">
            <button
              onClick={() => onAction('WATCH_TODAY')}
              className="tap-primary w-full text-[17px]"
              style={{ minHeight: 56 }}
            >
              ▶ Watch this tonight
            </button>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button
                onClick={() => onAction('SEEN_IT')}
                className="tap-quiet whitespace-nowrap px-1 text-[14px]"
                style={{ minHeight: 50 }}
              >
                ✓ Seen it
              </button>
              <button
                onClick={() => onAction('MAYBE_LATER')}
                className="tap-quiet whitespace-nowrap px-1 text-[14px]"
                style={{ minHeight: 50 }}
              >
                🕐 Later
              </button>
              <button
                onClick={() => onAction('NOT_INTERESTED')}
                className="tap-quiet whitespace-nowrap px-1 text-[14px]"
                style={{ minHeight: 50 }}
              >
                ✕ Not for me
              </button>
            </div>
          </div>
        )}
      </article>

      {showWhy && (
        <WhyThisSheet recommendation={recommendation} onClose={() => setShowWhy(false)} />
      )}
    </>
  );
}

function Score({ label, value }: { label: string; value: string | null }) {
  if (value == null) {
    return (
      <span className="rounded-[9px] bg-surface-2 px-2.5 py-2 text-[14px] italic text-ink-3">
        {label} — not available
      </span>
    );
  }
  return (
    <span className="rounded-[9px] bg-surface-2 px-2.5 py-2 text-[14px]">
      {label} <strong>{value}</strong>
    </span>
  );
}

export { CONFIRMATION };
