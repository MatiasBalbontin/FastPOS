import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// SQLite's CURRENT_TIMESTAMP stores UTC as "YYYY-MM-DD HH:MM:SS" with no
// timezone marker. `new Date()` on that string is parsed as if it were
// already local time, silently shifting every displayed timestamp by the
// browser's UTC offset. Use this instead of `new Date(...)` on any
// created_at/opening_time/closing_time value coming from the API.
export function parseDbDate(value: string | null | undefined): Date {
  if (!value) return new Date(NaN);
  const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/.test(value);
  return new Date(hasTimezone ? value : `${value.replace(' ', 'T')}Z`);
}
