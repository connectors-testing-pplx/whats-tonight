import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_LABELS,
  type AppState,
  type Title,
  type UserAction,
  type UserActionType,
} from '@/lib/types';
import { addScaled, cosine, embedTitle, normalise } from './vector';

/**
 * ===========================================================================
 * THE BEHAVIOURAL PROFILE
 * ===========================================================================
 *
 * This replaces the old genre-weights approach entirely. There is no
 * "Thriller = 5" anywhere in this file, and there never will be.
 *
 * How it works:
 *
 *   Every title Papa acts on contributes its content vector to a running
 *   weighted mean — positively for things he chose, negatively for things he
 *   rejected. The result is one vector describing the *kind of thing* he goes
 *   for. Scoring a new candidate is then a cosine similarity against it.
 *
 *   Because the vector is dominated by attributes (heavy/light, fast/slow,
 *   twisty, funny, grounded) rather than genre tags, what it learns is closer
 *   to "tightly plotted, mid-length, twist-driven, grounded" than to "likes
 *   thrillers". That is the distinction the brief asks for, and it is the
 *   difference between a recommender that feels perceptive and one that feels
 *   like a questionnaire.
 *
 * COLD START — the part that matters most here.
 *
 *   Papa has watched an enormous amount already. That means two things:
 *
 *     1. His first fifty taps are mostly him telling us what he has ALREADY
 *        SEEN, not what he likes. Treating "Seen it" as a preference signal
 *        would be a category error — so it carries zero taste weight.
 *
 *     2. Any confident model built from five interactions will be wrong, and
 *        being wrong early is expensive: it narrows what he's shown, so he
 *        stops seeing the things that would have corrected it.
 *
 *   So confidence is explicitly staged. Below LEARNING_FLOOR interactions the
 *   profile contributes nothing at all. Between there and CONFIDENT_AT it
 *   ramps in gradually. It never exceeds MAX_CONFIDENCE, so there is always
 *   room for the engine to show him something the model wouldn't have
 *   predicted — which is the only way it ever learns anything new.
 */

// --- Tuning knobs. Exposed rather than buried so they can be adjusted. -----
export const PROFILE_CONFIG = {
  /** Below this many opinionated interactions the profile is ignored. */
  LEARNING_FLOOR: 12,
  /** Confidence reaches its ceiling around here. */
  CONFIDENT_AT: 60,
  /** Never fully trust the model — always leave room to explore. */
  MAX_CONFIDENCE: 0.78,
  /** Half-life of a signal, in days. */
  HALF_LIFE_DAYS: 240,
  /** Max points the profile can add or remove from a 100-point score. */
  AFFINITY_WEIGHT: 18,
};

/**
 * How much each action says about taste.
 *
 * Note the two deliberate zeros:
 *   SEEN_IT   — he watched it at some point in the last thirty years. That
 *               tells us to exclude it, and almost nothing about tonight.
 *               Onboarding also bulk-marks these, which would swamp everything.
 *   IGNORED   — handled separately as a per-title fatigue counter, because
 *               "shown and not tapped" is far too weak to move a taste vector.
 */
export const INTERACTION_WEIGHTS: Record<UserActionType, number> = {
  // Choosing to watch says he liked the pitch — real, but not the same as
  // having enjoyed it. Weighted below the confirmed outcomes below.
  WATCH_TODAY: 0.8,
  MAYBE_LATER: 0.35,
  OPENED_DETAILS: 0.15,
  NOT_INTERESTED: -0.45,
  SEEN_IT: 0,
  IGNORED: 0,

  // Post-watch answers are the strongest evidence the app can get: he sat
  // through it and told us what he thought. Weighted accordingly.
  LOVED_IT: 1.6,
  WAS_FINE: 0.4,
  // Abandoning something is unambiguous in a way "not interested" never is —
  // he gave it a real chance. Full negative weight, no discount.
  DIDNT_FINISH: -1.0,
  // Says nothing about taste at all. It says something about his week.
  DIDNT_WATCH: 0,
};

