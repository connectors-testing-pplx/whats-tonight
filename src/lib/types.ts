/**
 * Core domain types.
 *
 * A guiding rule runs through every one of these: anything we are not certain
 * about is `null`, never a placeholder or a guess. The UI is built to render
 * "Not available" gracefully. It is always better for Papa to see an honest gap
 * than a confident-looking invention.
 */

// ---------------------------------------------------------------------------
// Titles
// ---------------------------------------------------------------------------

export type TitleType = 'movie' | 'series' | 'limited-series';

export type Provider = 'netflix' | 'prime' | 'jiohotstar';

export const PROVIDER_LABELS: Record<Provider, string> = {
  netflix: 'Netflix',
  prime: 'Prime Video',
  jiohotstar: 'JioHotstar',
};

/** Where a single fact came from. Rendered in the admin view, never to Papa. */
export type DataSource = 'tmdb' | 'omdb' | 'seed' | 'derived' | 'unknown';

export interface Availability {
  provider: Provider;
  country: string;
  streamingUrl: string | null;
  lastChecked: string | null;
  source: DataSource;
}

// ---------------------------------------------------------------------------
// Language — the single most important signal for Papa
// ---------------------------------------------------------------------------

/**
 * How Papa would actually watch this, in his terms.
 *
 * Note `english-only-unverified`: we know it's an English title and we have no
 * confirmation either way about a Hindi dub. That is a different claim from
 * "there is definitely no Hindi dub", and the UI says so rather than pretending
 * to certainty. The engine treats it like english-only but slightly softer.
 */
export type ViewingLanguage =
  | 'hindi'
  | 'hindi-dubbed'
  | 'hindi-and-english'
  | 'english-only'
  | 'english-only-unverified'
  | 'other-language';

export interface LanguageLabel {
  flag: string;
  text: string;
  /** 'good' = Hindi available, 'warn' = English only, 'unknown' = unconfirmed */
  tone: 'good' | 'warn' | 'unknown';
  /** Longer explanation, shown under Read more. */
  detail: string;
}

export const LANGUAGE_LABELS: Record<ViewingLanguage, LanguageLabel> = {
  hindi: {
    flag: '🇮🇳',
    text: 'Hindi',
    tone: 'good',
    detail: 'Originally made in Hindi.',
  },
  'hindi-dubbed': {
    flag: '🇮🇳',
    text: 'Hindi Dubbed',
    tone: 'good',
    detail: 'A Hindi dubbed version is available on this platform.',
  },
  'hindi-and-english': {
    flag: '🇮🇳',
    text: 'Hindi + English',
    tone: 'good',
    detail: 'Watchable in either Hindi or English.',
  },
  'english-only': {
    flag: '🇬🇧',
    text: 'English Only',
    tone: 'warn',
    detail: 'No Hindi dub available — English audio with subtitles.',
  },
  'english-only-unverified': {
    flag: '🇬🇧',
    text: 'English Only',
    tone: 'unknown',
    detail:
      'English audio. We could not confirm whether a Hindi dub exists on this platform.',
  },
  'other-language': {
    flag: '🌏',
    text: 'Subtitles',
    tone: 'warn',
    detail: 'Original language with subtitles. No Hindi dub confirmed.',
  },
};

// ---------------------------------------------------------------------------
// Era and industry
// ---------------------------------------------------------------------------

export type Era = 'classic' | '1980s' | '1990s' | '2000s' | '2010s' | '2020s' | 'new';

export const ERA_LABELS: Record<Era, string> = {
  classic: '1970s & older',
  '1980s': '1980s',
  '1990s': '1990s',
  '2000s': '2000s',
  '2010s': '2010s',
  '2020s': '2020s',
  new: 'New release',
};

export function eraForYear(year: number | null, now = new Date()): Era | null {
  if (year == null) return null;
  if (year >= now.getFullYear() - 1) return 'new';
  if (year >= 2020) return '2020s';
  if (year >= 2010) return '2010s';
  if (year >= 2000) return '2000s';
  if (year >= 1990) return '1990s';
  if (year >= 1980) return '1980s';
  return 'classic';
}

