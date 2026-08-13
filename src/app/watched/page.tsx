'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore, useTitlesByAction } from '@/lib/store/AppStore';
import { TitleRow } from '@/components/TitleRow';
import { EmptyState, Loading } from '@/components/Bits';

type SortKey = 'recent' | 'title' | 'rating' | 'year';

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'recent', label: 'Recently marked' },
  { id: 'title', label: 'A–Z' },
  { id: 'rating', label: 'Rating' },
  { id: 'year', label: 'Year' },
];

/**
 * Watched — the exclusion list, made browsable.
 *
 * Papa has seen an enormous amount, so this page grows large and gets search
 * and sort. Nothing more elaborate: it is a reference, not a destination.
 */
export default function WatchedPage() {
  const { ready, removeAction } = useStore();
  const watched = useTitlesByAction('SEEN_IT');
  const chosen = useTitlesByAction('WATCH_TODAY');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');

  const all = useMemo(() => [...watched, ...chosen], [watched, chosen]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? all.filter(
          ({ title }) =>
            title.title.toLowerCase().includes(q) ||
            title.genres.some((g) => g.toLowerCase().includes(q)) ||
            title.cast.some((c) => c.toLowerCase().includes(q))
        )
      : all;

    const sorted = [...filtered];
    if (sort === 'title') sorted.sort((a, b) => a.title.title.localeCompare(b.title.title));
    if (sort === 'rating')
      sorted.sort((a, b) => (b.title.ratings.imdbRating ?? 0) - (a.title.ratings.imdbRating ?? 0));
    if (sort === 'year')
      sorted.sort((a, b) => (b.title.releaseYear ?? 0) - (a.title.releaseYear ?? 0));
    return sorted;
  }, [all, query, sort]);

  if (!ready) {
    return (
      <main className="shell pt-16">
        <Loading headline="Loading…" />
      </main>
    );
  }

  return (
    <main className="shell pt-8">
      <header className="mb-5">
        <h1 className="font-display text-[28px] font-semibold">Watched</h1>
        <p className="mt-1.5 text-[16px] leading-relaxed text-ink-2">
          {all.length === 0
            ? 'Nothing marked yet.'
            : `${all.length} title${all.length === 1 ? '' : 's'}. None of these will be suggested again.`}
        </p>
      </header>

      {all.length === 0 ? (
        <EmptyState
          icon="✓"
          title="No watched titles yet"
          body="Mark things as Seen it from tonight’s picks, or search for anything you’ve already watched and mark it here."
          action={
            <Link href="/search" className="tap-primary px-6">
              Search and mark titles
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-4 space-y-3">
            <input
              type="search"
              inputMode="search"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your watched list"
              aria-label="Search watched titles"
              className="field"
            />
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSort(s.id)}
                  aria-pressed={sort === s.id}
                  className="chip shrink-0"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="py-10 text-center text-[16px] text-ink-3">
              Nothing matches “{query}”.
            </p>
          ) : (
            visible.map(({ title, at }) => (
              <TitleRow
                key={title.id}
                title={title}
                meta={`Marked ${new Date(at).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}`}
                actions={[{ label: '↩ I haven’t seen this', onClick: () => removeAction(title.id) }]}
              />
            ))
          )}
        </>
      )}
    </main>
  );
}
