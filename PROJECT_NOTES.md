# HaydosFX Project Notes
_Last updated: 2025-10-04 23:22:37 +01:00

## File tree (app/)
<!-- BEGIN:APP_TREE -->
app/(dashboard)/calendar/CalendarClient.tsx
app/(dashboard)/calendar/components/CalendarEventDrawer.tsx
app/(dashboard)/calendar/components/CalendarTable.tsx
app/(dashboard)/calendar/hooks/useCalendar.ts
app/(dashboard)/calendar/page.tsx
app/(dashboard)/calendar/server.ts
app/(dashboard)/calendar/types.ts
app/(dashboard)/cot/[market]/MarketPageClient.tsx
app/(dashboard)/cot/[market]/page.tsx
app/(dashboard)/cot/components/CotCharts.tsx
app/(dashboard)/cot/components/CotTable.tsx
app/(dashboard)/cot/components/CurrencyStrengthChart.tsx
app/(dashboard)/cot/components/RangeControls.tsx
app/(dashboard)/cot/CotPageClient.tsx
app/(dashboard)/cot/page.tsx
app/(dashboard)/currencies/components/FxChartPanel.tsx
app/(dashboard)/currencies/components/TradingViewWidget.tsx
app/(dashboard)/currencies/page.tsx
app/(dashboard)/currency-strength/components/Label.tsx
app/(dashboard)/currency-strength/components/Switch.tsx
app/(dashboard)/currency-strength/FxStrengthChart.tsx
app/(dashboard)/currency-strength/page.tsx
app/(dashboard)/economy/compare/page.tsx
app/(dashboard)/economy/layout.tsx
app/(dashboard)/economy/page.tsx
app/(dashboard)/economy/us/page.tsx
app/api/calendar/_lib/auth.ts
app/api/calendar/countries/upsert/route.ts
app/api/calendar/events/upsert/route.ts
app/api/calendar/values/upsert/route.ts
app/api/cot/g8/ytd/route.ts
app/api/cot/market/[market]/route.ts
app/api/cot/route.ts
app/api/cot/snapshot/route.ts
app/api/economy/route.ts
app/api/fx-strength/route.ts
app/api/yclose/route.ts
app/debug/yclose/page.tsx
app/globals.css
app/layout.tsx
app/page.tsx
<!-- END:APP_TREE -->

## File tree (components/)
<!-- BEGIN:COMP_TREE -->
components/charts/SafeEChart.tsx
components/charts/useMeasure.ts
components/economy/EconCard.tsx
components/Header.tsx
components/nav/BackToEconomyLink.tsx
components/nav/SidebarNav.tsx
components/placeholders.tsx
components/shell/AppShell.tsx
components/Sidebar.tsx
components/ui/badge.tsx
components/ui/button.tsx
components/ui/card.tsx
components/ui/progress.tsx
components/ui/scroll-area.tsx
components/ui/SectionCard.tsx
components/ui/separator.tsx
components/ui/sheet.tsx
components/ui/tooltip.tsx
<!-- END:COMP_TREE -->

## File tree (config/)
<!-- BEGIN:CONFIG_TREE -->
config/calendar.cursor.json
config/calendar.local.json
<!-- END:CONFIG_TREE -->

## File tree (lib/)
<!-- BEGIN:LIB_TREE -->
lib/calendar/provider.ts
lib/cot/api.ts
lib/cot/contracts.ts
lib/cot/markets.ts
lib/cot/query.ts
lib/cot/range.ts
lib/cot/shape.ts
lib/db/server.ts
lib/db/supabase-admin.ts
lib/db/supabase-clients.ts
lib/economy/fred.ts
lib/economy/series.ts
lib/economy/transforms.ts
lib/errorMessage.ts
lib/fx/strength.ts
lib/fx/symbols.ts
lib/fx/yahooSpark.ts
lib/pricing/yahoo.ts
lib/r2/client.ts
lib/utils.ts
<!-- END:LIB_TREE -->


## Features Implemented
### Calendar
- Calendar table with flags, impact chips, revisions.
- Row click â†’ opens details drawer.
- Quick range toggles: Yesterday / Today / Tomorrow / Last Week / This Week / Next Week / This Month.
- Filters: Country, Impact, Sector, Search.
- Prev/Next shifts by current span.

### Event Details Drawer
- Wide sheet, impact-colored header, country tag.
- Stat cards: Actual / Forecast / Previous / Revised.
- Description text.
- Recharts line chart (Actual vs Forecast) with Brush (default last 2y).
- Scrollable history table.

### Data Pipeline
- MT5 Economic Calendar â†’ Turso.
- Normalization (1e6 scaling, units, multipliers).
- Full refill supported:
- $env:CALENDAR_FULL="1"; node scripts/calendar/push-local.ts
- 10-year backfill completed.

## Tech Conventions
- Next.js (App Router), Tailwind + shadcn/ui, Recharts, Turso, Vercel.

## Pending / Ideas
- Sync chart brush with history table.
- Country tabs on calendar.
- Cache layer (Redis/KV).
- External descriptions API.
- Export CSV/Excel.
## Changelog
### Update 2025-09-22 01:15:41 +01:00
- Refreshed file tree snapshot
- Notes current as of 2025-09-22 01:15:41 +01:00
### Update 2025-09-22 15:13:03 +01:00
- (add your notes here)
### Update 2025-09-23 00:03:38 +01:00
- (add your notes here)
### Update 2025-09-24 03:58:41 +01:00
- (add your notes here)
### Update 2025-10-04 23:22:37 +01:00
- (add your notes here)

