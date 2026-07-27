import { db } from './index';

// Each operator has their own cash shift now (not one shared register), so
// every cash-moving write (sale, expense, customer payment) needs to know
// which specific shift it belongs to — a per-user date-range filter would
// double-count a sale if two operators happen to have shifts open at once.
export function getOpenShiftId(userId: number | undefined): number | null {
  if (!userId) return null;
  const shift = db.prepare("SELECT id FROM cash_shifts WHERE status = 'open' AND user_id = ?").get(userId) as { id: number } | undefined;
  return shift ? shift.id : null;
}
