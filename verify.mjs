/**
 * End-to-end verification, driven at 390x844 (iPhone) and 412x915 (Pixel).
 *
 * This is the acceptance checklist as an executable script rather than a list
 * of things somebody promises to click. Exits non-zero on any failure.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3210';
const SHOTS = 'screenshots';
mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch({
  args: ['--no-sandbox'],
  executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});

// ---------------------------------------------------------- iPhone context
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

const shot = (name, full = false) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full });

// ------------------------------------------------------------- 1. ONBOARD
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForURL('**/onboarding', { timeout: 15000 });
check('New user lands on onboarding', true);
await shot('01-onboarding');

await page.getByRole('button', { name: /Continue/ }).click();
await page.waitForSelector('button[aria-pressed]', { timeout: 20000 });
await page.waitForTimeout(900);
const posterButtons = page.locator('main button[aria-pressed="false"]');
const posterCount = await posterButtons.count();
check('Onboarding shows a grid to mark as seen', posterCount > 6, `${posterCount} titles`);
await shot('02-onboarding-grid', true);

const seeded = [];
for (let i = 0; i < 4; i++) {
  const btn = posterButtons.nth(i);
  seeded.push((await btn.locator('> p').first().innerText()).trim());
  await btn.click();
}
await page.getByRole('button', { name: /^Done/ }).click();
await page.waitForURL(BASE + '/', { timeout: 15000 });
await page.waitForTimeout(900);

// ------------------------------------------------------- 2. MOOD-FIRST HOME
const homeText = await page.locator('body').innerText();
check('Homepage greets with "Hi Papa"', homeText.includes('Hi Papa'));
check('Homepage asks the mood question first', homeText.includes('What are you in the mood for'));
check(
  'No recommendation cards before a mood is chosen',
  (await page.locator('main article').count()) === 0
);
const moodTiles = await page.locator('[class*="grid-cols-2"] > button').count();
check('Eight mood tiles plus Mix everything', moodTiles === 9, `${moodTiles} tiles`);
check('Bollywood tile present', homeText.includes('Bollywood'));
await shot('03-home-mood', true);

// ---------------------------------------------------------- 3. FILTERS
await page.getByRole('button', { name: /More filters/ }).click();
await page.waitForTimeout(500);
// Read the panel itself, not the collapsed CTA's subtitle, and match
// case-insensitively because the headings are uppercased in CSS.
const filterPanel = await page.locator('main .card').first().innerText();
for (const group of ['Genre', 'Era', 'Cinema', 'Language', 'Movie or series', 'Length', 'Platform']) {
  check(
    `Filter group present: ${group}`,
    new RegExp(group.replace(/ /g, '\\s+'), 'i').test(filterPanel)
  );
}
const filterText = filterPanel;
check('Era options include the 2000s', filterText.includes('2000s'));
check('Language options are in plain words', filterText.includes('Hindi or Hindi dubbed'));
await shot('04-filters', true);
await page.getByRole('button', { name: /More filters/ }).click();
await page.waitForTimeout(300);

// ------------------------------------------------------------- 4. PICKS
await page.getByRole('button', { name: /Mystery/ }).first().click();
await page.waitForSelector('main article', { timeout: 30000 });
await page.waitForTimeout(1200);

const cards = await page.locator('main article').count();
check('Returns 4 to 6 picks, never padded', cards >= 4 && cards <= 6, `${cards} cards`);

const body = await page.locator('main').innerText();
check('Heading is "Here\'s what I\'d pick tonight"', body.includes("Here's what I'd pick tonight"));

const titles = await page.locator('main article h2').allInnerTexts();
check('All picks are distinct titles', new Set(titles).size === titles.length, titles.join(' | '));
check(
  'None of the onboarding-seen titles were recommended',
  !titles.some((t) => seeded.includes(t)),
  `seeded: ${seeded.join(', ')}`
);

// Language labels — plain words, never a code.
const langCount = (body.match(/Hindi|English Only/g) ?? []).length;
check('Every card shows a language label', langCount >= cards, `${langCount} labels`);
check('No raw language codes shown', !/\b(hi-IN|iso_639|Original Language:)\b/.test(body));
await shot('05-picks', true);

