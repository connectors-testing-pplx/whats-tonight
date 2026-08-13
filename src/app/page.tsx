'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store/AppStore';
import {
  EMPTY_FILTERS,
  FilterPanel,
  MoodGrid,
  countFilters,
  type FilterState,
} from '@/components/MoodGrid';
import { RecommendationCard } from '@/components/RecommendationCard';
import { EmptyState, Loading, Toast } from '@/components/Bits';
import { Attribution } from '@/components/Attribution';
import { FollowUpCard, pendingFollowUp } from '@/components/FollowUp';
import { VoiceInput } from '@/components/VoiceInput';
import { TextSize } from '@/components/TextSize';
import type { SessionRequest, UserActionType } from '@/lib/types';
import { MOODS } from '@/lib/types';

/**
 * Tonight — the whole product in two screens.
 *
 *   1. What are you in the mood for?  (eight tiles, filters tucked away)
 *   2. Here's what I'd pick tonight.  (four to six cards)
 *
 * Nothing on screen one but the question. Nothing on screen two but the
 * answer. Seen it / Later / Not for me clear a card immediately; Watch today
 * keeps it, because that's the one he's about to go and act on.
 */

const CONFIRM: Partial<Record<UserActionType, string>> = {
  WATCH_TODAY: 'Enjoy it 🍿',
  MAYBE_LATER: 'Saved to Later',
  SEEN_IT: 'Marked as seen',
  NOT_INTERESTED: 'Removed — just this title',
};

const EXAMPLES = [
  'A 2000s Bollywood comedy',
  'Something like Drishyam',
  'Hollywood action in Hindi dubbed',
  'A mystery with a great ending',
  "Something good I probably haven't seen",
];

