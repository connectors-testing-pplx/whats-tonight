'use client';

import { useState } from 'react';
import {
  ERA_LABELS,
  INDUSTRY_LABELS,
  LANGUAGE_PREF_LABELS,
  RUNTIME_BANDS,
  type Era,
  type Industry,
  type LanguagePreference,
  type Mood,
  type Provider,
  type RuntimeBand,
  type SessionRequest,
  type TitleType,
} from '@/lib/types';

/**
 * Screen one: the question, and only the question.
 *
 * Eight tiles, each with its own colour identity so the grid reads as eight
 * distinct doors rather than eight identical boxes. Bollywood is the eighth —
 * not a mood exactly, but the thing Papa is most likely to want by name, and
 * it makes the grid even.
 *
 * Everything else is behind More filters. The homepage asks one question.
 */

interface Tile {
  id: Mood | 'bollywood';
  emoji: string;
  name: string;
  hint: string;
  tint: string;
  chip: string;
  /** Bollywood is an industry request, not a mood. */
  request: Partial<SessionRequest>;
}

const TILES: Tile[] = [
  { id: 'action', emoji: '🔥', name: 'Action', hint: 'Fast, loud, gripping', tint: 'rgba(228,106,58,.13)', chip: '#FCE8DD', request: { mood: 'action' } },
  { id: 'mystery', emoji: '🕵️', name: 'Mystery', hint: 'Twists and puzzles', tint: 'rgba(63,90,150,.13)', chip: '#E2E8F5', request: { mood: 'mystery' } },
  { id: 'family', emoji: '❤️', name: 'Family', hint: 'Watch with everyone', tint: 'rgba(206,84,102,.13)', chip: '#FBE4E8', request: { mood: 'family' } },
  { id: 'light', emoji: '😂', name: 'Light & Fun', hint: 'Nothing heavy', tint: 'rgba(217,163,32,.15)', chip: '#FBF0D6', request: { mood: 'light' } },
  { id: 'romance', emoji: '💕', name: 'Romance', hint: 'Love stories', tint: 'rgba(203,90,152,.13)', chip: '#FAE3F0', request: { mood: 'romance' } },
  { id: 'story', emoji: '🧠', name: 'Great Story', hint: 'Something meaningful', tint: 'rgba(38,138,124,.13)', chip: '#DDF0EC', request: { mood: 'story' } },
  { id: 'dark', emoji: '😱', name: 'Suspense', hint: 'Dark and intense', tint: 'rgba(78,84,102,.14)', chip: '#E5E7EE', request: { mood: 'dark' } },
  { id: 'bollywood', emoji: '🎞', name: 'Bollywood', hint: 'Hindi cinema, any era', tint: 'rgba(198,132,26,.15)', chip: '#FAEDD5', request: { industries: ['bollywood'] } },
];

