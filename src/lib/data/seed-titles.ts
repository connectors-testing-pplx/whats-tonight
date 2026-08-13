import {
  NEUTRAL_ATTRIBUTES,
  eraForYear,
  type Availability,
  type ContentAttributes,
  type Industry,
  type Provider,
  type Ratings,
  type Reception,
  type ReceptionTheme,
  type Title,
  type TitleType,
  type ViewingLanguage,
} from '@/lib/types';

/**
 * ===========================================================================
 * THE PACKAGED SEED CATALOGUE
 * ===========================================================================
 *
 * Read this before judging the numbers below.
 *
 * This exists so the app is fully usable the moment you open it — no keys, no
 * network. It is a *starter catalogue*, not a live feed.
 *
 * The rules it follows:
 *
 *  - Ratings are well-established public figures for well-known titles,
 *    captured as a point-in-time snapshot. Ratings drift. Treat as approximate.
 *  - RT AUDIENCE scores are null throughout. No free legitimate source exists,
 *    so the app prints "Not available" rather than inventing a number.
 *  - Streaming availability in India moves constantly. The assignments here
 *    reflect the general shape of the market, not a per-title check.
 *  - HINDI DUB availability is the least certain field of all. Big Hollywood
 *    releases and Netflix/Prime originals almost always carry Hindi audio in
 *    India; smaller prestige films usually don't. Where genuinely unsure, the
 *    entry uses `english-only-unverified`, which the UI renders as "English
 *    Only" with an explicit note that a dub could not be confirmed. That is a
 *    weaker claim than "there is no dub", and the difference matters.
 *  - CONTENT ATTRIBUTES (heavy/light, fast/slow, twisty, funny) are editorial
 *    judgements, not measurements. They drive similarity and mood matching,
 *    never a factual claim shown to Papa.
 *
 * Add TMDB_API_KEY and OMDB_API_KEY and this file stops being the source of
 * truth. See docs/GETTING-API-KEYS.md.
 */

const SEED_NOTE = 'Seed catalogue — replace with live provider data';

interface Seed {
  id: string;
  t: string;
  ty?: TitleType;
  y: number;
  ind: Industry;
  lang: ViewingLanguage;
  g: string[];
  /** Subgenres and themes power semantic search and similarity. */
  sg?: string[];
  th?: string[];
  /** Movies: total minutes. Series: minutes per episode. */
  r?: number;
  ss?: number;
  ep?: number;
  im: number | null;
  v: number | null;
  rtc?: number | null;
  p: Provider[];
  c?: string[];
  d?: string;
  syn: string;
  /** Reception themes, compact: "story+ acting+ pacing- ending~" */
  rth?: string;
  rec: string;
  /** Only the attributes that differ meaningfully from neutral. */
  at?: Partial<ContentAttributes>;
  /** 0-1 trending score. Only set for genuinely current titles. */
  tr?: number;
}

const SENTIMENT: Record<string, ReceptionTheme['sentiment']> = {
  '+': 'positive',
  '-': 'negative',
  '~': 'mixed',
};

function parseThemes(spec: string | undefined): ReceptionTheme[] {
  if (!spec) return [];
  const parts = spec.trim().split(/\s+/);
  return parts.map((part, i) => {
    const mark = part.slice(-1);
    const theme = part.slice(0, -1) as ReceptionTheme['theme'];
    return {
      theme,
      sentiment: SENTIMENT[mark] ?? 'mixed',
      // Earlier entries are the more commonly raised points.
      weight: Math.max(0.08, (parts.length - i) / (parts.length * (parts.length + 1) / 2)),
    };
  });
}

function buildRatings(s: Seed): Ratings {
  return {
    imdbRating: s.im,
    imdbVoteCount: s.v,
    rtCriticScore: s.rtc ?? null,
    rtCriticReviewCount: null,
    rtAudienceScore: null,
    rtAudienceReviewCount: null,
    tmdbScore: null,
    tmdbVoteCount: null,
    sources: {
      imdbRating: 'seed',
      imdbVoteCount: 'seed',
      rtCriticScore: s.rtc != null ? 'seed' : 'unknown',
    },
  };
}

function buildReception(s: Seed): Reception {
  return {
    summary: s.rec,
    themes: parseThemes(s.rth),
    evidenceCount: null,
    evidenceSources: [SEED_NOTE],
    generatedAt: null,
    llmGenerated: false,
  };
}

function buildAvailability(s: Seed): Availability[] {
  return s.p.map((provider) => ({
    provider,
    country: 'IN',
    streamingUrl: null,
    lastChecked: null,
    source: 'seed' as const,
  }));
}

function toTitle(s: Seed): Title {
  return {
    id: s.id,
    tmdbId: null,
    imdbId: null,
    title: s.t,
    type: s.ty ?? 'movie',
    releaseYear: s.y,
    posterUrl: null,
    backdropUrl: null,
    synopsis: s.syn,
    genres: s.g,
    subgenres: s.sg ?? [],
    themes: s.th ?? [],
    languages: languagesFor(s),
    viewingLanguage: s.lang,
    era: eraForYear(s.y, new Date('2026-08-12')),
    industry: s.ind,
    attributes: { ...NEUTRAL_ATTRIBUTES, ...(s.at ?? {}) },
    runtimeMinutes: s.r ?? null,
    seasons: s.ss ?? null,
    episodes: s.ep ?? null,
    ratings: buildRatings(s),
    reception: buildReception(s),
    availability: buildAvailability(s),
    trending: s.tr != null ? { score: s.tr, source: 'seed', checkedAt: null } : null,
    cast: s.c ?? [],
    director: s.d ?? null,
    lastUpdated: '2026-08-01T00:00:00.000Z',
    primarySource: 'seed',
  };
}

function languagesFor(s: Seed): string[] {
  switch (s.lang) {
    case 'hindi':
      return ['Hindi'];
    case 'hindi-dubbed':
      return ['Hindi', 'English'];
    case 'hindi-and-english':
      return ['Hindi', 'English'];
    case 'english-only':
    case 'english-only-unverified':
      return ['English'];
    case 'other-language':
      return s.ind === 'south-indian' ? ['Tamil'] : ['Original'];
  }
}

/** Shorthand for attribute objects. */
const A = (o: Partial<ContentAttributes>) => o;

// ===========================================================================
// THE CATALOGUE
// ===========================================================================

