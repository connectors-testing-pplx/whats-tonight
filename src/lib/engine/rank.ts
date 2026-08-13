import {
  MOODS,
  NEUTRAL_ATTRIBUTES,
  RUNTIME_BANDS,
  type ContentAttributes,
  type SessionRequest,
  type Title,
} from '@/lib/types';
import { ratingConfidence } from '@/lib/utils/consensus';
import { scoreLanguage } from './language';
import { affinity, fatiguePenalty, type BehaviouralProfile } from './profile';
import { titleSimilarity } from './vector';

/**
 * Ranking.
 *
 * Every component answers one question and is stored in the breakdown, so
 * /admin and the "why" explanation can show their working. Nothing is a black
 * box, and nothing is tuned by vibes without a comment saying why.
 */

export interface RankContext {
  request: SessionRequest;
  profile: BehaviouralProfile;
  /** Set when the request is "find me more like this". */
  seedTitle?: Title | null;
  now: Date;
}

export interface ScoredTitle {
  title: Title;
  score: number;
  breakdown: Record<string, number>;
  languageException: boolean;
  languageReason: string;
}

/** 0-34. Quality, discounted by how thin the evidence behind it is. */
export function qualityScore(title: Title): number {
  const { imdbRating, rtCriticScore, rtAudienceScore, tmdbScore } = title.ratings;
  const confidence = ratingConfidence(title);

  const signals: number[] = [];
  if (imdbRating != null) signals.push((imdbRating / 10) * 100);
  if (rtCriticScore != null) signals.push(rtCriticScore);
  if (rtAudienceScore != null) signals.push(rtAudienceScore);
  if (tmdbScore != null && imdbRating == null) signals.push((tmdbScore / 10) * 100);

  if (signals.length === 0) return 12; // unproven, not bad

  const mean = signals.reduce((a, b) => a + b, 0) / signals.length;
  const normalised = Math.max(0, Math.min(1, (mean - 60) / 40));

  // A brilliant score from very few voters gets pulled back toward the middle.
  // 8.6 from 900 people is a rumour; 8.2 from 400,000 is a fact.
  const trusted = normalised * (0.5 + 0.5 * confidence);
  return trusted * 34;
}

/** 0-10. Do critics and the crowd actually agree? */
export function agreementScore(title: Title): number {
  const { imdbRating, rtCriticScore, rtAudienceScore } = title.ratings;
  const pairs: [number, number][] = [];
  if (rtCriticScore != null && rtAudienceScore != null) pairs.push([rtCriticScore, rtAudienceScore]);
  if (rtCriticScore != null && imdbRating != null) pairs.push([rtCriticScore, imdbRating * 10]);
  if (pairs.length === 0) return 5;

  const avgGap = pairs.map(([a, b]) => Math.abs(a - b)).reduce((a, b) => a + b, 0) / pairs.length;
  return Math.max(0, 1 - avgGap / 30) * 10;
}

/** 0-10. How positively is it actually talked about? */
export function receptionScore(title: Title): number {
  const themes = title.reception.themes;
  if (themes.length === 0) return 4;
  let score = 0;
  let weightSum = 0;
  for (const theme of themes) {
    const value = theme.sentiment === 'positive' ? 1 : theme.sentiment === 'mixed' ? 0.45 : 0;
    score += value * theme.weight;
    weightSum += theme.weight;
  }
  return (weightSum ? score / weightSum : 0.5) * 10;
}

/**
 * 0-18. Mood match, computed in attribute space rather than by genre tag.
 *
 * This is the difference between "you asked for mystery so here are six things
 * tagged Mystery" and "you asked for mystery so here are six things that
 * actually feel like a mystery". Genre still contributes, but the attribute
 * distance does most of the work.
 */
export function moodScore(title: Title, request: SessionRequest): number {
  if (!request.mood || request.mood === 'surprise') return 9;
  const meta = MOODS.find((m) => m.id === request.mood);
  if (!meta) return 9;

  // Attribute distance to the mood's target shape.
  const targetKeys = Object.keys(meta.target) as (keyof ContentAttributes)[];
  let attributeFit = 0.5;
  if (targetKeys.length) {
    let distance = 0;
    for (const key of targetKeys) {
      const target = meta.target[key] ?? NEUTRAL_ATTRIBUTES[key];
      distance += Math.abs(title.attributes[key] - target);
    }
    const meanDistance = distance / targetKeys.length;
    attributeFit = Math.max(0, 1 - meanDistance / 0.6);
  }

  // Genre overlap as a secondary confirmation.
  const all = [...title.genres, ...title.subgenres].map((g) => g.toLowerCase());
  const hits = meta.genres.filter((g) => all.includes(g.toLowerCase())).length;
  const genreFit = Math.min(1, hits / 2);

  return attributeFit * 12 + genreFit * 6;
}

