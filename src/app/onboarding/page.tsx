'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store/AppStore';
import { Poster, Loading } from '@/components/Bits';
import { PROVIDER_LABELS, type Provider, type Title } from '@/lib/types';
import { formatCount } from '@/lib/utils/format';

/**
 * Onboarding. Two steps, and it must stay two steps.
 *
 * Step 2 matters enormously for Papa specifically: he has already worked
 * through most of what is popular, so seeding the watched list is the single
 * highest-value thing the app can do in its first minute. A grid of posters he
 * can tap through fast beats a search box he would have to think about.
 *
 * There is a skip on every screen.
 */
const PROVIDERS: { id: Provider; blurb: string }[] = [
  { id: 'netflix', blurb: 'Originals, international drama, big series' },
  { id: 'prime', blurb: 'Strong Indian catalogue and older films' },
  { id: 'jiohotstar', blurb: 'HBO, Disney, Star and live sport' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { state, ready, setProviders, completeOnboarding, recordAction } = useStore();

  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<Provider[]>(state.preferences.providers);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [popular, setPopular] = useState<Title[] | null>(null);

  useEffect(() => {
    if (ready && state.preferences.onboarded) router.replace('/');
  }, [ready, state.preferences.onboarded, router]);

  useEffect(() => {
    if (step !== 2 || popular) return;
    let cancelled = false;
    fetch('/api/popular')
      .then((r) => r.json())
      .then((json: { results: Title[] }) => {
        if (!cancelled) setPopular(json.results ?? []);
      })
      .catch(() => {
        if (!cancelled) setPopular([]);
      });
    return () => {
      cancelled = true;
    };
  }, [step, popular]);

  const finish = () => {
    setProviders(selected.length ? selected : (['netflix', 'prime', 'jiohotstar'] as Provider[]));
    if (popular) {
      for (const title of popular) if (seen.has(title.id)) recordAction(title, 'SEEN_IT');
    }
    completeOnboarding();
    router.replace('/');
  };

  if (!ready) {
    return (
      <main className="shell pt-16">
        <Loading headline="Loading…" />
      </main>
    );
  }

  return (
    <main className="shell min-h-dvh pb-12 pt-10 safe-top">
      <div className="mb-8 flex gap-2">
        {[1, 2].map((n) => (
          <div
            key={n}
            className={`h-1 flex-1 rounded-full ${n <= step ? 'bg-accent' : 'bg-line'}`}
          />
        ))}
      </div>

      {step === 1 && (
        <section>
          <p className="label">Step 1 of 2</p>
          <h1 className="mt-2 font-display text-[28px] font-semibold leading-tight">
            Which platforms do you have?
          </h1>
          <p className="mt-2 text-[16px] leading-relaxed text-ink-2">
            Everything suggested will be watchable on one of these, tonight, in India.
          </p>

          <div className="mt-6 space-y-3">
            {PROVIDERS.map((p) => {
              const on = selected.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() =>
                    setSelected((prev) =>
                      prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                    )
                  }
                  aria-pressed={on}
                  className={`flex w-full items-center gap-3.5 rounded-card border p-4 text-left
                              transition-colors ${on ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
                  style={{ minHeight: 78 }}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 text-[15px] font-bold
                                ${on ? 'border-accent bg-accent text-white' : 'border-line text-transparent'}`}
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[17px] font-semibold">{PROVIDER_LABELS[p.id]}</span>
                    <span className="block text-[14px] text-ink-3">{p.blurb}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setStep(2)}
            className="tap-primary mt-7 w-full text-[17px]"
            style={{ minHeight: 58 }}
          >
            Continue
          </button>
        </section>
      )}

      {step === 2 && (
        <section>
          <p className="label">Step 2 of 2</p>
          <h1 className="mt-2 font-display text-[28px] font-semibold leading-tight">
            Anything here you&apos;ve already watched?
          </h1>
          <p className="mt-2 text-[16px] leading-relaxed text-ink-2">
            Tap the ones you&apos;ve seen — they&apos;ll never be suggested. You can skip
            this and mark things as you go.
          </p>

          {popular === null ? (
            <Loading headline="Loading titles…" />
          ) : (
            <div className="mt-6 grid grid-cols-3 gap-2.5">
              {popular.map((title) => {
                const on = seen.has(title.id);
                return (
                  <button
                    key={title.id}
                    onClick={() =>
                      setSeen((prev) => {
                        const next = new Set(prev);
                        if (next.has(title.id)) next.delete(title.id);
                        else next.add(title.id);
                        return next;
                      })
                    }
                    aria-pressed={on}
                    className="relative text-left transition-transform active:scale-[0.97]"
                  >
                    <div className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-surface-2">
                      <Poster title={title} showHint={false} />
                    </div>
                    <div
                      className={`pointer-events-none absolute inset-x-0 top-0 flex aspect-[2/3] items-center
                                  justify-center rounded-xl transition-opacity ${on ? 'opacity-100' : 'opacity-0'}`}
                      style={{ background: 'rgba(22,24,29,.66)' }}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-[20px] font-bold text-white">
                        ✓
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-tight text-ink-2">
                      {title.title}
                    </p>
                    {title.ratings.imdbRating != null && (
                      <p className="text-[11px] text-ink-3">
                        ⭐ {title.ratings.imdbRating.toFixed(1)}
                        {title.ratings.imdbVoteCount != null &&
                          ` · ${formatCount(title.ratings.imdbVoteCount)}`}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-7 space-y-2.5">
            <button
              onClick={finish}
              className="tap-primary w-full text-[17px]"
              style={{ minHeight: 58 }}
            >
              {seen.size > 0 ? `Done — ${seen.size} marked as seen` : 'Done'}
            </button>
            <button onClick={finish} className="tap-ghost w-full text-[15px]">
              Skip this step
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
