import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// SQLite stores datetimes as "YYYY-MM-DD HH:MM:SS" (no timezone suffix).
// Without the "T" + "Z" suffix, browsers interpret bare strings as local time,
// causing wrong durations when the server is in a different timezone.
// This helper forces UTC interpretation in all browsers.
export function parseUTCDate(dateStr: string): Date {
  if (!dateStr) return new Date(0); // epoch sentinel — callers can detect invalid input
  if (dateStr.endsWith('Z') || dateStr.includes('T')) {
    return new Date(dateStr);
  }
  return new Date(dateStr.replace(' ', 'T') + 'Z');
}
