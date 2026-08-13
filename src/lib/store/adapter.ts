import type { AppState } from '@/lib/types';
import { INITIAL_STATE } from '@/lib/types';

/**
 * Persistence is behind an interface so Phase 2 (Firestore) is a drop-in.
 *
 * The local adapter below is not a toy — it is a perfectly reasonable way to
 * run this app for one person on one phone, and it works with no account, no
 * network and no monthly bill. Firestore becomes worth it when Dad wants the
 * same watched-list on his tablet, or when you want the data to survive
 * clearing the browser.
 */

export interface PersistenceAdapter {
  readonly id: string;
  readonly label: string;
  load(): Promise<AppState>;
  save(state: AppState): Promise<void>;
  clear(): Promise<void>;
  isAvailable(): boolean;
}

const STORAGE_KEY = 'whats-tonight:state:v2';

/**
 * Browser-local persistence.
 *
 * Everything is written under one key as a single JSON document, which keeps
 * reads and writes atomic and makes export/import trivial (see /admin).
 */
class LocalAdapter implements PersistenceAdapter {
  readonly id = 'local';
  readonly label = 'This browser';

  isAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const probe = '__wt_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  }

  async load(): Promise<AppState> {
    if (!this.isAvailable()) return structuredClone(INITIAL_STATE);
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(INITIAL_STATE);
      const parsed = JSON.parse(raw) as Partial<AppState>;
      return migrate(parsed);
    } catch {
      return structuredClone(INITIAL_STATE);
    }
  }

  async save(state: AppState): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('[store] save failed', err);
    }
  }

  async clear(): Promise<void> {
    if (!this.isAvailable()) return;
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Fills in anything a stored document is missing, so an older save never
 * crashes a newer build.
 */
export function migrate(parsed: Partial<AppState>): AppState {
  const base = structuredClone(INITIAL_STATE);
  return {
    version: parsed.version ?? base.version,
    preferences: { ...base.preferences, ...(parsed.preferences ?? {}) },
    actions: Array.isArray(parsed.actions) ? parsed.actions : base.actions,
    history: Array.isArray(parsed.history) ? parsed.history : base.history,
    currentPicks: parsed.currentPicks ?? null,
    titleCache: parsed.titleCache ?? {},
    searches: Array.isArray(parsed.searches) ? parsed.searches : [],
  };
}

export const localAdapter = new LocalAdapter();

/**
 * ---------------------------------------------------------------------------
 * PHASE 2: FIRESTORE
 * ---------------------------------------------------------------------------
 * The collections in the brief map onto this state document like so:
 *
 *   users/{uid}                        -> preferences
 *   users/{uid}/user_actions/{id}      -> actions[]
 *   users/{uid}/recommendation_history -> history[]
 *   users/{uid}/daily_picks/{date}     -> cachedPicks
 *   titles/{titleId}                   -> the enriched Title cache
 *   availability/{titleId}_{provider}  -> per-provider availability rows
 *
 * To switch over: install firebase, implement the class below against those
 * collections, and change `activeAdapter` at the bottom of this file. Nothing
 * in the UI or the engine needs to change — they only ever see AppState.
 */
export class FirestoreAdapter implements PersistenceAdapter {
  readonly id = 'firestore';
  readonly label = 'Firebase / Firestore';

  isAvailable(): boolean {
    return Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  }

  async load(): Promise<AppState> {
    throw new Error(
      'FirestoreAdapter is a stub. See docs/ARCHITECTURE.md for the Phase 2 checklist.'
    );
  }

  async save(): Promise<void> {
    throw new Error('FirestoreAdapter is a stub.');
  }

  async clear(): Promise<void> {
    throw new Error('FirestoreAdapter is a stub.');
  }
}

export const activeAdapter: PersistenceAdapter = localAdapter;