export type Industry =
  | 'bollywood'
  | 'hollywood'
  | 'south-indian'
  | 'international'
  | 'other';

export const INDUSTRY_LABELS: Record<Industry, string> = {
  bollywood: 'Bollywood',
  hollywood: 'Hollywood',
  'south-indian': 'South Indian',
  international: 'International',
  other: 'Other',
};

// ---------------------------------------------------------------------------
// Content attributes — what a title is actually LIKE
// ---------------------------------------------------------------------------

/**
 * This is the heart of the "learn content similarity, not genre similarity"
 * requirement.
 *
 * Two thrillers can be nothing alike. Andhadhun and Prisoners share a genre
 * label and almost nothing else — one is playful and intricate, the other is
 * bleak and grinding. These axes are what actually separate them, and they are
 * what the behavioural profile learns over.
 *
 * Every value is 0-1. They are deliberately interpretable so a human can read
 * the admin view and tell whether the model has learned something sensible.
 */
export interface ContentAttributes {
  /** 0 = light and breezy, 1 = heavy and bleak */
  weight: number;
  /** 0 = calm and quiet, 1 = relentless and intense */
  intensity: number;
  /** 0 = slow and patient, 1 = fast and propulsive */
  pace: number;
  /** 0 = straightforward, 1 = intricate and demanding */
  complexity: number;
  /** How much the appeal rests on a twist or reveal */
  twist: number;
  /** How much it goes for the heart */
  emotion: number;
  /** How funny it is meant to be */
  humour: number;
  /** Physical action, chases, set pieces */
  action: number;
  /** 0 = stylised or fantastical, 1 = grounded and realistic */
  realism: number;
  /** Scale and visual spectacle */
  spectacle: number;
  /** 0 = plot-driven, 1 = character-driven */
  character: number;
  /** Romance as a central thread */
  romance: number;
  /** Comfortable to watch with the whole family */
  familyFriendly: number;
}

export const NEUTRAL_ATTRIBUTES: ContentAttributes = {
  weight: 0.5,
  intensity: 0.5,
  pace: 0.5,
  complexity: 0.5,
  twist: 0.3,
  emotion: 0.5,
  humour: 0.3,
  action: 0.3,
  realism: 0.6,
  spectacle: 0.4,
  character: 0.5,
  romance: 0.2,
  familyFriendly: 0.4,
};

export const ATTRIBUTE_KEYS = Object.keys(NEUTRAL_ATTRIBUTES) as (keyof ContentAttributes)[];

export const ATTRIBUTE_LABELS: Record<keyof ContentAttributes, string> = {
  weight: 'Heavy vs light',
  intensity: 'Intensity',
  pace: 'Pace',
  complexity: 'Plot complexity',
  twist: 'Twist-driven',
  emotion: 'Emotional pull',
  humour: 'Humour',
  action: 'Action',
  realism: 'Grounded',
  spectacle: 'Spectacle',
  character: 'Character-driven',
  romance: 'Romance',
  familyFriendly: 'Family-friendly',
};

// ---------------------------------------------------------------------------
// Ratings and reception
// ---------------------------------------------------------------------------

export interface Ratings {
  imdbRating: number | null;
  imdbVoteCount: number | null;
  rtCriticScore: number | null;
  rtCriticReviewCount: number | null;
  rtAudienceScore: number | null;
  rtAudienceReviewCount: number | null;
  tmdbScore: number | null;
  tmdbVoteCount: number | null;
  sources: Partial<Record<keyof Omit<Ratings, 'sources'>, DataSource>>;
}

export interface ReceptionTheme {
  theme:
    | 'story'
    | 'acting'
    | 'pacing'
    | 'suspense'
    | 'ending'
    | 'emotion'
    | 'comedy'
    | 'family'
    | 'production'
    | 'music'
    | 'visuals';
  sentiment: 'positive' | 'mixed' | 'negative';
  weight: number;
}

