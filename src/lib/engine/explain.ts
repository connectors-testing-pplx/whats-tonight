import {
  ERA_LABELS,
  INDUSTRY_LABELS,
  PROVIDER_LABELS,
  RUNTIME_BANDS,
  type ReasonLine,
  type SessionRequest,
  type SlotId,
  type Title,
} from '@/lib/types';
import { formatCount, formatRuntime } from '@/lib/utils/format';
import { languageLabel } from './language';
import type { ScoredTitle } from './rank';
import type { BehaviouralProfile } from './profile';

/**
 * Explanations.
 *
 * Two outputs, both built strictly from data already on the title:
 *   "Why we picked this" — one sentence, on the card.
 *   "Why this?"          — the itemised list behind the tap.
 *
 * Every line maps to a fact we hold. Missing fact, missing line. There is no
 * template that says "critically acclaimed" unless a critic score is sitting
 * right there.
 *
 * What is deliberately NOT here: anything resembling "because you watched X".
 * The brief rules it out and it's the right call — it's faintly unnerving, and
 * it invites arguing with the machine instead of just picking a film.
 */

export interface ExplainContext {
  slot: SlotId;
  request: SessionRequest;
  slotReason: string;
  languageException: boolean;
  languageReason: string;
  profile: BehaviouralProfile;
}

const THEME_PHRASES: Record<string, string> = {
  story: 'a strong story',
  acting: 'the performances',
  pacing: 'a pace that keeps moving',
  suspense: 'real tension',
  ending: 'an ending that lands',
  emotion: 'genuine emotional weight',
  comedy: 'humour that works',
  family: 'broad family appeal',
  production: 'serious craft behind the camera',
  music: 'a memorable score',
  visuals: 'striking cinematography',
};

export function buildWhyWePicked(scored: ScoredTitle, ctx: ExplainContext): string {
  const { title } = scored;
  const lang = languageLabel(title);

  const positives = title.reception.themes
    .filter((t) => t.sentiment === 'positive')
    .slice(0, 2)
    .map((t) => THEME_PHRASES[t.theme])
    .filter(Boolean);

  const strengths =
    positives.length === 2 ? `${positives[0]} and ${positives[1]}` : positives[0] ?? null;

  const imdb = title.ratings.imdbRating;
  const votes = formatCount(title.ratings.imdbVoteCount);
  const runtime = formatRuntime(title.runtimeMinutes);

  // The language exception is the most useful thing we can say about a title
  // that would otherwise have been penalised, so it leads.
  if (ctx.languageException) {
    const evidence = [
      imdb != null ? `${imdb.toFixed(1)} on IMDb${votes ? ` from ${votes} ratings` : ''}` : null,
      title.ratings.rtCriticScore != null ? `${title.ratings.rtCriticScore}% from critics` : null,
    ]
      .filter(Boolean)
      .join(' and ');
    return `No Hindi dub, which normally counts against a title — but at ${evidence}, this one earns the exception.`;
  }

  switch (ctx.slot) {
    case 'best': {
      const langBit =
        title.viewingLanguage === 'hindi-dubbed' ? ' with a full Hindi dub' : '';
      if (strengths && imdb != null) {
        return `The strongest option tonight${langBit}: ${imdb.toFixed(1)} on IMDb${votes ? ` from ${votes} ratings` : ''}, with viewers pointing to ${strengths}.`;
      }
      if (strengths) return `Tonight's strongest option${langBit}, with viewers pointing to ${strengths}.`;
      if (imdb != null) return `The best-rated thing available to you tonight at ${imdb.toFixed(1)} on IMDb.`;
      return 'The strongest overall fit across quality, availability and what you asked for.';
    }

    case 'strong': {
      if (strengths) return `Another confident pick, praised for ${strengths}.`;
      if (imdb != null) return `A second strong option at ${imdb.toFixed(1)} on IMDb.`;
      return 'A second strong option that offers something different from the first.';
    }

    case 'gem': {
      const thin = title.ratings.imdbVoteCount != null && title.ratings.imdbVoteCount < 120_000;
      const base = thin ? 'Very well rated but not widely watched' : 'Highly rated and easy to miss';
      if (strengths) return `${base} — the praise centres on ${strengths}.`;
      if (imdb != null) return `${base}, sitting at ${imdb.toFixed(1)} on IMDb.`;
      return `${base}.`;
    }

    case 'recycled': {
      return `You set this aside a while ago — it's still available, and still well worth the evening.`;
    }

    case 'different': {
      const genre = title.genres[0]?.toLowerCase();
      if (strengths && genre) return `Something different from the picks above — ${genre}, and praised for ${strengths}.`;
      if (genre) return `A change of pace: ${genre}, if the other picks aren't quite the mood.`;
      return 'A change of pace from the picks above.';
    }

    case 'wildcard': {
      if (strengths && runtime) {
        return `Not an obvious suggestion, but it clears the bar comfortably and offers ${strengths} in ${runtime}.`;
      }
      if (strengths) return `An outside pick that still earns its place, with ${strengths}.`;
      return 'An outside pick that still clears the quality bar.';
    }
  }
}

