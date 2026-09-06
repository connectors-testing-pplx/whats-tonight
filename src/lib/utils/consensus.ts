import type { Consensus, ConsensusLabel, Title } from '@/lib/types';
import { formatCount } from './format';

/**
 * The consensus badge is computed, never chosen for flavour.
 *
 * Two ideas do the work:
 *
 *  1. CONFIDENCE. A rating means more when more people gave it. An 8.1 from
 *     350,000 votes is a fact; an 8.1 from 900 votes is a rumour. Vote count
 *     gates which labels a title can even reach.
 *  2. AGREEMENT. When critics and audiences diverge, the badge says "Mixed"
 *     rather than picking whichever number flatters the title.
 *
 * If there is not enough signal to justify any label, this returns null and the
 * card simply doesn't show a badge.
 */

const LABEL_TEXT: Record<ConsensusLabel, { text: string; emoji: string; explanation: string }> = {
  'strongly-recommended': {
    text: 'Strongly Recommended',
    emoji: '⭐',
    explanation:
      'Critics and audiences both rate this highly, and the ratings come from a large number of votes. This is the strongest call the app makes.',
  },
  'critically-acclaimed': {
    text: 'Critically Acclaimed',
    emoji: '🏆',
    explanation:
      'Critics scored this 88% or higher on Rotten Tomatoes. It is well regarded by reviewers, even where the audience vote count is smaller.',
  },
  'audience-favourite': {
    text: 'Audience Favourite',
    emoji: '🍿',
    explanation:
      'Audiences scored this 85% or higher on Rotten Tomatoes, where critics were more measured.',
  },
  'highly-rated': {
    text: 'Highly Rated',
    emoji: '⭐',
    explanation:
      'A high IMDb rating backed by a large number of votes — strong, but without the critics’ agreement that would make it a top pick.',
  },
  'worth-a-try': {
    text: 'Worth a Try',
    emoji: '👍',
    explanation:
      'Solid scores, but the evidence is thinner or the reception a little divided — a reasonable bet, not a sure thing.',
  },
  'mixed-reception': {
    text: 'Mixed Reception',
    emoji: '⚖️',
    explanation:
      'Critics and audiences disagree, or the scores are modest. It is worth reading the reception before committing.',
  },
};

/** 0 (no idea) to 1 (very well established). */
export function ratingConfidence(title: Title): number {
  const votes = title.ratings.imdbVoteCount;
  const critics = title.ratings.rtCriticReviewCount;

  let confidence = 0;
  if (votes != null) {
    // 1K votes -> 0.3, 25K -> 0.6, 250K+ -> ~0.9
    confidence = Math.min(0.9, Math.log10(Math.max(votes, 10)) / 6.2);
  }
  if (critics != null && critics >= 40) confidence = Math.min(1, confidence + 0.1);
  return confidence;
}

export function computeConsensus(title: Title): Consensus | null {
  const { imdbRating, imdbVoteCount, rtCriticScore, rtAudienceScore } = title.ratings;
  const confidence = ratingConfidence(title);
  const basis: string[] = [];

  if (imdbRating != null) {
    const votes = formatCount(imdbVoteCount);
    basis.push(votes ? `IMDb ${imdbRating.toFixed(1)} from ${votes} ratings` : `IMDb ${imdbRating.toFixed(1)}`);
  }
  if (rtCriticScore != null) basis.push(`Rotten Tomatoes critics ${rtCriticScore}%`);
  if (rtAudienceScore != null) basis.push(`Rotten Tomatoes audience ${rtAudienceScore}%`);

  const negativeThemes = title.reception.themes.filter((t) => t.sentiment === 'negative');
  const mixedThemes = title.reception.themes.filter((t) => t.sentiment === 'mixed');
  if (negativeThemes.length) {
    basis.push(`Recurring criticism about ${negativeThemes.map((t) => t.theme).join(', ')}`);
  }

  // Not enough to say anything responsibly.
  if (imdbRating == null && rtCriticScore == null && rtAudienceScore == null) {
    return null;
  }

  const label = pickLabel({
    imdbRating,
    rtCriticScore,
    rtAudienceScore,
    confidence,
    strongDisagreement: hasDisagreement(rtCriticScore, rtAudienceScore, imdbRating),
    mixedThemeShare: mixedThemes.length + negativeThemes.length,
  });

  return { label, ...LABEL_TEXT[label], basis };
}

function hasDisagreement(
  critic: number | null,
  audience: number | null,
  imdb: number | null
): boolean {
  if (critic != null && audience != null && Math.abs(critic - audience) >= 20) return true;
  // Critics love it, the crowd doesn't (or the reverse) — IMDb stands in for
  // the audience when RT audience isn't available.
  if (critic != null && imdb != null) {
    const imdbAsPercent = imdb * 10;
    if (Math.abs(critic - imdbAsPercent) >= 22) return true;
  }
  return false;
}

function pickLabel(input: {
  imdbRating: number | null;
  rtCriticScore: number | null;
  rtAudienceScore: number | null;
  confidence: number;
  strongDisagreement: boolean;
  mixedThemeShare: number;
}): ConsensusLabel {
  const { imdbRating, rtCriticScore, rtAudienceScore, confidence, strongDisagreement } = input;

  if (strongDisagreement) return 'mixed-reception';

  const imdbStrong = imdbRating != null && imdbRating >= 8.0;
  const imdbGood = imdbRating != null && imdbRating >= 7.4;
  const imdbWeak = imdbRating != null && imdbRating < 6.8;
  const criticsStrong = rtCriticScore != null && rtCriticScore >= 88;
  const criticsGood = rtCriticScore != null && rtCriticScore >= 75;
  const criticsWeak = rtCriticScore != null && rtCriticScore < 60;
  const audienceStrong = rtAudienceScore != null && rtAudienceScore >= 85;

  if (imdbWeak || criticsWeak) return 'mixed-reception';

  // The top label needs both a strong score AND enough people behind it.
  if (imdbStrong && criticsStrong && confidence >= 0.6) return 'strongly-recommended';
  if (criticsStrong && confidence >= 0.4 && !imdbStrong) return 'critically-acclaimed';
  if (audienceStrong && !criticsStrong) return 'audience-favourite';
  if (imdbStrong && confidence >= 0.55) return 'highly-rated';
  if (imdbStrong && confidence < 0.55) return 'worth-a-try'; // great score, thin evidence
  if (imdbGood || criticsGood) return 'worth-a-try';

  return 'mixed-reception';
}
