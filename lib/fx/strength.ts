import { G8, PAIRS, hasPair, type CCY } from "./symbols";
import { fetchYahooDailyCloses } from "./yahooSpark";

export type Series = { date: string; value: number };
export type StrengthResult = Record<CCY, Series[]>;

export async function buildFxStrength(options?: {
  days?: number;   // visible window (default 30)
  range?: "1mo" | "3mo" | "6mo" | "1y";
}): Promise<StrengthResult> {
  const days = options?.days ?? 30;
  const range = options?.range ?? "3mo";
  const symbols = Array.from(new Set(PAIRS.map(p => p.y)));

  const raw = await fetchYahooDailyCloses(symbols, range, "1d");

  // Build a master date axis = intersection of all fetched series
  const allDates = Object.values(raw).map(s => s.t);
  const axis = intersectDates(allDates).slice(-Math.max(days + 5, days));

  // Map each pair → aligned log-returns
  const pairLogRets = new Map<string, number[]>();
  for (const p of PAIRS) {
    const row = raw[p.y];
    if (!row) continue;
    const { c, t } = row;
    const aligned = axis.map(d => {
      const i = t.indexOf(d);
      return i >= 0 ? c[i] : NaN;
    });
    pairLogRets.set(keyAB(p.a, p.b), logReturns(aligned));
  }

  // Initialize output with strong typing (fixes your TS2352 error)
  const out = G8.reduce<StrengthResult>((acc, ccy) => {
    acc[ccy] = [];
    return acc;
  }, {} as StrengthResult);

  // Find earliest index where all pairs have a number (skip NaN warmup)
  const startIdx = findStartIdx(axis.length, (k) => {
    for (const p of PAIRS) {
      const arr = pairLogRets.get(keyAB(p.a, p.b));
      if (!arr || Number.isNaN(arr[k])) return false;
    }
    return true;
  });

  for (let i = startIdx; i < axis.length; i++) {
    const date = axis[i];
    for (const ccy of G8) {
      // Collect signed returns for ccy at this index
      const signed: number[] = [];
      for (const other of G8) {
        if (other === ccy) continue;
        const p = hasPair(ccy, other);
        if (!p) continue;
        const arr = pairLogRets.get(keyAB(p.a, p.b));
        if (!arr) continue;
        const r = arr[i];
        if (Number.isNaN(r)) continue;

        // If pair is ccy/base (ccy === a) ⇒ +r ; else (ccy === b) ⇒ -r
        signed.push((p.a === ccy ? 1 : -1) * r);
      }
      const avg = signed.length ? signed.reduce((a,b)=>a+b,0) / signed.length : 0;
      const prev = out[ccy].length ? out[ccy][out[ccy].length - 1].value : 0;
      out[ccy].push({ date, value: prev + avg });
    }
  }

  // Normalize visible window to start at 0 and scale ×100 for readability
  for (const ccy of G8) {
    const s = out[ccy].slice(-days);
    if (!s.length) { out[ccy] = []; continue; }
    const base = s[0].value;
    out[ccy] = s.map(pt => ({ date: pt.date, value: (pt.value - base) * 100 }));
  }
  return out;
}

/* ---------------- helpers ---------------- */
function keyAB(a: CCY, b: CCY) { return `${a}/${b}` as const; }

function logReturns(xs: number[]): number[] {
  const out = new Array(xs.length).fill(NaN);
  for (let i=1;i<xs.length;i++){
    const p0 = xs[i-1], p1 = xs[i];
    out[i] = Number.isFinite(p0) && Number.isFinite(p1) ? Math.log(p1/p0) : NaN;
  }
  return out;
}

function intersectDates(list: string[][]): string[] {
  if (!list.length) return [];
  const counts = new Map<string, number>();
  for (const arr of list) for (const d of arr) counts.set(d, (counts.get(d)||0)+1);
  const need = list.length;
  return Array.from(counts.entries()).filter(([,n])=>n===need).map(([d])=>d).sort();
}

function findStartIdx(n: number, okAt: (i:number)=>boolean): number {
  for (let i=0;i<n;i++) if (okAt(i)) return i;
  return 0;
}
