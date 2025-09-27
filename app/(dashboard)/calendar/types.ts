export type CalendarEventRow = {
  id: number;
  country: string;
  title: string;
  event_code: string | null;
  occurs_at: string; // ISO
  importance: number | null;
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  unit: string | null;
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