const SEED: Seed[] = [
  // ------------------------------------------------- BOLLYWOOD — CLASSIC
  {
    id: 'sholay', t: 'Sholay', y: 1975, ind: 'bollywood', lang: 'hindi',
    g: ['Action', 'Adventure', 'Drama'], sg: ['Curry Western'], th: ['friendship', 'revenge', 'iconic villain'],
    r: 204, im: 8.1, v: 63000, p: ['prime'],
    c: ['Amitabh Bachchan', 'Dharmendra', 'Amjad Khan', 'Hema Malini'], d: 'Ramesh Sippy',
    syn: 'Two small-time crooks are hired by a retired policeman to capture the bandit who destroyed his family.',
    rth: 'story+ acting+ music+ pacing~',
    rec: 'Still treated as the defining Hindi film — Gabbar Singh, the dialogue and the friendship at its centre are what people quote decades later. Its length is the only common complaint.',
    at: A({ action: 0.8, spectacle: 0.7, humour: 0.5, emotion: 0.7, pace: 0.55, familyFriendly: 0.6, weight: 0.5 }),
  },
  {
    id: 'deewaar', t: 'Deewaar', y: 1975, ind: 'bollywood', lang: 'hindi',
    g: ['Crime', 'Drama'], sg: ['Gangster'], th: ['brothers', 'morally grey', 'mother'],
    r: 174, im: 8.0, v: 22000, p: ['prime'],
    c: ['Amitabh Bachchan', 'Shashi Kapoor', 'Nirupa Roy'], d: 'Yash Chopra',
    syn: 'Two brothers take opposite sides of the law, and their mother has to choose between them.',
    rth: 'acting+ story+ emotion+',
    rec: 'The film that made the angry young man archetype, and the "mere paas maa hai" scene is part of the language now. Melodramatic by modern standards, which most viewers accept as the point.',
    at: A({ weight: 0.7, emotion: 0.85, character: 0.8, intensity: 0.6, action: 0.5, familyFriendly: 0.5 }),
  },
  {
    id: 'chupke-chupke', t: 'Chupke Chupke', y: 1975, ind: 'bollywood', lang: 'hindi',
    g: ['Comedy', 'Family'], sg: ['Farce'], th: ['mistaken identity', 'gentle'],
    r: 145, im: 8.2, v: 20000, p: ['prime'],
    c: ['Dharmendra', 'Amitabh Bachchan', 'Sharmila Tagore'], d: 'Hrishikesh Mukherjee',
    syn: 'A botany professor poses as an illiterate driver to play an elaborate prank on his wife’s brother-in-law.',
    rth: 'comedy+ acting+ family+',
    rec: 'A gentle farce that families rewatch every few years — the wordplay and Dharmendra’s straight-faced performance are the draw. Nobody dislikes this film.',
    at: A({ humour: 0.9, weight: 0.12, intensity: 0.15, familyFriendly: 0.95, emotion: 0.5, action: 0.05, pace: 0.5 }),
  },
  {
    id: 'jaane-bhi-do-yaaro', t: 'Jaane Bhi Do Yaaro', y: 1983, ind: 'bollywood', lang: 'hindi',
    g: ['Comedy', 'Dark Comedy'], sg: ['Satire'], th: ['corruption', 'absurd', 'cult classic'],
    r: 132, im: 8.3, v: 25000, p: ['prime'],
    c: ['Naseeruddin Shah', 'Ravi Baswani', 'Om Puri', 'Satish Shah'], d: 'Kundan Shah',
    syn: 'Two idealistic photographers stumble onto a construction scandal and a corpse they cannot get rid of.',
    rth: 'comedy+ story+ production~',
    rec: 'India’s most quoted satire — the Mahabharata sequence is legendary, and the film’s bleak punchline lands harder every decade. The production is rough and visibly cheap.',
    at: A({ humour: 0.95, weight: 0.5, complexity: 0.5, familyFriendly: 0.5, realism: 0.4, intensity: 0.3 }),
  },
  {
    id: 'masoom', t: 'Masoom', y: 1983, ind: 'bollywood', lang: 'hindi',
    g: ['Drama', 'Family'], th: ['family bonds', 'emotional'],
    r: 145, im: 8.2, v: 12000, p: ['prime'],
    c: ['Naseeruddin Shah', 'Shabana Azmi', 'Jugal Hansraj'], d: 'Shekhar Kapur',
    syn: 'A man’s son from a past affair arrives at the family home, and his wife has to decide what to do about a child who did nothing wrong.',
    rth: 'emotion+ acting+ music+',
    rec: 'Regularly named one of the most affecting Hindi family dramas, with the child performances and the R.D. Burman score singled out. Quiet and unhurried throughout.',
    at: A({ emotion: 0.95, weight: 0.55, character: 0.9, familyFriendly: 0.7, pace: 0.3, intensity: 0.3, humour: 0.15 }),
  },
  {
    id: 'mr-india', t: 'Mr. India', y: 1987, ind: 'bollywood', lang: 'hindi',
    g: ['Action', 'Adventure', 'Family'], sg: ['Superhero'], th: ['iconic villain', 'underdog'],
    r: 179, im: 7.7, v: 30000, p: ['prime'],
    c: ['Anil Kapoor', 'Sridevi', 'Amrish Puri'], d: 'Shekhar Kapur',
    syn: 'A struggling violinist inherits a watch that makes him invisible, and takes on a warlord with it.',
    rth: 'comedy+ music+ acting+ production~',
    rec: 'Mogambo remains one of Hindi cinema’s great villains and the songs are permanent fixtures. The effects are of their time and nobody minds.',
    at: A({ action: 0.6, humour: 0.75, familyFriendly: 0.9, spectacle: 0.6, realism: 0.25, weight: 0.2 }),
  },
  {
    id: 'ardh-satya', t: 'Ardh Satya', y: 1983, ind: 'bollywood', lang: 'hindi',
    g: ['Crime', 'Drama'], sg: ['Police Drama'], th: ['corruption', 'bleak', 'morally grey'],
    r: 130, im: 8.3, v: 8000, p: ['prime'],
    c: ['Om Puri', 'Smita Patil', 'Amrish Puri'], d: 'Govind Nihalani',
    syn: 'An honest police officer is ground down by the system he joined to serve.',
    rth: 'acting+ story+ emotion+',
    rec: 'Om Puri’s finest performance according to most who have seen it, and one of the bleakest films Hindi cinema has produced. Not an easy watch and never pretends to be.',
    at: A({ weight: 0.9, intensity: 0.75, realism: 0.95, character: 0.9, familyFriendly: 0.05, humour: 0.02, pace: 0.35 }),
  },

  // ------------------------------------------------- BOLLYWOOD — 1990s
  {
    id: 'andaz-apna-apna', t: 'Andaz Apna Apna', y: 1994, ind: 'bollywood', lang: 'hindi',
    g: ['Comedy'], sg: ['Farce'], th: ['cult classic', 'absurd'],
    r: 160, im: 8.1, v: 60000, p: ['netflix'],
    c: ['Aamir Khan', 'Salman Khan', 'Raveena Tandon', 'Paresh Rawal'], d: 'Rajkumar Santoshi',
    syn: 'Two layabouts both try to marry the same heiress, and neither is remotely equipped for the con.',
    rth: 'comedy+ acting+ story~',
    rec: 'A flop on release that became the most quoted comedy in Hindi cinema — every second line is a reference now. The plot is nonsense and that is entirely fine.',
    at: A({ humour: 0.95, weight: 0.1, intensity: 0.15, familyFriendly: 0.85, realism: 0.15, complexity: 0.2 }),
  },
  {
    id: 'satya', t: 'Satya', y: 1998, ind: 'bollywood', lang: 'hindi',
    g: ['Crime', 'Drama', 'Thriller'], sg: ['Gangster'], th: ['underworld', 'bleak', 'morally grey'],
    r: 170, im: 8.2, v: 30000, p: ['prime'],
    c: ['J.D. Chakravarthy', 'Manoj Bajpayee', 'Urmila Matondkar'], d: 'Ram Gopal Varma',
    syn: 'A man arriving in Bombay with nothing is pulled into the underworld almost by accident.',
    rth: 'acting+ story+ music+ production+',
    rec: 'The film that reset Hindi crime cinema — Manoj Bajpayee’s Bhiku Mhatre is the performance everyone cites, and the Bombay it captures feels lived in rather than staged.',
    at: A({ weight: 0.85, intensity: 0.8, realism: 0.9, character: 0.8, familyFriendly: 0.05, pace: 0.6 }),
  },
  {
    id: 'sarfarosh', t: 'Sarfarosh', y: 1999, ind: 'bollywood', lang: 'hindi',
    g: ['Action', 'Crime', 'Thriller'], sg: ['Police Drama'], th: ['duty', 'investigation'],
    r: 174, im: 8.1, v: 32000, p: ['prime'],
    c: ['Aamir Khan', 'Naseeruddin Shah', 'Sonali Bendre'], d: 'John Matthew Matthan',
    syn: 'A police officer tracing an arms pipeline finds the trail leads somewhere he did not expect.',
    rth: 'story+ acting+ suspense+',
    rec: 'Held up as one of the best-constructed Hindi thrillers of its decade, with Naseeruddin Shah’s antagonist drawing particular praise for being written as a person rather than a caricature.',
    at: A({ action: 0.65, intensity: 0.7, complexity: 0.6, realism: 0.75, twist: 0.4, weight: 0.55 }),
  },
  {
    id: 'ddlj', t: 'Dilwale Dulhania Le Jayenge', y: 1995, ind: 'bollywood', lang: 'hindi',
    g: ['Romance', 'Comedy', 'Drama'], th: ['family bonds', 'feel good'],
    r: 189, im: 8.0, v: 82000, p: ['prime'],
    c: ['Shah Rukh Khan', 'Kajol', 'Amrish Puri'], d: 'Aditya Chopra',
    syn: 'Two Londoners fall for each other on a Europe trip, and he decides to win her family over rather than elope.',
    rth: 'music+ acting+ emotion+ pacing~',
    rec: 'The most-watched Hindi romance ever made and still running in a Mumbai cinema. Its politics are debated now; its hold on people is not.',
    at: A({ romance: 0.95, emotion: 0.85, humour: 0.6, familyFriendly: 0.9, weight: 0.25, pace: 0.4 }),
  },

  // ------------------------------------------------- BOLLYWOOD — 2000s
  {
    id: 'dil-chahta-hai', t: 'Dil Chahta Hai', y: 2001, ind: 'bollywood', lang: 'hindi',
    g: ['Comedy', 'Drama', 'Romance'], sg: ['Coming of Age'], th: ['friendship', 'feel good'],
    r: 183, im: 8.1, v: 75000, p: ['netflix'],
    c: ['Aamir Khan', 'Saif Ali Khan', 'Akshaye Khanna', 'Preity Zinta'], d: 'Farhan Akhtar',
    syn: 'Three friends leave college with very different ideas about love, and fall out over them.',
    rth: 'story+ acting+ music+ emotion+',
    rec: 'Widely credited with modernising the Hindi mainstream — the friendship feels real and the Akshaye Khanna strand is the one people say broke them.',
    at: A({ humour: 0.6, emotion: 0.75, character: 0.85, romance: 0.6, weight: 0.3, familyFriendly: 0.75, realism: 0.8 }),
  },
  {
    id: 'lagaan', t: 'Lagaan', y: 2001, ind: 'bollywood', lang: 'hindi',
    g: ['Drama', 'Sport', 'History'], sg: ['Period'], th: ['underdog', 'colonial'],
    r: 224, im: 8.1, v: 120000, rtc: 96, p: ['netflix'],
    c: ['Aamir Khan', 'Gracy Singh', 'Rachel Shelley'], d: 'Ashutosh Gowariker',
    syn: 'A village in colonial India is offered a way out of its tax burden: beat the British at cricket.',
    rth: 'story+ music+ emotion+ pacing~',
    rec: 'An Oscar nominee that people describe as gripping despite a four-hour runtime, with the final match routinely called the best sports sequence in Indian film. The length is the only reservation.',
    at: A({ emotion: 0.85, spectacle: 0.7, familyFriendly: 0.9, weight: 0.4, pace: 0.4, character: 0.7 }),
  },
  {
    id: 'munna-bhai', t: 'Munna Bhai M.B.B.S.', y: 2003, ind: 'bollywood', lang: 'hindi',
    g: ['Comedy', 'Drama'], th: ['feel good', 'family bonds'],
    r: 156, im: 8.1, v: 96000, p: ['netflix'],
    c: ['Sanjay Dutt', 'Arshad Warsi', 'Boman Irani'], d: 'Rajkumar Hirani',
    syn: 'A Mumbai gangster fakes his way into medical college to keep up a lie he told his parents.',
    rth: 'comedy+ emotion+ acting+',
    rec: 'Warm, very funny, and the hug-as-medicine idea landed far beyond the film. The Sanjay Dutt and Arshad Warsi pairing is what people remember.',
    at: A({ humour: 0.85, emotion: 0.8, familyFriendly: 0.9, weight: 0.2, character: 0.7, realism: 0.5 }),
  },
  {
    id: 'swades', t: 'Swades', y: 2004, ind: 'bollywood', lang: 'hindi',
    g: ['Drama'], th: ['returning home', 'social'],
    r: 210, im: 8.2, v: 90000, p: ['netflix'],
    c: ['Shah Rukh Khan', 'Gayatri Joshi', 'Kishori Ballal'], d: 'Ashutosh Gowariker',
    syn: 'A NASA engineer comes back to India to find his childhood nanny and ends up staying rather longer.',
    rth: 'acting+ emotion+ music+ pacing-',
    rec: 'Considered Shah Rukh Khan’s most restrained performance, and the train-station water scene comes up in every discussion. It is long and slow, which is the standard caveat.',
    at: A({ emotion: 0.85, realism: 0.9, character: 0.85, pace: 0.2, weight: 0.45, familyFriendly: 0.85, humour: 0.2 }),
  },
  {
    id: 'rang-de-basanti', t: 'Rang De Basanti', y: 2006, ind: 'bollywood', lang: 'hindi',
    g: ['Drama', 'History'], th: ['friendship', 'social', 'political'],
    r: 167, im: 8.1, v: 125000, p: ['netflix'],
    c: ['Aamir Khan', 'Siddharth', 'R. Madhavan', 'Kunal Kapoor'], d: 'Rakeysh Omprakash Mehra',
    syn: 'Students playing freedom fighters in a documentary find the parallels catching up with their own lives.',
    rth: 'music+ story+ emotion+ ending~',
    rec: 'A cultural moment as much as a film, with the A.R. Rahman score and the tonal turn in the second half drawing the most comment. Where it ends up divides people sharply.',
    at: A({ emotion: 0.85, intensity: 0.7, weight: 0.65, character: 0.75, humour: 0.4, pace: 0.55 }),
  },
  {
    id: 'omkara', t: 'Omkara', y: 2006, ind: 'bollywood', lang: 'hindi',
    g: ['Crime', 'Drama'], sg: ['Adaptation'], th: ['jealousy', 'bleak', 'morally grey'],
    r: 155, im: 8.1, v: 40000, p: ['prime'],
    c: ['Ajay Devgn', 'Saif Ali Khan', 'Kareena Kapoor', 'Konkona Sen Sharma'], d: 'Vishal Bhardwaj',
    syn: 'Othello relocated to the badlands of Uttar Pradesh, where a lieutenant passed over for promotion decides to destroy everything.',
    rth: 'acting+ story+ music+',
    rec: 'Saif Ali Khan’s Langda Tyagi is regularly called one of the great Hindi screen villains, and the transposition of Shakespeare to UP is treated as seamless. Bleak and profane.',
    at: A({ weight: 0.85, intensity: 0.8, character: 0.9, realism: 0.85, familyFriendly: 0.05, complexity: 0.7 }),
  },
  {
    id: 'khosla-ka-ghosla', t: 'Khosla Ka Ghosla', y: 2006, ind: 'bollywood', lang: 'hindi',
    g: ['Comedy', 'Drama'], sg: ['Caper'], th: ['underdog', 'family bonds', 'con'],
    r: 134, im: 8.1, v: 22000, p: ['prime'],
    c: ['Anupam Kher', 'Boman Irani', 'Parvin Dabas'], d: 'Dibakar Banerjee',
    syn: 'A retired Delhi clerk’s plot of land is grabbed by a property shark, so his family runs a con to get it back.',
    rth: 'comedy+ story+ acting+',
    rec: 'A small, extremely well-observed Delhi comedy that people recommend to each other rather than find on a homepage. The middle-class detail is what everybody mentions.',
    at: A({ humour: 0.8, realism: 0.9, familyFriendly: 0.8, weight: 0.25, complexity: 0.5, character: 0.75 }),
  },
  {
    id: 'johnny-gaddaar', t: 'Johnny Gaddaar', y: 2007, ind: 'bollywood', lang: 'hindi',
    g: ['Crime', 'Thriller'], sg: ['Neo-Noir', 'Heist'], th: ['betrayal', 'twist ending', 'intricate plot'],
    r: 125, im: 8.0, v: 18000, p: ['prime'],
    c: ['Neil Nitin Mukesh', 'Dharmendra', 'Vinay Pathak', 'Rimi Sen'], d: 'Sriram Raghavan',
    syn: 'Five men plan one clean deal. One takes the money for himself and spends the rest of the film covering a mistake with a bigger mistake.',
    rth: 'story+ suspense+ production+ ending+',
    rec: 'A cult favourite found almost entirely by word of mouth — the plotting and the retro styling get consistent praise, and it is regularly called one of the best Hindi noirs ever made.',
    at: A({ twist: 0.85, complexity: 0.8, intensity: 0.75, pace: 0.8, weight: 0.7, familyFriendly: 0.1, realism: 0.7 }),
  },
  {
    id: 'chak-de-india', t: 'Chak De! India', y: 2007, ind: 'bollywood', lang: 'hindi',
    g: ['Drama', 'Sport'], th: ['underdog', 'redemption', 'team'],
    r: 153, im: 8.2, v: 90000, p: ['prime'],
    c: ['Shah Rukh Khan', 'Vidya Malvade', 'Sagarika Ghatge'], d: 'Shimit Amin',
    syn: 'A disgraced hockey captain is handed the women’s national team nobody else wants to coach.',
    rth: 'emotion+ story+ acting+',
    rec: 'The sports film Indians actually rewatch — the team is written as sixteen people rather than a backdrop, and the final is genuinely tense. Very few criticisms.',
    at: A({ emotion: 0.85, familyFriendly: 0.9, intensity: 0.6, character: 0.7, pace: 0.65, weight: 0.35 }),
  },
  {
    id: 'taare-zameen-par', t: 'Taare Zameen Par', y: 2007, ind: 'bollywood', lang: 'hindi',
    g: ['Drama', 'Family'], th: ['emotional', 'family bonds', 'childhood'],
    r: 165, im: 8.3, v: 210000, p: ['netflix'],
    c: ['Darsheel Safary', 'Aamir Khan', 'Tisca Chopra'], d: 'Aamir Khan',
    syn: 'A boy who cannot read is sent to boarding school as a discipline problem, until one teacher works out what is actually going on.',
    rth: 'emotion+ acting+ music+ pacing~',
    rec: 'The film people most often say made them cry, with the child lead’s performance and the dyslexia storyline widely credited with changing conversations in Indian schools.',
    at: A({ emotion: 0.98, familyFriendly: 0.95, weight: 0.4, character: 0.9, humour: 0.3, pace: 0.35, realism: 0.8 }),
  },
  {
    id: 'a-wednesday', t: 'A Wednesday!', y: 2008, ind: 'bollywood', lang: 'hindi',
    g: ['Thriller', 'Crime', 'Drama'], sg: ['Real Time'], th: ['twist ending', 'tense', 'ordinary man'],
    r: 104, im: 8.1, v: 82000, p: ['prime'],
    c: ['Naseeruddin Shah', 'Anupam Kher', 'Jimmy Sheirgill'], d: 'Neeraj Pandey',
    syn: 'A man calls the Mumbai police commissioner claiming to have planted bombs across the city, and refuses to say why.',
    rth: 'suspense+ acting+ ending+ pacing+',
    rec: 'A tight 104 minutes that almost nobody finds slow, carried by Naseeruddin Shah and a reveal that reframes everything. Its politics draw some criticism.',
    at: A({ twist: 0.9, intensity: 0.85, pace: 0.9, complexity: 0.6, weight: 0.6, realism: 0.8, familyFriendly: 0.3 }),
  },
  {
    id: '3-idiots', t: '3 Idiots', y: 2009, ind: 'bollywood', lang: 'hindi',
    g: ['Comedy', 'Drama'], th: ['friendship', 'feel good', 'education'],
    r: 170, im: 8.4, v: 430000, p: ['prime'],
    c: ['Aamir Khan', 'R. Madhavan', 'Sharman Joshi', 'Boman Irani'], d: 'Rajkumar Hirani',
    syn: 'Three engineering students survive a college designed to break them, and years later go looking for the one who vanished.',
    rth: 'comedy+ emotion+ story+ pacing~',
    rec: 'One of the most widely seen Indian films anywhere, praised for making a point about education without lecturing. Some find the sentimentality heavy in the last act.',
    at: A({ humour: 0.85, emotion: 0.85, familyFriendly: 0.9, weight: 0.25, character: 0.75, pace: 0.6 }),
  },
  {
    id: 'oye-lucky', t: 'Oye Lucky! Lucky Oye!', y: 2008, ind: 'bollywood', lang: 'hindi',
    g: ['Comedy', 'Crime'], sg: ['Caper'], th: ['con', 'cult classic'],
    r: 128, im: 7.9, v: 15000, p: ['prime'],
    c: ['Abhay Deol', 'Paresh Rawal', 'Neetu Chandra'], d: 'Dibakar Banerjee',
    syn: 'A Delhi thief steals almost anything not nailed down, mostly because he can.',
    rth: 'comedy+ acting+ story+',
    rec: 'Dry, very specific Delhi humour and Paresh Rawal in three roles — a film with a small but extremely loyal following.',
    at: A({ humour: 0.85, realism: 0.85, weight: 0.3, character: 0.8, pace: 0.6, familyFriendly: 0.5 }),
  },

  // ------------------------------------------------- BOLLYWOOD — 2010s
  {
    id: 'udaan', t: 'Udaan', y: 2010, ind: 'bollywood', lang: 'hindi',
    g: ['Drama'], sg: ['Coming of Age'], th: ['father son', 'escape'],
    r: 134, im: 8.1, v: 42000, p: ['prime'],
    c: ['Rajat Barmecha', 'Ronit Roy', 'Ram Kapoor'], d: 'Vikramaditya Motwane',
    syn: 'A boy expelled from boarding school is sent home to a father who runs the house like a factory floor.',
    rth: 'acting+ story+ emotion+',
    rec: 'Ronit Roy’s father is one of the most frightening portrayals in recent Hindi cinema, and the ending is quietly triumphant. Uncomfortable to watch in stretches.',
    at: A({ weight: 0.75, emotion: 0.85, character: 0.95, realism: 0.9, intensity: 0.6, familyFriendly: 0.2, pace: 0.4 }),
  },
  {
    id: 'kahaani', t: 'Kahaani', y: 2012, ind: 'bollywood', lang: 'hindi',
    g: ['Thriller', 'Mystery', 'Drama'], sg: ['Neo-Noir'], th: ['twist ending', 'investigation', 'unreliable narrator'],
    r: 122, im: 8.1, v: 76000, p: ['prime'],
    c: ['Vidya Balan', 'Parambrata Chatterjee', 'Nawazuddin Siddiqui'], d: 'Sujoy Ghosh',
    syn: 'A pregnant woman arrives in Kolkata during Durga Puja to look for her missing husband, and finds nobody will admit he existed.',
    rth: 'suspense+ acting+ ending+ production+',
    rec: 'The twist and Vidya Balan’s performance dominate every discussion, and Kolkata functions as a character in its own right. Rewatch value is the standard caveat.',
    at: A({ twist: 0.95, complexity: 0.75, intensity: 0.7, pace: 0.65, character: 0.7, weight: 0.6, familyFriendly: 0.3 }),
  },
  {
    id: 'paan-singh-tomar', t: 'Paan Singh Tomar', y: 2012, ind: 'bollywood', lang: 'hindi',
    g: ['Biography', 'Action', 'Drama'], th: ['true story', 'underdog', 'injustice'],
    r: 135, im: 8.2, v: 40000, p: ['prime'],
    c: ['Irrfan Khan', 'Mahie Gill', 'Vipin Sharma'], d: 'Tigmanshu Dhulia',
    syn: 'A national steeplechase champion turns dacoit after the state fails to protect his family’s land.',
    rth: 'acting+ story+ emotion+',
    rec: 'Irrfan Khan at his absolute best according to most viewers, and the true story behind it makes the ending land harder. Rough around the edges technically.',
    at: A({ weight: 0.7, realism: 0.9, character: 0.9, intensity: 0.65, emotion: 0.75, action: 0.5, pace: 0.55 }),
  },
  {
    id: 'gangs-of-wasseypur', t: 'Gangs of Wasseypur', y: 2012, ind: 'bollywood', lang: 'hindi',
    g: ['Crime', 'Drama', 'Action'], sg: ['Gangster', 'Epic'], th: ['revenge', 'generational', 'morally grey'],
    r: 321, im: 8.2, v: 105000, p: ['netflix'],
    c: ['Manoj Bajpayee', 'Nawazuddin Siddiqui', 'Richa Chadha', 'Huma Qureshi'], d: 'Anurag Kashyap',
    syn: 'Three generations of a coal-belt feud, told across five hours and a great deal of bloodshed.',
    rth: 'acting+ music+ story+ pacing~',
    rec: 'Sprawling, funny and brutal in roughly equal measure, with a soundtrack that became a phenomenon on its own. The length puts a lot of people off, and the violence is not decorative.',
    at: A({ weight: 0.85, intensity: 0.9, character: 0.85, realism: 0.85, humour: 0.5, familyFriendly: 0.02, pace: 0.5, complexity: 0.8 }),
  },
  {
    id: 'special-26', t: 'Special 26', y: 2013, ind: 'bollywood', lang: 'hindi',
    g: ['Crime', 'Thriller'], sg: ['Heist', 'Caper'], th: ['con', 'true story', 'intricate plot'],
    r: 144, im: 8.0, v: 55000, p: ['netflix'],
    c: ['Akshay Kumar', 'Manoj Bajpayee', 'Anupam Kher'], d: 'Neeraj Pandey',
    syn: 'A gang posing as CBI officers raids the homes of the corrupt, with a real officer closing in.',
    rth: 'story+ acting+ suspense+',
    rec: 'A properly satisfying con film based on a real 1980s case, and the Akshay Kumar–Manoj Bajpayee cat and mouse is what carries it.',
    at: A({ twist: 0.7, complexity: 0.7, pace: 0.7, humour: 0.4, weight: 0.35, familyFriendly: 0.7, realism: 0.75 }),
  },
  {
    id: 'bhaag-milkha-bhaag', t: 'Bhaag Milkha Bhaag', y: 2013, ind: 'bollywood', lang: 'hindi',
    g: ['Biography', 'Drama', 'Sport'], th: ['true story', 'underdog', 'partition'],
    r: 186, im: 8.2, v: 65000, p: ['netflix'],
    c: ['Farhan Akhtar', 'Sonam Kapoor', 'Pawan Malhotra'], d: 'Rakeysh Omprakash Mehra',
    syn: 'The sprinter Milkha Singh runs from Partition to the Rome Olympics, and from a memory he cannot outpace.',
    rth: 'acting+ emotion+ music+ pacing-',
    rec: 'Farhan Akhtar’s physical transformation and commitment carry the film, and the Partition sequences are its strongest material. It is very long.',
    at: A({ emotion: 0.85, intensity: 0.6, character: 0.8, weight: 0.55, spectacle: 0.6, pace: 0.45, familyFriendly: 0.75 }),
  },
  {
    id: 'queen', t: 'Queen', y: 2013, ind: 'bollywood', lang: 'hindi',
    g: ['Comedy', 'Drama'], sg: ['Coming of Age'], th: ['feel good', 'independence', 'travel'],
    r: 146, im: 8.1, v: 70000, p: ['prime'],
    c: ['Kangana Ranaut', 'Rajkummar Rao', 'Lisa Haydon'], d: 'Vikas Bahl',
    syn: 'Jilted days before her wedding, a sheltered Delhi girl goes on the honeymoon by herself.',
    rth: 'acting+ emotion+ comedy+',
    rec: 'Kangana Ranaut’s performance is the whole film and is almost universally praised. Warm without being saccharine, which is the hard part.',
    at: A({ humour: 0.7, emotion: 0.85, familyFriendly: 0.8, weight: 0.25, character: 0.9, realism: 0.75 }),
  },
  {
    id: 'haider', t: 'Haider', y: 2014, ind: 'bollywood', lang: 'hindi',
    g: ['Crime', 'Drama'], sg: ['Adaptation', 'Political'], th: ['bleak', 'kashmir', 'revenge'],
    r: 160, im: 8.0, v: 60000, p: ['netflix'],
    c: ['Shahid Kapoor', 'Tabu', 'Kay Kay Menon', 'Shraddha Kapoor'], d: 'Vishal Bhardwaj',
    syn: 'Hamlet in 1995 Kashmir, where a student returns to find his father disappeared and his mother remarried.',
    rth: 'acting+ production+ music+ pacing~',
    rec: 'Tabu’s performance and the decision to set Hamlet in Kashmir draw enormous praise, and the film is politically braver than most. Slow and heavy.',
    at: A({ weight: 0.9, intensity: 0.75, complexity: 0.8, character: 0.9, familyFriendly: 0.05, pace: 0.3, emotion: 0.8 }),
  },
  {
    id: 'drishyam-2015', t: 'Drishyam', y: 2015, ind: 'bollywood', lang: 'hindi',
    g: ['Thriller', 'Crime', 'Drama'], sg: ['Procedural'], th: ['ordinary man', 'family bonds', 'intricate plot', 'cover-up'],
    r: 163, im: 8.2, v: 90000, p: ['prime'],
    c: ['Ajay Devgn', 'Tabu', 'Shriya Saran'], d: 'Nishikant Kamat',
    syn: 'A cable operator with a fourth-grade education builds an elaborate alibi to protect his family from a police investigation.',
    rth: 'story+ suspense+ acting+ pacing~ family+',
    rec: 'Audiences single out the premise and the slow tightening of the trap, and the family dynamic gives the suspense real weight. The first half takes its time.',
    at: A({ twist: 0.8, complexity: 0.85, intensity: 0.7, character: 0.8, emotion: 0.7, familyFriendly: 0.5, pace: 0.5, realism: 0.85 }),
  },
  {
    id: 'talvar', t: 'Talvar', y: 2015, ind: 'bollywood', lang: 'hindi',
    g: ['Crime', 'Drama', 'Mystery'], sg: ['Procedural'], th: ['investigation', 'true story', 'unreliable narrator'],
    r: 132, im: 8.1, v: 32000, p: ['prime'],
    c: ['Irrfan Khan', 'Konkona Sen Sharma', 'Neeraj Kabi'], d: 'Meghna Gulzar',
    syn: 'Three competing accounts of the same double murder investigation, told without telling you which to believe.',
    rth: 'story+ acting+ suspense+ ending~',
    rec: 'The Rashomon structure and Irrfan Khan’s performance are what viewers talk about, along with how restrained the film is with a sensational case. The lack of resolution frustrates some.',
    at: A({ complexity: 0.85, realism: 0.95, weight: 0.7, character: 0.75, twist: 0.5, pace: 0.5, familyFriendly: 0.2 }),
  },
  {
    id: 'masaan', t: 'Masaan', y: 2015, ind: 'bollywood', lang: 'hindi',
    g: ['Drama', 'Romance'], th: ['caste', 'grief', 'emotional'],
    r: 109, im: 8.1, v: 32000, p: ['prime'],
    c: ['Richa Chadha', 'Vicky Kaushal', 'Sanjay Mishra'], d: 'Neeraj Ghaywan',
    syn: 'Two stories along the ghats of Varanasi — a young woman caught in a scandal, and a boy from a cremation-ground caste who falls for a girl above his station.',
    rth: 'emotion+ acting+ music+ pacing~',
    rec: 'Quietly devastating, with the two parallel stories, the Varanasi setting and the soundtrack drawing the most praise. Viewers wanting plot momentum find it slow.',
    at: A({ emotion: 0.95, weight: 0.7, character: 0.9, realism: 0.95, pace: 0.25, romance: 0.6, familyFriendly: 0.3 }),
  },
  {
    id: 'pink', t: 'Pink', y: 2016, ind: 'bollywood', lang: 'hindi',
    g: ['Crime', 'Drama', 'Thriller'], sg: ['Courtroom'], th: ['consent', 'social', 'justice'],
    r: 136, im: 8.1, v: 60000, p: ['prime'],
    c: ['Amitabh Bachchan', 'Taapsee Pannu', 'Kirti Kulhari'], d: 'Aniruddha Roy Chowdhury',
    syn: 'Three women in Delhi are dragged through a courtroom after defending themselves.',
    rth: 'acting+ story+ emotion+',
    rec: 'The courtroom scenes and Amitabh Bachchan’s closing arguments are what the film is remembered for, and it is credited with shifting a public conversation.',
    at: A({ weight: 0.75, intensity: 0.7, realism: 0.9, character: 0.8, emotion: 0.8, familyFriendly: 0.3, pace: 0.55 }),
  },
  {
    id: 'dangal', t: 'Dangal', y: 2016, ind: 'bollywood', lang: 'hindi',
    g: ['Biography', 'Drama', 'Sport'], th: ['true story', 'underdog', 'father daughter'],
    r: 161, im: 8.3, v: 220000, p: ['netflix'],
    c: ['Aamir Khan', 'Fatima Sana Shaikh', 'Sanya Malhotra'], d: 'Nitesh Tiwari',
    syn: 'A wrestler trains his daughters to win the gold he never could, whether the village likes it or not.',
    rth: 'emotion+ acting+ story+',
    rec: 'The highest-grossing Indian film of its time and one of the best-reviewed — the wrestling is convincing and the father-daughter relationship is why it travelled.',
    at: A({ emotion: 0.9, intensity: 0.7, familyFriendly: 0.9, character: 0.8, realism: 0.85, weight: 0.4, pace: 0.6 }),
  },
  {
    id: 'newton', t: 'Newton', y: 2017, ind: 'bollywood', lang: 'hindi',
    g: ['Comedy', 'Drama'], sg: ['Satire', 'Political'], th: ['bureaucracy', 'idealism', 'election'],
    r: 106, im: 7.6, v: 30000, rtc: 100, p: ['prime'],
    c: ['Rajkummar Rao', 'Pankaj Tripathi', 'Anjali Patil'], d: 'Amit Masurkar',
    syn: 'A junior clerk is sent to run a polling booth in a Naxal-controlled forest, and insists on doing it properly.',
    rth: 'story+ acting+ comedy+',
    rec: 'Dry, deadpan and very well reviewed internationally, with Pankaj Tripathi frequently stealing the film. Its quietness is the reason it stayed niche.',
    at: A({ humour: 0.6, realism: 0.95, weight: 0.5, character: 0.8, pace: 0.35, complexity: 0.5, familyFriendly: 0.5 }),
  },
  {
    id: 'tumbbad', t: 'Tumbbad', y: 2018, ind: 'bollywood', lang: 'hindi',
    g: ['Horror', 'Fantasy', 'Drama'], sg: ['Folklore', 'Period'], th: ['greed', 'mythology', 'atmospheric'],
    r: 104, im: 8.2, v: 60000, p: ['prime'],
    c: ['Sohum Shah', 'Jyoti Malshe', 'Anita Date'], d: 'Rahi Anil Barve',
    syn: 'Across three decades in a rain-soaked Maharashtrian village, a man returns again and again to a cursed treasure guarded by something that should have stayed buried.',
    rth: 'visuals+ production+ story+ suspense+ pacing~',
    rec: 'Almost universally praised for its production design and cinematography — the rain-drenched look is what people remember. Opinion divides on the mythology, left deliberately half-explained.',
    at: A({ weight: 0.85, intensity: 0.75, spectacle: 0.85, realism: 0.25, complexity: 0.65, familyFriendly: 0.1, pace: 0.45 }),
  },
  {
    id: 'andhadhun', t: 'Andhadhun', y: 2018, ind: 'bollywood', lang: 'hindi',
    g: ['Thriller', 'Crime', 'Dark Comedy'], sg: ['Neo-Noir'], th: ['twist ending', 'unreliable narrator', 'intricate plot', 'dark humour'],
    r: 139, im: 8.2, v: 105000, p: ['netflix'],
    c: ['Ayushmann Khurrana', 'Tabu', 'Radhika Apte'], d: 'Sriram Raghavan',
    syn: 'A pianist who pretends to be blind becomes the unwilling witness to a murder, and the lie he built his life around starts collapsing in increasingly absurd directions.',
    rth: 'story+ acting+ suspense+ comedy+ ending~',
    rec: 'Widely admired for its tight plotting and Tabu’s performance, with viewers repeatedly calling the mix of black comedy and thriller unusually confident. The ending is the one real dividing line.',
    at: A({ twist: 0.95, complexity: 0.9, humour: 0.65, intensity: 0.7, pace: 0.8, weight: 0.55, familyFriendly: 0.2, realism: 0.5 }),
  },
  {
    id: 'badhaai-ho', t: 'Badhaai Ho', y: 2018, ind: 'bollywood', lang: 'hindi',
    g: ['Comedy', 'Drama', 'Family'], th: ['family bonds', 'feel good', 'social'],
    r: 124, im: 7.8, v: 46000, p: ['prime'],
    c: ['Ayushmann Khurrana', 'Neena Gupta', 'Gajraj Rao'], d: 'Amit Ravindernath Sharma',
    syn: 'A grown man discovers his middle-aged mother is pregnant, and the neighbourhood finds out at roughly the same time.',
    rth: 'comedy+ acting+ family+ emotion+',
    rec: 'Gajraj Rao and Neena Gupta are the reason this worked — a broad comedy premise handled with unexpected tenderness.',
    at: A({ humour: 0.85, emotion: 0.7, familyFriendly: 0.85, weight: 0.2, realism: 0.8, character: 0.75 }),
  },
  {
    id: 'article-15', t: 'Article 15', y: 2019, ind: 'bollywood', lang: 'hindi',
    g: ['Crime', 'Drama', 'Mystery'], sg: ['Police Drama', 'Political'], th: ['caste', 'investigation', 'social'],
    r: 130, im: 8.1, v: 60000, p: ['netflix'],
    c: ['Ayushmann Khurrana', 'Sayani Gupta', 'Kumud Mishra'], d: 'Anubhav Sinha',
    syn: 'A newly posted police officer investigates the disappearance of three girls in rural Uttar Pradesh and runs headlong into the caste politics of the village.',
    rth: 'story+ acting+ production+ emotion+',
    rec: 'Praised as one of the more unflinching mainstream Hindi films of its decade, with particular credit to the atmosphere and supporting cast. Some feel the outsider-hero framing simplifies things.',
    at: A({ weight: 0.85, intensity: 0.75, realism: 0.95, complexity: 0.65, familyFriendly: 0.1, pace: 0.5, character: 0.7 }),
  },
  {
    id: 'uri', t: 'Uri: The Surgical Strike', y: 2019, ind: 'bollywood', lang: 'hindi',
    g: ['Action', 'War', 'Drama'], th: ['true story', 'duty', 'tense'],
    r: 138, im: 8.2, v: 78000, p: ['jiohotstar'],
    c: ['Vicky Kaushal', 'Yami Gautam', 'Paresh Rawal'], d: 'Aditya Dhar',
    syn: 'The planning and execution of the 2016 cross-border raid, hour by hour.',
    rth: 'production+ acting+ suspense+ story~',
    rec: 'The technical execution and Vicky Kaushal’s performance carry it, and the raid sequence is genuinely tense. Its politics are a point of contention for some viewers.',
    at: A({ action: 0.85, intensity: 0.85, spectacle: 0.7, pace: 0.8, weight: 0.55, realism: 0.7, familyFriendly: 0.4 }),
  },
  {
    id: 'raazi', t: 'Raazi', y: 2018, ind: 'bollywood', lang: 'hindi',
    g: ['Thriller', 'Drama'], sg: ['Spy', 'Period'], th: ['true story', 'duty', 'tense'],
    r: 138, im: 7.7, v: 42000, p: ['prime'],
    c: ['Alia Bhatt', 'Vicky Kaushal', 'Jaideep Ahlawat'], d: 'Meghna Gulzar',
    syn: 'A Kashmiri student is married into a Pakistani military family in 1971 so she can spy from inside it.',
    rth: 'acting+ suspense+ emotion+',
    rec: 'Alia Bhatt’s performance is the anchor, and the film is unusually sympathetic to people on both sides. Quiet and tense rather than action-driven.',
    at: A({ intensity: 0.75, weight: 0.65, character: 0.85, pace: 0.55, twist: 0.35, emotion: 0.75, realism: 0.85 }),
  },
  {
    id: 'stree', t: 'Stree', y: 2018, ind: 'bollywood', lang: 'hindi',
    g: ['Comedy', 'Horror'], sg: ['Horror Comedy', 'Folklore'], th: ['small town', 'dark humour'],
    r: 128, im: 7.5, v: 45000, p: ['jiohotstar'],
    c: ['Rajkummar Rao', 'Shraddha Kapoor', 'Pankaj Tripathi'], d: 'Amar Kaushik',
    syn: 'A small town believes a spirit abducts men during the festival, and one tailor decides to investigate.',
    rth: 'comedy+ acting+ story~ ending~',
    rec: 'A genuinely funny horror comedy with a sly feminist streak, carried by Pankaj Tripathi and Rajkummar Rao. The scares are mild and the ending sets up sequels.',
    at: A({ humour: 0.85, weight: 0.3, intensity: 0.45, familyFriendly: 0.55, realism: 0.35, pace: 0.65 }),
  },

  // ------------------------------------------------- BOLLYWOOD — 2020s
  {
    id: 'sardar-udham', t: 'Sardar Udham', y: 2021, ind: 'bollywood', lang: 'hindi',
    g: ['Biography', 'Drama', 'History'], sg: ['Period'], th: ['true story', 'revenge', 'colonial', 'bleak'],
    r: 164, im: 8.3, v: 42000, p: ['prime'],
    c: ['Vicky Kaushal', 'Banita Sandhu', 'Shaun Scott'], d: 'Shoojit Sircar',
    syn: 'The long, patient road that took Udham Singh from Jallianwala Bagh to a London drawing room twenty-one years later.',
    rth: 'production+ acting+ emotion+ pacing-',
    rec: 'The massacre sequence is described by many viewers as among the most harrowing put to film in Indian cinema, and the period craft is praised throughout. Pacing is the near-universal criticism.',
    at: A({ weight: 0.95, pace: 0.15, character: 0.85, realism: 0.9, emotion: 0.85, spectacle: 0.7, familyFriendly: 0.1, intensity: 0.6 }),
  },
  {
    id: 'shershaah', t: 'Shershaah', y: 2021, ind: 'bollywood', lang: 'hindi',
    g: ['Action', 'War', 'Biography'], th: ['true story', 'duty', 'emotional'],
    r: 135, im: 8.3, v: 130000, p: ['prime'],
    c: ['Sidharth Malhotra', 'Kiara Advani'], d: 'Vishnuvardhan',
    syn: 'The short life of Captain Vikram Batra, from officer training to Kargil.',
    rth: 'emotion+ acting+ music+ story~',
    rec: 'Rated very highly by audiences, who point to the battle sequences and the romance thread. Critics were more measured about how conventional the storytelling is.',
    at: A({ action: 0.75, emotion: 0.85, intensity: 0.7, romance: 0.5, weight: 0.5, familyFriendly: 0.6, pace: 0.65 }),
  },
  {
    id: '12th-fail', t: '12th Fail', y: 2023, ind: 'bollywood', lang: 'hindi',
    g: ['Drama', 'Biography'], th: ['underdog', 'true story', 'emotional', 'education'],
    r: 147, im: 8.8, v: 145000, p: ['jiohotstar'],
    c: ['Vikrant Massey', 'Medha Shankr', 'Anant V Joshi'], d: 'Vidhu Vinod Chopra',
    syn: 'A boy from a Chambal village with almost nothing to his name sets out to clear the civil services exam, failing his way forward.',
    rth: 'emotion+ acting+ story+ production+',
    rec: 'One of the most warmly received Hindi films in years, with viewers repeatedly describing it as genuinely inspiring rather than manipulative, and Vikrant Massey’s restraint getting particular credit.',
    at: A({ emotion: 0.95, realism: 0.95, character: 0.9, familyFriendly: 0.85, weight: 0.5, pace: 0.55, humour: 0.25 }),
    tr: 0.5,
  },
  {
    id: 'laapataa-ladies', t: 'Laapataa Ladies', y: 2024, ind: 'bollywood', lang: 'hindi',
    g: ['Comedy', 'Drama'], sg: ['Satire'], th: ['feel good', 'small town', 'mistaken identity'],
    r: 122, im: 8.3, v: 60000, p: ['netflix'],
    c: ['Nitanshi Goel', 'Pratibha Ranta', 'Sparsh Shrivastava', 'Ravi Kishan'], d: 'Kiran Rao',
    syn: 'Two brides in identical veils are swapped on a train, and neither husband notices for rather too long.',
    rth: 'comedy+ story+ acting+ emotion+',
    rec: 'Warm, funny and quietly pointed — viewers describe it as the rare social film that never lectures, and Ravi Kishan’s policeman is a favourite.',
    at: A({ humour: 0.8, emotion: 0.75, familyFriendly: 0.9, weight: 0.25, realism: 0.75, character: 0.8 }),
    tr: 0.6,
  },

  // ------------------------------------------------- SOUTH INDIAN
  {
    id: 'drishyam-mal', t: 'Drishyam (Malayalam)', y: 2013, ind: 'south-indian', lang: 'hindi-dubbed',
    g: ['Thriller', 'Crime', 'Drama'], sg: ['Procedural'], th: ['ordinary man', 'family bonds', 'cover-up', 'intricate plot'],
    r: 160, im: 8.3, v: 40000, p: ['prime'],
    c: ['Mohanlal', 'Meena', 'Asha Sharath'], d: 'Jeethu Joseph',
    syn: 'The original: a cable operator constructs an alibi from the films he has watched to protect his family.',
    rth: 'story+ acting+ suspense+',
    rec: 'Widely considered better than the remakes, with Mohanlal’s understatement and the tighter construction cited as the reasons. The Hindi dub is on most platforms.',
    at: A({ twist: 0.8, complexity: 0.85, intensity: 0.65, character: 0.85, emotion: 0.7, realism: 0.9, pace: 0.45 }),
  },
  {
    id: 'super-deluxe', t: 'Super Deluxe', y: 2019, ind: 'south-indian', lang: 'other-language',
    g: ['Drama', 'Dark Comedy'], sg: ['Anthology'], th: ['interlocking', 'absurd', 'morally grey'],
    r: 176, im: 8.3, v: 34000, p: ['netflix'],
    c: ['Vijay Sethupathi', 'Fahadh Faasil', 'Samantha'], d: 'Thiagarajan Kumararaja',
    syn: 'Four stories in one Chennai day — an affair gone wrong, a father who came home different, a schoolboy and a videotape, and a cult.',
    rth: 'acting+ visuals+ story+ pacing~ ending~',
    rec: 'Genuinely singular — the interlocking structure, the colour palette and Vijay Sethupathi’s performance draw heavy praise. Also openly divisive: the tonal swerves lose some viewers entirely.',
    at: A({ complexity: 0.95, weight: 0.75, humour: 0.55, realism: 0.5, character: 0.85, familyFriendly: 0.02, pace: 0.4 }),
  },
  {
    id: 'soorarai-pottru', t: 'Soorarai Pottru', y: 2020, ind: 'south-indian', lang: 'hindi-dubbed',
    g: ['Drama', 'Biography'], th: ['underdog', 'true story', 'emotional'],
    r: 153, im: 8.5, v: 120000, p: ['prime'],
    c: ['Suriya', 'Aparna Balamurali', 'Paresh Rawal'], d: 'Sudha Kongara',
    syn: 'A farmer’s son takes on the airline industry to build a carrier ordinary people can afford to fly.',
    rth: 'emotion+ acting+ story+ music+',
    rec: 'Strongly received for Suriya’s performance and for giving the female lead unusual agency for the genre. A minority find the underdog beats familiar.',
    at: A({ emotion: 0.9, intensity: 0.7, character: 0.85, familyFriendly: 0.8, weight: 0.45, pace: 0.65, realism: 0.8 }),
  },
  {
    id: 'kumbalangi-nights', t: 'Kumbalangi Nights', y: 2019, ind: 'south-indian', lang: 'hindi-dubbed',
    g: ['Drama', 'Comedy'], th: ['brothers', 'family bonds', 'atmospheric'],
    r: 135, im: 8.4, v: 40000, p: ['prime'],
    c: ['Shane Nigam', 'Soubin Shahir', 'Fahadh Faasil'], d: 'Madhu C. Narayanan',
    syn: 'Four brothers in a broken-down house on a Kerala backwater slowly become a family, while a very controlled man next door comes apart.',
    rth: 'acting+ story+ visuals+ emotion+',
    rec: 'Frequently named the best Malayalam film of recent years — Fahadh Faasil’s antagonist is quietly terrifying and the brothers feel completely real.',
    at: A({ character: 0.95, realism: 0.95, emotion: 0.8, humour: 0.5, weight: 0.45, pace: 0.35, familyFriendly: 0.5 }),
  },
  {
    id: 'vikram-vedha', t: 'Vikram Vedha', y: 2017, ind: 'south-indian', lang: 'hindi-dubbed',
    g: ['Action', 'Crime', 'Thriller'], sg: ['Neo-Noir'], th: ['morally grey', 'cat and mouse', 'intricate plot'],
    r: 147, im: 8.3, v: 40000, p: ['prime'],
    c: ['R. Madhavan', 'Vijay Sethupathi', 'Shraddha Srinath'], d: 'Pushkar–Gayathri',
    syn: 'A gangster surrenders to the officer hunting him and starts telling him stories, each one making the moral ground shakier.',
    rth: 'story+ acting+ suspense+',
    rec: 'The structure — a folk tale turned into a crime thriller — and Vijay Sethupathi’s performance are what everyone cites. Considered far superior to the Hindi remake.',
    at: A({ complexity: 0.85, twist: 0.7, intensity: 0.75, action: 0.6, weight: 0.65, character: 0.8, pace: 0.7 }),
  },
  {
    id: 'jai-bhim', t: 'Jai Bhim', y: 2021, ind: 'south-indian', lang: 'hindi-dubbed',
    g: ['Crime', 'Drama'], sg: ['Courtroom'], th: ['caste', 'true story', 'injustice', 'bleak'],
    r: 164, im: 8.7, v: 220000, p: ['prime'],
    c: ['Suriya', 'Lijomol Jose', 'Manikandan'], d: 'T. J. Gnanavel',
    syn: 'A lawyer takes on a case for a tribal woman whose husband has vanished in police custody.',
    rth: 'emotion+ acting+ story+',
    rec: 'One of the highest audience-rated Indian films ever, praised for its anger and its refusal to soften the custodial violence. Extremely hard to watch in places.',
    at: A({ weight: 0.95, emotion: 0.9, realism: 0.95, intensity: 0.8, familyFriendly: 0.05, character: 0.8, pace: 0.5 }),
  },
  {
    id: 'kantara', t: 'Kantara', y: 2022, ind: 'south-indian', lang: 'hindi-dubbed',
    g: ['Action', 'Drama', 'Fantasy'], sg: ['Folklore'], th: ['mythology', 'land', 'spectacular climax'],
    r: 148, im: 8.2, v: 175000, p: ['prime'],
    c: ['Rishab Shetty', 'Sapthami Gowda', 'Kishore'], d: 'Rishab Shetty',
    syn: 'A conflict over forest land in coastal Karnataka collides with a ritual tradition that turns out to be a great deal more literal than anyone assumed.',
    rth: 'production+ music+ story+ pacing~',
    rec: 'The final twenty minutes are the reason this film travelled — the climax and its sound design are described in near-ecstatic terms. The village-comedy first half is where opinion splits.',
    at: A({ intensity: 0.8, spectacle: 0.85, action: 0.7, realism: 0.35, weight: 0.6, pace: 0.55, familyFriendly: 0.4 }),
  },
  {
    id: 'ninety-six', t: '96', y: 2018, ind: 'south-indian', lang: 'hindi-dubbed',
    g: ['Romance', 'Drama'], th: ['first love', 'nostalgia', 'emotional'],
    r: 158, im: 8.5, v: 40000, p: ['netflix'],
    c: ['Vijay Sethupathi', 'Trisha'], d: 'C. Prem Kumar',
    syn: 'Two school sweethearts meet again at a reunion twenty-two years later, and spend one night talking.',
    rth: 'emotion+ acting+ music+ pacing~',
    rec: 'Beloved for its restraint — almost nothing happens and viewers describe it as devastating anyway. The pace is very slow by design.',
    at: A({ romance: 0.95, emotion: 0.95, pace: 0.15, character: 0.95, weight: 0.5, familyFriendly: 0.7, intensity: 0.2 }),
  },
  {
    id: 'kaithi', t: 'Kaithi', y: 2019, ind: 'south-indian', lang: 'hindi-dubbed',
    g: ['Action', 'Thriller', 'Crime'], sg: ['Survival'], th: ['one night', 'father daughter', 'tense'],
    r: 145, im: 8.3, v: 45000, p: ['netflix'],
    c: ['Karthi', 'Narain', 'George Maryan'], d: 'Lokesh Kanagaraj',
    syn: 'An ex-convict released on the day he was to meet his daughter is forced to drive a truckload of poisoned policemen through the night.',
    rth: 'suspense+ pacing+ production+ acting+',
    rec: 'Relentless, almost songless, and set over a single night — praised for sustaining tension without the usual detours.',
    at: A({ intensity: 0.95, pace: 0.9, action: 0.85, weight: 0.65, complexity: 0.5, familyFriendly: 0.2, realism: 0.6 }),
  },
  {
    id: 'baahubali-2', t: 'Baahubali 2: The Conclusion', y: 2017, ind: 'south-indian', lang: 'hindi-dubbed',
    g: ['Action', 'Drama', 'Fantasy'], sg: ['Epic'], th: ['betrayal', 'spectacle', 'mythology'],
    r: 167, im: 8.1, v: 100000, p: ['netflix'],
    c: ['Prabhas', 'Rana Daggubati', 'Anushka Shetty', 'Ramya Krishnan'], d: 'S. S. Rajamouli',
    syn: 'The answer to why Kattappa did it, and the war that follows.',
    rth: 'visuals+ production+ music+ story~',
    rec: 'The scale is what people talk about — battle sequences unlike anything Indian cinema had attempted. The plotting is broad and the effects are uneven in places.',
    at: A({ spectacle: 0.98, action: 0.9, intensity: 0.8, realism: 0.15, familyFriendly: 0.7, weight: 0.4, complexity: 0.35 }),
  },
  {
    id: 'asuran', t: 'Asuran', y: 2019, ind: 'south-indian', lang: 'hindi-dubbed',
    g: ['Action', 'Drama', 'Crime'], th: ['caste', 'revenge', 'father son'],
    r: 141, im: 8.4, v: 30000, p: ['netflix'],
    c: ['Dhanush', 'Manju Warrier', 'Ken Karunas'], d: 'Vetrimaaran',
    syn: 'A farmer who has spent years avoiding a fight has to protect his surviving son from a landowning family.',
    rth: 'acting+ story+ emotion+ production+',
    rec: 'Dhanush plays two ages of the same man and is praised for both. Violent, angry, and considered one of the best Tamil films of its decade.',
    at: A({ weight: 0.85, intensity: 0.85, action: 0.7, emotion: 0.85, realism: 0.85, familyFriendly: 0.05, character: 0.85 }),
  },
  {
    id: 'ratsasan', t: 'Ratsasan', y: 2018, ind: 'south-indian', lang: 'hindi-dubbed',
    g: ['Thriller', 'Crime', 'Mystery'], sg: ['Serial Killer', 'Procedural'], th: ['investigation', 'tense', 'twist ending'],
    r: 170, im: 8.4, v: 45000, p: ['netflix'],
    c: ['Vishnu Vishal', 'Amala Paul'], d: 'Ram Kumar',
    syn: 'An aspiring filmmaker turned policeman hunts a killer targeting schoolgirls.',
    rth: 'suspense+ story+ pacing+ ending+',
    rec: 'Regularly called the best Indian serial-killer thriller, with viewers warning that it is genuinely frightening in places. Some find the length excessive.',
    at: A({ intensity: 0.9, twist: 0.75, complexity: 0.7, weight: 0.8, pace: 0.75, familyFriendly: 0.05, realism: 0.65 }),
  },
  {
    id: 'pariyerum-perumal', t: 'Pariyerum Perumal', y: 2018, ind: 'south-indian', lang: 'hindi-dubbed',
    g: ['Drama'], th: ['caste', 'injustice', 'friendship'],
    r: 154, im: 8.7, v: 35000, p: ['netflix'],
    c: ['Kathir', 'Anandhi', 'Yogi Babu'], d: 'Mari Selvaraj',
    syn: 'A law student from an oppressed caste is befriended by a classmate whose family finds that unacceptable.',
    rth: 'story+ acting+ emotion+ visuals+',
    rec: 'Among the highest-rated Indian films on IMDb and almost unknown outside Tamil cinema — the final conversation is described as one of the most powerful scenes in recent Indian film.',
    at: A({ weight: 0.85, emotion: 0.9, realism: 0.95, character: 0.9, intensity: 0.6, familyFriendly: 0.2, pace: 0.45 }),
  },

  // ------------------------------------------------- HOLLYWOOD (dubbed)
  {
    id: 'the-dark-knight', t: 'The Dark Knight', y: 2008, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Action', 'Crime', 'Drama'], sg: ['Superhero'], th: ['iconic villain', 'morally grey', 'chaos'],
    r: 152, im: 9.0, v: 2900000, rtc: 94, p: ['jiohotstar'],
    c: ['Christian Bale', 'Heath Ledger', 'Aaron Eckhart'], d: 'Christopher Nolan',
    syn: 'A criminal with no name and no plan sets out to prove that anyone can be broken.',
    rth: 'acting+ story+ production+ pacing~',
    rec: 'Heath Ledger’s Joker is the reference point for the entire genre, and the film is widely treated as the best comic-book adaptation ever made. Its length and density divide a minority.',
    at: A({ action: 0.85, intensity: 0.9, weight: 0.75, complexity: 0.75, spectacle: 0.85, character: 0.8, familyFriendly: 0.3 }),
  },
  {
    id: 'inception', t: 'Inception', y: 2010, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Action', 'Science Fiction', 'Thriller'], sg: ['Heist'], th: ['intricate plot', 'dreams', 'twist ending'],
    r: 148, im: 8.8, v: 2600000, rtc: 87, p: ['jiohotstar'],
    c: ['Leonardo DiCaprio', 'Joseph Gordon-Levitt', 'Elliot Page', 'Tom Hardy'], d: 'Christopher Nolan',
    syn: 'A team of thieves who steal from inside dreams are asked to plant an idea instead.',
    rth: 'story+ production+ music+ complexity~',
    rec: 'Praised for making a genuinely complicated premise thrilling rather than confusing, and the final shot is still argued about. Some find it emotionally cold.',
    at: A({ complexity: 0.95, action: 0.75, spectacle: 0.9, twist: 0.7, intensity: 0.8, pace: 0.75, weight: 0.55 }),
  },
  {
    id: 'interstellar', t: 'Interstellar', y: 2014, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Adventure', 'Drama', 'Science Fiction'], th: ['father daughter', 'emotional', 'space'],
    r: 169, im: 8.7, v: 2200000, rtc: 73, p: ['jiohotstar'],
    c: ['Matthew McConaughey', 'Anne Hathaway', 'Jessica Chastain'], d: 'Christopher Nolan',
    syn: 'A former pilot leaves his children behind to look for a habitable planet, and time stops being kind to any of them.',
    rth: 'emotion+ visuals+ music+ story~',
    rec: 'The docking scene and the Hans Zimmer score come up constantly, and the father-daughter thread is why people rewatch it. Critics were more split than audiences on the third act.',
    at: A({ emotion: 0.9, spectacle: 0.95, complexity: 0.8, weight: 0.6, pace: 0.5, familyFriendly: 0.6, intensity: 0.7 }),
  },
  {
    id: 'the-prestige', t: 'The Prestige', y: 2006, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Drama', 'Mystery', 'Thriller'], sg: ['Period'], th: ['twist ending', 'obsession', 'rivalry', 'intricate plot'],
    r: 130, im: 8.5, v: 1400000, rtc: 76, p: ['jiohotstar'],
    c: ['Christian Bale', 'Hugh Jackman', 'Michael Caine', 'Scarlett Johansson'], d: 'Christopher Nolan',
    syn: 'Two Victorian magicians destroy each other over a trick neither will explain.',
    rth: 'story+ acting+ ending+',
    rec: 'A film built entirely for the rewatch — the structure hides its answer in plain sight and viewers rate it higher the second time. A minority find the final reveal a cheat.',
    at: A({ twist: 0.95, complexity: 0.9, weight: 0.7, character: 0.8, intensity: 0.65, pace: 0.6, familyFriendly: 0.3 }),
  },
  {
    id: 'shutter-island', t: 'Shutter Island', y: 2010, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Mystery', 'Thriller'], sg: ['Psychological'], th: ['twist ending', 'unreliable narrator', 'atmospheric'],
    r: 138, im: 8.2, v: 1400000, rtc: 69, p: ['netflix'],
    c: ['Leonardo DiCaprio', 'Mark Ruffalo', 'Ben Kingsley', 'Michelle Williams'], d: 'Martin Scorsese',
    syn: 'Two US marshals investigate a disappearance from a hospital for the criminally insane, and nothing about the island adds up.',
    rth: 'suspense+ acting+ production+ ending~',
    rec: 'The atmosphere and DiCaprio’s performance draw the most praise, and the final line is argued about years later. Some find the middle stretch heavy going.',
    at: A({ twist: 0.95, weight: 0.85, intensity: 0.8, complexity: 0.8, familyFriendly: 0.05, pace: 0.5, realism: 0.5 }),
  },
  {
    id: 'se7en', t: 'Se7en', y: 1995, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Crime', 'Drama', 'Mystery'], sg: ['Serial Killer', 'Neo-Noir'], th: ['bleak', 'twist ending', 'investigation'],
    r: 127, im: 8.6, v: 1800000, rtc: 82, p: ['netflix'],
    c: ['Morgan Freeman', 'Brad Pitt', 'Kevin Spacey'], d: 'David Fincher',
    syn: 'Two detectives hunt a killer working through the seven deadly sins.',
    rth: 'ending+ production+ acting+ suspense+',
    rec: 'The ending is one of the most famous in cinema and the reason the film endures. Grim throughout, and deliberately so.',
    at: A({ weight: 0.95, intensity: 0.85, twist: 0.85, complexity: 0.7, familyFriendly: 0.02, realism: 0.7, pace: 0.6 }),
  },
  {
    id: 'the-departed', t: 'The Departed', y: 2006, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Crime', 'Drama', 'Thriller'], sg: ['Gangster'], th: ['cat and mouse', 'betrayal', 'undercover'],
    r: 151, im: 8.5, v: 1400000, rtc: 91, p: ['jiohotstar'],
    c: ['Leonardo DiCaprio', 'Matt Damon', 'Jack Nicholson', 'Mark Wahlberg'], d: 'Martin Scorsese',
    syn: 'A cop inside the mob and a mobster inside the police each start hunting the other.',
    rth: 'acting+ story+ pacing+ ending~',
    rec: 'Tense, funny and extremely well cast, with the two-moles premise sustained brilliantly. The abruptness of the ending divides people.',
    at: A({ intensity: 0.85, complexity: 0.8, weight: 0.75, pace: 0.75, character: 0.8, familyFriendly: 0.02 }),
  },
  {
    id: 'gladiator', t: 'Gladiator', y: 2000, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Action', 'Adventure', 'Drama'], sg: ['Epic', 'Period'], th: ['revenge', 'spectacle', 'honour'],
    r: 155, im: 8.5, v: 1600000, rtc: 80, p: ['jiohotstar'],
    c: ['Russell Crowe', 'Joaquin Phoenix', 'Connie Nielsen'], d: 'Ridley Scott',
    syn: 'A Roman general betrayed and enslaved fights his way back toward the emperor who ordered his family killed.',
    rth: 'acting+ music+ spectacle+ story~',
    rec: 'Russell Crowe and the Hans Zimmer score are what people remember, and the arena sequences hold up. Historically loose, which few viewers mind.',
    at: A({ action: 0.85, spectacle: 0.9, emotion: 0.8, intensity: 0.8, weight: 0.6, character: 0.75, pace: 0.65 }),
  },
  {
    id: 'catch-me-if-you-can', t: 'Catch Me If You Can', y: 2002, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Biography', 'Crime', 'Drama'], sg: ['Caper'], th: ['con', 'true story', 'cat and mouse', 'father son'],
    r: 141, im: 8.1, v: 1000000, rtc: 96, p: ['netflix'],
    c: ['Leonardo DiCaprio', 'Tom Hanks', 'Christopher Walken'], d: 'Steven Spielberg',
    syn: 'A teenager passes himself off as a pilot, a doctor and a lawyer, with one FBI agent slowly closing in.',
    rth: 'story+ acting+ music+ comedy+',
    rec: 'Breezy and charming, with an unexpectedly sad father-son story underneath. One of the most rewatchable films on any list.',
    at: A({ humour: 0.6, pace: 0.8, weight: 0.3, character: 0.8, familyFriendly: 0.75, emotion: 0.7, complexity: 0.5 }),
  },
  {
    id: 'memento', t: 'Memento', y: 2000, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Mystery', 'Thriller'], sg: ['Psychological', 'Neo-Noir'], th: ['twist ending', 'unreliable narrator', 'intricate plot', 'memory'],
    r: 113, im: 8.4, v: 1400000, rtc: 94, p: ['netflix'],
    c: ['Guy Pearce', 'Carrie-Anne Moss', 'Joe Pantoliano'], d: 'Christopher Nolan',
    syn: 'A man who cannot form new memories hunts his wife’s killer, in a story told backwards.',
    rth: 'story+ ending+ acting+ complexity~',
    rec: 'The reverse structure is not a gimmick — viewers consistently say it is the only way the story could work. Demands full attention and rewards a second viewing.',
    at: A({ complexity: 0.98, twist: 0.9, weight: 0.75, intensity: 0.7, character: 0.7, familyFriendly: 0.1, pace: 0.55 }),
  },
  {
    id: 'the-sixth-sense', t: 'The Sixth Sense', y: 1999, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Drama', 'Mystery', 'Thriller'], sg: ['Supernatural'], th: ['twist ending', 'grief', 'atmospheric'],
    r: 107, im: 8.2, v: 1100000, rtc: 86, p: ['jiohotstar'],
    c: ['Bruce Willis', 'Haley Joel Osment', 'Toni Collette'], d: 'M. Night Shyamalan',
    syn: 'A child psychologist takes on a boy who says he sees dead people.',
    rth: 'ending+ acting+ emotion+',
    rec: 'The twist is famous enough to have entered the language, but viewers who go in cold rate the emotional story just as highly. The child performance is exceptional.',
    at: A({ twist: 0.98, emotion: 0.8, weight: 0.65, intensity: 0.6, pace: 0.45, realism: 0.4, familyFriendly: 0.3 }),
  },
  {
    id: 'mad-max-fury-road', t: 'Mad Max: Fury Road', y: 2015, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Action', 'Adventure', 'Science Fiction'], sg: ['Post-Apocalyptic'], th: ['spectacle', 'chase', 'relentless'],
    r: 120, im: 8.1, v: 1100000, rtc: 97, p: ['jiohotstar'],
    c: ['Tom Hardy', 'Charlize Theron', 'Nicholas Hoult'], d: 'George Miller',
    syn: 'One very long chase across a desert, away from a warlord and toward something better.',
    rth: 'production+ visuals+ pacing+ story~',
    rec: 'Almost universally praised for its practical stunt work and relentless momentum — many call it the best action film of the century. Dialogue is minimal by design.',
    at: A({ action: 0.98, intensity: 0.98, pace: 0.98, spectacle: 0.95, complexity: 0.25, weight: 0.6, familyFriendly: 0.2 }),
  },
  {
    id: 'the-martian', t: 'The Martian', y: 2015, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Adventure', 'Drama', 'Science Fiction'], sg: ['Survival'], th: ['problem solving', 'feel good', 'space'],
    r: 144, im: 8.0, v: 900000, rtc: 91, p: ['jiohotstar'],
    c: ['Matt Damon', 'Jessica Chastain', 'Jeff Daniels'], d: 'Ridley Scott',
    syn: 'An astronaut left behind on Mars works the problem, one botany experiment at a time.',
    rth: 'story+ acting+ comedy+',
    rec: 'Unusually cheerful for a survival film, and the problem-solving is what people enjoy most. Matt Damon carries long stretches alone.',
    at: A({ humour: 0.6, spectacle: 0.75, weight: 0.3, familyFriendly: 0.8, pace: 0.65, complexity: 0.55, emotion: 0.6 }),
  },
  {
    id: 'now-you-see-me', t: 'Now You See Me', y: 2013, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Crime', 'Mystery', 'Thriller'], sg: ['Heist'], th: ['con', 'twist ending', 'magic'],
    r: 115, im: 7.2, v: 550000, rtc: 50, p: ['netflix'],
    c: ['Jesse Eisenberg', 'Mark Ruffalo', 'Woody Harrelson', 'Morgan Freeman'], d: 'Louis Leterrier',
    syn: 'Four magicians rob banks during their shows, and the FBI cannot work out how.',
    rth: 'pacing+ comedy+ story~ ending-',
    rec: 'Audiences enjoy it considerably more than critics did — it moves fast and the heists are fun. The explanation does not hold up to much scrutiny.',
    at: A({ pace: 0.85, humour: 0.5, twist: 0.6, weight: 0.2, complexity: 0.5, familyFriendly: 0.75, realism: 0.3 }),
  },
  {
    id: 'skyfall', t: 'Skyfall', y: 2012, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Action', 'Adventure', 'Thriller'], sg: ['Spy'], th: ['iconic villain', 'spectacle'],
    r: 143, im: 7.8, v: 730000, rtc: 92, p: ['prime'],
    c: ['Daniel Craig', 'Javier Bardem', 'Judi Dench'], d: 'Sam Mendes',
    syn: 'Bond comes back from the dead to protect the one person who ever mattered to him.',
    rth: 'visuals+ acting+ production+',
    rec: 'Roger Deakins’ photography and Javier Bardem’s villain are what elevate this above the rest of the series for most viewers.',
    at: A({ action: 0.8, spectacle: 0.85, intensity: 0.75, weight: 0.5, character: 0.65, pace: 0.7, familyFriendly: 0.5 }),
  },
  {
    id: 'john-wick', t: 'John Wick', y: 2014, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Action', 'Crime', 'Thriller'], th: ['revenge', 'relentless', 'stylised'],
    r: 101, im: 7.4, v: 700000, rtc: 86, p: ['jiohotstar'],
    c: ['Keanu Reeves', 'Michael Nyqvist', 'Willem Dafoe'], d: 'Chad Stahelski',
    syn: 'A retired hitman comes back for the worst possible reason.',
    rth: 'production+ pacing+ visuals+ story~',
    rec: 'Credited with resetting how action is shot in Hollywood — the choreography is legible and the world-building is done in throwaway lines. Thin on plot by design.',
    at: A({ action: 0.98, pace: 0.9, intensity: 0.9, spectacle: 0.75, complexity: 0.2, weight: 0.55, familyFriendly: 0.1 }),
  },
  {
    id: 'jurassic-park', t: 'Jurassic Park', y: 1993, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Adventure', 'Science Fiction', 'Thriller'], th: ['spectacle', 'wonder'],
    r: 127, im: 8.2, v: 1100000, rtc: 92, p: ['jiohotstar'],
    c: ['Sam Neill', 'Laura Dern', 'Jeff Goldblum'], d: 'Steven Spielberg',
    syn: 'A theme park of cloned dinosaurs opens its doors slightly ahead of schedule.',
    rth: 'production+ visuals+ music+ suspense+',
    rec: 'The effects still hold up thirty years later, and the kitchen sequence is a masterclass in tension. A film almost everyone has seen at least once.',
    at: A({ spectacle: 0.9, intensity: 0.7, action: 0.7, familyFriendly: 0.7, weight: 0.35, pace: 0.7, realism: 0.4 }),
  },
  {
    id: 'terminator-2', t: 'Terminator 2: Judgment Day', y: 1991, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Action', 'Science Fiction'], th: ['spectacle', 'father figure', 'chase'],
    r: 137, im: 8.6, v: 1200000, rtc: 91, p: ['jiohotstar'],
    c: ['Arnold Schwarzenegger', 'Linda Hamilton', 'Robert Patrick'], d: 'James Cameron',
    syn: 'The machine sent to kill John Connor last time is sent back to protect him.',
    rth: 'production+ action+ emotion+',
    rec: 'Widely held up as the best action sequel ever made, and the effects were a genuine leap. The relationship between the boy and the machine is why it lasts.',
    at: A({ action: 0.92, spectacle: 0.9, intensity: 0.85, emotion: 0.65, pace: 0.8, weight: 0.5, familyFriendly: 0.45 }),
  },
  {
    id: 'forrest-gump', t: 'Forrest Gump', y: 1994, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Drama', 'Romance'], th: ['feel good', 'emotional', 'life story'],
    r: 142, im: 8.8, v: 2300000, rtc: 74, p: ['jiohotstar'],
    c: ['Tom Hanks', 'Robin Wright', 'Gary Sinise'], d: 'Robert Zemeckis',
    syn: 'A man of limited understanding walks through thirty years of American history and keeps going back for the same woman.',
    rth: 'emotion+ acting+ music+ story~',
    rec: 'One of the most-loved films ever made by audiences, though critics have always been more divided about its politics. Tom Hanks’ performance is not in dispute.',
    at: A({ emotion: 0.95, weight: 0.4, familyFriendly: 0.8, character: 0.85, humour: 0.5, pace: 0.5, romance: 0.6 }),
  },
  {
    id: 'shawshank', t: 'The Shawshank Redemption', y: 1994, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Drama'], sg: ['Prison'], th: ['friendship', 'hope', 'twist ending'],
    r: 142, im: 9.3, v: 2900000, rtc: 89, p: ['jiohotstar'],
    c: ['Tim Robbins', 'Morgan Freeman', 'Bob Gunton'], d: 'Frank Darabont',
    syn: 'A banker convicted of a murder he did not commit spends nineteen years being patient.',
    rth: 'story+ acting+ emotion+ ending+',
    rec: 'The highest-rated film on IMDb for most of the site’s history. The friendship and the final act are why, and almost nobody argues with it.',
    at: A({ emotion: 0.9, character: 0.9, weight: 0.6, pace: 0.4, familyFriendly: 0.5, twist: 0.6, realism: 0.8 }),
  },
  {
    id: 'django', t: 'Django Unchained', y: 2012, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Drama', 'Western'], th: ['revenge', 'stylised', 'morally grey'],
    r: 165, im: 8.5, v: 1700000, rtc: 87, p: ['netflix'],
    c: ['Jamie Foxx', 'Christoph Waltz', 'Leonardo DiCaprio', 'Samuel L. Jackson'], d: 'Quentin Tarantino',
    syn: 'A freed slave and a bounty hunter go looking for his wife on a Mississippi plantation.',
    rth: 'acting+ story+ music+ pacing~',
    rec: 'Christoph Waltz and Samuel L. Jackson draw the most praise, and the dialogue is Tarantino at full strength. Long, violent and deliberately provocative.',
    at: A({ action: 0.7, humour: 0.55, weight: 0.7, intensity: 0.8, character: 0.8, pace: 0.55, familyFriendly: 0.02 }),
  },

  // -------------------------------------- HOLLYWOOD (English only)
  {
    id: 'prisoners', t: 'Prisoners', y: 2013, ind: 'hollywood', lang: 'english-only',
    g: ['Thriller', 'Crime', 'Drama'], sg: ['Procedural'], th: ['investigation', 'bleak', 'morally grey', 'twist ending'],
    r: 153, im: 8.2, v: 750000, rtc: 81, p: ['netflix'],
    c: ['Hugh Jackman', 'Jake Gyllenhaal', 'Viola Davis', 'Paul Dano'], d: 'Denis Villeneuve',
    syn: 'When two girls vanish on Thanksgiving, one father decides the detective is moving too slowly and takes the investigation somewhere very dark.',
    rth: 'acting+ suspense+ visuals+ ending~ pacing~',
    rec: 'Consistently held up as a top-tier modern thriller, with the two lead performances and Roger Deakins’ photography drawing the most praise. It is long and genuinely grim.',
    at: A({ weight: 0.95, intensity: 0.85, complexity: 0.75, realism: 0.9, character: 0.85, pace: 0.35, familyFriendly: 0.02, twist: 0.6 }),
  },
  {
    id: 'whiplash', t: 'Whiplash', y: 2014, ind: 'hollywood', lang: 'english-only',
    g: ['Drama', 'Music'], th: ['obsession', 'mentor', 'strong ending'],
    r: 106, im: 8.5, v: 1000000, rtc: 94, p: ['prime'],
    c: ['Miles Teller', 'J.K. Simmons', 'Paul Reiser'], d: 'Damien Chazelle',
    syn: 'A young drummer at a cutthroat conservatory falls under a teacher who believes there are no two words more harmful than "good job".',
    rth: 'acting+ music+ ending+ pacing+',
    rec: 'The final ten minutes and J.K. Simmons’ performance are what almost every viewer brings up, and the editing is frequently called the film’s secret weapon.',
    at: A({ intensity: 0.95, pace: 0.9, weight: 0.7, character: 0.85, emotion: 0.7, familyFriendly: 0.15, complexity: 0.4 }),
  },
  {
    id: 'hell-or-high-water', t: 'Hell or High Water', y: 2016, ind: 'hollywood', lang: 'english-only-unverified',
    g: ['Crime', 'Drama', 'Western'], sg: ['Neo-Western'], th: ['brothers', 'grounded', 'chase'],
    r: 102, im: 7.6, v: 250000, rtc: 97, p: ['netflix'],
    c: ['Chris Pine', 'Ben Foster', 'Jeff Bridges'], d: 'David Mackenzie',
    syn: 'Two brothers rob small Texas branches of the bank about to take their mother’s ranch, with a Ranger weeks from retirement on their trail.',
    rth: 'story+ acting+ visuals+ pacing+',
    rec: 'A critical favourite that many viewers say they only found by accident — the screenplay, Jeff Bridges’ performance and the sense of place are the recurring points of praise.',
    at: A({ weight: 0.65, realism: 0.95, character: 0.85, intensity: 0.6, pace: 0.6, familyFriendly: 0.2, humour: 0.35 }),
  },
  {
    id: 'arrival', t: 'Arrival', y: 2016, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Science Fiction', 'Drama', 'Mystery'], th: ['emotional', 'intricate plot', 'twist ending', 'language'],
    r: 116, im: 7.9, v: 800000, rtc: 94, p: ['netflix'],
    c: ['Amy Adams', 'Jeremy Renner', 'Forest Whitaker'], d: 'Denis Villeneuve',
    syn: 'A linguist is brought in to work out what twelve alien vessels want, and the answer changes what she understands about her own life.',
    rth: 'story+ emotion+ acting+ pacing~',
    rec: 'Regarded as intelligent, patient science fiction, with Amy Adams’ performance and the emotional reveal getting the strongest praise. Viewers expecting an invasion film find it slow.',
    at: A({ complexity: 0.85, emotion: 0.9, weight: 0.6, pace: 0.3, twist: 0.85, spectacle: 0.6, intensity: 0.5 }),
  },
  {
    id: 'knives-out', t: 'Knives Out', y: 2019, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Mystery', 'Comedy', 'Crime'], sg: ['Whodunnit'], th: ['twist ending', 'ensemble', 'dark humour'],
    r: 130, im: 7.9, v: 750000, rtc: 97, p: ['prime'],
    c: ['Daniel Craig', 'Ana de Armas', 'Chris Evans', 'Jamie Lee Curtis'], d: 'Rian Johnson',
    syn: 'A wealthy crime novelist dies the night after his birthday party, and a Southern-accented private detective turns up uninvited.',
    rth: 'story+ comedy+ acting+ ending+ family+',
    rec: 'Enjoyed almost universally as a smart, funny update of the country-house mystery, with the ensemble and the structure drawing the most credit.',
    at: A({ humour: 0.75, twist: 0.85, complexity: 0.7, weight: 0.25, familyFriendly: 0.7, pace: 0.7, character: 0.7 }),
  },
  {
    id: 'ford-v-ferrari', t: 'Ford v Ferrari', y: 2019, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Drama', 'Sport', 'Biography'], th: ['true story', 'friendship', 'underdog'],
    r: 152, im: 8.1, v: 450000, rtc: 92, p: ['jiohotstar'],
    c: ['Matt Damon', 'Christian Bale', 'Caitriona Balfe'], d: 'James Mangold',
    syn: 'A car designer and a difficult British driver are given two years to build something at Ford that can beat Ferrari at Le Mans.',
    rth: 'acting+ production+ emotion+ story+',
    rec: 'Praised as crowd-pleasing without being hollow — Christian Bale’s performance, the sound design and the racing sequences come up constantly.',
    at: A({ intensity: 0.75, spectacle: 0.8, emotion: 0.75, familyFriendly: 0.75, character: 0.8, pace: 0.7, weight: 0.35 }),
  },
  {
    id: 'nightcrawler', t: 'Nightcrawler', y: 2014, ind: 'hollywood', lang: 'english-only',
    g: ['Thriller', 'Crime', 'Drama'], sg: ['Neo-Noir'], th: ['morally grey', 'bleak', 'obsession'],
    r: 117, im: 7.8, v: 570000, rtc: 95, p: ['netflix'],
    c: ['Jake Gyllenhaal', 'Rene Russo', 'Riz Ahmed'], d: 'Dan Gilroy',
    syn: 'A drifter discovers he has a real talent for filming crime scenes before anyone else arrives, and no floor beneath him at all.',
    rth: 'acting+ story+ visuals+ emotion~',
    rec: 'Gyllenhaal’s performance dominates every discussion of this film, and the night-time Los Angeles photography is widely praised. Deliberately cold.',
    at: A({ weight: 0.85, intensity: 0.8, character: 0.85, realism: 0.8, emotion: 0.2, familyFriendly: 0.02, pace: 0.65 }),
  },
  {
    id: 'spotlight', t: 'Spotlight', y: 2015, ind: 'hollywood', lang: 'english-only',
    g: ['Drama', 'Biography'], sg: ['Procedural'], th: ['investigation', 'true story', 'grounded'],
    r: 129, im: 8.1, v: 500000, rtc: 97, p: ['prime'],
    c: ['Mark Ruffalo', 'Michael Keaton', 'Rachel McAdams'], d: 'Tom McCarthy',
    syn: 'The Boston Globe investigative team works a story everyone in the city already half knew.',
    rth: 'story+ acting+ production+ pacing~',
    rec: 'Admired for its refusal to dramatise — repeatedly described as a procedural that trusts the material, with a uniformly strong ensemble. Some find it flat for the same reason.',
    at: A({ realism: 0.98, weight: 0.75, complexity: 0.65, character: 0.7, pace: 0.4, intensity: 0.5, familyFriendly: 0.2 }),
  },
  {
    id: 'the-intouchables', t: 'The Intouchables', y: 2011, ind: 'international', lang: 'hindi-dubbed',
    g: ['Comedy', 'Drama', 'Biography'], th: ['friendship', 'feel good', 'true story'],
    r: 112, im: 8.5, v: 900000, p: ['netflix'],
    c: ['François Cluzet', 'Omar Sy'],
    syn: 'A quadriplegic aristocrat hires the least qualified applicant he can find as his carer, largely because the man has no pity to offer.',
    rth: 'emotion+ comedy+ acting+ family+',
    rec: 'One of the most warmly received films anywhere — the chemistry between the two leads is what everybody mentions, and viewers repeatedly describe it as genuinely uplifting.',
    at: A({ humour: 0.8, emotion: 0.95, familyFriendly: 0.85, weight: 0.25, character: 0.9, pace: 0.6 }),
  },
  {
    id: 'parasite', t: 'Parasite', y: 2019, ind: 'international', lang: 'other-language',
    g: ['Drama', 'Thriller', 'Dark Comedy'], th: ['class', 'twist ending', 'con'],
    r: 132, im: 8.5, v: 950000, rtc: 99, p: ['prime'],
    c: ['Song Kang-ho', 'Lee Sun-kyun', 'Cho Yeo-jeong'], d: 'Bong Joon-ho',
    syn: 'A poor family installs itself, one member at a time, in the household of a rich one.',
    rth: 'story+ production+ ending+ acting+',
    rec: 'The first non-English Best Picture winner and near-universally praised, with the mid-film turn cited as one of the great structural surprises. Subtitles only.',
    at: A({ twist: 0.9, complexity: 0.85, weight: 0.75, humour: 0.6, intensity: 0.8, familyFriendly: 0.1, pace: 0.65 }),
  },
  {
    id: 'memories-of-murder', t: 'Memories of Murder', y: 2003, ind: 'international', lang: 'other-language',
    g: ['Crime', 'Drama', 'Mystery'], sg: ['Serial Killer', 'Procedural'], th: ['investigation', 'bleak', 'unresolved'],
    r: 132, im: 8.1, v: 200000, rtc: 95, p: ['prime'],
    c: ['Song Kang-ho', 'Kim Sang-kyung'], d: 'Bong Joon-ho',
    syn: 'Two rural detectives in 1986 Korea investigate the country’s first serial murders with almost no forensic capability.',
    rth: 'story+ acting+ ending+ visuals+',
    rec: 'Frequently named one of the greatest crime films ever made, and the final shot is legendary. Bleak, funny and deeply frustrating by design.',
    at: A({ weight: 0.85, realism: 0.95, complexity: 0.8, humour: 0.35, character: 0.85, pace: 0.5, familyFriendly: 0.05 }),
  },

  // ------------------------------------------------- SERIES — HINDI
  {
    id: 'the-family-man', t: 'The Family Man', ty: 'series', y: 2019, ind: 'bollywood', lang: 'hindi',
    g: ['Thriller', 'Action', 'Drama'], sg: ['Spy'], th: ['family bonds', 'dark humour', 'duty'],
    r: 45, ss: 2, ep: 19, im: 8.7, v: 100000, p: ['prime'],
    c: ['Manoj Bajpayee', 'Samantha', 'Sharib Hashmi', 'Priyamani'],
    syn: 'A middle-class Mumbai man works for a secret branch of the National Investigation Agency, and is losing at both jobs.',
    rth: 'acting+ comedy+ story+ family+ ending~',
    rec: 'Manoj Bajpayee’s performance and the domestic comedy woven through the spy plot are what people love — the show makes the family scenes as gripping as the missions.',
    at: A({ intensity: 0.75, humour: 0.6, action: 0.7, character: 0.85, familyFriendly: 0.3, pace: 0.75, weight: 0.55 }),
  },
  {
    id: 'panchayat', t: 'Panchayat', ty: 'series', y: 2020, ind: 'bollywood', lang: 'hindi',
    g: ['Comedy', 'Drama'], sg: ['Slice of Life'], th: ['small town', 'gentle', 'feel good'],
    r: 32, ss: 3, ep: 24, im: 8.9, v: 130000, p: ['prime'],
    c: ['Jitendra Kumar', 'Neena Gupta', 'Raghubir Yadav', 'Faisal Malik'],
    syn: 'An engineering graduate with no better options takes a panchayat secretary job in a UP village and slowly stops counting the days.',
    rth: 'comedy+ family+ acting+ emotion+ pacing+',
    rec: 'Beloved for its gentleness — viewers describe it as the rare show with no villains and no cynicism, and the ensemble is uniformly well cast.',
    at: A({ humour: 0.8, weight: 0.15, intensity: 0.1, familyFriendly: 0.95, emotion: 0.75, realism: 0.9, pace: 0.3, character: 0.9 }),
    tr: 0.4,
  },
  {
    id: 'paatal-lok', t: 'Paatal Lok', ty: 'series', y: 2020, ind: 'bollywood', lang: 'hindi',
    g: ['Crime', 'Thriller', 'Drama'], sg: ['Police Drama'], th: ['investigation', 'bleak', 'caste', 'morally grey'],
    r: 50, ss: 2, ep: 17, im: 7.9, v: 90000, p: ['prime'],
    c: ['Jaideep Ahlawat', 'Neeraj Kabi', 'Abhishek Banerjee'],
    syn: 'A washed-up Delhi inspector is handed a high-profile case everyone expects him to fumble, and the deeper he goes the less it resembles what he was told.',
    rth: 'acting+ story+ production+ pacing~',
    rec: 'Jaideep Ahlawat’s Hathi Ram is treated as a landmark performance, and the backstory episodes are frequently called the show’s best writing.',
    at: A({ weight: 0.9, intensity: 0.8, realism: 0.9, complexity: 0.8, character: 0.85, familyFriendly: 0.02, pace: 0.55 }),
  },
  {
    id: 'delhi-crime', t: 'Delhi Crime', ty: 'series', y: 2019, ind: 'bollywood', lang: 'hindi',
    g: ['Crime', 'Drama'], sg: ['Procedural'], th: ['investigation', 'bleak', 'true story'],
    r: 50, ss: 2, ep: 12, im: 8.5, v: 40000, p: ['netflix'],
    c: ['Shefali Shah', 'Rasika Dugal', 'Adil Hussain'],
    syn: 'The Delhi police investigation into a 2012 case, followed hour by hour from the inside.',
    rth: 'acting+ story+ emotion+ production+',
    rec: 'Shefali Shah’s central performance is the anchor and is almost universally praised, as is the decision to stay procedural rather than sensational. Genuinely heavy going.',
    at: A({ weight: 0.9, realism: 0.95, intensity: 0.75, character: 0.8, emotion: 0.8, familyFriendly: 0.05, pace: 0.55 }),
  },
  {
    id: 'kohrra', t: 'Kohrra', ty: 'limited-series', y: 2023, ind: 'bollywood', lang: 'hindi',
    g: ['Crime', 'Mystery', 'Drama'], sg: ['Procedural'], th: ['investigation', 'atmospheric', 'family bonds', 'slow burn'],
    r: 45, ss: 2, ep: 12, im: 8.0, v: 22000, p: ['netflix'],
    c: ['Suvinder Vicky', 'Barun Sobti', 'Harleen Sethi'],
    syn: 'An NRI groom is found dead in a Punjab field days before his wedding, and the two policemen on the case have their own houses falling apart.',
    rth: 'acting+ story+ emotion+ pacing~',
    rec: 'Quietly one of the best-reviewed Indian crime shows of recent years — the rural Punjab atmosphere and Suvinder Vicky’s lead performance get consistent praise. Slow and melancholy.',
    at: A({ weight: 0.8, realism: 0.95, character: 0.9, complexity: 0.7, pace: 0.25, intensity: 0.6, familyFriendly: 0.1 }),
  },
  {
    id: 'kota-factory', t: 'Kota Factory', ty: 'series', y: 2019, ind: 'bollywood', lang: 'hindi',
    g: ['Comedy', 'Drama'], sg: ['Coming of Age', 'Slice of Life'], th: ['education', 'friendship', 'gentle'],
    r: 40, ss: 3, ep: 15, im: 8.7, v: 90000, p: ['netflix'],
    c: ['Mayur More', 'Jitendra Kumar', 'Ranjan Raj'],
    syn: 'Teenagers in a coaching-class town grind toward an entrance exam that will decide everything.',
    rth: 'acting+ story+ emotion+ comedy+',
    rec: 'Jeetu Bhaiya became a genuine cultural figure, and the show is praised for taking teenage pressure seriously without melodrama. The black-and-white first season is a favourite.',
    at: A({ humour: 0.55, emotion: 0.75, realism: 0.9, familyFriendly: 0.85, weight: 0.4, pace: 0.4, character: 0.85 }),
  },
  {
    id: 'farzi', t: 'Farzi', ty: 'series', y: 2023, ind: 'bollywood', lang: 'hindi',
    g: ['Crime', 'Thriller', 'Dark Comedy'], sg: ['Caper'], th: ['con', 'cat and mouse', 'intricate plot'],
    r: 50, ss: 1, ep: 8, im: 7.9, v: 55000, p: ['prime'],
    c: ['Shahid Kapoor', 'Vijay Sethupathi', 'Raashii Khanna'],
    syn: 'A street artist with a gift for detail starts printing perfect counterfeit notes, and finds the officer chasing him is every bit as obsessive.',
    rth: 'acting+ production+ story+ pacing~',
    rec: 'Vijay Sethupathi’s supporting turn is the standout for most viewers, and the counterfeiting procedural detail is a draw. The romantic subplot attracts most of the criticism.',
    at: A({ complexity: 0.7, pace: 0.75, intensity: 0.7, humour: 0.45, weight: 0.5, character: 0.7, familyFriendly: 0.25 }),
  },
  {
    id: 'jubilee', t: 'Jubilee', ty: 'limited-series', y: 2023, ind: 'bollywood', lang: 'hindi',
    g: ['Drama', 'History'], sg: ['Period'], th: ['cinema', 'ambition', 'partition'],
    r: 55, ss: 1, ep: 10, im: 8.1, v: 25000, p: ['prime'],
    c: ['Aparshakti Khurana', 'Prosenjit Chatterjee', 'Aditi Rao Hydari', 'Sidhant Gupta'],
    syn: 'The birth of the Bombay film industry in the years after Partition, told through the people it made and destroyed.',
    rth: 'production+ visuals+ acting+ pacing~',
    rec: 'The period recreation and cinematography are the most-praised elements, and it is treated as one of the best-looking Indian shows made. Deliberately measured in pace.',
    at: A({ spectacle: 0.8, weight: 0.65, character: 0.85, realism: 0.8, pace: 0.35, complexity: 0.7, emotion: 0.7 }),
  },

  // ------------------------------------------------- SERIES — INTERNATIONAL
  {
    id: 'breaking-bad', t: 'Breaking Bad', ty: 'series', y: 2008, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Crime', 'Drama', 'Thriller'], th: ['morally grey', 'transformation', 'strong ending'],
    r: 47, ss: 5, ep: 62, im: 9.5, v: 2200000, p: ['netflix'],
    c: ['Bryan Cranston', 'Aaron Paul', 'Anna Gunn'],
    syn: 'A high-school chemistry teacher with a terminal diagnosis starts cooking methamphetamine and turns out to be extremely good at it.',
    rth: 'acting+ story+ ending+ pacing~',
    rec: 'Routinely named one of the best-written television dramas ever made, with Bryan Cranston’s transformation and the show’s ability to stick its landing drawing near-universal praise.',
    at: A({ weight: 0.85, intensity: 0.85, character: 0.95, complexity: 0.8, familyFriendly: 0.02, pace: 0.6, twist: 0.6 }),
  },
  {
    id: 'money-heist', t: 'Money Heist', ty: 'series', y: 2017, ind: 'international', lang: 'hindi-dubbed',
    g: ['Crime', 'Thriller', 'Drama'], sg: ['Heist'], th: ['con', 'intricate plot', 'ensemble'],
    r: 50, ss: 5, ep: 41, im: 8.2, v: 500000, p: ['netflix'],
    c: ['Úrsula Corberó', 'Álvaro Morte', 'Itziar Ituño'],
    syn: 'A man called the Professor recruits eight strangers to take the Royal Mint of Spain.',
    rth: 'story+ pacing+ acting+ ending-',
    rec: 'A global phenomenon, especially in India, and the Hindi dub is why. The first two parts are widely considered far stronger than the later ones.',
    at: A({ pace: 0.85, intensity: 0.85, complexity: 0.7, twist: 0.7, weight: 0.55, familyFriendly: 0.2, character: 0.7 }),
  },
  {
    id: 'dark', t: 'Dark', ty: 'series', y: 2017, ind: 'international', lang: 'hindi-dubbed',
    g: ['Science Fiction', 'Mystery', 'Thriller'], th: ['intricate plot', 'twist ending', 'atmospheric', 'time'],
    r: 55, ss: 3, ep: 26, im: 8.7, v: 460000, p: ['netflix'],
    c: ['Louis Hofmann', 'Lisa Vicari', 'Oliver Masucci'],
    syn: 'Children go missing in a small German town near a nuclear plant, and the reason involves four families and rather more than one timeline.',
    rth: 'story+ production+ suspense+ ending+ pacing~',
    rec: 'Admired for plotting that actually holds together across three seasons, and for a bleak, precise visual style. Demands full attention throughout.',
    at: A({ complexity: 0.98, weight: 0.85, twist: 0.9, intensity: 0.75, pace: 0.45, familyFriendly: 0.05, spectacle: 0.6 }),
  },
  {
    id: 'chernobyl', t: 'Chernobyl', ty: 'limited-series', y: 2019, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Drama', 'History', 'Thriller'], th: ['true story', 'bleak', 'tense', 'institutional failure'],
    r: 65, ss: 1, ep: 5, im: 9.3, v: 900000, p: ['jiohotstar'],
    c: ['Jared Harris', 'Stellan Skarsgård', 'Emily Watson'],
    syn: 'The 1986 reactor failure, the men sent in afterwards, and the machinery of denial around both.',
    rth: 'production+ acting+ suspense+ emotion+',
    rec: 'Praised almost without dissent for its atmosphere, sound design and restraint, and frequently described as the most gripping five hours of television people have watched.',
    at: A({ weight: 0.98, intensity: 0.9, realism: 0.95, character: 0.8, familyFriendly: 0.02, pace: 0.55, emotion: 0.8 }),
  },
  {
    id: 'the-boys', t: 'The Boys', ty: 'series', y: 2019, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Action', 'Comedy', 'Crime'], sg: ['Superhero', 'Satire'], th: ['satire', 'dark humour', 'morally grey'],
    r: 60, ss: 4, ep: 32, im: 8.7, v: 700000, p: ['prime'],
    c: ['Karl Urban', 'Jack Quaid', 'Antony Starr', 'Erin Moriarty'],
    syn: 'Superheroes are a corporate product, and a group of civilians decides to take them down.',
    rth: 'acting+ comedy+ story+ pacing~',
    rec: 'Antony Starr’s Homelander is what people talk about, and the satire lands harder than expected. Extremely graphic — this is not a superhero show for the family.',
    at: A({ action: 0.8, humour: 0.7, weight: 0.7, intensity: 0.9, familyFriendly: 0.01, pace: 0.8, spectacle: 0.75 }),
  },
  {
    id: 'game-of-thrones', t: 'Game of Thrones', ty: 'series', y: 2011, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Action', 'Adventure', 'Drama', 'Fantasy'], sg: ['Epic'], th: ['ensemble', 'betrayal', 'spectacle'],
    r: 57, ss: 8, ep: 73, im: 9.2, v: 2300000, p: ['jiohotstar'],
    c: ['Emilia Clarke', 'Peter Dinklage', 'Kit Harington', 'Lena Headey'],
    syn: 'Several families fight for a throne while something far worse gathers in the north.',
    rth: 'production+ acting+ story+ ending-',
    rec: 'The first six seasons are widely held up as some of the best television ever made. The final season is the most-complained-about ending in modern TV, and viewers will warn you.',
    at: A({ spectacle: 0.95, weight: 0.8, complexity: 0.9, intensity: 0.85, familyFriendly: 0.02, character: 0.85, pace: 0.6 }),
  },
  {
    id: 'stranger-things', t: 'Stranger Things', ty: 'series', y: 2016, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Drama', 'Fantasy', 'Horror'], sg: ['Coming of Age'], th: ['nostalgia', 'friendship', 'small town'],
    r: 51, ss: 4, ep: 34, im: 8.6, v: 1300000, p: ['netflix'],
    c: ['Millie Bobby Brown', 'Finn Wolfhard', 'Winona Ryder', 'David Harbour'],
    syn: 'A boy vanishes in a small Indiana town, and a girl with a shaved head and strange abilities turns up instead.',
    rth: 'production+ acting+ music+ pacing~',
    rec: 'The eighties atmosphere and the child cast are the draw, and it works as a family watch in a way most horror does not. Later seasons are longer and more divisive.',
    at: A({ spectacle: 0.75, intensity: 0.65, familyFriendly: 0.6, emotion: 0.7, pace: 0.7, weight: 0.4, character: 0.8 }),
  },
  {
    id: 'the-bear', t: 'The Bear', ty: 'series', y: 2022, ind: 'hollywood', lang: 'english-only-unverified',
    g: ['Drama', 'Comedy'], th: ['family bonds', 'grief', 'pressure'],
    r: 30, ss: 4, ep: 38, im: 8.6, v: 300000, p: ['jiohotstar'],
    c: ['Jeremy Allen White', 'Ayo Edebiri', 'Ebon Moss-Bachrach'],
    syn: 'A fine-dining chef comes home to run his late brother’s Chicago sandwich shop, which is failing in every direction at once.',
    rth: 'acting+ pacing+ emotion+ production+',
    rec: 'The kitchen chaos and the editing are what hook people, and the ensemble is praised throughout. Viewers warn that it is genuinely stressful to watch.',
    at: A({ intensity: 0.9, pace: 0.85, weight: 0.65, character: 0.9, emotion: 0.8, familyFriendly: 0.2, humour: 0.45 }),
    tr: 0.5,
  },
  {
    id: 'mindhunter', t: 'Mindhunter', ty: 'series', y: 2017, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Crime', 'Drama', 'Thriller'], sg: ['Procedural', 'Serial Killer'], th: ['investigation', 'slow burn', 'unresolved'],
    r: 50, ss: 2, ep: 19, im: 8.6, v: 350000, p: ['netflix'],
    c: ['Jonathan Groff', 'Holt McCallany', 'Anna Torv'],
    syn: 'Two FBI agents in the late seventies start interviewing imprisoned killers to work out whether there is a pattern worth naming.',
    rth: 'acting+ production+ story+ ending-',
    rec: 'The interview scenes are held up as some of the most unsettling television of the last decade, and the period craft is meticulous. The overwhelming complaint is that it was never finished.',
    at: A({ weight: 0.85, realism: 0.95, complexity: 0.75, pace: 0.3, intensity: 0.7, familyFriendly: 0.02, character: 0.85 }),
  },
  {
    id: 'the-queens-gambit', t: "The Queen's Gambit", ty: 'limited-series', y: 2020, ind: 'hollywood', lang: 'hindi-dubbed',
    g: ['Drama'], sg: ['Period'], th: ['underdog', 'obsession', 'addiction'],
    r: 55, ss: 1, ep: 7, im: 8.5, v: 550000, p: ['netflix'],
    c: ['Anya Taylor-Joy', 'Bill Camp', 'Moses Ingram'],
    syn: 'An orphaned chess prodigy climbs to the top of a game nobody expected her to play, with a growing dependence on pills along the way.',
    rth: 'acting+ production+ story+ emotion+',
    rec: 'Widely praised for making chess visually thrilling, with the costume design and Anya Taylor-Joy’s performance drawing the most attention. Some find the addiction plot resolved too easily.',
    at: A({ character: 0.9, spectacle: 0.7, emotion: 0.7, weight: 0.5, pace: 0.55, familyFriendly: 0.6, intensity: 0.6 }),
  },
];

for (const s of SEED) {
  if (!s.rec) throw new Error(`Seed ${s.id} is missing a reception summary`);
}

export const SEED_TITLES: Title[] = SEED.map(toTitle);

export function getSeedTitle(id: string): Title | null {
  return SEED_TITLES.find((t) => t.id === id) ?? null;
}

/** Catalogue shape, reported in /admin so coverage gaps are visible. */
export function catalogueBreakdown() {
  const by = <T extends string | number | symbol>(fn: (t: Title) => T) => {
    const out: Record<string, number> = {};
    for (const t of SEED_TITLES) {
      const key = String(fn(t));
      out[key] = (out[key] ?? 0) + 1;
    }
    return out;
  };
  return {
    total: SEED_TITLES.length,
    byIndustry: by((t) => t.industry),
    byEra: by((t) => t.era ?? 'unknown'),
    byLanguage: by((t) => t.viewingLanguage),
    byType: by((t) => t.type),
    hindiAvailable: SEED_TITLES.filter((t) =>
      ['hindi', 'hindi-dubbed', 'hindi-and-english'].includes(t.viewingLanguage)
    ).length,
  };
}
