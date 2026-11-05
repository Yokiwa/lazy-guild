import type { Species } from '@lazy-guild/core';
import type { TFunction } from 'i18next';

export const OCCASIONS = ['greet', 'accept', 'done', 'partial', 'skipped', 'levelUp', 'evolve', 'rest'] as const;
export type Occasion = (typeof OCCASIONS)[number];

export function pickLine(t: TFunction, species: Species, occasion: Occasion, rand: () => number = Math.random): string {
  const lines = t(`lines.${species}.${occasion}`, { returnObjects: true }) as unknown;
  if (!Array.isArray(lines) || lines.length === 0) return '';
  return String(lines[Math.floor(rand() * lines.length) % lines.length]);
}
