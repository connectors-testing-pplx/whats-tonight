'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store/AppStore';
import { Loading } from '@/components/Bits';
import { buildProfile } from '@/lib/engine/profile';
import { buildExclusionSets } from '@/lib/engine/filter';
import { setDiversity } from '@/lib/engine/diversify';
import type { ProviderHealth } from '@/lib/providers/types';

/**
 * Developer dashboard. Not linked from the user UI — type /admin to reach it.
 *
 * The most useful panel is the profile one: it shows exactly what the system
 * has and has not concluded, which is how you verify the cold-start rules are
 * actually holding rather than just being documented.
 */
interface StatusResponse {
  dataMode: string;
  region: string;
  live: boolean;
  active: {
    metadata: string;
    streaming: string;
    ratings: string[];
    reviews: string[];
    llm: boolean;
  };
  providers: ProviderHealth[];
  catalogue: Record<string, unknown>;
  engine: {
    rankComponents: { key: string; label: string; max: number }[];
    maybeLaterCooldownDays: number;
    shownCooldownDays: number;
    profile: Record<string, number>;
    interactionWeights: Record<string, number>;
  };
  checkedAt: string;
}

export default function AdminPage() {
  const { state, ready, picks, reset, importState } = useStore();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get('key');
    fetch(`/api/status${key ? `?key=${encodeURIComponent(key)}` : ''}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setStatus)
      .catch((e) => setStatusError(e.message));
  }, []);

  const sets = useMemo(() => buildExclusionSets(state), [state]);
  const profile = useMemo(
    () => buildProfile(state, new Map(Object.entries(state.titleCache))),
    [state]
  );
  const diversity = useMemo(
    () => (picks ? setDiversity(picks.recommendations.map((r) => r.title)) : null),
    [picks]
  );

  if (!ready) {
    return (
      <main className="shell pt-16">
        <Loading headline="Loading…" />
      </main>
    );
  }

  const exportState = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whats-tonight-state-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        importState(JSON.parse(text));
      } catch {
        alert('That file could not be parsed as saved state.');
      }
    });
  };

  return (
    <main className="shell py-8">
      <header className="mb-6">
        <p className="label">Developer view</p>
        <h1 className="mt-1 font-display text-[26px] font-semibold">System status</h1>
        <p className="mt-1 text-[14px] text-ink-3">Not linked from the app.</p>
      </header>

      {statusError && (
        <Panel title="Status endpoint">
          <p className="text-[15px] text-accent">Could not load /api/status — {statusError}</p>
        </Panel>
      )}

      {status && (
        <>
          <Panel title="Data sources">
            <Row label="Mode" value={status.dataMode} />
            <Row label="Live data" value={status.live ? 'Yes' : 'No — packaged catalogue'} />
            <Row label="Region" value={status.region} />
            <Row label="Metadata" value={status.active.metadata} />
            <Row label="Availability" value={status.active.streaming} />
            <Row label="Ratings" value={status.active.ratings.join(' → ')} />
            <Row label="Reception" value={status.active.reviews.join(' → ')} />
            <Row label="LLM" value={status.active.llm ? 'Configured' : 'Off (offline summariser)'} />
          </Panel>

          <Panel title="Provider health">
            <div className="space-y-3">
              {status.providers.map((p) => (
                <div key={p.id} className="rounded-xl bg-surface-2 p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        p.reachable === true
                          ? 'bg-hindi'
                          : p.reachable === false
                            ? 'bg-accent'
                            : 'bg-ink-3'
                      }`}
                    />
                    <span className="text-[15px] font-semibold">{p.label}</span>
                    <span className="ml-auto text-[13px] uppercase tracking-wide text-ink-3">
                      {p.kind}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{p.note}</p>
                  <p className="mt-1 font-mono text-[12px] text-ink-3">
                    configured: {String(p.configured)} · reachable: {String(p.reachable)}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Catalogue">
            {Object.entries(status.catalogue).map(([k, v]) => (
              <Row
                key={k}
                label={humanise(k)}
                value={typeof v === 'object' ? JSON.stringify(v) : String(v)}
              />
            ))}
          </Panel>
        </>
      )}

      <Panel title="User state">
        <Row label="Onboarded" value={String(state.preferences.onboarded)} />
        <Row label="Platforms" value={state.preferences.providers.join(', ') || 'none'} />
        <Row label="Total actions" value={String(state.actions.length)} />
        <Row label="Marked seen" value={String(sets.seen.size)} />
        <Row label="Not interested" value={String(sets.rejected.size)} />
        <Row label="Later" value={String(sets.maybeLater.size)} />
        <Row label="Chosen to watch" value={String(sets.watchToday.size)} />
        <Row label="History entries" value={String(state.history.length)} />
        <Row label="Cached titles" value={String(Object.keys(state.titleCache).length)} />
        <Row label="Searches recorded" value={String(state.searches.length)} />
      </Panel>

      <Panel title="Behavioural profile">
        <Row label="Stage" value={profile.stage} />
        <Row label="Confidence" value={`${(profile.confidence * 100).toFixed(0)}%`} />
        <Row label="Opinionated interactions" value={String(profile.interactions)} />
        <Row label="Vector length" value={String(profile.vector.length)} />
        <div className="mt-3 space-y-1">
          {profile.notes.map((n, i) => (
            <p key={i} className="text-[13px] leading-relaxed text-ink-2">
              · {n}
            </p>
          ))}
        </div>
        {profile.insights.length > 0 && (
          <div className="mt-3">
            <p className="label mb-1">What it has learned</p>
            {profile.insights.map((insight) => (
              <p key={insight.key} className="font-mono text-[12px] text-ink-2">
                · {insight.text}
              </p>
            ))}
          </div>
        )}
        {status && (
          <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
            Thresholds — learning floor: {status.engine.profile.LEARNING_FLOOR} interactions ·
            confident at: {status.engine.profile.CONFIDENT_AT} · max confidence:{' '}
            {(status.engine.profile.MAX_CONFIDENCE * 100).toFixed(0)}% · half-life:{' '}
            {status.engine.profile.HALF_LIFE_DAYS} days
          </p>
        )}
      </Panel>

      <Panel title="Last generation">
        {picks ? (
          <>
            <Row label="Date" value={picks.date} />
            <Row label="Revision" value={String(picks.revision)} />
            <Row label="Candidate pool" value={String(picks.poolSize)} />
            <Row label="Picks returned" value={String(picks.recommendations.length)} />
            <Row
              label="Set diversity"
              value={diversity != null ? `${(diversity * 100).toFixed(0)}%` : '—'}
            />
            <Row label="Profile confidence" value={`${(picks.profileConfidence * 100).toFixed(0)}%`} />
            <div className="mt-3 space-y-2">
              {picks.recommendations.map((r) => (
                <div key={r.title.id} className="rounded-xl bg-surface-2 p-3">
                  <p className="text-[15px] font-semibold">
                    {r.slot} · {r.title.title} <span className="text-ink-3">({r.score})</span>
                  </p>
                  <p className="mt-1 font-mono text-[12px] leading-relaxed text-ink-2">
                    {Object.entries(r.scoreBreakdown).map(([k, v]) => `${k}=${v}`).join('  ')}
                  </p>
                  <p className="mt-1 font-mono text-[12px] text-ink-3">
                    {r.title.viewingLanguage} · {r.title.industry} · {r.title.era} ·{' '}
                    {r.languageException ? 'LANGUAGE EXCEPTION' : 'no exception'}
                  </p>
                </div>
              ))}
            </div>
            {picks.notes.length > 0 && (
              <div className="mt-3">
                <p className="label mb-1">Pipeline notes</p>
                {picks.notes.map((n, i) => (
                  <p key={i} className="font-mono text-[12px] text-ink-2">
                    · {n}
                  </p>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-[15px] text-ink-3">No picks generated yet.</p>
        )}
      </Panel>

      <Panel title="Data management">
        <div className="flex flex-wrap gap-2">
          <button onClick={exportState} className="tap-quiet flex-1 px-4 text-[15px]">
            Export state
          </button>
          <label className="tap-quiet flex-1 cursor-pointer px-4 text-[15px]">
            Import state
            <input type="file" accept="application/json" onChange={handleImport} className="hidden" />
          </label>
        </div>
        <button
          onClick={() => {
            if (confirm('Erase all preferences, actions and history on this device?')) reset();
          }}
          className="tap-quiet mt-2 w-full px-4 text-[15px] text-accent"
        >
          Reset everything
        </button>
      </Panel>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card mb-4 p-4">
      <h2 className="mb-3 text-[16px] font-semibold text-accent">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-[3px]">
      <span className="shrink-0 text-[14px] text-ink-3">{label}</span>
      <span className="break-all text-right font-mono text-[12.5px]">{value}</span>
    </div>
  );
}

function humanise(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}
