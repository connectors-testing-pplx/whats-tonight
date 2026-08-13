import {
  ATTRIBUTE_KEYS,
  type ContentAttributes,
  type Title,
} from '@/lib/types';

/**
 * ===========================================================================
 * CONTENT VECTORS
 * ===========================================================================
 *
 * Every title becomes a vector so that "similar" can mean something richer
 * than "same genre tag".
 *
 * The problem this solves: Andhadhun and Prisoners are both filed under
 * Thriller. One is playful, intricate and blackly funny; the other is bleak,
 * slow and gruelling. A genre-matching recommender treats them as
 * interchangeable. It is wrong, and the user notices immediately.
 *
 * So the vector is dominated by the *attribute* block — how heavy, how fast,
 * how twisty, how funny, how grounded — with genre, era, industry, language
 * and format as secondary blocks. Two titles are similar when they feel
 * similar to watch, not when a database put them in the same bucket.
 *
 * Deliberately NOT a learned embedding from an ML model. These axes are
 * hand-readable, which means you can open /admin, look at what the profile has
 * learned, and tell whether it is sensible. A 384-dimension embedding would be
 * more expressive and completely unauditable — a bad trade for a system that
 * has to earn one specific person's trust.
 *
 * If you later want real embeddings, `embedTitle` is the single seam: return a
 * longer vector from an embedding API and everything downstream still works.
 */

// The genre vocabulary the vector spans. Anything outside it is ignored
// rather than silently colliding into a wrong dimension.
const GENRE_AXES = [
  'Action', 'Adventure', 'Comedy', 'Crime', 'Drama', 'Family', 'Fantasy',
  'History', 'Horror', 'Music', 'Mystery', 'Romance', 'Science Fiction',
  'Sport', 'Thriller', 'War', 'Western', 'Biography', 'Dark Comedy',
  'Period', 'Slice of Life', 'Anthology', 'Folklore', 'Procedural',
];

const INDUSTRY_AXES = ['bollywood', 'hollywood', 'south-indian', 'international', 'other'];

const LANGUAGE_AXES = ['hindi-native', 'hindi-available', 'english-only'];

const FORMAT_AXES = ['movie', 'series'];

/** Relative pull of each block on the similarity calculation. */
const BLOCK_WEIGHTS = {
  attributes: 1.0,
  genre: 0.55,
  industry: 0.3,
  era: 0.25,
  language: 0.3,
  format: 0.3,
  runtime: 0.15,
};

export interface VectorMeta {
  /** Index ranges per block, for the admin view. */
  blocks: { name: string; start: number; end: number }[];
  length: number;
}

function attributeBlock(attrs: ContentAttributes): number[] {
  return ATTRIBUTE_KEYS.map((k) => attrs[k] * BLOCK_WEIGHTS.attributes);
}

function genreBlock(title: Title): number[] {
  const set = new Set(
    [...title.genres, ...title.subgenres].map((g) => g.toLowerCase())
  );
  return GENRE_AXES.map((axis) =>
    set.has(axis.toLowerCase()) ? BLOCK_WEIGHTS.genre : 0
  );
}

function industryBlock(title: Title): number[] {
  return INDUSTRY_AXES.map((axis) =>
    title.industry === axis ? BLOCK_WEIGHTS.industry : 0
  );
}

/**
 * Era is ordinal, not categorical — a 2010s film is closer to a 2020s film
 * than to a 1970s one, and one-hot encoding would throw that away.
 */
function eraBlock(title: Title): number[] {
  const year = title.releaseYear;
  if (year == null) return [0.5 * BLOCK_WEIGHTS.era];
  const normalised = Math.max(0, Math.min(1, (year - 1965) / 60));
  return [normalised * BLOCK_WEIGHTS.era];
}

function languageBlock(title: Title): number[] {
  const lang = title.viewingLanguage;
  const native = lang === 'hindi' ? 1 : 0;
  const available = lang === 'hindi' || lang === 'hindi-dubbed' || lang === 'hindi-and-english' ? 1 : 0;
  const englishOnly = lang === 'english-only' || lang === 'english-only-unverified' ? 1 : 0;
  return [native, available, englishOnly].map((v) => v * BLOCK_WEIGHTS.language);
}

function formatBlock(title: Title): number[] {
  const isMovie = title.type === 'movie';
  return [isMovie ? 1 : 0, isMovie ? 0 : 1].map((v) => v * BLOCK_WEIGHTS.format);
}

function runtimeBlock(title: Title): number[] {
  const r = title.runtimeMinutes;
  if (r == null) return [0.5 * BLOCK_WEIGHTS.runtime];
  // Movies 60-200 min, series episodes 20-70 min — normalise separately so a
  // 45-minute episode isn't treated as a very short film.
  const normalised =
    title.type === 'movie'
      ? Math.max(0, Math.min(1, (r - 60) / 140))
      : Math.max(0, Math.min(1, (r - 20) / 50));
  return [normalised * BLOCK_WEIGHTS.runtime];
}