export interface ProfileInsight {
  key: string;
  label: string;
  /** -1 to 1 relative to the neutral midpoint. */
  lean: number;
  text: string;
}

export interface BehaviouralProfile {
  /** The learned taste vector. Empty until the learning floor is cleared. */
  vector: number[];
  /** 0-1. How much the engine should trust `vector` this run. */
  confidence: number;
  /** Opinionated interactions on record. */
  interactions: number;
  /** Total actions including Seen It, for the admin view. */
  totalActions: number;
  stage: 'cold' | 'learning' | 'warming' | 'confident';
  /** Human-readable read-out of what has been learned. Admin only. */
  insights: ProfileInsight[];
  notes: string[];
  /** Titles shown repeatedly and never acted on. */
  fatigue: Record<string, number>;
}

export const EMPTY_PROFILE: BehaviouralProfile = {
  vector: [],
  confidence: 0,
  interactions: 0,
  totalActions: 0,
  stage: 'cold',
  insights: [],
  notes: ['No interactions yet — recommending on quality, reviews and mood alone.'],
  fatigue: {},
};

function decay(timestamp: string, now: number): number {
  const ageDays = (now - new Date(timestamp).getTime()) / 86_400_000;
  if (!Number.isFinite(ageDays) || ageDays <= 0) return 1;
  return Math.pow(0.5, ageDays / PROFILE_CONFIG.HALF_LIFE_DAYS);
}

function stageFor(interactions: number): BehaviouralProfile['stage'] {
  if (interactions === 0) return 'cold';
  if (interactions < PROFILE_CONFIG.LEARNING_FLOOR) return 'learning';
  if (interactions < PROFILE_CONFIG.CONFIDENT_AT) return 'warming';
  return 'confident';
}

/**
 * Confidence curve. Zero until the floor, then a smooth ramp that flattens
 * out — deliberately not linear, so early interactions don't jerk the
 * recommendations around.
 */
export function confidenceFor(interactions: number): number {
  if (interactions < PROFILE_CONFIG.LEARNING_FLOOR) return 0;
  const span = PROFILE_CONFIG.CONFIDENT_AT - PROFILE_CONFIG.LEARNING_FLOOR;
  const progress = Math.min(1, (interactions - PROFILE_CONFIG.LEARNING_FLOOR) / span);
  // Ease-out: fast early gains, slow approach to the ceiling.
  const eased = 1 - Math.pow(1 - progress, 2);
  return eased * PROFILE_CONFIG.MAX_CONFIDENCE;
}

export function buildProfile(
  state: AppState,
  titlesById: Map<string, Title>,
  now = new Date()
): BehaviouralProfile {
  const nowMs = now.getTime();

  // Latest action per title wins.
  const latest = new Map<string, UserAction>();
  for (const action of [...state.actions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )) {
    latest.set(action.titleId, action);
  }

  const opinionated = [...latest.values()].filter(
    (a) => INTERACTION_WEIGHTS[a.action] !== 0
  );

  // Fatigue: shown repeatedly, never acted on.
  const fatigue: Record<string, number> = {};
  const shownCount: Record<string, number> = {};
  for (const entry of state.history) {
    if (!entry.displayed) continue;
    shownCount[entry.titleId] = (shownCount[entry.titleId] ?? 0) + 1;
    if (entry.action == null) {
      fatigue[entry.titleId] = (fatigue[entry.titleId] ?? 0) + 1;
    }
  }

  const interactions = opinionated.length;
  const confidence = confidenceFor(interactions);
  const stage = stageFor(interactions);
  const notes: string[] = [];

  if (stage === 'cold' || stage === 'learning') {
    notes.push(
      `${interactions} opinionated interactions. The profile switches on at ${PROFILE_CONFIG.LEARNING_FLOOR} — until then, ranking is quality, reviews, language and mood only.`
    );
    return {
      ...EMPTY_PROFILE,
      interactions,
      totalActions: state.actions.length,
      stage,
      notes,
      fatigue,
    };
  }

  // --- Build the taste vector -------------------------------------------
  let vector: number[] = [];
  let weightSum = 0;

  for (const action of opinionated) {
    const title = titlesById.get(action.titleId);
    if (!title) continue;
    const weight = INTERACTION_WEIGHTS[action.action] * decay(action.timestamp, nowMs);
    if (weight === 0) continue;
    vector = addScaled(vector, embedTitle(title), weight);
    weightSum += Math.abs(weight);
  }

  if (weightSum === 0 || vector.length === 0) {
    return {
      ...EMPTY_PROFILE,
      interactions,
      totalActions: state.actions.length,
      stage,
      notes: ['Interactions recorded, but none of those titles are still in the catalogue.'],
      fatigue,
    };
  }

  vector = normalise(vector.map((v) => v / weightSum));

  notes.push(
    `Profile built from ${interactions} interactions, trusted at ${(confidence * 100).toFixed(0)}%.`
  );
  notes.push(
    `Confidence is capped at ${(PROFILE_CONFIG.MAX_CONFIDENCE * 100).toFixed(0)}% by design — some exploration always survives.`
  );

  return {
    vector,
    confidence,
    interactions,
    totalActions: state.actions.length,
    stage,
    insights: describeProfile(opinionated, titlesById, nowMs),
    notes,
    fatigue,
  };
}

