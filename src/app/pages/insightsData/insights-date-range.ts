/** Start of calendar day in local time. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** End of calendar day in local time (23:59:59.999). */
export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export type InsightsDatePreset = 'today' | 'yesterday' | 'week';

export function rangeForPreset(preset: InsightsDatePreset): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday': {
      const y = addDays(now, -1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case 'week':
      return { start: startOfDay(addDays(now, -6)), end: endOfDay(now) };
  }
}

export interface InsightsDateRangeParams {
  fromDate: string;
  toDate: string;
}

/** Builds UTC ISO strings for the API from inclusive local calendar days. */
export function toApiDateRange(start: Date, end: Date): InsightsDateRangeParams {
  const from = startOfDay(start);
  const to = endOfDay(end);
  return {
    fromDate: from.toISOString(),
    toDate: to.toISOString(),
  };
}