export function buildReasons(scored: ScoredTitle, ctx: ExplainContext): ReasonLine[] {
  const { title, breakdown } = scored;
  const lines: ReasonLine[] = [];
  const lang = languageLabel(title);

  // --- Language leads, because it's the first thing he checks. ------------
  lines.push({ icon: lang.flag, text: `${lang.text} — ${lang.detail}` });
  if (ctx.languageException) {
    lines.push({ icon: '⭐', text: ctx.languageReason });
  }

  // --- Ratings ------------------------------------------------------------
  const { imdbRating, imdbVoteCount, rtCriticScore, rtCriticReviewCount, rtAudienceScore } =
    title.ratings;

  if (imdbRating != null) {
    const votes = formatCount(imdbVoteCount);
    lines.push({
      icon: '⭐',
      text: votes
        ? `IMDb ${imdbRating.toFixed(1)} from ${votes} ratings`
        : `IMDb ${imdbRating.toFixed(1)} (vote count not available)`,
    });
  } else {
    lines.push({ icon: '⭐', text: 'IMDb rating not available for this title' });
  }

  if (rtCriticScore != null) {
    lines.push({
      icon: '🍅',
      text: rtCriticReviewCount
        ? `Rotten Tomatoes critics ${rtCriticScore}% from ${rtCriticReviewCount} reviews`
        : `Rotten Tomatoes critics ${rtCriticScore}%`,
    });
  }
  if (rtAudienceScore != null) {
    lines.push({ icon: '🍿', text: `Rotten Tomatoes audience ${rtAudienceScore}%` });
  }

  // --- Reception ----------------------------------------------------------
  const positives = title.reception.themes.filter((t) => t.sentiment === 'positive');
  if (positives.length) {
    lines.push({
      icon: '👥',
      text: `Reviewers most often praise ${positives.slice(0, 2).map((t) => t.theme).join(' and ')}`,
    });
  }
  const negatives = title.reception.themes.filter((t) => t.sentiment === 'negative');
  if (negatives.length) {
    lines.push({ icon: '⚠️', text: `Common criticism: ${negatives.map((t) => t.theme).join(', ')}` });
  }

  // --- Availability -------------------------------------------------------
  const providers = [...new Set(title.availability.map((a) => a.provider))];
  if (providers.length) {
    lines.push({
      icon: '📺',
      text: `Available on ${providers.map((p) => PROVIDER_LABELS[p]).join(' and ')} in India`,
    });
  }

  // --- Era and industry ---------------------------------------------------
  const context = [
    title.era ? ERA_LABELS[title.era] : null,
    INDUSTRY_LABELS[title.industry],
  ].filter(Boolean);
  if (context.length) lines.push({ icon: '🎬', text: context.join(' · ') });

  // --- Runtime ------------------------------------------------------------
  const runtime = formatRuntime(title.runtimeMinutes);
  if (runtime) {
    const band = RUNTIME_BANDS.find((b) => b.id === ctx.request.runtime);
    const suffix = title.type === 'movie' ? '' : ' per episode';
    if (band && ctx.request.runtime !== 'any' && title.runtimeMinutes != null) {
      const fits = title.runtimeMinutes <= band.max + 15;
      lines.push({
        icon: '⏱',
        text: fits
          ? `${runtime}${suffix} — fits the time you asked for`
          : `${runtime}${suffix} — a little over what you asked for`,
      });
    } else {
      lines.push({ icon: '⏱', text: `${runtime}${suffix}` });
    }
  }

  // --- Mood ---------------------------------------------------------------
  if (ctx.request.mood && ctx.request.mood !== 'surprise' && breakdown.mood > 11) {
    lines.push({ icon: '🎭', text: 'Closely matches the mood you picked tonight' });
  }

  // --- Discovery ----------------------------------------------------------
  if (breakdown.discovery >= 9) {
    lines.push({
      icon: '💎',
      text: 'Comparatively under-watched, so less likely you have already seen it',
    });
  }

  // --- Trending -----------------------------------------------------------
  if (breakdown.trending >= 3) {
    lines.push({ icon: '📈', text: 'Getting a lot of attention right now, and reviewing well' });
  }

  // --- Exclusion confirmation --------------------------------------------
  lines.push({ icon: '✓', text: 'Not on your Seen or Not Interested lists' });

  // --- Learned profile ----------------------------------------------------
  // Stated as a nudge, without naming the titles it came from.
  if (Math.abs(breakdown.profile) > 1.5) {
    lines.push({
      icon: '🧠',
      text:
        breakdown.profile > 0
          ? 'Close to the kind of thing you tend to pick'
          : 'A bit outside what you usually pick — included for variety',
    });
  } else if (ctx.profile.stage === 'learning' || ctx.profile.stage === 'cold') {
    lines.push({
      icon: '🧠',
      text: 'Still learning your taste — ranked on quality, reviews and tonight’s mood',
    });
  }

  // --- Slot rationale -----------------------------------------------------
  lines.push({ icon: '🎯', text: ctx.slotReason });

  return lines;
}
