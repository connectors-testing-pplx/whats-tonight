'use client';

import { useEffect } from 'react';
import type { Recommendation } from '@/lib/types';
import { RANK_COMPONENTS } from '@/lib/engine/rank';

/**
 * "Why this?" — the receipts.
 *
 * A recommendation you can't interrogate is just an assertion. Every fact that
 * fed the pick is listed, with the numeric breakdown underneath, so there is no
 * hidden step between the data and the suggestion.
 */
export function WhyThisSheet({
  recommendation,
  onClose,
}: {
  recommendation: Recommendation;
  onClose: () => void;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const { title, reasons, scoreBreakdown, score } = recommendation;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Why we picked ${title.title}`}
    >
      <button
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative max-h-[86dvh] w-full max-w-phone overflow-y-auto rounded-t-[26px] border-t border-line bg-surface pb-8 safe-bottom">
        <div className="sticky top-0 z-10 rounded-t-[26px] bg-surface/95 px-5 pb-3 pt-3 backdrop-blur">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink-3/30" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label">Why this?</p>
              <h2 className="mt-1 font-display text-[21px] font-semibold leading-tight">
                {title.title}
              </h2>
            </div>
            <button onClick={onClose} className="tap-quiet px-4 text-[15px]">
              Close
            </button>
          </div>
        </div>

        <div className="px-5">
          <ul className="mt-2 space-y-2.5">
            {reasons.map((reason, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
                <span className="w-[22px] shrink-0 pt-px" aria-hidden>
                  {reason.icon}
                </span>
                <span>{reason.text}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6">
            <p className="label mb-2">Score breakdown</p>
            <div className="card p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-[15px] text-ink-2">Total</span>
                <span className="text-[19px] font-semibold tabular-nums">{score.toFixed(1)}</span>
              </div>
              <div className="space-y-2.5">
                {RANK_COMPONENTS.filter((c) => scoreBreakdown[c.key] != null).map((component) => {
                  const value = scoreBreakdown[component.key] ?? 0;
                  const pct = component.max
                    ? Math.max(0, Math.min(100, (value / component.max) * 100))
                    : 0;
                  return (
                    <div key={component.key}>
                      <div className="mb-1 flex items-baseline justify-between gap-3">
                        <span className="text-[14px] text-ink-2">{component.label}</span>
                        <span className="text-[14px] tabular-nums text-ink-2">
                          {value.toFixed(1)}
                          {component.max > 0 && <span className="text-ink-3">/{component.max}</span>}
                        </span>
                      </div>
                      {component.max > 0 && (
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-accent-2/75"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {title.reception.evidenceSources.length > 0 && (
            <p className="mt-5 text-[13px] leading-relaxed text-ink-3">
              Reception summary derived from: {title.reception.evidenceSources.join(', ')}
              {title.reception.evidenceCount != null &&
                ` (${title.reception.evidenceCount} reviews analysed)`}
              {title.reception.llmGenerated
                ? '. Phrased by a language model from those extracted themes — the model was not asked what people think, only to summarise what they wrote.'
                : '.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
