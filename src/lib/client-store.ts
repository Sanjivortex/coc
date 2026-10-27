'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

// localStorage-backed values that render as `null` on the server and the first client pass,
// then update without effects. An in-memory copy keeps things working when storage is blocked.
const memory = new Map<string, string | null>();
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function read(key: string): string | null {
  if (memory.has(key)) return memory.get(key)!;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useStoredString(key: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const set = useCallback(
    (next: string | null) => {
      memory.set(key, next);
      try {
        if (next === null) localStorage.removeItem(key);
        else localStorage.setItem(key, next);
      } catch {
        // private mode / quota: the in-memory copy still serves this visit
      }
      listeners.forEach((l) => l());
    },
    [key],
  );
  return [value, set];
}

export function useStoredJson<T>(key: string): [T | null, (value: T | null) => void] {
  const [raw, setRaw] = useStoredString(key);
  const value = useMemo(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }, [raw]);
  const set = useCallback((next: T | null) => setRaw(next === null ? null : JSON.stringify(next)), [setRaw]);
  return [value, set];
}

// A clock that ticks once a minute on the client and is `null` during server rendering.
const clockListeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribeClock(onChange: () => void) {
  clockListeners.add(onChange);
  timer ??= setInterval(() => clockListeners.forEach((l) => l()), 60_000);
  return () => {
    clockListeners.delete(onChange);
    if (clockListeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** Current unix time in seconds, rounded to the minute so snapshots stay stable; null on the server. */
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribeClock,
    () => Math.floor(Date.now() / 60_000) * 60,
    () => null,
  );
}