export interface Reception {
  summary: string | null;
  themes: ReceptionTheme[];
  evidenceCount: number | null;
  evidenceSources: string[];
  generatedAt: string | null;
  llmGenerated: boolean;
}

/** Freshness. Trending alone never earns a slot — it only adds a boost. */
export interface Trending {
  /** 0-1, how much conversation this is currently getting. */
  score: number;
  source: DataSource;
  checkedAt: string | null;
}

export interface Title {
  id: string;
  tmdbId: number | null;
  imdbId: string | null;
  title: string;
  type: TitleType;
  releaseYear: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  synopsis: string | null;
  genres: string[];
  /** Finer-grained than genre: "psychological thriller", "heist", "courtroom". */
  subgenres: string[];
  /** Free-text themes used by semantic search: "twist ending", "underdog". */
  themes: string[];
  languages: string[];
  viewingLanguage: ViewingLanguage;
  era: Era | null;
  industry: Industry;
  attributes: ContentAttributes;
  runtimeMinutes: number | null;
  seasons: number | null;
  episodes: number | null;
  ratings: Ratings;
  reception: Reception;
  availability: Availability[];
  trending: Trending | null;
  cast: string[];
  director: string | null;
  lastUpdated: string;
  primarySource: DataSource;
}

// ---------------------------------------------------------------------------
// User signals
// ---------------------------------------------------------------------------

export type UserActionType =
  | 'WATCH_TODAY'
  | 'MAYBE_LATER'
  | 'SEEN_IT'
  | 'NOT_INTERESTED'
  /** Weak interest signal: he opened Read more. */
  | 'OPENED_DETAILS'
  /** Weak negative: shown and passed over without any action. */
  | 'IGNORED'
  // --- Post-watch follow-up ------------------------------------------------
  // Choosing to watch something says he liked the *pitch*. Whether he actually
  // enjoyed it is a completely different question, and by far the strongest
  // signal available — so the app asks, once, the next evening.
  /** Watched and loved it. The best signal we ever get. */
  | 'LOVED_IT'
  /** Watched, it was fine. Mild positive. */
  | 'WAS_FINE'
  /** Started it and gave up. Genuinely negative, and stays excluded. */
  | 'DIDNT_FINISH'
  /** Never got round to it. Clears the pick and returns it to the pool. */
  | 'DIDNT_WATCH';

/** The four answers to "did you watch it?", in the order they're offered. */
export const FOLLOW_UP_OPTIONS: {
  action: UserActionType;
  label: string;
  emoji: string;
}[] = [
  { action: 'LOVED_IT', label: 'Loved it', emoji: '😍' },
  { action: 'WAS_FINE', label: 'It was fine', emoji: '🙂' },
  { action: 'DIDNT_FINISH', label: 'Gave up on it', emoji: '😕' },
  { action: 'DIDNT_WATCH', label: 'Never got to it', emoji: '🕐' },
];

export interface UserAction {
  titleId: string;
  action: UserActionType;
  timestamp: string;
  slot?: SlotId;
  /** What he was in the mood for when he did this. Context, not preference. */
  moodAtTime?: Mood | null;
}

// ---------------------------------------------------------------------------
// Mood — session context, never a permanent trait
// ---------------------------------------------------------------------------

export type Mood =
  | 'action'
  | 'mystery'
  | 'family'
  | 'light'
  | 'romance'
  | 'story'
  | 'dark'
  | 'surprise';

export interface MoodMeta {
  id: Mood;
  label: string;
  emoji: string;
  genres: string[];
  /** The shape of title this mood is asking for, in attribute space. */
  target: Partial<ContentAttributes>;
}