export function MoodGrid({ onPick }: { onPick: (request: Partial<SessionRequest>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {TILES.map((tile) => (
        <button
          key={tile.id}
          onClick={() => onPick({ ...tile.request })}
          className="relative flex min-h-[96px] flex-col items-start gap-2 overflow-hidden
                     rounded-card border border-line bg-surface p-4 text-left shadow-soft
                     transition-transform duration-150 active:scale-[0.97]"
        >
          <span
            className="pointer-events-none absolute inset-0"
            style={{ background: `linear-gradient(150deg, ${tile.tint} 0%, rgba(255,255,255,0) 72%)` }}
            aria-hidden
          />
          <span
            className="relative z-10 flex h-[42px] w-[42px] items-center justify-center rounded-[13px] text-[21px] leading-none"
            style={{ background: tile.chip, boxShadow: 'inset 0 0 0 1px rgba(22,24,29,.05)' }}
            aria-hidden
          >
            {tile.emoji}
          </span>
          <span className="relative z-10 text-[16.5px] font-semibold leading-tight tracking-tight">
            {tile.name}
          </span>
          <span className="relative z-10 text-[12.5px] leading-snug text-ink-3">{tile.hint}</span>
        </button>
      ))}

      <button
        onClick={() => onPick({ mood: 'surprise' })}
        className="relative col-span-2 flex min-h-[74px] items-center gap-3 overflow-hidden
                   rounded-card border border-line bg-surface px-4 text-left shadow-soft
                   transition-transform duration-150 active:scale-[0.98]"
      >
        <span
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(150deg, rgba(120,120,130,.10) 0%, rgba(255,255,255,0) 72%)' }}
          aria-hidden
        />
        <span
          className="relative z-10 flex h-[42px] w-[42px] items-center justify-center rounded-[13px] text-[21px]"
          style={{ background: '#ECEAE5', boxShadow: 'inset 0 0 0 1px rgba(22,24,29,.05)' }}
          aria-hidden
        >
          🎲
        </span>
        <span className="relative z-10 text-[16px] font-semibold tracking-tight">
          Mix everything — surprise me
        </span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// More filters
// ---------------------------------------------------------------------------

const GENRES = ['Action', 'Thriller', 'Mystery', 'Comedy', 'Family', 'Drama', 'Romance', 'Crime', 'Adventure', 'Horror', 'Biography', 'Science Fiction'];
const ERAS: Era[] = ['new', '2020s', '2010s', '2000s', '1990s', '1980s', 'classic'];
const INDUSTRIES: Industry[] = ['bollywood', 'hollywood', 'south-indian', 'international'];
const LANGUAGES: LanguagePreference[] = ['hindi-any', 'hindi-only', 'include-english', 'any'];
const FORMATS: { id: TitleType; label: string }[] = [
  { id: 'movie', label: 'Movies' },
  { id: 'series', label: 'Series' },
  { id: 'limited-series', label: 'Limited series' },
];
const PROVIDERS: { id: Provider; label: string }[] = [
  { id: 'netflix', label: 'Netflix' },
  { id: 'prime', label: 'Prime Video' },
  { id: 'jiohotstar', label: 'JioHotstar' },
];

export interface FilterState {
  genres: string[];
  eras: Era[];
  industries: Industry[];
  languagePreference: LanguagePreference;
  runtime: RuntimeBand;
  formats: TitleType[];
  providers: Provider[];
}

export const EMPTY_FILTERS: FilterState = {
  genres: [],
  eras: [],
  industries: [],
  languagePreference: 'hindi-any',
  runtime: 'any',
  formats: [],
  providers: [],
};

export function countFilters(f: FilterState): number {
  return (
    f.genres.length +
    f.eras.length +
    f.industries.length +
    f.formats.length +
    f.providers.length +
    (f.languagePreference !== 'hindi-any' ? 1 : 0) +
    (f.runtime !== 'any' ? 1 : 0)
  );
}

export function FilterPanel({
  filters,
  onChange,
  onApply,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onApply: () => void;
}) {
  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <div className="card mt-2.5 px-4 pb-4 pt-0.5">
      <Group label="Genre">
        {GENRES.map((g) => (
          <Chip
            key={g}
            on={filters.genres.includes(g)}
            onClick={() => onChange({ ...filters, genres: toggle(filters.genres, g) })}
          >
            {g}
          </Chip>
        ))}
      </Group>

      <Group label="Era">
        {ERAS.map((e) => (
          <Chip
            key={e}
            on={filters.eras.includes(e)}
            onClick={() => onChange({ ...filters, eras: toggle(filters.eras, e) })}
          >
            {ERA_LABELS[e]}
          </Chip>
        ))}
      </Group>

      <Group label="Cinema">
        {INDUSTRIES.map((i) => (
          <Chip
            key={i}
            on={filters.industries.includes(i)}
            onClick={() => onChange({ ...filters, industries: toggle(filters.industries, i) })}
          >
            {INDUSTRY_LABELS[i]}
          </Chip>
        ))}
      </Group>

      <Group label="Language">
        {LANGUAGES.map((l) => (
          <Chip
            key={l}
            on={filters.languagePreference === l}
            onClick={() => onChange({ ...filters, languagePreference: l })}
          >
            {LANGUAGE_PREF_LABELS[l]}
          </Chip>
        ))}
      </Group>

      <Group label="Movie or series">
        {FORMATS.map((f) => (
          <Chip
            key={f.id}
            on={filters.formats.includes(f.id)}
            onClick={() => onChange({ ...filters, formats: toggle(filters.formats, f.id) })}
          >
            {f.label}
          </Chip>
        ))}
      </Group>

      <Group label="Length">
        {RUNTIME_BANDS.map((b) => (
          <Chip
            key={b.id}
            on={filters.runtime === b.id}
            onClick={() => onChange({ ...filters, runtime: b.id })}
          >
            {b.label}
          </Chip>
        ))}
      </Group>

      <Group label="Platform">
        {PROVIDERS.map((p) => (
          <Chip
            key={p.id}
            on={filters.providers.includes(p.id)}
            onClick={() => onChange({ ...filters, providers: toggle(filters.providers, p.id) })}
          >
            {p.label}
          </Chip>
        ))}
      </Group>

      <div className="mt-5 flex gap-2.5">
        <button
          onClick={() => onChange(EMPTY_FILTERS)}
          className="tap-quiet flex-1 text-[15px]"
          style={{ minHeight: 52 }}
        >
          Clear
        </button>
        <button
          onClick={onApply}
          className="tap-primary flex-1 text-[15px]"
          style={{ minHeight: 52 }}
        >
          Show me picks
        </button>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="rule-heading mb-2.5">{label}</h3>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button className="chip" aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

export { TILES as MOOD_TILES };
