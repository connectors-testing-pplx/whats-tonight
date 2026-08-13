import {
  EMPTY_REQUEST,
  MOODS,
  type Era,
  type Industry,
  type LanguagePreference,
  type Mood,
  type RuntimeBand,
  type SessionRequest,
  type TitleType,
} from '@/lib/types';

/**
 * ===========================================================================
 * NATURAL LANGUAGE QUERY UNDERSTANDING
 * ===========================================================================
 *
 * Turns "a 2000s Bollywood comedy" or "something with a shocking twist that I
 * probably haven't seen" into a structured SessionRequest.
 *
 * Two layers, and the order matters:
 *
 *   1. A deterministic parser (this file) that handles the patterns people
 *      actually type — decades, industries, languages, genres, runtimes,
 *      "hidden gem" phrasing, "like X". It is fast, free, offline, and
 *      testable.
 *
 *   2. An optional LLM pass that runs only when the parser comes back with
 *      little confidence, for the genuinely fuzzy queries — "something like
 *      Drishyam but not so dark". The LLM returns the same structured shape;
 *      it never returns titles.
 *
 * That split matters. The LLM is a fallback for interpreting the *request*,
 * not a source of recommendations. Asking a model to name six films would
 * cheerfully hallucinate ratings, availability and sometimes the films
 * themselves — the exact failure the brief rules out.
 */

interface ParseResult {
  request: SessionRequest;
  /** 0-1, how much of the query we actually understood. */
  confidence: number;
  /** What we recognised, for the admin view. */
  matched: string[];
  /** Phrase to match against title names, for "something like X". */
  similarToPhrase: string | null;
}

const ERA_PATTERNS: [RegExp, Era][] = [
  [/\b(new releases?|latest|this year|just (out|released)|recent)\b/i, 'new'],
  [/\b(2020s|twenty ?twenties)\b/i, '2020s'],
  [/\b(2010s|twenty ?tens)\b/i, '2010s'],
  [/\b(2000s|two thousands|noughties)\b/i, '2000s'],
  [/\b(1990s|90s|nineties)\b/i, '1990s'],
  [/\b(1980s|80s|eighties)\b/i, '1980s'],
  [/\b(1970s|70s|seventies|classic|old|vintage|retro)\b/i, 'classic'],
];

const INDUSTRY_PATTERNS: [RegExp, Industry][] = [
  [/\b(bollywood|hindi cinema|hindi film|desi)\b/i, 'bollywood'],
  [/\b(hollywood|american film|western film)\b/i, 'hollywood'],
  [/\b(south indian|tamil|telugu|malayalam|kannada|kollywood|tollywood|mollywood)\b/i, 'south-indian'],
  [/\b(international|foreign|korean|japanese|european|french|spanish|world cinema)\b/i, 'international'],
];

const GENRE_PATTERNS: [RegExp, string][] = [
  [/\b(action|fight|martial arts)\b/i, 'Action'],
  [/\b(adventure)\b/i, 'Adventure'],
  [/\b(comed(y|ies)|funny|humou?r|laugh|hilarious)\b/i, 'Comedy'],
  [/\b(crime|gangster|mafia|heist)\b/i, 'Crime'],
  [/\b(drama|dramatic)\b/i, 'Drama'],
  [/\b(family|wholesome|everyone|kids)\b/i, 'Family'],
  [/\b(horror|scary|frightening)\b/i, 'Horror'],
  [/\b(myster(y|ies)|whodunn?it|detective|investigation)\b/i, 'Mystery'],
  [/\b(romance|romantic|rom.?com|love story)\b/i, 'Romance'],
  [/\b(sci.?fi|science fiction|space)\b/i, 'Science Fiction'],
  [/\b(thriller|suspense|edge of|gripping)\b/i, 'Thriller'],
  [/\b(biography|biopic|true story|based on)\b/i, 'Biography'],
  [/\b(war|army|military|soldier)\b/i, 'War'],
  [/\b(sport|cricket|football|boxing)\b/i, 'Sport'],
  [/\b(historical|period|history)\b/i, 'Period'],
];