export function embedTitle(title: Title): number[] {
  return [
    ...attributeBlock(title.attributes),
    ...genreBlock(title),
    ...industryBlock(title),
    ...eraBlock(title),
    ...languageBlock(title),
    ...formatBlock(title),
    ...runtimeBlock(title),
  ];
}

export const VECTOR_META: VectorMeta = (() => {
  const sizes: [string, number][] = [
    ['attributes', ATTRIBUTE_KEYS.length],
    ['genre', GENRE_AXES.length],
    ['industry', INDUSTRY_AXES.length],
    ['era', 1],
    ['language', LANGUAGE_AXES.length],
    ['format', FORMAT_AXES.length],
    ['runtime', 1],
  ];
  const blocks: VectorMeta['blocks'] = [];
  let cursor = 0;
  for (const [name, size] of sizes) {
    blocks.push({ name, start: cursor, end: cursor + size });
    cursor += size;
  }
  return { blocks, length: cursor };
})();

// ---------------------------------------------------------------------------
// Vector maths
// ---------------------------------------------------------------------------

export function dot(a: number[], b: number[]): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) sum += a[i] * b[i];
  return sum;
}

export function magnitude(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

/** -1 to 1. Returns 0 when either vector is empty rather than NaN. */
export function cosine(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dot(a, b) / (magA * magB);
}

export function addScaled(target: number[], source: number[], scale: number): number[] {
  const out = target.length ? [...target] : new Array(source.length).fill(0);
  for (let i = 0; i < source.length; i++) out[i] = (out[i] ?? 0) + source[i] * scale;
  return out;
}

export function scale(a: number[], factor: number): number[] {
  return a.map((v) => v * factor);
}

export function normalise(a: number[]): number[] {
  const mag = magnitude(a);
  return mag === 0 ? a : a.map((v) => v / mag);
}

// ---------------------------------------------------------------------------
// Title-to-title similarity
// ---------------------------------------------------------------------------

/**
 * How alike two titles are, 0-1.
 *
 * Cosine over the content vector, then nudged by two things the vector can't
 * express well: shared people (a director or lead actor in common is a strong
 * signal of "more like this") and shared themes.
 */
export function titleSimilarity(a: Title, b: Title): number {
  if (a.id === b.id) return 1;

  const base = Math.max(0, cosine(embedTitle(a), embedTitle(b)));

  // Shared cast/director.
  const peopleA = new Set([...a.cast, a.director].filter(Boolean).map((p) => p!.toLowerCase()));
  const peopleB = new Set([...b.cast, b.director].filter(Boolean).map((p) => p!.toLowerCase()));
  let sharedPeople = 0;
  for (const p of peopleA) if (peopleB.has(p)) sharedPeople++;
  const peopleBonus = Math.min(0.12, sharedPeople * 0.05);

  // Shared themes — "twist ending", "underdog", "small town".
  const themesA = new Set(a.themes.map((t) => t.toLowerCase()));
  const themesB = new Set(b.themes.map((t) => t.toLowerCase()));
  let sharedThemes = 0;
  for (const t of themesA) if (themesB.has(t)) sharedThemes++;
  const themeBonus = Math.min(0.12, sharedThemes * 0.045);

  return Math.min(1, base + peopleBonus + themeBonus);
}

/** Ranked "more like this", excluding the seed title itself. */
export function findSimilar(
  seed: Title,
  pool: Title[],
  limit = 12
): { title: Title; similarity: number }[] {
  return pool
    .filter((t) => t.id !== seed.id)
    .map((title) => ({ title, similarity: titleSimilarity(seed, title) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Readable explanation of why two titles are considered alike. Used in /admin
 * to sanity-check the model, never shown to Papa.
 */
export function explainSimilarity(a: Title, b: Title): string[] {
  const notes: string[] = [];

  const diffs = ATTRIBUTE_KEYS.map((k) => ({
    key: k,
    delta: Math.abs(a.attributes[k] - b.attributes[k]),
    value: (a.attributes[k] + b.attributes[k]) / 2,
  }));
  const close = diffs
    .filter((d) => d.delta < 0.15 && (d.value > 0.65 || d.value < 0.25))
    .sort((x, y) => x.delta - y.delta)
    .slice(0, 3);
  for (const c of close) {
    notes.push(`${c.key}: both ${c.value > 0.5 ? 'high' : 'low'} (${c.value.toFixed(2)})`);
  }

  const sharedGenres = a.genres.filter((g) => b.genres.includes(g));
  if (sharedGenres.length) notes.push(`shared genres: ${sharedGenres.join(', ')}`);

  const sharedPeople = [...a.cast, a.director]
    .filter(Boolean)
    .filter((p) => [...b.cast, b.director].includes(p!));
  if (sharedPeople.length) notes.push(`shared people: ${sharedPeople.join(', ')}`);

  const sharedThemes = a.themes.filter((t) => b.themes.includes(t));
  if (sharedThemes.length) notes.push(`shared themes: ${sharedThemes.join(', ')}`);

  return notes;
}