export const MOODS: MoodMeta[] = [
  {
    id: 'action',
    label: 'Action',
    emoji: '🔥',
    genres: ['Action', 'Adventure', 'Crime', 'Thriller', 'War', 'Sport'],
    target: { action: 0.85, intensity: 0.8, pace: 0.8, spectacle: 0.7, weight: 0.45 },
  },
  {
    id: 'mystery',
    label: 'Mystery',
    emoji: '🕵️',
    genres: ['Mystery', 'Thriller', 'Crime', 'Suspense'],
    target: { twist: 0.85, complexity: 0.75, intensity: 0.65, pace: 0.6 },
  },
  {
    id: 'family',
    label: 'Family',
    emoji: '❤️',
    genres: ['Family', 'Drama', 'Comedy', 'Slice of Life', 'Music'],
    target: { familyFriendly: 0.9, emotion: 0.75, weight: 0.3, intensity: 0.25 },
  },
  {
    id: 'light',
    label: 'Light & Fun',
    emoji: '😂',
    genres: ['Comedy', 'Adventure', 'Slice of Life', 'Dark Comedy', 'Family'],
    target: { humour: 0.85, weight: 0.2, intensity: 0.25, pace: 0.6 },
  },
  {
    id: 'romance',
    label: 'Romance',
    emoji: '💕',
    genres: ['Romance', 'Comedy', 'Drama', 'Musical'],
    target: { romance: 0.85, emotion: 0.8, weight: 0.3, humour: 0.5 },
  },
  {
    id: 'story',
    label: 'Great Story',
    emoji: '🧠',
    genres: ['Drama', 'Biography', 'History', 'Science Fiction', 'Period', 'Mystery'],
    target: { complexity: 0.75, character: 0.8, emotion: 0.7, realism: 0.7 },
  },
  {
    id: 'dark',
    label: 'Suspense / Dark',
    emoji: '😱',
    genres: ['Thriller', 'Horror', 'Crime', 'Mystery', 'Dark Comedy'],
    target: { weight: 0.85, intensity: 0.85, twist: 0.6, familyFriendly: 0.1 },
  },
  {
    id: 'surprise',
    label: 'Surprise me',
    emoji: '🎲',
    genres: [],
    target: {},
  },
];

// ---------------------------------------------------------------------------
// Session filters — what he wants TONIGHT
// ---------------------------------------------------------------------------

export type RuntimeBand = 'under60' | 'under90' | 'under120' | 'over120' | 'any';

export const RUNTIME_BANDS: { id: RuntimeBand; label: string; max: number }[] = [
  { id: 'under60', label: 'Under 1 hour', max: 65 },
  { id: 'under90', label: 'Under 90 minutes', max: 95 },
  { id: 'under120', label: 'Under 2 hours', max: 125 },
  { id: 'over120', label: '2+ hours', max: 999 },
  { id: 'any', label: 'Any length', max: 999 },
];

export type LanguagePreference = 'hindi-any' | 'hindi-only' | 'include-english' | 'any';

export const LANGUAGE_PREF_LABELS: Record<LanguagePreference, string> = {
  'hindi-any': 'Hindi or Hindi dubbed',
  'hindi-only': 'Hindi only',
  'include-english': 'Include English',
  any: 'Any language',
};

/**
 * Everything Papa asked for in THIS session. None of it is written to his
 * long-term profile — see profile.ts for why that separation matters.
 */
export interface SessionRequest {
  mood: Mood | null;
  genres: string[];
  eras: Era[];
  industries: Industry[];
  languagePreference: LanguagePreference;
  runtime: RuntimeBand;
  providers: Provider[];
  formats: TitleType[];
  /** Free-text query, when he typed instead of tapping. */
  query: string | null;
  /** Set by "You may have missed these". */
  discoveryMode: boolean;
  /** Set by "Find similar" — the title to match against. */
  similarToId: string | null;
}

export const EMPTY_REQUEST: SessionRequest = {
  mood: null,
  genres: [],
  eras: [],
  industries: [],
  languagePreference: 'hindi-any',
  runtime: 'any',
  providers: [],
  formats: [],
  query: null,
  discoveryMode: false,
  similarToId: null,
};

