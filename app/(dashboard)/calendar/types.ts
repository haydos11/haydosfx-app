// app/(dashboard)/calendar/types.ts
export type CalendarEventRow = {
  id: number;
  country: string;            // ISO-2, e.g. "US"
  title: string;
  event_code: string | null;
  occurs_at: string;          // ISO
  importance: number | null;

  actual: number | null;
  forecast: number | null;
  previous: number | null;

  // 🔹 NEW: revised previous (preferred) + raw fallbacks for robustness
  revised_previous?: number | null;     // server alias -> UI uses this
  revised_prev_value?: number | null;   // raw from view (if not aliased)
  revised_previous_num?: number | null; // scaled from view (if present)

  unit: string | null;

  // 🔹 NEW: multiplier hints (your fmtValue() already reads these)
  multiplier?: number | null;
  multiplier_power?: number | null;
  unit_multiplier?: number | null;

  created_at: string;
  updated_at: string;
};

export type IngestEvent = {
  country: string;
  title: string;
  occurs_at: string | number;
  importance?: number | null;
  actual?: number | null;
  forecast?: number | null;
  previous?: number | null;
  unit?: string | null;
  event_code?: string | null;
  source?: string | null;
};
