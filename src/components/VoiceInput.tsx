'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Voice input for the search box.
 *
 * Typing "a 2000s Bollywood comedy" on a phone keyboard is a chore at any age
 * and a genuine barrier at sixty. Saying it out loud is not. This is probably
 * the single biggest ease-of-use win in the app for the person actually using
 * it.
 *
 * Uses the browser's built-in Web Speech API — no service, no key, no audio
 * ever leaving the device on most implementations. Support is real but not
 * universal (Chrome on Android, Safari on iOS 14.5+, Chrome desktop), so the
 * button simply doesn't render where it wouldn't work. Nothing breaks; the
 * keyboard is still there.
 *
 * Language is set to en-IN so Indian English and common Hindi title names are
 * recognised far better than the en-US default.
 */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: { [k: number]: { [k: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function getRecogniser(): SpeechRecognitionLike | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function VoiceInput({ onResult }: { onResult: (text: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recogniser = useRef<SpeechRecognitionLike | null>(null);

  // Feature-detect after mount so the server and client agree on first render.
  useEffect(() => {
    setSupported(getRecogniser() !== null);
    return () => recogniser.current?.stop();
  }, []);

  if (!supported) return null;

  const start = () => {
    if (listening) {
      recogniser.current?.stop();
      return;
    }
    const r = getRecogniser();
    if (!r) return;
    recogniser.current = r;
    r.lang = 'en-IN';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) onResult(transcript.trim());
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    setListening(true);
    r.start();
  };

  return (
    <button
      onClick={start}
      aria-label={listening ? 'Stop listening' : 'Search by voice'}
      aria-pressed={listening}
      className={`absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center
                  justify-center rounded-full transition-colors ${
                    listening ? 'bg-accent text-white' : 'text-ink-3'
                  }`}
    >
      {listening ? (
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
        </span>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 17.5V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
