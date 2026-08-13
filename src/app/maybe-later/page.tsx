'use client';

import { useStore, useTitlesByAction } from '@/lib/store/AppStore';
import { TitleRow } from '@/components/TitleRow';
import { EmptyState, Loading } from '@/components/Bits';
import { MAYBE_LATER_COOLDOWN_DAYS } from '@/lib/engine/filter';

/**
 * Later — a holding pen, not a watchlist that grows forever.
 *
 * Each row says exactly when it becomes eligible again, so "later" means
 * something concrete rather than quietly disappearing.
 */
export default function LaterPage() {
  const { ready, recordAction, removeAction } = useStore();
  const items = useTitlesByAction('MAYBE_LATER');

  if (!ready) {
    return (
      <main className="shell pt-16">
        <Loading headline="Loading…" />
      </main>
    );
  }

  const now = Date.now();

  return (
    <main className="shell pt-8">
      <header className="mb-5">
        <h1 className="font-display text-[28px] font-semibold">Later</h1>
        <p className="mt-1.5 text-[16px] leading-relaxed text-ink-2">
          Set aside for now. Each becomes eligible again after{' '}
          {MAYBE_LATER_COOLDOWN_DAYS} days, then gets mixed back in.
        </p>
      </header>

      {items.length === 0 ? (
        <EmptyState
          icon="🕐"
          title="Nothing set aside"
          body="When something looks interesting but not for tonight, tap Later and it will wait here."
        />
      ) : (
        <div>
          {items.map(({ title, at }) => {
            const waited = (now - new Date(at).getTime()) / 86_400_000;
            const left = Math.max(0, Math.ceil(MAYBE_LATER_COOLDOWN_DAYS - waited));
            return (
              <TitleRow
                key={title.id}
                title={title}
                meta={
                  left > 0
                    ? `Back in the mix in ${left} day${left === 1 ? '' : 's'}`
                    : 'Eligible again — it may turn up in tonight’s picks'
                }
                actions={[
                  { label: '▶ Watch', primary: true, onClick: () => recordAction(title, 'WATCH_TODAY') },
                  { label: '✓ Seen it', onClick: () => recordAction(title, 'SEEN_IT') },
                  { label: '✕ Remove', onClick: () => removeAction(title.id) },
                ]}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
