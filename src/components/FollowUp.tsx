'use client';

import { useMemo } from 'react';
import { FOLLOW_UP_OPTIONS, type AppState, type Title, type UserActionType } from '@/lib/types';

/**
 * "You picked this last time — did you watch it?"
 *
 * This is the single most valuable question the app can ask, and it was
 * missing.
 *
 * Choosing "Watch this tonight" only tells us he liked the *pitch* — the
 * poster, the rating, the two-line summary. Whether he actually enjoyed the
 * film is a completely different question, and it's the one that should shape
 * what he sees next. A recommender that never closes this loop is learning
 * from trailers, not from films.
 *
 * So: one card, at the top of the next visit, four large buttons, one tap.
 * It appears once per title and never nags — if he ignores it, the pick simply
 * stays as it was.
 */

/** A pick made at least this long ago is worth asking about. */
const ASK_AFTER_HOURS = 10;

export function pendingFollowUp(state: AppState): Title | null {
  const now = Date.now();

  // Latest action per title, so a title he later marked some other way is out.
  const latest = new Map<string, { action: UserActionType; timestamp: string }>();
  for (const a of [...state.actions].sort(
    (x, y) => new Date(x.timestamp).getTime() - new Date(y.timestamp).getTime()
  )) {
    latest.set(a.titleId, { action: a.action, timestamp: a.timestamp });
  }

  for (const [titleId, entry] of latest) {
    if (entry.action !== 'WATCH_TODAY') continue;
    const hours = (now - new Date(entry.timestamp).getTime()) / 3_600_000;
    if (hours < ASK_AFTER_HOURS) continue;
    const title = state.titleCache[titleId];
    if (title) return title;
  }
  return null;
}

export function FollowUpCard({
  title,
  onAnswer,
}: {
  title: Title;
  onAnswer: (action: UserActionType) => void;
}) {
  const when = useMemo(() => 'last time', []);

  return (
    <section className="card mb-5 animate-rise p-4">
      <p className="label">Quick question</p>
      <h2 className="mt-1.5 font-display text-[20px] font-semibold leading-tight">
        You picked <span className="text-accent">{title.title}</span> {when}. How was it?
      </h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-3">
        One tap. It&apos;s the most useful thing you can tell me.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {FOLLOW_UP_OPTIONS.map((option) => (
          <button
            key={option.action}
            onClick={() => onAnswer(option.action)}
            className="tap-quiet flex-col gap-1 px-2 text-[14.5px]"
            style={{ minHeight: 64 }}
          >
            <span className="text-[20px] leading-none" aria-hidden>
              {option.emoji}
            </span>
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
