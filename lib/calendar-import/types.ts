export type CalendarValue = {
  id: number;
  event_id: number;
  time: number;
  period: number;
  revision: number;
  impact_type: number;
  actual_value: number | null;
  prev_value: number | null;
  revised_prev_value: number | null;
  forecast_value: number | null;
};