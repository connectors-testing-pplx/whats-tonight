'use client';

import { useEffect, useRef, useState } from 'react';
import { useActionMap, useStore } from '@/lib/store/AppStore';
import { TitleRow } from '@/components/TitleRow';
import { EmptyState, Loading } from '@/components/Bits';
import type { Title } from '@/lib/types';

/**
 * Search.
 *
 * Its main job is bulk-marking things Papa watched before this site existed,
 * so "Seen it" is the primary action on every row and the result stays visible
 * with a confirmation rather than vanishing — marking ten in a row should feel
 * like progress, not whack-a-mole.
 */
export default function SearchPage() {
  const { ready, recordAction, removeAction, noteSearch } = useStore();
  const actionMap = useActionMap();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Title[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setError(null);
      return;
    }
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      noteSearch(q);
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((json: { results: Title[]; error?: string }) => {
          setResults(json.results ?? []);
          if (json.error) setError(json.error);
        })
        .catch((err) => {
          if (err?.name !== 'AbortError') setError('Search failed. Try again.');
        })
        .finally(() => setLoading(false));
    }, 320);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (!ready) {
    return (
      <main className="shell pt-16">
        <Loading headline="Loading…" />
      </main>
    );
  }

  return (
    <main className="shell pt-8">
      <header className="mb-4">
        <h1 className="font-display text-[28px] font-semibold">Search</h1>
        <p className="mt-1.5 text-[16px] leading-relaxed text-ink-2">
          Look up a film, series, actor or genre — and mark anything you’ve already
          watched.
        </p>
      </header>

      <div className="sticky top-0 z-20 -mx-5 bg-canvas/95 px-5 pb-3 pt-1 backdrop-blur">
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try “Tabu”, “thriller”, or a title"
          aria-label="Search titles, actors and genres"
          className="field"
        />
      </div>

      {loading && <Loading headline="Searching…" />}
      {error && !loading && <p className="py-6 text-center text-[15px] text-accent">{error}</p>}

      {!loading && results === null && (
        <EmptyState
          icon="🔎"
          title="What are you looking for?"
          body="Search by title, by an actor’s name, or just a genre. Marking things as seen here is the quickest way to keep them out of your evening picks."
        />
      )}

      {!loading && results !== null && results.length === 0 && (
        <p className="py-10 text-center text-[16px] text-ink-3">Nothing found for “{query}”.</p>
      )}

      {results !== null &&
        results.map((title) => {
          const taken = actionMap.get(title.id);
          return (
            <TitleRow
              key={title.id}
              title={title}
              meta={
                taken === 'SEEN_IT'
                  ? '✓ Marked as seen — won’t be suggested'
                  : taken === 'NOT_INTERESTED'
                    ? '✕ Ruled out — won’t be suggested'
                    : taken === 'MAYBE_LATER'
                      ? '🕐 Saved to Later'
                      : undefined
              }
              actions={
                taken
                  ? [{ label: '↩ Undo', onClick: () => removeAction(title.id) }]
                  : [
                      { label: '✓ Seen it', primary: true, onClick: () => recordAction(title, 'SEEN_IT') },
                      { label: '🕐 Later', onClick: () => recordAction(title, 'MAYBE_LATER') },
                      { label: '✕ Not for me', onClick: () => recordAction(title, 'NOT_INTERESTED') },
                    ]
              }
            />
          );
        })}
    </main>
  );
}