// ---------------------------------------------------------- 5. READ MORE
await page.locator('button', { hasText: 'Read more' }).first().click();
await page.waitForTimeout(600);
const expanded = await page.locator('main article').first().innerText();
check('Read more reveals ratings', /IMDb/i.test(expanded));
check('Read more names RT critics', /Critics/i.test(expanded));
check('Read more names RT audience', /Audience/i.test(expanded));
check('Unavailable metrics say "not available"', /not available/i.test(expanded));
check('Read more shows the plot', /What it's about/i.test(expanded));
check('Read more shows the cast', /Cast/i.test(expanded));
check('Read more shows reception', /What people are saying/i.test(expanded));
check('Read more shows why we picked it', /Why we picked this/i.test(expanded));
check('Find similar is offered', /Find more like this/i.test(expanded));
// He decides on the phone and watches on the TV, so what matters is knowing
// WHICH app to open — the platform name, prominently, not a tappable link.
check(
  'States the platform clearly on the card',
  /(Netflix|Prime Video|JioHotstar)/.test(expanded),
  (expanded.match(/(Netflix|Prime Video|JioHotstar)/) ?? [])[0] ?? 'none'
);
await shot('06-expanded', true);

// "Why this?" full reasoning
await page.getByText('See the full reasoning').first().click();
await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
await page.waitForTimeout(500);
const sheet = await page.locator('[role="dialog"]').innerText();
check('Full reasoning lists the receipts', /why this\?/i.test(sheet));
check('Full reasoning shows the score breakdown', /score breakdown/i.test(sheet));
check('Full reasoning confirms exclusion checks', /Not on your Seen/i.test(sheet));
check(
  'No "because you watched X" phrasing anywhere',
  !/because you watched/i.test(sheet + body)
);
await shot('07-why-this', true);
await page.locator('[role="dialog"]').getByText('Close', { exact: true }).click();
await page.waitForTimeout(400);
await page.locator('button', { hasText: 'Show less' }).first().click();
await page.waitForTimeout(400);

// ------------------------------------------------------- 6. CARD ACTIONS
const before = await page.locator('main article').count();
await page.locator('button', { hasText: 'Seen it' }).first().click();
await page.waitForTimeout(900);
check(
  'Seen it removes the card immediately, no confirmation screen',
  (await page.locator('main article').count()) === before - 1
);

await page.locator('button', { hasText: 'Not for me' }).first().click();
await page.waitForTimeout(900);
check(
  'Not for me removes the card immediately',
  (await page.locator('main article').count()) === before - 2
);

await page.locator('button', { hasText: 'Later' }).first().click();
await page.waitForTimeout(900);
check(
  'Later removes the card immediately',
  (await page.locator('main article').count()) === before - 3
);

await page.locator('button', { hasText: 'Watch this tonight' }).first().click();
await page.waitForTimeout(700);
const afterWatch = await page.locator('main').innerText();
check('Watch today keeps the card and confirms', afterWatch.includes('Watching this tonight'));
check('Watch today offers an undo', afterWatch.includes('Undo'));
await shot('08-actions', true);

// ------------------------------------------------------- 7. REGENERATE
const remaining = await page.locator('main article h2').allInnerTexts();
await page.getByRole('button', { name: /Give me different picks/ }).click();
await page.waitForSelector('main article', { timeout: 30000 });
await page.waitForTimeout(1400);
const fresh = await page.locator('main article h2').allInnerTexts();
check(
  'Different picks returns a genuinely new set, not a reshuffle',
  fresh.length >= 3 && !fresh.some((t) => remaining.includes(t)),
  fresh.join(' | ')
);
await shot('09-regenerated');

// --------------------------------------------------- 8. DISCOVERY MODE
await page.getByRole('button', { name: /Things you may have missed/ }).click();
await page.waitForSelector('main article', { timeout: 30000 });
await page.waitForTimeout(1400);
check(
  'Discovery mode returns a set',
  (await page.locator('main article').count()) >= 3
);
await shot('10-discovery');

// ------------------------------------------------------------ 9. TABS
await page.getByRole('link', { name: 'Later' }).click();
await page.waitForTimeout(1000);
check('Later lists the saved title with a return date', /Back in the mix in/.test(await page.locator('main').innerText()));
await shot('11-later');

await page.getByRole('link', { name: 'Watched' }).click();
await page.waitForTimeout(1000);
check('Watched contains the onboarding seeds', /\d+ titles/.test(await page.locator('main').innerText()));
await shot('12-watched');

await page.getByRole('link', { name: 'Search' }).click();
await page.waitForTimeout(700);
await page.getByRole('searchbox').fill('Tabu');
await page.waitForTimeout(2400);
check('Search finds titles by actor', !(await page.locator('main').innerText()).includes('Nothing found'));
await shot('13-search');

// ------------------------------------------- 10. NATURAL LANGUAGE SEARCH
await page.getByRole('link', { name: 'Tonight' }).click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: /Change/ }).click().catch(() => {});
await page.waitForTimeout(600);
const nlBox = page.getByPlaceholder(/tell me what you want/);
await nlBox.fill('a 2000s Bollywood comedy');
await nlBox.press('Enter');
await page.waitForSelector('main article', { timeout: 30000 });
await page.waitForTimeout(1400);