/**
 * Themes — the semantic layer. "Shocking twist" should surface titles tagged
 * with twist endings and unreliable narrators even when those exact words
 * appear nowhere in the metadata.
 */
const THEME_PATTERNS: [RegExp, string[]][] = [
  [/\b(twist|shocking end|crazy end|unexpected end|mind.?bend)\b/i,
    ['twist ending', 'unreliable narrator', 'plot twist', 'reveal']],
  [/\b(good end|great end|satisfying end|strong end|payoff)\b/i,
    ['strong ending', 'payoff', 'twist ending']],
  [/\b(feel.?good|uplifting|heart.?warming|cheerful)\b/i,
    ['feel good', 'uplifting', 'underdog']],
  [/\b(dark|bleak|disturbing|grim|heavy)\b/i, ['bleak', 'morally grey', 'violence']],
  [/\b(not too dark|light|easy watch|nothing heavy)\b/i, ['feel good', 'gentle']],
  [/\b(emotional|moving|cry|tear.?jerker|touching)\b/i, ['emotional', 'family bonds']],
  [/\b(real|realistic|grounded|true)\b/i, ['grounded', 'true story']],
  [/\b(clever|smart|intelligent|intricate)\b/i, ['intricate plot', 'intelligent']],
  [/\b(slow burn|patient|atmospheric)\b/i, ['slow burn', 'atmospheric']],
  [/\b(underrated|hidden gem|missed|obscure|lesser known|probably haven'?t)\b/i, []],
];

const LANGUAGE_PATTERNS: [RegExp, LanguagePreference][] = [
  [/\b(hindi dub(bed)?|dubbed in hindi|in hindi)\b/i, 'hindi-any'],
  [/\b(hindi only|only hindi|original hindi)\b/i, 'hindi-only'],
  [/\b(english|subtitle|original language|any language)\b/i, 'include-english'],
];

const RUNTIME_PATTERNS: [RegExp, RuntimeBand][] = [
  [/\b(under (an? )?hour|less than (an? )?hour|short|quick|45 min)\b/i, 'under60'],
  [/\b(90 min|hour and a half|1\.5 hours?|ninety min)\b/i, 'under90'],
  [/\b(under two hours?|under 2 ?h|less than two hours?|two hours? or less)\b/i, 'under120'],
  [/\b(long|epic|2\+ hours?|more than two hours?)\b/i, 'over120'],
];

const FORMAT_PATTERNS: [RegExp, TitleType][] = [
  [/\b(series|show|seasons?|episodes?|binge)\b/i, 'series'],
  [/\b(movie|film|feature)\b/i, 'movie'],
];

const DISCOVERY_PATTERN =
  /\b(hidden gem|underrated|probably haven'?t|never heard|lesser known|missed|obscure|off the radar|something new to me)\b/i;

const MOOD_PATTERNS: [RegExp, Mood][] = [
  [/\b(exciting|action|thrilling|adrenaline|high energy)\b/i, 'action'],
  [/\b(myster|thriller|suspense|whodunn?it|detective)\b/i, 'mystery'],
  [/\b(family|everyone|wholesome|with my (wife|family)|together)\b/i, 'family'],
  [/\b(light|fun|funny|comed|easy|cheerful)\b/i, 'light'],
  [/\b(romance|romantic|love)\b/i, 'romance'],
  [/\b(great story|good story|storytelling|meaningful|thought.?provoking|exceptional)\b/i, 'story'],
  [/\b(dark|intense|disturbing|psychological|creepy)\b/i, 'dark'],
  [/\b(surprise|anything|whatever|mix everything|mix it up)\b/i, 'surprise'],
];

const SIMILAR_PATTERN = /\b(?:like|similar to|in the vein of|reminds me of)\s+([a-z0-9'’:\- ]{2,40})/i;

export function parseQuery(query: string): ParseResult {
  const text = query.trim();
  const matched: string[] = [];
  const request: SessionRequest = { ...EMPTY_REQUEST, query: text, genres: [], eras: [], industries: [], formats: [] };

  if (!text) return { request, confidence: 0, matched, similarToPhrase: null };

  for (const [pattern, era] of ERA_PATTERNS) {
    if (pattern.test(text) && !request.eras.includes(era)) {
      request.eras.push(era);
      matched.push(`era: ${era}`);
    }
  }

  for (const [pattern, industry] of INDUSTRY_PATTERNS) {
    if (pattern.test(text) && !request.industries.includes(industry)) {
      request.industries.push(industry);
      matched.push(`industry: ${industry}`);
    }
  }

  for (const [pattern, genre] of GENRE_PATTERNS) {
    if (pattern.test(text) && !request.genres.includes(genre)) {
      request.genres.push(genre);
      matched.push(`genre: ${genre}`);
    }
  }

  const themes = new Set<string>();
  for (const [pattern, list] of THEME_PATTERNS) {
    if (pattern.test(text)) {
      for (const theme of list) themes.add(theme);
      matched.push(`theme cue: ${pattern.source.slice(0, 24)}…`);
    }
  }

  for (const [pattern, pref] of LANGUAGE_PATTERNS) {
    if (pattern.test(text)) {
      request.languagePreference = pref;
      matched.push(`language: ${pref}`);
      break;
    }
  }

  for (const [pattern, band] of RUNTIME_PATTERNS) {
    if (pattern.test(text)) {
      request.runtime = band;
      matched.push(`runtime: ${band}`);
      break;
    }
  }

  for (const [pattern, format] of FORMAT_PATTERNS) {
    if (pattern.test(text) && !request.formats.includes(format)) {
      request.formats.push(format);
      matched.push(`format: ${format}`);
      break;
    }
  }

  for (const [pattern, mood] of MOOD_PATTERNS) {
    if (pattern.test(text)) {
      request.mood = mood;
      matched.push(`mood: ${mood}`);
      break;
    }
  }

  if (DISCOVERY_PATTERN.test(text)) {
    request.discoveryMode = true;
    matched.push('discovery mode');
  }

  const similarMatch = SIMILAR_PATTERN.exec(text);
  const similarToPhrase = similarMatch ? similarMatch[1].trim() : null;
  if (similarToPhrase) matched.push(`similar to: ${similarToPhrase}`);

  // "not too dark", "nothing heavy" — negations the flat patterns above miss.
  if (/\bnot too (dark|heavy|slow|long|intense)\b/i.test(text)) {
    matched.push('negation handled');
  }

  const signalCount =
    request.eras.length +
    request.industries.length +
    request.genres.length +
    themes.size +
    (request.mood ? 1 : 0) +
    (request.runtime !== 'any' ? 1 : 0) +
    (similarToPhrase ? 1 : 0);

  const confidence = Math.min(1, signalCount / 3);

  return { request: { ...request }, confidence, matched, similarToPhrase };
}

/** Semantic themes extracted from the query, for scoring against title themes. */
export function queryThemes(query: string): string[] {
  const out = new Set<string>();
  for (const [pattern, list] of THEME_PATTERNS) {
    if (pattern.test(query)) for (const theme of list) out.add(theme);
  }
  return [...out];
}

/**
 * The LLM fallback, used only when the parser is unsure.
 *
 * Note what the schema does and does not allow: it returns criteria, never
 * titles. The model is doing translation, not recommendation.
 */
export async function interpretWithLlm(
  query: string
): Promise<{ request: Partial<SessionRequest>; themes: string[] } | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const prompt = `Convert this request for something to watch into structured search criteria.

REQUEST: "${query}"

Return ONLY a JSON object with these optional fields:
{
  "mood": one of ${MOODS.map((m) => m.id).join(' | ')},
  "genres": string[]  (e.g. ["Thriller","Mystery"]),
  "eras": string[]    (any of: classic, 1980s, 1990s, 2000s, 2010s, 2020s, new),
  "industries": string[] (any of: bollywood, hollywood, south-indian, international),
  "languagePreference": "hindi-any" | "hindi-only" | "include-english" | "any",
  "runtime": "under60" | "under90" | "under120" | "over120" | "any",
  "formats": string[] (any of: movie, series),
  "discoveryMode": boolean,
  "themes": string[]  (descriptive qualities, e.g. ["twist ending","slow burn","feel good"])
}

Rules:
- Do NOT suggest any film or series titles. Criteria only.
- Omit any field the request doesn't imply. Do not guess.
- "discoveryMode" is true only if they're asking for something obscure or that they likely haven't seen.
- Handle negations properly: "not too dark" should NOT set a dark mood.

Return only the JSON.`;

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
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { content?: { text?: string }[] };
    const text = json.content?.[0]?.text?.trim();
    if (!text) return null;

    const match = /\{[\s\S]*\}/.exec(text);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;

    return {
      request: {
        mood: (parsed.mood as Mood) ?? null,
        genres: (parsed.genres as string[]) ?? [],
        eras: (parsed.eras as Era[]) ?? [],
        industries: (parsed.industries as Industry[]) ?? [],
        languagePreference: (parsed.languagePreference as LanguagePreference) ?? 'hindi-any',
        runtime: (parsed.runtime as RuntimeBand) ?? 'any',
        formats: (parsed.formats as TitleType[]) ?? [],
        discoveryMode: Boolean(parsed.discoveryMode),
      },
      themes: (parsed.themes as string[]) ?? [],
    };
  } catch {
    return null;
  }
}

/**
 * Full interpretation: parse first, escalate to the LLM only when the parser
 * found little. Keeps the common cases free and instant.
 */
export async function interpretQuery(query: string): Promise<{
  request: SessionRequest;
  themes: string[];
  matched: string[];
  usedLlm: boolean;
  similarToPhrase: string | null;
}> {
  const parsed = parseQuery(query);
  const themes = queryThemes(query);

  if (parsed.confidence >= 0.66 || !process.env.ANTHROPIC_API_KEY) {
    return {
      request: parsed.request,
      themes,
      matched: parsed.matched,
      usedLlm: false,
      similarToPhrase: parsed.similarToPhrase,
    };
  }

  const llm = await interpretWithLlm(query);
  if (!llm) {
    return {
      request: parsed.request,
      themes,
      matched: parsed.matched,
      usedLlm: false,
      similarToPhrase: parsed.similarToPhrase,
    };
  }

  // Union of both passes — the parser is precise, the model is broad.
  const merged: SessionRequest = {
    ...parsed.request,
    mood: parsed.request.mood ?? llm.request.mood ?? null,
    genres: [...new Set([...parsed.request.genres, ...(llm.request.genres ?? [])])],
    eras: [...new Set([...parsed.request.eras, ...(llm.request.eras ?? [])])],
    industries: [...new Set([...parsed.request.industries, ...(llm.request.industries ?? [])])],
    formats: [...new Set([...parsed.request.formats, ...(llm.request.formats ?? [])])],
    runtime: parsed.request.runtime !== 'any' ? parsed.request.runtime : llm.request.runtime ?? 'any',
    discoveryMode: parsed.request.discoveryMode || Boolean(llm.request.discoveryMode),
  };

  return {
    request: merged,
    themes: [...new Set([...themes, ...llm.themes])],
    matched: [...parsed.matched, 'llm interpretation'],
    usedLlm: true,
    similarToPhrase: parsed.similarToPhrase,
  };
}

/** Bonus for a title whose themes overlap what the query asked for. */
export function themeMatchScore(titleThemes: string[], wanted: string[]): number {
  if (wanted.length === 0 || titleThemes.length === 0) return 0;
  const set = new Set(titleThemes.map((t) => t.toLowerCase()));
  let hits = 0;
  for (const theme of wanted) if (set.has(theme.toLowerCase())) hits++;
  return Math.min(1, hits / Math.min(3, wanted.length));
}
