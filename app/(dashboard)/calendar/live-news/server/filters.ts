import type { NormalizedItem } from "./fetchFeeds";

/**
 * Start permissive (keep almost everything).
 * Tip: leave INCLUDE empty to accept all, then add EXCLUDE noise rules.
 */
export const INCLUDE: RegExp[] = [
  // /CPI|inflation|PPI|GDP|PMI|NFP|unemployment|retail sales/i,
  // /rate decision|hike|cut|hold|FOMC|ECB|BoE|RBA|RBNZ|BoC|BoJ|SNB|Norges/i,
];

export const EXCLUDE: RegExp[] = [
  // /celebrity|gaming|esports|giveaway|contest/i,
];

export function passesFilters(item: NormalizedItem): boolean {
  const hay = `${item.title} ${item.summary}`;
  if (INCLUDE.length > 0 && !INCLUDE.some((rx) => rx.test(hay))) return false;
  if (EXCLUDE.length > 0 && EXCLUDE.some((rx) => rx.test(hay))) return false;
  return true;
}
