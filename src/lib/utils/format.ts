import type { Availability, Title } from '@/lib/types';
import { PROVIDER_LABELS } from '@/lib/types';

/** "2h 08m", "48m". Returns null when we genuinely don't know. */
export function formatRuntime(minutes: number | null): string | null {
  if (minutes == null || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/** Series show per-episode runtime; the phrasing has to make that clear. */
export function formatTitleRuntime(title: Title): string | null {
  const runtime = formatRuntime(title.runtimeMinutes);
  if (!runtime) return null;
  if (title.type === 'movie') return runtime;
  return `${title.runtimeMinutes} min/episode`;
}

export function formatSeasons(title: Title): string | null {
  if (title.type !== 'series') return null;
  if (title.seasons == null) return null;
  const seasons = `${title.seasons} season${title.seasons === 1 ? '' : 's'}`;
  if (title.episodes == null) return seasons;
  return `${seasons} · ${title.episodes} episodes`;
}

/** 350000 -> "350K", 2200000 -> "2.2M", 900 -> "900". */
export function formatCount(count: number | null): string | null {
  if (count == null) return null;
  if (count >= 1_000_000) {
    const m = count / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1)}M`;
  }
  if (count >= 1_000) {
    const k = count / 1_000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1)}K`;
  }
  return String(count);
}

export function formatProviders(availability: Availability[]): string | null {
  if (availability.length === 0) return null;
  const unique = [...new Set(availability.map((a) => a.provider))];
  return unique.map((p) => PROVIDER_LABELS[p]).join(' · ');
}

export function formatGenres(genres: string[], limit = 3): string | null {
  if (genres.length === 0) return null;
  return genres.slice(0, limit).join(' · ');
}

export function formatLanguages(languages: string[], limit = 2): string | null {
  if (languages.length === 0) return null;
  return languages.slice(0, limit).join(' · ');
}

/** Local calendar date as YYYY-MM-DD. This is the unit of "tonight". */
export function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  return Math.abs(a - b) / (1000 * 60 * 60 * 24);
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Deterministic hue from a string, for the generated poster fallback. */
export function hashHue(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

export function initials(title: string): string {
  const words = title.replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