export interface UserPreferences {
  providers: Provider[];
  onboarded: boolean;
  /** Long-lived default; the session request can override it for one night. */
  languagePreference: LanguagePreference;
  /** 1 = normal, 1.15 = large, 1.3 = largest. For older eyes. */
  textScale: number;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  providers: ['netflix', 'prime', 'jiohotstar'],
  onboarded: false,
  languagePreference: 'hindi-any',
  textScale: 1,
};

export const TEXT_SCALES: { value: number; label: string }[] = [
  { value: 1, label: 'Normal' },
  { value: 1.15, label: 'Large' },
  { value: 1.3, label: 'Largest' },
];

/**
 * Where to open a title, when the provider gives us no deep link.
 *
 * These are search URLs on the provider's own site — not scraping, just the
 * same URL you'd get by typing in their search box. Better than dumping him on
 * a homepage to hunt for it himself.
 */
export const PROVIDER_SEARCH: Record<Provider, (title: string) => string> = {
  netflix: (t) => `https://www.netflix.com/search?q=${encodeURIComponent(t)}`,
  prime: (t) => `https://www.primevideo.com/search?phrase=${encodeURIComponent(t)}`,
  jiohotstar: (t) => `https://www.hotstar.com/in/search?q=${encodeURIComponent(t)}`,
};

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export type SlotId =
  | 'best'
  | 'strong'
  | 'gem'
  | 'different'
  | 'wildcard'
  | 'recycled';

export interface SlotMeta {
  id: SlotId;
  label: string;
  emoji: string;
}

export const SLOTS: SlotMeta[] = [
  { id: 'best', label: 'Best match', emoji: '🥇' },
  { id: 'strong', label: 'Strong match', emoji: '✨' },
  { id: 'gem', label: 'You may have missed this', emoji: '💎' },
  { id: 'different', label: 'Something different', emoji: '🔀' },
  { id: 'wildcard', label: 'Wildcard', emoji: '🎲' },
  { id: 'recycled', label: 'From your Later list', emoji: '🕐' },
];

export type ConsensusLabel =
  | 'strongly-recommended'
  | 'critically-acclaimed'
  | 'audience-favourite'
  | 'highly-rated'
  | 'worth-a-try'
  | 'mixed-reception';

export interface Consensus {
  label: ConsensusLabel;
  text: string;
  emoji: string;
  explanation: string;
  basis: string[];
}

export interface ReasonLine {
  icon: string;
  text: string;
}

export interface Recommendation {
  slot: SlotId;
  title: Title;
  score: number;
  scoreBreakdown: Record<string, number>;
  consensus: Consensus | null;
  whyWePicked: string;
  reasons: ReasonLine[];
  /** True when an English-only title cleared the bar despite the penalty. */
  languageException: boolean;
}

export interface PickSet {
  date: string;
  revision: number;
  request: SessionRequest;
  recommendations: Recommendation[];
  generatedAt: string;
  poolSize: number;
  notes: string[];
  /** 0-1. How much the engine trusted the learned profile this run. */
  profileConfidence: number;
}

export interface RecommendationHistoryEntry {
  titleId: string;
  date: string;
  slot: SlotId;
  displayed: boolean;
  action: UserActionType | null;
  actionAt: string | null;
  /** Increments each time it was shown and passed over. */
  ignoredCount?: number;
}

// ---------------------------------------------------------------------------
// Persisted application state
// ---------------------------------------------------------------------------

export interface AppState {
  preferences: UserPreferences;
  actions: UserAction[];
  history: RecommendationHistoryEntry[];
  currentPicks: PickSet | null;
  titleCache: Record<string, Title>;
  /** Free-text searches, kept as weak contextual signal. */
  searches: { query: string; timestamp: string }[];
  version: number;
}

export const INITIAL_STATE: AppState = {
  preferences: DEFAULT_PREFERENCES,
  actions: [],
  history: [],
  currentPicks: null,
  titleCache: {},
  searches: [],
  version: 2,
};
