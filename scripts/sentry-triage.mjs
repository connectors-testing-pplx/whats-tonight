#!/usr/bin/env node
/**
 * sentry-triage.mjs — bridge between Sentry critical errors and GitHub issues.
 *
 * Run inside the error-triage GitHub Action. It:
 *   1. Pulls recently-seen, unresolved, high-priority Sentry issues (or reads
 *      an explicit payload handed to it by a Sentry webhook via
 *      repository_dispatch).
 *   2. For each, fetches the latest event to extract the stack trace, the
 *      session/replay data, browser/OS, request URL, and the release (= commit
 *      SHA responsible for the regression).
 *   3. Dedupes against already-tracked GitHub issues using a hidden marker.
 *   4. Opens a new GitHub issue (via `gh`) with the full triage report, and
 *      links back to the commit and the Sentry issue.
 *
 * Required env:
 *   SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN
 *   GH_* (provided by the GitHub Action runner — `gh` is pre-authenticated)
 *
 * Optional env:
 *   SENTRY_POLL_PERIOD    statsPeriod for the scheduled poll (default "15m")
 *   SENTRY_DISPATCH_PATH  path to a JSON payload from a repository_dispatch event
 *   GITHUB_REPOSITORY      owner/repo (provided by the runner)
 *   DRY_RUN               "1" to print what would be created without creating
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const SENTRY_HOST = process.env.SENTRY_HOST || 'https://sentry.io';
const ORG = process.env.SENTRY_ORG;
const PROJECT = process.env.SENTRY_PROJECT;
const TOKEN = process.env.SENTRY_AUTH_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY;
const POLL = process.env.SENTRY_POLL_PERIOD || '15m';
const DRY = process.env.DRY_RUN === '1';

for (const v of ['SENTRY_ORG', 'SENTRY_PROJECT', 'SENTRY_AUTH_TOKEN', 'GITHUB_REPOSITORY']) {
  if (!process.env[v]) {
    console.error(`Missing required env var: ${v}`);
    process.exit(2);
  }
}

const LABEL = 'sentry-triage';
// Hidden marker embedded in the issue body so we can find it again by id.
const marker = (id) => `<!-- sentry-issue:${id} -->`;

async function sentry(path, query = {}) {
  const url = new URL(`${SENTRY_HOST}/api/0/${path}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().slice(0, 500);
    throw new Error(`Sentry ${res.status} ${res.statusText} for ${url.pathname}: ${body}`);
  }
  return res.json();
}

// --- GitHub issue helpers (gh is pre-authenticated in the runner) ---------
function gh(args, input) {
  return execFileSync('gh', args, {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

/** Does an issue already track this Sentry issue? Search open+closed issues. */
function existingIssue(sentryId) {
  try {
    const out = gh([
      'issue', 'list',
      '--repo', REPO,
      '--state', 'all',
      '--search', `in:body "${marker(sentryId)}"`,
      '--json', 'number,state,title',
      '--limit', '5',
    ]);
    const issues = JSON.parse(out || '[]');
    return issues[0] || null;
  } catch {
    // search returns non-zero when nothing matches; treat as "none"
    return null;
  }
}

function ensureLabel() {
  try {
    gh(['label', 'create', LABEL, '--repo', REPO, '--color', 'D73A4A', '--description', 'Auto-filed by Sentry error triage', '--force']);
  } catch {
    // label already exists — fine
  }
}

function createIssue(title, body) {
  if (DRY) {
    console.log(`\n[DRY RUN] would create issue:\n  TITLE: ${title}\n  ---\n${body}\n  ---`);
    return null;
  }
  return gh([
    'issue', 'create',
    '--repo', REPO,
    '--title', title,
    '--body', body,
    '--label', LABEL,
    '--assignee', '@me',
  ]);
}

function commentIssue(number, body) {
  if (DRY) {
    console.log(`\n[DRY RUN] would comment on #${number}:\n  ${body}`);
    return;
  }
  gh(['issue', 'comment', String(number), '--repo', REPO, '--body', body]);
}

// --- Format the Sentry event into a triage report -------------------------
function formatStacktrace(exception) {
  if (!exception) return '_No exception captured._';
  const values = exception.values || [];
  if (!values.length) return '_No exception values._';
  return values
    .map((v, i) => {
      const frames = (v.stacktrace?.frames || []).slice().reverse();
      const lines = [
        `**${v.type || 'Error'}**: ${v.value || ''}`.trim(),
      ];
      if (frames.length) {
        lines.push('', '```');
        for (const f of frames) {
          const file = f.filename || f.abs_path || '?';
          const inApp = f.in_app ? ' (app)' : ' (vendor)';
          lines.push(
            `  at ${f.function || '<anonymous>'}  ${file}:${f.lineno ?? '?'}:${f.colno ?? ''}${inApp}`
          );
          if (f.context && f.context.length) {
            for (const c of f.context) lines.push(`      ${c[0]} | ${c[1]}`);
          }
        }
        lines.push('```');
      }
      return `### Exception ${values.length > 1 ? i + 1 : ''}\n${lines.join('\n')}`;
    })
    .join('\n\n');
}

function tag(event, name) {
  const t = event.tags || [];
  const found = t.find((x) => x.key === name);
  return found ? found.value : null;
}

