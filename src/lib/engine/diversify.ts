import type { Title } from '@/lib/types';
import type { ScoredTitle } from './rank';
import { titleSimilarity } from './vector';

/**
 * Diversity.
 *
 * Six thrillers is a failure even when all six are excellent, because it
 * doesn't reduce the decision — it just moves it. But the brief is precise
 * about what variety means here: asking for "thriller" should still return six
 * thrillers, just six *different kinds* of thriller. A mystery, a heist, a
 * psychological one, an action one, an old one, a hidden one.
 *
 * That is exactly what the content vector gives us, and why diversity is
 * measured over attributes rather than genre labels. Two films tagged Thriller
 * that feel nothing alike score as genuinely different here — which is the
 * right answer, and one a genre-based check would get wrong.
 */

/** Maximal marginal relevance: best score minus resemblance to what's chosen. */
export function selectDiverse(
  ranked: ScoredTitle[],
  count: number,
  lambda = 0.5,
  seeded: ScoredTitle[] = []
): ScoredTitle[] {
  const chosen: ScoredTitle[] = [...seeded];
  const pool = ranked.filter((r) => !chosen.some((c) => c.title.id === r.title.id));
  const maxScore = Math.max(...ranked.map((r) => r.score), 1);

  while (chosen.length < count && pool.length > 0) {
    let bestIndex = 0;
    let bestValue = -Infinity;

    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[i];
      const relevance = candidate.score / maxScore;
      const maxSimilarity = chosen.length
        ? Math.max(...chosen.map((c) => titleSimilarity(candidate.title, c.title)))
        : 0;
      const value = relevance - lambda * maxSimilarity;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = i;
      }
    }

    chosen.push(pool[bestIndex]);
    pool.splice(bestIndex, 1);
  }

  return chosen;
}

/** 0-1, how varied a finished set is. Reported in /admin. */
export function setDiversity(titles: Title[]): number {
  if (titles.length < 2) return 1;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < titles.length; i++) {
    for (let j = i + 1; j < titles.length; j++) {
      total += titleSimilarity(titles[i], titles[j]);
      pairs += 1;
    }
  }
  return 1 - total / pairs;
}

export { titleSimilarity as similarity };