/**
 * Turn the vector back into sentences a human can check.
 *
 * This exists so you can look at /admin and say "yes, that's Papa" or "no,
 * that's wrong" — a model nobody can audit is a model nobody should trust.
 */
function describeProfile(
  actions: UserAction[],
  titlesById: Map<string, Title>,
  nowMs: number
): ProfileInsight[] {
  const sums: Record<string, number> = {};
  let totalWeight = 0;

  for (const action of actions) {
    const title = titlesById.get(action.titleId);
    if (!title) continue;
    const weight = INTERACTION_WEIGHTS[action.action] * decay(action.timestamp, nowMs);
    if (weight <= 0) continue; // describe what he likes, not what he skipped
    for (const key of ATTRIBUTE_KEYS) {
      sums[key] = (sums[key] ?? 0) + title.attributes[key] * weight;
    }
    totalWeight += weight;
  }

  if (totalWeight === 0) return [];

  return ATTRIBUTE_KEYS.map((key) => {
    const mean = sums[key] / totalWeight;
    const lean = (mean - 0.5) * 2;
    return {
      key,
      label: ATTRIBUTE_LABELS[key],
      lean,
      text: `${ATTRIBUTE_LABELS[key]}: ${mean.toFixed(2)} (${
        lean > 0.25 ? 'leans high' : lean < -0.25 ? 'leans low' : 'no clear lean'
      })`,
    };
  })
    .filter((i) => Math.abs(i.lean) > 0.2)
    .sort((a, b) => Math.abs(b.lean) - Math.abs(a.lean));
}

/**
 * How well a candidate matches the learned profile, already scaled by
 * confidence. Returns 0 during the learning period — not a small number, but
 * exactly zero, so early recommendations are provably unbiased by a model that
 * hasn't earned the right to an opinion yet.
 */
export function affinity(title: Title, profile: BehaviouralProfile): number {
  if (profile.confidence === 0 || profile.vector.length === 0) return 0;
  const similarity = cosine(embedTitle(title), profile.vector);
  // Cosine here lands roughly in 0.2-0.95; recentre so an average title scores
  // near zero rather than getting a free boost.
  const centred = (similarity - 0.55) / 0.45;
  const clamped = Math.max(-1, Math.min(1, centred));
  return clamped * profile.confidence * PROFILE_CONFIG.AFFINITY_WEIGHT;
}

/**
 * Titles shown three or more times without a tap get quietly de-prioritised.
 * He has seen the card and chosen not to engage; showing it a seventh time is
 * not persistence, it's noise.
 */
export function fatiguePenalty(titleId: string, profile: BehaviouralProfile): number {
  const count = profile.fatigue[titleId] ?? 0;
  if (count < 3) return 0;
  return -Math.min(10, (count - 2) * 3);
}