function formatEvent(issue, event) {
  const release = tag(event, 'release') || event.release || issue.first_release || null;
  const environment = tag(event, 'environment') || 'production';
  const level = tag(event, 'level') || 'error';
  const url = tag(event, 'url') || event.request?.url || null;
  const browser = tag(event, 'browser') || null;
  const os = tag(event, 'os') || null;
  const runtime = tag(event, 'runtime') || null;

  // Session / replay data
  const replayId = event.contexts?.replay?.replay_id || tag(event, 'replayId');
  const replayUrl = replayId
    ? `${SENTRY_HOST}/organizations/${ORG}/replays/${replayId}/`
    : null;
  const sessionUrl = `${SENTRY_HOST}/organizations/${ORG}/explore/traces/?field=trace&trace=${event.contexts?.trace?.trace_id || ''}`;

  // Build the commit / regression link.
  const shortSha = release ? release.slice(0, 7) : null;
  const commitUrl = release
    ? `https://github.com/${REPO}/commit/${release}`
    : null;

  const sections = [
    `### Sentry issue`,
    `**Level:** ${level}`,
    `**Environment:** ${environment}`,
    `**First seen:** ${issue.firstSeen}`,
    `**Last seen:** ${issue.lastSeen}`,
    `**Events:** ${issue.count}`,
    `**Users affected:** ${issue.userCount}`,
    '',
    `### Responsible commit`,
    release
      ? `Regression introduced in release \`${release}\` — [${shortSha} → ](${commitUrl}).`
      : `_No release tag attached to this event (was \`SENTRY_RELEASE\` set at build time?)._`,
    '',
    `### Stack trace`,
    formatStacktrace(event.exception),
    '',
    `### Session data`,
    replayUrl
      ? `- **Session replay:** [Watch replay](${replayUrl})`
      : '- **Session replay:** _not captured for this event_',
    `- **Trace explorer:** [Open trace](${sessionUrl})`,
    url ? `- **Request URL:** \`${url}\`` : '',
    browser ? `- **Browser:** ${browser}` : '',
    os ? `- **OS:** ${os}` : '',
    runtime ? `- **Runtime:** ${runtime}` : '',
    '',
    `### Links`,
    `- **Sentry issue:** ${SENTRY_HOST}/organizations/${ORG}/issues/${issue.id}/`,
    `- **Sentry event:** ${SENTRY_HOST}/organizations/${ORG}/issues/${issue.id}/events/${event.eventID}/`,
    commitUrl ? `- **Commit:** [${release}](${commitUrl})` : '',
    '',
    '---',
    `_Auto-filed by the \`error-triage\` GitHub Action. Do not remove the marker below._`,
    marker(issue.id),
  ].filter(Boolean);

  return sections.join('\n');
}

function issueTitle(issue, event) {
  const release = tag(event, 'release') || issue.first_release || '';
  const short = release ? release.slice(0, 7) : 'unknown-release';
  const type = event.exception?.values?.[0]?.type || 'Error';
  const msg = (event.exception?.values?.[0]?.value || issue.title || 'Unhandled error')
    .replace(/\s+/g, ' ')
    .slice(0, 120);
  return `[sentry:${short}] ${type}: ${msg}`;
}

// --- Pull recent unresolved critical issues from the Sentry API -----------
async function pollIssues() {
  console.log(`Polling Sentry for unresolved issues in the last ${POLL}…`);
  const issues = await sentry(`projects/${ORG}/${PROJECT}/issues/`, {
    query: 'is:unresolved level:error OR level:fatal',
    statsPeriod: POLL,
    sort: 'date',
    limit: '20',
  });
  return issues;
}

// --- Process one Sentry issue ---------------------------------------------
async function processIssue(issue) {
  let event;
  try {
    event = await sentry(`issues/${issue.id}/events/latest/`);
  } catch (e) {
    console.warn(`  could not fetch latest event for issue ${issue.id}: ${e.message}`);
    event = { exception: null, tags: [], contexts: {}, eventID: 'n/a' };
  }

  const existing = existingIssue(issue.id);
  const title = issueTitle(issue, event);
  const body = formatEvent(issue, event);

  if (existing) {
    // Already tracked — add a comment noting a new occurrence so the thread
    // stays current, but don't open a duplicate.
    console.log(`  → already tracked as #${existing.number} (${existing.state}); commenting.`);
    commentIssue(
      existing.number,
      `**New occurrence** — last seen ${issue.lastSeen} (now ${issue.count} total events, ${issue.userCount} users).\n\n${SENTRY_HOST}/organizations/${ORG}/issues/${issue.id}/`
    );
    if (existing.state === 'closed') {
      console.log(`  → reopening closed issue #${existing.number}.`);
      if (!DRY) gh(['issue', 'reopen', String(existing.number), '--repo', REPO]);
    }
    return 'updated';
  }

  console.log(`  → opening new GitHub issue for Sentry issue ${issue.id}.`);
  const url = createIssue(title, body);
  if (url) console.log(`  ✓ ${url}`);
  return 'created';
}

// --- Main -----------------------------------------------------------------
async function main() {
  ensureLabel();

  let issues = [];
  const dispatchPath = process.env.SENTRY_DISPATCH_PATH;
  if (dispatchPath && existsSync(dispatchPath)) {
    // repository_dispatch payload from a Sentry webhook (issue + latest event).
    console.log('Processing repository_dispatch payload…');
    const payload = JSON.parse(readFileSync(dispatchPath, 'utf8'));
    // Normalize: a webhook issue payload is roughly an issue object.
    issues = [payload.issue || payload].filter((i) => i && i.id);
  } else {
    issues = await pollIssues();
  }

  console.log(`Found ${issues.length} Sentry issue(s) to triage.`);

  let created = 0,
    updated = 0;
  for (const issue of issues) {
    try {
      const r = await processIssue(issue);
      if (r === 'created') created++;
      else updated++;
    } catch (e) {
      console.error(`  failed to process issue ${issue.id}: ${e.message}`);
    }
  }

  console.log(`\nDone. Created ${created}, updated ${updated}.`);
}

main().catch((e) => {
  console.error('Triage failed:', e);
  process.exit(1);
});
