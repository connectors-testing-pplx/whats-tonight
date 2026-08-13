import {
  LANGUAGE_LABELS,
  type LanguageLabel,
  type LanguagePreference,
  type Title,
  type ViewingLanguage,
} from '@/lib/types';
import { ratingConfidence } from '@/lib/utils/consensus';

/**
 * ===========================================================================
 * LANGUAGE — A STRONG PREFERENCE, NEVER A GATE
 * ===========================================================================
 *
 * Papa watches Hindi, and Hollywood films in Hindi dub. That is a major signal
 * and the engine treats it as one.
 *
 * But the brief is precise about the failure mode to avoid, and it's the right
 * one to worry about: a hard language filter would quietly bury Prisoners, or
 * Chernobyl, or anything superb that never got a dub. The rule that captures
 * what he actually wants is:
 *
 *     A mediocre Hindi film should not beat an outstanding English one.
 *
 * So language is a scoring term, not a filter. Hindi and Hindi-dubbed titles
 * get a solid bonus. English-only titles take a penalty — and that penalty is
 * *earnable back* by exceptional quality. An 8.4-with-500k-votes English film
 * comes through; a 7.0 English film does not, and correctly loses to a 7.6
 * Hindi one.
 *
 * The only case where language becomes hard is when Papa explicitly asks for
 * it — picking "Hindi only" in the filters. That's him overriding us, which is
 * different from us deciding for him.
 */

export const LANGUAGE_CONFIG = {
  /** Bonus for an original-Hindi title. */
  HINDI_BONUS: 12,
  /** Bonus for a confirmed Hindi dub. Slightly under native, but close. */
  DUBBED_BONUS: 10,
  /** Both options available — the most flexible outcome. */
  BOTH_BONUS: 12,
  /** Penalty for confirmed English-only. */
  ENGLISH_PENALTY: -9,
  /** Softer, because we don't actually know a dub is absent. */
  UNVERIFIED_PENALTY: -6,
  /** Non-Hindi, non-English with no dub — subtitles all the way. */
  OTHER_PENALTY: -11,

  /** An English-only title needs to clear these to earn the exception. */
  EXCEPTION_MIN_IMDB: 8.0,
  EXCEPTION_MIN_VOTES: 50_000,
  EXCEPTION_MIN_RT: 85,
  /** Or be this strong on critics alone. */
  EXCEPTION_ELITE_RT: 92,
};

export function languageLabel(title: Title): LanguageLabel {
  return LANGUAGE_LABELS[title.viewingLanguage];
}

export function hasHindi(lang: ViewingLanguage): boolean {
  return lang === 'hindi' || lang === 'hindi-dubbed' || lang === 'hindi-and-english';
}

/**
 * Does this English-only title deserve to be here anyway?
 *
 * Two routes through: broadly excellent (high IMDb with a real crowd behind
 * it, plus strong critics), or critically elite. Both require evidence — an
 * unrated title never earns the exception.
 */
export function earnsLanguageException(title: Title): boolean {
  const { imdbRating, imdbVoteCount, rtCriticScore } = title.ratings;
  const confidence = ratingConfidence(title);

  // Route 1: strong audience score with enough votes to mean something.
  const audienceRoute =
    imdbRating != null &&
    imdbRating >= LANGUAGE_CONFIG.EXCEPTION_MIN_IMDB &&
    imdbVoteCount != null &&
    imdbVoteCount >= LANGUAGE_CONFIG.EXCEPTION_MIN_VOTES;

  // Route 2: critically elite, and not thinly evidenced.
  const criticRoute =
    rtCriticScore != null &&
    rtCriticScore >= LANGUAGE_CONFIG.EXCEPTION_ELITE_RT &&
    confidence >= 0.5;

  // Route 3: both solid, neither elite.
  const combinedRoute =
    imdbRating != null &&
    imdbRating >= 7.8 &&
    rtCriticScore != null &&
    rtCriticScore >= LANGUAGE_CONFIG.EXCEPTION_MIN_RT &&
    confidence >= 0.55;

  return audienceRoute || criticRoute || combinedRoute;
}

export interface LanguageScore {
  points: number;
  exception: boolean;
  reason: string;
}

/**
 * The language term of the score. `preference` is what Papa asked for tonight;
 * `hindi-only` is the one setting that makes this behave like a filter, and
 * only because he said so.
 */
export function scoreLanguage(
  title: Title,
  preference: LanguagePreference
): LanguageScore {
  const lang = title.viewingLanguage;
  const label = LANGUAGE_LABELS[lang];

  if (preference === 'any') {
    return { points: 0, exception: false, reason: 'Language preference set to any.' };
  }

  // Explicit user override: he asked for Hindi only, he gets Hindi only.
  if (preference === 'hindi-only') {
    if (lang === 'hindi') {
      return { points: LANGUAGE_CONFIG.HINDI_BONUS, exception: false, reason: 'Originally in Hindi.' };
    }
    return {
      points: -100,
      exception: false,
      reason: 'You asked for Hindi originals only.',
    };
  }

  switch (lang) {
    case 'hindi':
      return { points: LANGUAGE_CONFIG.HINDI_BONUS, exception: false, reason: 'Originally in Hindi.' };
    case 'hindi-and-english':
      return { points: LANGUAGE_CONFIG.BOTH_BONUS, exception: false, reason: 'Available in Hindi or English.' };
    case 'hindi-dubbed':
      return { points: LANGUAGE_CONFIG.DUBBED_BONUS, exception: false, reason: 'Hindi dubbed version available.' };

    case 'english-only':
    case 'english-only-unverified': {
      const basePenalty =
        lang === 'english-only'
          ? LANGUAGE_CONFIG.ENGLISH_PENALTY
          : LANGUAGE_CONFIG.UNVERIFIED_PENALTY;

      if (preference === 'include-english') {
        // He explicitly opened the door to English; only a token penalty left.
        return {
          points: basePenalty / 3,
          exception: false,
          reason: label.detail,
        };
      }

      if (earnsLanguageException(title)) {
        return {
          points: 0,
          exception: true,
          reason:
            'No Hindi dub, which normally counts against a title — but the ratings and reviews are strong enough to make an exception.',
        };
      }

      return { points: basePenalty, exception: false, reason: label.detail };
    }

    case 'other-language': {
      if (earnsLanguageException(title)) {
        return {
          points: LANGUAGE_CONFIG.OTHER_PENALTY / 3,
          exception: true,
          reason: 'Subtitles only, but exceptionally well received.',
        };
      }
      return { points: LANGUAGE_CONFIG.OTHER_PENALTY, exception: false, reason: label.detail };
    }
  }
}

/**
 * Hard exclusion, used by the filter stage. Language almost never appears
 * here — this returns true only for the explicit "Hindi only" request.
 */
export function languageExcludes(
  title: Title,
  preference: LanguagePreference
): boolean {
  if (preference !== 'hindi-only') return false;
  return title.viewingLanguage !== 'hindi';
}