export default function TonightPage() {
  const router = useRouter();
  const {
    state, ready, request, picks, loading, error, dataMode, dismissed,
    run, regenerate, clearRequest, recordAction, removeAction, noteSearch,
  } = useStore();

  // "You picked X last time — how was it?" The strongest signal available,
  // and it costs him one tap. See FollowUp.tsx.
  const followUp = useMemo(() => (ready ? pendingFollowUp(state) : null), [ready, state]);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [today, setToday] = useState('');

  useEffect(() => {
    setToday(new Date().toLocaleDateString(undefined, { weekday: 'long' }));
  }, []);

  useEffect(() => {
    if (ready && !state.preferences.onboarded) router.replace('/onboarding');
  }, [ready, state.preferences.onboarded, router]);

  // Held in a ref so a rapid second tap replaces the timer rather than
  // stacking, and so it can be cleared on unmount.
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1900);
  };

  const start = (partial: Partial<SessionRequest>) => {
    setChosen(new Set());
    run({ ...partial, ...filtersToRequest(filters) });
  };

  const handleAction = (titleId: string, action: UserActionType) => {
    const rec = picks?.recommendations.find((r) => r.title.id === titleId);
    if (!rec) return;
    recordAction(rec.title, action);
    if (action === 'WATCH_TODAY') setChosen((prev) => new Set(prev).add(titleId));
    showToast(CONFIRM[action] ?? 'Saved');
  };

  if (!ready || !state.preferences.onboarded) {
    return (
      <main className="shell pt-16">
        <Loading headline="Getting things ready…" />
      </main>
    );
  }

  const visible = (picks?.recommendations ?? []).filter((r) => !dismissed.has(r.title.id));
  const onResults = Boolean(picks) || loading;
  const moodLabel = request.mood
    ? `${MOODS.find((m) => m.id === request.mood)?.emoji ?? ''} ${MOODS.find((m) => m.id === request.mood)?.label ?? ''}`
    : request.query
      ? `⌕ ${request.query}`
      : request.industries.length
        ? `🎞 ${request.industries[0]}`
        : '🎲 Mix everything';

  return (
    <>
      {/* ---------------------------------------------------------- masthead */}
      <header
        className="relative overflow-hidden px-5 pb-7 pt-5 safe-top"
        style={{
          background:
            'radial-gradient(120% 100% at 12% 0%, #FDF3E2 0%, rgba(253,243,226,0) 62%), radial-gradient(90% 80% at 100% 12%, #F6E7E0 0%, rgba(246,231,224,0) 60%), #F6F4F0',
        }}
      >
        <div className="mx-auto w-full max-w-phone">
          <div className="flex items-center justify-between pt-2">
            <span className="inline-flex items-baseline gap-2 font-display text-[16px] font-semibold text-ink-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-2" aria-hidden />
              What&apos;s Tonight?
            </span>
            {onResults ? (
              <button
                onClick={() => {
                  clearRequest();
                  setChosen(new Set());
                }}
                className="inline-flex h-10 items-center rounded-full border border-line bg-white/75 px-4 text-[14.5px] font-medium text-ink-2"
              >
                ‹ Change
              </button>
            ) : (
              <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                {today}
              </span>
            )}
          </div>

          {!onResults && (
            <div className="pt-6">
              <h1 className="font-display text-[38px] font-semibold leading-[1.08] tracking-tight">
                Hi Papa <span aria-hidden>👋</span>
              </h1>
              <div
                className="mt-4 h-[3px] w-[46px] rounded-full"
                style={{ background: 'linear-gradient(90deg,#C9761F,#C9971B)' }}
              />
              <p className="mt-4 text-[19px] font-medium leading-snug text-ink-2">
                What are you in the mood for tonight?
              </p>
            </div>
          )}
        </div>
      </header>

      <main className="shell">
        {/* ------------------------------------------------------- screen 1 */}
        {!onResults && (
          <section>
            {followUp && (
              <FollowUpCard
                title={followUp}
                onAnswer={(action) => {
                  recordAction(followUp, action);
                  showToast(
                    action === 'LOVED_IT'
                      ? 'Noted — more like that'
                      : action === 'DIDNT_FINISH'
                        ? 'Noted — fewer like that'
                        : action === 'DIDNT_WATCH'
                          ? 'Put back in the mix'
                          : 'Thanks'
                  );
                }}
              />
            )}

            <MoodGrid onPick={start} />

            <button
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              className="mt-3 flex min-h-[58px] w-full items-center justify-between rounded-card
                         border border-line bg-surface px-4 text-left shadow-soft"
            >
              <span>
                <span className="text-[16px] font-medium">
                  More filters
                  {countFilters(filters) > 0 && (
                    <span className="ml-2 inline-flex h-[21px] min-w-[21px] items-center justify-center rounded-full bg-accent px-1.5 text-[12px] font-bold text-white">
                      {countFilters(filters)}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[12.5px] text-ink-3">
                  Genre · Era · Cinema · Language · Length · Platform
                </span>
              </span>
              <span
                className={`text-[11px] text-ink-3 transition-transform duration-300 ${filtersOpen ? 'rotate-180' : ''}`}
                aria-hidden
              >
                ▼
              </span>
            </button>

            {filtersOpen && (
              <FilterPanel
                filters={filters}
                onChange={setFilters}
                onApply={() => start({})}
              />
            )}

            <div className="mt-3">
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-ink-3">
                  ⌕
                </span>
                <input
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  autoCorrect="off"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && query.trim()) {
                      noteSearch(query.trim());
                      start({ query: query.trim() });
                    }
                  }}
                  placeholder="Or just tell me what you want…"
                  aria-label="Describe what you want to watch"
                  className="field pl-11 pr-14 shadow-soft"
                />
                <VoiceInput
                  onResult={(text) => {
                    setQuery(text);
                    noteSearch(text);
                    start({ query: text });
                  }}
                />
              </div>
              <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto pb-1">
                {EXAMPLES.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      setQuery(e);
                      noteSearch(e);
                      start({ query: e });
                    }}
                    className="flex shrink-0 items-center whitespace-nowrap rounded-full bg-surface-2 px-4 text-[13.5px] text-ink-2"
                    style={{ minHeight: 44 }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-surface-2 px-4 py-3.5 text-[13px] leading-relaxed text-ink-3">
              <strong className="text-ink-2">Still learning.</strong> For the first few weeks
              it leans on ratings and reviews while it works out what you actually pick. The
              more you tap, the sharper it gets — and it will always keep a couple of
              unexpected things in the mix.
            </div>
          </section>
        )}

        {/* ------------------------------------------------------- screen 2 */}
        {onResults && (
          <section className="pt-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3.5 py-2 text-[14px] font-semibold text-accent">
              {moodLabel}
            </span>
            <h2 className="mt-3.5 font-display text-[27px] font-semibold leading-tight tracking-tight">
              Here&apos;s what I&apos;d pick tonight.
            </h2>
            {picks && !loading && (
              <p className="mt-1.5 text-[14.5px] text-ink-3">
                {visible.length} pick{visible.length === 1 ? '' : 's'} · Hindi first, English
                only where it earns it
              </p>
            )}

            {loading && <Loading />}

            {error && !loading && (
              <EmptyState
                icon="⚠️"
                title="Couldn't load your picks"
                body={error}
                action={
                  <button onClick={() => run(request)} className="tap-primary px-6">
                    Try again
                  </button>
                }
              />
            )}

            {!loading && !error && picks && visible.length === 0 && (
              <div className="py-10 text-center">
                <div className="text-[32px]" aria-hidden>
                  ✨
                </div>
                <p className="mt-3 font-display text-[22px] font-semibold">
                  That&apos;s tonight sorted.
                </p>
                <p className="mt-1.5 text-[15px] text-ink-2">
                  Anything you saved is waiting under Later.
                </p>
              </div>
            )}

            <div className="mt-4">
              {visible.map((rec, i) => (
                <RecommendationCard
                  key={rec.title.id}
                  recommendation={rec}
                  index={i}
                  chosen={chosen.has(rec.title.id)}
                  onAction={(action) => handleAction(rec.title.id, action)}
                  onUndo={() => {
                    removeAction(rec.title.id);
                    setChosen((prev) => {
                      const next = new Set(prev);
                      next.delete(rec.title.id);
                      return next;
                    });
                  }}
                  onFindSimilar={() => {
                    setChosen(new Set());
                    run({ ...request, similarToId: rec.title.id, mood: null });
                    showToast('Finding titles like this one…');
                  }}
                />
              ))}
            </div>

            {picks && !loading && (
              <>
                <button
                  onClick={() => {
                    setChosen(new Set());
                    regenerate();
                  }}
                  className="tap-quiet mt-1 w-full text-[16px] font-semibold"
                  style={{ minHeight: 60 }}
                >
                  🔄 Give me different picks
                </button>
                <button
                  onClick={() => {
                    setChosen(new Set());
                    run({ ...request, discoveryMode: true });
                  }}
                  className="tap-quiet mt-2.5 w-full text-[16px] font-semibold"
                  style={{ minHeight: 60 }}
                >
                  💎 Things you may have missed
                </button>
              </>
            )}

            {dataMode && !dataMode.live && (
              <div className="mt-5 rounded-xl bg-surface-2 px-4 py-3.5 text-[13px] leading-relaxed text-ink-3">
                <strong className="text-ink-2">Starter catalogue.</strong> Ratings are
                snapshots and availability is indicative. Add a TMDB key for live data.
              </div>
            )}
          </section>
        )}
            <TextSize />
        <Attribution />
      </main>

      <Toast message={toast} />
    </>
  );
}

function filtersToRequest(f: FilterState): Partial<SessionRequest> {
  return {
    genres: f.genres,
    eras: f.eras,
    industries: f.industries,
    languagePreference: f.languagePreference,
    runtime: f.runtime,
    formats: f.formats,
    providers: f.providers,
  };
}
