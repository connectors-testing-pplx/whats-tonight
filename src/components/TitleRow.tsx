'use client';

import { useState } from 'react';
import type { Title } from '@/lib/types';
import { LanguageBadge, Poster, ProviderBadges } from './Bits';
import { formatCount, formatSeasons, formatTitleRuntime } from '@/lib/utils/format';

/** Compact row used by Later, Watched and Search. Expands in place. */
export function TitleRow({
  title,
  meta,
  actions,
}: {
  title: Title;
  meta?: string;
  actions?: { label: string; onClick: () => void; primary?: boolean }[];
}) {
  const [open, setOpen] = useState(false);

  const facts = [
    title.type === 'movie' ? 'Film' : 'Series',
    title.releaseYear != null ? String(title.releaseYear) : null,
    formatTitleRuntime(title),
    formatSeasons(title),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="card mb-3.5">
      <div className="flex gap-3.5 p-3.5">
        <div className="h-[104px] w-[70px] shrink-0 overflow-hidden rounded-lg bg-surface-2">
          <Poster title={title} showHint={false} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[17px] font-semibold leading-tight">{title.title}</h3>
          <p className="mt-0.5 text-[13.5px] text-ink-3">{facts}</p>
          {title.ratings.imdbRating != null ? (
            <p className="mt-1 text-[14.5px] tabular-nums">
              ⭐ {title.ratings.imdbRating.toFixed(1)}
              {title.ratings.imdbVoteCount != null && (
                <span className="text-ink-3"> · {formatCount(title.ratings.imdbVoteCount)}</span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-[13.5px] italic text-ink-3">Rating not available</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <LanguageBadge title={title} />
            <ProviderBadges availability={title.availability} />
          </div>
          {meta && <p className="mt-1.5 text-[13px] text-ink-3">{meta}</p>}
        </div>
      </div>

      {title.reception.summary && (
        <div className="px-3.5">
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex min-h-[40px] w-full items-center text-left text-[14px] text-accent"
          >
            {open ? '▾' : '▸'}&nbsp;What people are saying
          </button>
          {open && (
            <p className="pb-2 text-[15px] leading-relaxed text-ink-2">
              {title.reception.summary}
            </p>
          )}
        </div>
      )}

      {actions && actions.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-line-2 p-3">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              className={`${a.primary ? 'tap-primary' : 'tap-quiet'} flex-1 whitespace-nowrap px-2 text-[14.5px]`}
              style={{ minHeight: 48 }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
