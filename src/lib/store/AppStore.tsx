'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { activeAdapter } from './adapter';
import {
  EMPTY_REQUEST,
  INITIAL_STATE,
  type AppState,
  type PickSet,
  type Provider,
  type SessionRequest,
  type Title,
  type UserActionType,
} from '@/lib/types';
import { localDateKey } from '@/lib/utils/format';

/**
 * The single client-side store.
 *
 * One separation runs through this file and matters more than anything else in
 * it: the SESSION REQUEST (what he wants tonight) lives in memory and dies with
 * the tab, while APP STATE (what he has seen, rejected, saved) is persisted.
 *
 * Picking Action on Monday must not make him an action person on Tuesday. The
 * only way to guarantee that is to never write the mood anywhere durable, so
 * that is what happens here.
 */

interface StoreValue {
  state: AppState;
  ready: boolean;

  /** What he asked for tonight. Not persisted. */
  request: SessionRequest;
  picks: PickSet | null;
  loading: boolean;
  error: string | null;
  dataMode: { live: boolean; note: string } | null;

  /** Titles removed from the current view by an action. */
  dismissed: Set<string>;

  run(request: Partial<SessionRequest>): void;
  regenerate(): void;
  clearRequest(): void;

  setProviders(providers: Provider[]): void;
  setTextScale(scale: number): void;
  completeOnboarding(): void;

  recordAction(title: Title, action: UserActionType): void;
  removeAction(titleId: string): void;
  noteSearch(query: string): void;

