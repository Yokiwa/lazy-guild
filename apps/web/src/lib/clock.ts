/** The only place the app reads the wall clock, so tests can control time. */
export function now(): Date {
  return new Date();
}
