'use client';

import { TEXT_SCALES } from '@/lib/types';
import { useStore } from '@/lib/store/AppStore';

/**
 * Text size control.
 *
 * The app already uses 16px as its floor, which is fine for most people and
 * not necessarily fine at sixty. Rather than guess, let him set it — three
 * options, applied to the root font size so everything scales together, and
 * remembered.
 *
 * Deliberately at the very bottom of the first screen: it's a set-once
 * control, not something he needs in his way every evening.
 */
export function TextSize() {
  const { state, setTextScale } = useStore();
  const current = state.preferences.textScale || 1;

  return (
    <div className="mt-6 flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3">
      <span className="text-[14px] text-ink-2">Text size</span>
      <div className="ml-auto flex gap-1.5">
        {TEXT_SCALES.map((scale) => (
          <button
            key={scale.value}
            onClick={() => setTextScale(scale.value)}
            aria-pressed={current === scale.value}
            className={`rounded-lg border px-3 transition-colors ${
              current === scale.value
                ? 'border-accent bg-accent-soft font-semibold text-accent'
                : 'border-line text-ink-2'
            }`}
            style={{ minHeight: 44, fontSize: `${13 + scale.value * 2}px` }}
          >
            A
            <span className="sr-only">{scale.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