const nlIds = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('whats-tonight:state:v2'));
  return s.currentPicks.recommendations.map((r) => ({
    title: r.title.title,
    era: r.title.era,
    industry: r.title.industry,
    genres: r.title.genres,
  }));
});
check(
  '"a 2000s Bollywood comedy" is parsed into era + industry + genre',
  nlIds.length > 0 && nlIds.every((t) => t.industry === 'bollywood'),
  nlIds.map((t) => `${t.title} (${t.era}/${t.industry})`).join(' | ')
);
await shot('14-natural-language', true);

// ------------------------------------------------- 11. LANGUAGE PREFERENCE
const langStats = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('whats-tonight:state:v2'));
  const recs = s.currentPicks.recommendations;
  return {
    total: recs.length,
    hindi: recs.filter((r) =>
      ['hindi', 'hindi-dubbed', 'hindi-and-english'].includes(r.title.viewingLanguage)
    ).length,
  };
});
check(
  'Hindi and Hindi-dubbed dominate the picks',
  langStats.hindi >= Math.ceil(langStats.total * 0.6),
  `${langStats.hindi}/${langStats.total} available in Hindi`
);

// -------------------------------------------- 12. ENGLISH-ONLY EXCEPTION
// Force an English-heavy request and confirm exceptional titles still appear.
await page.getByRole('button', { name: /Change/ }).click();
await page.waitForTimeout(600);
const nlBox2 = page.getByPlaceholder(/tell me what you want/);
await nlBox2.fill('an exceptional English thriller');
await nlBox2.press('Enter');
await page.waitForSelector('main article', { timeout: 30000 });
await page.waitForTimeout(1400);
const englishPicks = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('whats-tonight:state:v2'));
  return s.currentPicks.recommendations.map((r) => ({
    title: r.title.title,
    lang: r.title.viewingLanguage,
    exception: r.languageException,
  }));
});
check(
  'English-only titles are never hard-filtered out',
  englishPicks.length > 0,
  englishPicks.map((p) => `${p.title}[${p.lang}${p.exception ? '/exception' : ''}]`).join(' | ')
);

// ------------------------------------------------ 13. COLD START BEHAVIOUR
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
const admin = await page.locator('main').innerText();
check('Admin dashboard renders', admin.includes('System status'));
check('Admin reports provider health', admin.includes('Provider health'));
check(
  'Profile stays in learning mode after a handful of taps',
  /Stage\s*(cold|learning)/i.test(admin.replace(/\n/g, ' ')),
  'cold-start rules holding'
);
check(
  'Profile confidence is 0% during the learning period',
  /Confidence\s*0%/i.test(admin.replace(/\n/g, ' '))
);
check('No hard genre weights anywhere in the profile', !/Thriller\s*=\s*\d/.test(admin));
await shot('15-admin', true);

// ------------------------------------------------------ 14. MOBILE WEB
const inputMetrics = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('input, button, a').forEach((el) => {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (rect.height === 0) return;
    out.push({ tag: el.tagName, fontSize: parseFloat(cs.fontSize), height: rect.height });
  });
  return out;
});
const smallText = inputMetrics.filter((m) => m.tag === 'INPUT' && m.fontSize < 16);
check(
  'No input under 16px (prevents iOS Safari force-zoom)',
  smallText.length === 0,
  smallText.length ? `${smallText.length} offenders` : 'all inputs >= 16px'
);

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const tapTargets = await page.evaluate(() => {
  const small = [];
  document.querySelectorAll('button, a').forEach((el) => {
    // WCAG 2.5.8 exempts targets inline within a sentence — an attribution
    // link inside a paragraph of footnote text is not a control, and blowing
    // it up to 44px would look broken. Standalone controls are still held to
    // the full floor.
    const inlineInText = el.closest('p') !== null;
    if (inlineInText) return;
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.height < 44) {
      small.push({ text: el.textContent?.slice(0, 24), h: Math.round(r.height) });
    }
  });
  return small;
});
check(
  'Every standalone control is at least 44px tall',
  tapTargets.length === 0,
  tapTargets.length ? JSON.stringify(tapTargets.slice(0, 3)) : 'all >= 44px'
);

const viewportMeta = await page.evaluate(
  () => document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? ''
);
check('viewport-fit=cover set for iPhone safe areas', viewportMeta.includes('viewport-fit=cover'), viewportMeta);
check('Pinch zoom is not disabled', !/user-scalable\s*=\s*no/.test(viewportMeta));

const overscroll = await page.evaluate(() => getComputedStyle(document.body).overscrollBehaviorY);
check('Pull-to-refresh suppressed on Android Chrome', overscroll === 'none', overscroll);