  reset(): void;
  importState(state: AppState): void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <AppProvider>');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [ready, setReady] = useState(false);
  const [request, setRequest] = useState<SessionRequest>(EMPTY_REQUEST);
  const [picks, setPicks] = useState<PickSet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataMode, setDataMode] = useState<{ live: boolean; note: string } | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const stateRef = useRef(state);
  stateRef.current = state;
  const inFlight = useRef(false);

  // ------------------------------------------------------------- hydrate
  useEffect(() => {
    let cancelled = false;
    activeAdapter.load().then((loaded) => {
      if (cancelled) return;
      setState(loaded);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Text scale is applied to the root element rather than to each component,
  // so every rem-based size in the app moves together.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.style.fontSize = `${16 * (state.preferences.textScale || 1)}px`;
  }, [state.preferences.textScale]);

  const persist = useCallback((next: AppState) => {
    setState(next);
    stateRef.current = next;
    void activeAdapter.save(next);
  }, []);

  // --------------------------------------------------------- run a request
  const fetchPicks = useCallback(
    async (next: SessionRequest, revision: number, excludeIds: string[] = []) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setLoading(true);
      setError(null);
      setDismissed(new Set());

      try {
        const res = await fetch('/api/recommendations', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            state: stateRef.current,
            request: next,
            revision,
            excludeIds,
            date: localDateKey(),
          }),
        });
        if (!res.ok) throw new Error(`Recommendation service returned ${res.status}`);

        const json = (await res.json()) as {
          picks: PickSet;
          dataMode: { live: boolean; note: string };
        };

        setPicks(json.picks);
        setDataMode(json.dataMode);

        // Record what was shown and cache the titles so the other tabs work
        // without another round trip.
        const current = stateRef.current;
        const shownDate = json.picks.date;
        const historyWithoutThisSet = current.history.filter(
          (h) => !(h.date === shownDate && h.action == null)
        );
        const newHistory = json.picks.recommendations.map((r) => ({
          titleId: r.title.id,
          date: shownDate,
          slot: r.slot,
          displayed: true,
          action: null,
          actionAt: null,
        }));
        const titleCache = { ...current.titleCache };
        for (const r of json.picks.recommendations) titleCache[r.title.id] = r.title;

        persist({
          ...current,
          history: [...historyWithoutThisSet, ...newHistory],
          currentPicks: json.picks,
          titleCache,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load tonight’s picks');
      } finally {
        setLoading(false);
        inFlight.current = false;
      }
    },
    [persist]
  );

  const run = useCallback(
    (partial: Partial<SessionRequest>) => {
      const next: SessionRequest = {
        ...EMPTY_REQUEST,
        languagePreference: stateRef.current.preferences.languagePreference,
        providers: stateRef.current.preferences.providers,
        ...partial,
      };
      setRequest(next);
      setPicks(null);
      void fetchPicks(next, 0);
    },
    [fetchPicks]
  );

  const regenerate = useCallback(() => {
    const currentIds = picks?.recommendations.map((r) => r.title.id) ?? [];
    void fetchPicks(request, (picks?.revision ?? 0) + 1, currentIds);
  }, [picks, request, fetchPicks]);

  const clearRequest = useCallback(() => {
    setRequest(EMPTY_REQUEST);
    setPicks(null);
    setDismissed(new Set());
  }, []);

  // --------------------------------------------------------------- actions
  const recordAction = useCallback(
    (title: Title, action: UserActionType) => {
      const current = stateRef.current;
      const timestamp = new Date().toISOString();
      const today = localDateKey();

      const history = current.history.map((h) =>
        h.titleId === title.id && h.date === today
          ? { ...h, action, actionAt: timestamp }
          : h
      );

      persist({
        ...current,
        actions: [
          ...current.actions.filter((a) => a.titleId !== title.id),
          {
            titleId: title.id,
            action,
            timestamp,
            moodAtTime: request.mood,
          },
        ],
        history,
        titleCache: { ...current.titleCache, [title.id]: title },
      });

      // Seen it / Later / Not for me clear the card immediately. Watch today
      // stays on screen — it's what he's about to go and watch.
      if (action !== 'WATCH_TODAY' && action !== 'OPENED_DETAILS') {
        setDismissed((prev) => new Set(prev).add(title.id));
      }
    },
    [persist, request.mood]
  );

  const removeAction = useCallback(
    (titleId: string) => {
      const current = stateRef.current;
      persist({ ...current, actions: current.actions.filter((a) => a.titleId !== titleId) });
      setDismissed((prev) => {
        const next = new Set(prev);
        next.delete(titleId);
        return next;
      });
    },
    [persist]
  );

  const noteSearch = useCallback(
    (query: string) => {
      const current = stateRef.current;
      persist({
        ...current,
        searches: [
          ...current.searches.slice(-49),
          { query, timestamp: new Date().toISOString() },
        ],
      });
    },
    [persist]
  );

  // ----------------------------------------------------------- preferences
  const setProviders = useCallback(
    (providers: Provider[]) => {
      const current = stateRef.current;
      persist({ ...current, preferences: { ...current.preferences, providers } });
    },
    [persist]
  );

  const setTextScale = useCallback(
    (textScale: number) => {
      const current = stateRef.current;
      persist({ ...current, preferences: { ...current.preferences, textScale } });
    },
    [persist]
  );

  const completeOnboarding = useCallback(() => {
    const current = stateRef.current;
    persist({ ...current, preferences: { ...current.preferences, onboarded: true } });
  }, [persist]);

  const reset = useCallback(() => {
    void activeAdapter.clear();
    setState(INITIAL_STATE);
    stateRef.current = INITIAL_STATE;
    setPicks(null);
    setRequest(EMPTY_REQUEST);
  }, []);

  const importState = useCallback(
    (next: AppState) => {
      persist(next);
      setPicks(next.currentPicks);
    },
    [persist]
  );

  const value = useMemo<StoreValue>(
    () => ({
      state, ready, request, picks, loading, error, dataMode, dismissed,
      run, regenerate, clearRequest,
      setProviders, setTextScale, completeOnboarding,
      recordAction, removeAction, noteSearch,
      reset, importState,
    }),
    [
      state, ready, request, picks, loading, error, dataMode, dismissed,
      run, regenerate, clearRequest,
      setProviders, setTextScale, completeOnboarding,
      recordAction, removeAction, noteSearch,
      reset, importState,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function useActionMap(): Map<string, UserActionType> {
  const { state } = useStore();
  return useMemo(() => {
    const map = new Map<string, UserActionType>();
    const sorted = [...state.actions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    for (const action of sorted) map.set(action.titleId, action.action);
    return map;
  }, [state.actions]);
}

export function useTitlesByAction(action: UserActionType): { title: Title; at: string }[] {
  const { state } = useStore();
  return useMemo(() => {
    const map = new Map<string, string>();
    const sorted = [...state.actions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    for (const a of sorted) {
      if (a.action === action) map.set(a.titleId, a.timestamp);
      else map.delete(a.titleId);
    }
    return [...map.entries()]
      .map(([id, at]) => ({ title: state.titleCache[id], at }))
      .filter((x): x is { title: Title; at: string } => Boolean(x.title))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [state.actions, state.titleCache, action]);
}