/** 0-12. Does it fit the evening he actually has? */
export function runtimeFitScore(title: Title, request: SessionRequest): number {
  if (request.runtime === 'any') return 7;
  const band = RUNTIME_BANDS.find((b) => b.id === request.runtime);
  if (!band || title.runtimeMinutes == null) return 5;

  if (request.runtime === 'over120') return title.runtimeMinutes >= 120 ? 12 : 6;

  const over = title.runtimeMinutes - band.max;
  if (over <= 0) {
    // Comfortably inside; closest to the top of the window is ideal.
    return 7 + Math.min(5, (title.runtimeMinutes / band.max) * 5);
  }
  return Math.max(0, 12 - over * 0.5);
}

/**
 * 0-14. How likely is it he has NOT already stumbled onto this?
 *
 * The single most important component for a heavy viewer. Vote count is the
 * proxy: the more people have rated something, the more likely it crossed his
 * path over the last twenty years. Weighted up hard in discovery mode.
 */
export function discoveryScore(title: Title, request: SessionRequest): number {
  const votes = title.ratings.imdbVoteCount;
  let base: number;

  if (votes == null) {
    base = 8;
  } else {
    // 5K votes -> ~12, 200K -> ~6, 2M -> ~1
    const saturation = Math.min(1, Math.log10(Math.max(votes, 100)) / 6.4);
    base = (1 - saturation) * 14;
  }

  // Older titles are likelier to have been missed than this year's releases.
  if (title.releaseYear != null && title.releaseYear < 2010) base += 1.5;

  return Math.min(14, request.discoveryMode ? base * 1.35 : base);
}

/**
 * 0-8. Trending, gated on quality.
 *
 * Trending is never a reason on its own — the brief is explicit that viral
 * does not mean good. So the boost is multiplied by how well reviewed the
 * title is. A trending mediocrity gets almost nothing; a trending excellent
 * title gets the full bump.
 */
export function trendingScore(title: Title): number {
  if (!title.trending) return 0;
  const { imdbRating } = title.ratings;
  const qualityGate =
    imdbRating == null ? 0.35 : Math.max(0, Math.min(1, (imdbRating - 6.8) / 1.4));
  return title.trending.score * qualityGate * 8;
}

/** 0-20. Similarity to a seed title, for "find more like this". */
export function similarityScore(title: Title, seed: Title | null | undefined): number {
  if (!seed) return 0;
  return titleSimilarity(seed, title) * 20;
}

export function scoreTitle(title: Title, ctx: RankContext): ScoredTitle {
  const language = scoreLanguage(title, ctx.request.languagePreference);

  const breakdown: Record<string, number> = {
    quality: qualityScore(title),
    agreement: agreementScore(title),
    reception: receptionScore(title),
    mood: moodScore(title, ctx.request),
    runtimeFit: runtimeFitScore(title, ctx.request),
    discovery: discoveryScore(title, ctx.request),
    language: language.points,
    trending: trendingScore(title),
    profile: affinity(title, ctx.profile),
    similarity: similarityScore(title, ctx.seedTitle),
    fatigue: fatiguePenalty(title.id, ctx.profile),
  };

  const raw = Object.values(breakdown).reduce((a, b) => a + b, 0);

  return {
    title,
    score: Math.max(0, Math.min(130, raw)),
    breakdown,
    languageException: language.exception,
    languageReason: language.reason,
  };
}

export function rankCandidates(candidates: Title[], ctx: RankContext): ScoredTitle[] {
  return candidates
    .map((title) => scoreTitle(title, ctx))
    .sort((a, b) => b.score - a.score);
}

export const RANK_COMPONENTS: { key: string; label: string; max: number }[] = [
  { key: 'quality', label: 'Ratings quality', max: 34 },
  { key: 'mood', label: 'Fits tonight’s mood', max: 18 },
  { key: 'profile', label: 'Learned taste (confidence-scaled)', max: 18 },
  { key: 'discovery', label: 'Likely undiscovered', max: 14 },
  { key: 'language', label: 'Hindi availability', max: 12 },
  { key: 'runtimeFit', label: 'Fits your evening', max: 12 },
  { key: 'agreement', label: 'Critic/audience agreement', max: 10 },
  { key: 'reception', label: 'Review sentiment', max: 10 },
  { key: 'trending', label: 'Trending (quality-gated)', max: 8 },
  { key: 'similarity', label: 'Similar to your seed title', max: 20 },
  { key: 'fatigue', label: 'Shown-and-ignored penalty', max: 0 },
];