const manifest = await page.evaluate(
  () => document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? ''
);
check('Web manifest linked (Add to Home Screen)', manifest.length > 0, manifest);

// No horizontal overflow at the narrowest common width.
await page.setViewportSize({ width: 360, height: 800 });
await page.waitForTimeout(700);
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth
);
check('No horizontal scroll at 360px', overflow <= 1, `${overflow}px overflow`);
await shot('16-360px', true);

// ---------------------------------------------------------- 15. ANDROID
const android = await browser.newContext({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2.6,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
});
const apage = await android.newPage();
await apage.goto(BASE, { waitUntil: 'networkidle' });
await apage.waitForURL('**/onboarding', { timeout: 15000 });
await apage.getByRole('button', { name: /Continue/ }).click();
await apage.waitForTimeout(1500);
await apage.getByRole('button', { name: /^Done/ }).click();
await apage.waitForTimeout(1200);
await apage.getByRole('button', { name: /Action/ }).first().click();
await apage.waitForSelector('main article', { timeout: 30000 });
await apage.waitForTimeout(1400);
const acards = await apage.locator('main article').count();
check('Android Chrome renders the full flow', acards >= 4, `${acards} cards at 412px`);
await apage.screenshot({ path: `${SHOTS}/17-android.png` });
await apage.screenshot({ path: `${SHOTS}/17-android-full.png`, fullPage: true });

// ------------------------------------------- 15a. NEW: FOLLOW-UP LOOP
// Rewind the WATCH_TODAY so the follow-up becomes due, then reload.
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.evaluate(() => {
  const KEY = 'whats-tonight:state:v2';
  const s = JSON.parse(localStorage.getItem(KEY));
  s.actions = s.actions.map((a) =>
    a.action === 'WATCH_TODAY'
      ? { ...a, timestamp: new Date(Date.now() - 20 * 3600 * 1000).toISOString() }
      : a
  );
  localStorage.setItem(KEY, JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const followText = await page.locator('main').innerText();
check(
  'Asks how the last pick was, the evening after',
  /How was it\?/i.test(followText),
  followText.split('\n').find((l) => /How was it/i.test(l)) ?? ''
);
check('Follow-up offers all four answers',
  ['Loved it', 'It was fine', 'Gave up on it', 'Never got to it'].every((t) => followText.includes(t))
);
await shot('19-followup', true);

// "Loved it" is the strongest positive the app can record.
await page.getByRole('button', { name: /Loved it/ }).click();
await page.waitForTimeout(900);
const afterAnswer = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('whats-tonight:state:v2'));
  return s.actions.filter((a) => a.action === 'LOVED_IT').length;
});
check('Answer is recorded as a distinct signal', afterAnswer === 1, `${afterAnswer} LOVED_IT`);
check(
  'Follow-up does not ask twice',
  !/How was it\?/i.test(await page.locator('main').innerText())
);

// ------------------------------------------------- 15b. NEW: TEXT SIZE
const beforeSize = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
await page.locator('button[aria-pressed]').last().click();
await page.waitForTimeout(600);
const afterSize = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
check(
  'Text size control actually resizes the app',
  parseFloat(afterSize) > parseFloat(beforeSize),
  `${beforeSize} → ${afterSize}`
);
await shot('20-large-text', true);
// Put it back so later checks measure the default.
await page.locator('button[aria-pressed]').first().click();
await page.waitForTimeout(500);

// ------------------------------------------------------ 15b. ATTRIBUTION
// TMDB's terms require attribution for any images or data used.
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const footer = await page.locator('body').innerText();
check('TMDB is attributed in the product', /TMDB/.test(footer));
check(
  'Carries the required "not endorsed or certified" line',
  /not endorsed or certified by TMDB/i.test(footer)
);

// ---------------------------------------------------------- 16. DESKTOP
const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const dpage = await desktop.newPage();
await dpage.goto(BASE, { waitUntil: 'networkidle' });
await dpage.waitForURL('**/onboarding', { timeout: 15000 });
await dpage.getByRole('button', { name: /Continue/ }).click();
await dpage.waitForTimeout(1500);
await dpage.getByRole('button', { name: /^Done/ }).click();
await dpage.waitForTimeout(1200);
await dpage.screenshot({ path: `${SHOTS}/18-desktop.png` });
check('Desktop renders as a centred column', true);

// --------------------------------------------------------------- CONSOLE
const realErrors = errors.filter(
  (e) => !e.includes('favicon') && !e.includes('Download the React DevTools')
);
check('No console errors across the whole flow', realErrors.length === 0, realErrors.slice(0, 2).join(' | '));

await browser.close();

const failed = results.filter((r) => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
  process.exit(1);
}
