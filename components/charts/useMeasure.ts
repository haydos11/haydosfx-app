"use client";
import * as React from "react";

export function useMeasure<T extends HTMLElement>() {
  const ref = React.useRef<T | null>(null);
  const [rect, setRect] = React.useState<{ width: number; height: number }>({ width: 0, height: 0 });

  React.useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const cr = e.contentRect;
        setRect({ width: cr.width, height: cr.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, rect };
}
