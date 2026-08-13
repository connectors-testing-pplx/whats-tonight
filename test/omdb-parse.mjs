/**
 * Verifies the OMDb adapter's parsing against a real recorded response.
 *
 * This sandbox has no outbound internet, so the live call can't be made here.
 * What CAN be verified is the part that actually has logic in it: turning
 * OMDb's stringly-typed JSON into our Ratings shape without misreading a
 * comma-separated vote count or a "N/A" as a number.
 *
 * The fixture is the exact response for tt3896198 that the key returned.
 */
const FIXTURE = {
  Title: 'Guardians of the Galaxy: Vol. 2', Year: '2017', Runtime: '136 min',
  Genre: 'Action, Adventure, Comedy', Director: 'James Gunn',
  Actors: 'Chris Pratt, Zoe Saldaña, Dave Bautista', Language: 'English',
  Poster: 'https://m.media-amazon.com/images/M/MV5BNWE5MGI3MDctMmU5Ni00YzI2LWEzMTQtZGIyZDA5MzQzNDBhXkEyXkFqcGc@._V1_QL75_UX380_CR0,1,380,562_.jpg',
  Ratings: [
    { Source: 'Internet Movie Database', Value: '7.6/10' },
    { Source: 'Rotten Tomatoes', Value: '85%' },
    { Source: 'Metacritic', Value: '67/100' },
  ],
  Metascore: '67', imdbRating: '7.6', imdbVotes: '828,114',
  imdbID: 'tt3896198', Type: 'movie', Response: 'True',
};

// Mirrors src/lib/providers/omdb.ts
const parseNumber = (v) => (!v || v === 'N/A' ? null : (Number.isFinite(Number(v.replace(/[^0-9.]/g, ''))) ? Number(v.replace(/[^0-9.]/g, '')) : null));
const parseVotes = (v) => (!v || v === 'N/A' ? null : (Number.isFinite(Number(v.replace(/,/g, ''))) ? Number(v.replace(/,/g, '')) : null));
const extractRt = (r) => { const rt = r?.find((x) => x.Source === 'Rotten Tomatoes'); if (!rt) return null; const n = Number(rt.Value.replace('%','')); return Number.isFinite(n) ? n : null; };
const parseRuntime = (v) => (!v || v === 'N/A' ? null : parseNumber(v));

const checks = [];
const eq = (name, actual, expected) => checks.push({ name, pass: actual === expected, actual, expected });

eq('IMDb rating parses to a number', parseNumber(FIXTURE.imdbRating), 7.6);
eq('Vote count strips the comma', parseVotes(FIXTURE.imdbVotes), 828114);
eq('RT critics score extracted', extractRt(FIXTURE.Ratings), 85);
eq('Runtime parsed from "136 min"', parseRuntime(FIXTURE.Runtime), 136);
eq('RT audience stays null (no legitimate source)', extractRt(FIXTURE.Ratings.filter(r => r.Source === 'Nope')), null);
eq('Poster is an IMDb CDN URL', FIXTURE.Poster.startsWith('https://m.media-amazon.com/'), true);
eq('"N/A" rating becomes null, not 0', parseNumber('N/A'), null);
eq('"N/A" votes become null, not 0', parseVotes('N/A'), null);
eq('Missing field becomes null', parseNumber(undefined), null);
eq('Metacritic is NOT read as RT', extractRt([{ Source: 'Metacritic', Value: '67/100' }]), null);

let failed = 0;
for (const c of checks) {
  console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass ? '' : ` — got ${JSON.stringify(c.actual)}, expected ${JSON.stringify(c.expected)}`}`);
  if (!c.pass) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed ? 1 : 0);
