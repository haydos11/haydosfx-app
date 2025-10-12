import { LiveRate } from "../cbanks";

/** Merge Myfxbook + FF preferring more complete + newer entries per cb_code */
export function mergeLive(a: LiveRate[], b: LiveRate[]): LiveRate[] {
  const map = new Map<string, LiveRate>();
  const score = (x: LiveRate) =>
    (x.current != null ? 3 : 0) +
    (x.forecast != null ? 1 : 0) +
    (x.previous != null ? 1 : 0) +
    (x.released_at ? 1 : 0);

  const pick = (x?: LiveRate, y?: LiveRate) => {
    if (!x) return y!;
    if (!y) return x!;
    const sx = score(x), sy = score(y);
    if (sy > sx) return y;
    if (sy < sx) return x;
    const tx = x.released_at ? Date.parse(x.released_at) : 0;
    const ty = y.released_at ? Date.parse(y.released_at) : 0;
    return ty >= tx ? y : x;
  };

  for (const r of [...a, ...b]) {
    map.set(r.cb_code, pick(map.get(r.cb_code), r));
  }
  return [...map.values()];
}
