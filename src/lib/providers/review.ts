import type { Reception, ReceptionTheme, Title } from '@/lib/types';
import { emptyHealth, type ProviderHealth, type ReviewProvider } from './types';

/**
 * Reception provider — "What people are saying".
 *
 * The pipeline is deliberately two-stage, and the order matters:
 *
 *   1. RETRIEVE real review text from a legitimate source. Today that is the
 *      TMDB user-reviews endpoint, which is part of their public API. No
 *      scraping of Rotten Tomatoes, IMDb, Reddit or anywhere else.
 *   2. DERIVE themes from that text with a deterministic pass, then have an
 *      LLM turn the *derived themes* into two or three readable lines.
 *
 * The LLM never sees a blank page and is never asked what people think. It is
 * handed a structured tally — "pacing: negative, 7 of 22 reviews" — and asked
 * to phrase it. If the LLM is not configured, the offline summariser writes
 * the same thing in slightly stiffer prose. Either way the claim traces back to
 * text somebody actually wrote.
 *
 * If there is no evidence, `summary` is null and the card says so. It does not
 * guess.
 */

const BASE = 'https://api.themoviedb.org/3';

interface TmdbReview {
  author: string;
  content: string;
  author_details?: { rating: number | null };
}

/** Theme detection vocabulary. Deliberately conservative and auditable. */
const THEME_TERMS: Record<ReceptionTheme['theme'], string[]> = {
  story: ['story', 'plot', 'script', 'writing', 'screenplay', 'narrative', 'premise'],
  acting: ['acting', 'performance', 'performances', 'cast', 'actor', 'actress', 'played'],
  pacing: ['pacing', 'pace', 'slow', 'dragged', 'drags', 'rushed', 'lengthy', 'runtime', 'boring'],
  suspense: ['suspense', 'tension', 'thrilling', 'gripping', 'edge of', 'twist', 'twists'],
  ending: ['ending', 'finale', 'climax', 'last act', 'final act', 'conclusion', 'payoff'],
  emotion: ['emotional', 'moving', 'touching', 'cried', 'heartbreaking', 'poignant', 'tears'],
  comedy: ['funny', 'humour', 'humor', 'comedy', 'hilarious', 'laugh', 'witty'],
  family: ['family', 'wholesome', 'kids', 'children', 'relatable', 'heartwarming'],
  production: ['direction', 'directed', 'production', 'sets', 'design', 'atmosphere', 'craft'],
  music: ['music', 'score', 'soundtrack', 'songs', 'sound design', 'bgm'],
  visuals: ['cinematography', 'visuals', 'visually', 'shot', 'camera', 'colour', 'color', 'beautiful'],
};

const POSITIVE_TERMS = [
  'excellent', 'brilliant', 'great', 'superb', 'outstanding', 'masterpiece',
  'loved', 'love', 'perfect', 'amazing', 'wonderful', 'strong', 'best',
  'compelling', 'stunning', 'impressive', 'fantastic', 'gripping', 'flawless',
];

const NEGATIVE_TERMS = [
  'boring', 'weak', 'disappointing', 'poor', 'bad', 'terrible', 'dull',
  'predictable', 'waste', 'flat', 'mess', 'lacked', 'lacking', 'worst',
  'failed', 'forced', 'contrived', 'overrated', 'dragged',
];

interface Sentence {
  text: string;
  lower: string;
}

function splitSentences(text: string): Sentence[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => ({ text: s.trim(), lower: s.toLowerCase() }))
    .filter((s) => s.text.length > 15 && s.text.length < 400);
}

