import { useEffect, useState } from 'react';
import { now } from './clock';

/** Re-renders every `intervalMs` with the current time. */
export function useNow(intervalMs = 1000): Date {
  const [t, setT] = useState(() => now());
  useEffect(() => {
    const id = setInterval(() => setT(now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return t;
}
