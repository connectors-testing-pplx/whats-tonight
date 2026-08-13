'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/store/AppStore';

/**
 * Four tabs, nothing more. Labels are words, not just icons — icon-only tabs
 * are a guessing game for anyone who didn't grow up with them.
 */

const TABS = [
  { href: '/', label: 'Tonight', icon: MoonIcon },
  { href: '/maybe-later', label: 'Later', icon: ClockIcon },
  { href: '/watched', label: 'Watched', icon: CheckIcon },
  { href: '/search', label: 'Search', icon: SearchIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  const { state, ready } = useStore();

  // The nav would be noise during onboarding and on the developer view.
  if (pathname?.startsWith('/admin')) return null;
  if (ready && !state.preferences.onboarded) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95
                 backdrop-blur-lg safe-bottom"
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-phone">
        {TABS.map((tab) => {
          const active =
            tab.href === '/' ? pathname === '/' : pathname?.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px]
                         font-medium tracking-wide transition-colors
                         ${active ? 'text-accent' : 'text-ink-3'}`}
              style={{ minHeight: 58 }}
            >
              <Icon active={Boolean(active)} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

interface IconProps {
  active: boolean;
}

function MoonIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.18 : 0}
      />
    </svg>
  );
}

function ClockIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="8.4"
        stroke="currentColor"
        strokeWidth="1.7"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.18 : 0}
      />
      <path d="M12 7.6V12l3 1.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3.6"
        y="3.6"
        width="16.8"
        height="16.8"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.7"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.18 : 0}
      />
      <path
        d="m8 12.2 2.7 2.7L16 9.6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="11"
        cy="11"
        r="6.6"
        stroke="currentColor"
        strokeWidth="1.7"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.18 : 0}
      />
      <path d="m16 16 4.2 4.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