function sentimentOf(sentence: Sentence): 'positive' | 'negative' | 'neutral' {
  let score = 0;
  for (const term of POSITIVE_TERMS) if (sentence.lower.includes(term)) score += 1;
  for (const term of NEGATIVE_TERMS) if (sentence.lower.includes(term)) score -= 1;
  // "not great", "wasn't good" — flip a positive when clearly negated.
  if (/\b(not|n't|never|hardly)\b/.test(sentence.lower) && score > 0) score -= 2;
  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
}

/**
 * Tally which themes appear and how they are talked about. Everything the
 * summary later claims comes out of this function.
 */
export function extractThemes(reviews: string[]): {
  themes: ReceptionTheme[];
  quotes: Record<string, string[]>;
} {
  const tally: Record<
    string,
    { positive: number; negative: number; neutral: number; quotes: string[] }
  > = {};

  for (const review of reviews) {
    for (const sentence of splitSentences(review)) {
      for (const [theme, terms] of Object.entries(THEME_TERMS)) {
        if (!terms.some((term) => sentence.lower.includes(term))) continue;
        tally[theme] ??= { positive: 0, negative: 0, neutral: 0, quotes: [] };
        const s = sentimentOf(sentence);
        tally[theme][s] += 1;
        if (tally[theme].quotes.length < 4) tally[theme].quotes.push(sentence.text);
      }
    }
  }

  const totalMentions = Object.values(tally).reduce(
    (sum, v) => sum + v.positive + v.negative + v.neutral,
    0
  );

  const themes: ReceptionTheme[] = Object.entries(tally)
    .map(([theme, v]) => {
      const mentions = v.positive + v.negative + v.neutral;
      const net = v.positive - v.negative;
      const sentiment: ReceptionTheme['sentiment'] =
        net > Math.max(1, mentions * 0.25)
          ? 'positive'
          : net < -Math.max(1, mentions * 0.25)
            ? 'negative'
            : 'mixed';
      return {
        theme: theme as ReceptionTheme['theme'],
        sentiment,
        weight: totalMentions ? mentions / totalMentions : 0,
      };
    })
    .filter((t) => t.weight > 0.04)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6);

  const quotes: Record<string, string[]> = {};
  for (const [theme, v] of Object.entries(tally)) quotes[theme] = v.quotes;

  return { themes, quotes };
}

const THEME_NOUNS: Record<ReceptionTheme['theme'], string> = {
  story: 'the story and writing',
  acting: 'the performances',
  pacing: 'the pacing',
  suspense: 'the tension',
  ending: 'the ending',
  emotion: 'the emotional weight',
  comedy: 'the humour',
  family: 'how well it works as a family watch',
  production: 'the direction and craft',
  music: 'the music',
  visuals: 'the cinematography',
};

/**
 * Offline summariser. Used when no LLM key is configured. Produces prose that
 * is plainer than the LLM version but makes exactly the same claims.
 */
export function summariseOffline(
  themes: ReceptionTheme[],
  evidenceCount: number | null
): string | null {
  if (themes.length === 0) return null;

  const positives = themes.filter((t) => t.sentiment === 'positive').slice(0, 3);
  const negatives = themes.filter((t) => t.sentiment === 'negative').slice(0, 2);
  const mixed = themes.filter((t) => t.sentiment === 'mixed').slice(0, 2);

  const parts: string[] = [];

  if (positives.length) {
    const list = positives.map((t) => THEME_NOUNS[t.theme]);
    const joined =
      list.length === 1
        ? list[0]
        : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
    parts.push(`Viewers most often praise ${joined}.`);
  }

  if (negatives.length) {
    const list = negatives.map((t) => THEME_NOUNS[t.theme]);
    parts.push(
      `The recurring criticism concerns ${list.join(' and ')}.`
    );
  } else if (mixed.length) {
    parts.push(`Opinion is more divided on ${mixed.map((t) => THEME_NOUNS[t.theme]).join(' and ')}.`);
  }

  if (parts.length === 0) return null;

  if (evidenceCount) {
    parts.push(`Based on ${evidenceCount} published viewer reviews.`);
  }

  return parts.join(' ');
}

/**
 * LLM summariser. Given the tally and a handful of representative sentences,
 * it writes two or three lines. The prompt forbids adding anything not present
 * in the evidence — no ratings, no plot claims, no invented consensus.
 */
async function summariseWithLlm(
  title: Title,
  themes: ReceptionTheme[],
  quotes: Record<string, string[]>,
  evidenceCount: number
): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || themes.length === 0) return null;

  const evidence = themes
    .map((t) => {
      const sample = (quotes[t.theme] ?? []).slice(0, 2).map((q) => `    - "${q}"`).join('\n');
      return `  ${t.theme}: sentiment=${t.sentiment}, share_of_mentions=${(t.weight * 100).toFixed(0)}%\n${sample}`;
    })
    .join('\n');

  const prompt = `You are summarising audience reception for a film recommendation card.

TITLE: ${title.title} (${title.releaseYear ?? 'year unknown'})
REVIEWS ANALYSED: ${evidenceCount}

EXTRACTED THEMES AND EVIDENCE:
${evidence}

Write 2-3 sentences summarising the overall reception.

Hard rules:
- Use ONLY the themes and evidence above. Do not add plot details, ratings, awards, comparisons to other titles, or anything about streaming availability.
- If sentiment is mixed on a theme, say so honestly rather than smoothing it into praise.
- Name the most common criticism if one exists. Do not manufacture one if it doesn't.
- No marketing language, no exclamation marks, no "must-watch".
- Plain declarative prose. Do not begin with the title's name.

Return only the summary text.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.REVIEW_SUMMARY_MODEL ?? 'claude-sonnet-4-5',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { content?: { text?: string }[] };
    const text = json.content?.[0]?.text?.trim();
    return text || null;
  } catch {
    return null;
  }
}

class TmdbReviewProvider implements ReviewProvider {
  readonly id = 'tmdb-reviews';
  readonly label = 'TMDB user reviews';

  isConfigured(): boolean {
    return Boolean(process.env.TMDB_API_KEY);
  }

  async health(): Promise<ProviderHealth> {
    const configured = this.isConfigured();
    return {
      ...emptyHealth(
        this.id,
        'review',
        this.label,
        configured,
        configured
          ? process.env.ANTHROPIC_API_KEY
            ? 'Retrieves TMDB user reviews, extracts themes, summarises with an LLM.'
            : 'Retrieves TMDB user reviews and summarises offline. Set ANTHROPIC_API_KEY for better prose.'
          : 'Needs TMDB_API_KEY. Reception falls back to the packaged catalogue.'
      ),
      reachable: configured ? true : null,
      lastCheckedAt: new Date().toISOString(),
    };
  }

  async getReception(title: Title): Promise<Reception | null> {
    if (!this.isConfigured() || !title.tmdbId) return null;

    const kind = title.type === 'movie' ? 'movie' : 'tv';
    const url = new URL(`${BASE}/${kind}/${title.tmdbId}/reviews`);
    url.searchParams.set('api_key', process.env.TMDB_API_KEY!);

    let reviews: TmdbReview[] = [];
    try {
      const res = await fetch(url.toString(), {
        next: { revalidate: 60 * 60 * 24 },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { results: TmdbReview[] };
      reviews = json.results ?? [];
    } catch {
      return null;
    }

    if (reviews.length === 0) {
      // No evidence retrieved. Say nothing rather than something.
      return {
        summary: null,
        themes: [],
        evidenceCount: 0,
        evidenceSources: ['TMDB user reviews'],
        generatedAt: new Date().toISOString(),
        llmGenerated: false,
      };
    }

    const texts = reviews.map((r) => r.content).filter(Boolean);
    const { themes, quotes } = extractThemes(texts);

    const llmSummary = await summariseWithLlm(title, themes, quotes, texts.length);
    const summary = llmSummary ?? summariseOffline(themes, texts.length);

    return {
      summary,
      themes,
      evidenceCount: texts.length,
      evidenceSources: ['TMDB user reviews'],
      generatedAt: new Date().toISOString(),
      llmGenerated: Boolean(llmSummary),
    };
  }
}

export const reviewProvider = new TmdbReviewProvider();
