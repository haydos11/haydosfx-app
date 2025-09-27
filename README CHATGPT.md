# HaydosFX App Snapshot â€” 2025-09-22 15:16:49 +01:00
**Repo:** C:\dev\haydosfx-app  
**App dir:** C:\dev\haydosfx-app\app  
**Git branch:** master  last commit: fb91b8d 2025-09-08 21:38:26 +0100 - Initial commit from Create Next App

## File tree (app/)
app/(dashboard)/calendar/CalendarTable.tsx
app/(dashboard)/calendar/EventDetailsSheet.tsx
app/(dashboard)/calendar/layout.tsx
app/(dashboard)/calendar/page.tsx
app/(dashboard)/calendar/RangePicker.tsx
app/(dashboard)/calendar/TimeZoneControl.tsx
app/(dashboard)/cot/[market]/page.tsx
app/(dashboard)/cot/components/CotCharts.tsx
app/(dashboard)/cot/components/CotTable.tsx
app/(dashboard)/cot/components/CurrencyStrengthChart.tsx
app/(dashboard)/cot/components/RangeControls.tsx
app/(dashboard)/cot/page.tsx
app/(dashboard)/currency-strength/page.tsx
app/(dashboard)/dev-calendar/DevCalendarTable.tsx
app/(dashboard)/dev-calendar/page.tsx
app/(dashboard)/economy/compare/page.tsx
app/(dashboard)/economy/layout.tsx
app/(dashboard)/economy/page.tsx
app/(dashboard)/economy/us/page.tsx
app/api/calendar/event/[id]/route.ts
app/api/calendar/route.ts
app/api/cot/g8/ytd/route.ts
app/api/cot/market/[market]/route.ts
app/api/cot/route.ts
app/api/cot/snapshot/route.ts
app/api/debug/finnhub-key/route.ts
app/api/economy/route.ts
app/api/yclose/route.ts
app/debug/yclose/page.tsx
app/fx-strength/page.tsx
app/globals.css
app/layout.tsx
app/page.tsx

## File tree (components/)
components/charts/SafeEChart.tsx
components/economy/EconCard.tsx
components/economy/EconCardDual.tsx
components/Header.tsx
components/nav/BackToEconomyLink.tsx
components/nav/SidebarNav.tsx
components/placeholders.tsx
components/shell/AppShell.tsx
components/Sidebar.tsx
components/ui/badge.tsx
components/ui/card.tsx
components/ui/progress.tsx
components/ui/scroll-area.tsx
components/ui/SectionCard.tsx
components/ui/separator.tsx
components/ui/sheet.tsx

## File tree (config/)
config/calendar.cursor.json
config/calendar.local.json

## File tree (lib/)
lib/calendar/db.ts
lib/calendar/descriptions.ts
lib/calendar/provider.ts
lib/cot/api.ts
lib/cot/contracts.ts
lib/cot/markets.ts
lib/cot/query.ts
lib/cot/range.ts
lib/cot/shape.ts
lib/economy/fred.ts
lib/economy/series.ts
lib/economy/transforms.ts
lib/errorMessage.ts
lib/pricing/yahoo.ts
lib/utils.ts

## Working tree changes
```
 M README.md
 M package-lock.json
 M package.json
 M tsconfig.json
?? .vscode/
?? CHANGELOG.md
?? PROJECT_NOTES.md
?? "README CHATGPT.md"
?? app-structure.txt
?? app/
?? components.json
?? components/
?? config/
?? lib/
?? next.config.mjs
?? postcss.config.js
?? scripts/
?? tailwind.config.js
?? tailwind.config.ts.bak
```

## Files changed in last commit
```
A	.gitignore
A	README.md
A	eslint.config.mjs
A	next.config.ts
A	package-lock.json
A	package.json
A	postcss.config.mjs
A	public/file.svg
A	public/globe.svg
A	public/next.svg
A	public/vercel.svg
A	public/window.svg
A	src/app/favicon.ico
A	src/app/globals.css
A	src/app/layout.tsx
A	src/app/page.tsx
A	tsconfig.json
```

## app/ quick purpose & linkage hints
- app/(dashboard)/calendar/CalendarTable.tsx
  - Economic calendar table â€” Match API schema & unit normalisation.
- app/(dashboard)/calendar/EventDetailsSheet.tsx
  - Route file â€” page/layout/segment asset.
- app/(dashboard)/calendar/layout.tsx
  - Route file â€” page/layout/segment asset.
- app/(dashboard)/calendar/page.tsx
  - Route file â€” page/layout/segment asset.
- app/(dashboard)/calendar/RangePicker.tsx
  - Date range picker (UTC) â€” Align with API query boundaries & timezone.
- app/(dashboard)/calendar/TimeZoneControl.tsx
  - Timezone selector â€” Switch display TZ; do not mutate query UTC.
- app/(dashboard)/cot/[market]/page.tsx
  - Route file â€” page/layout/segment asset.
- app/(dashboard)/cot/components/CotCharts.tsx
  - Route file â€” page/layout/segment asset.
- app/(dashboard)/cot/components/CotTable.tsx
  - Route file â€” page/layout/segment asset.
- app/(dashboard)/cot/components/CurrencyStrengthChart.tsx
  - Route file â€” page/layout/segment asset.
- app/(dashboard)/cot/components/RangeControls.tsx
  - Route file â€” page/layout/segment asset.
- app/(dashboard)/cot/page.tsx
  - Route file â€” page/layout/segment asset.
- app/(dashboard)/currency-strength/page.tsx
  - Route file â€” page/layout/segment asset.
- app/(dashboard)/dev-calendar/DevCalendarTable.tsx
  - Route file â€” page/layout/segment asset.
- app/(dashboard)/dev-calendar/page.tsx
  - Route file â€” page/layout/segment asset.
- app/(dashboard)/economy/compare/page.tsx
  - Route file â€” page/layout/segment asset.
- app/(dashboard)/economy/layout.tsx
  - Route file â€” page/layout/segment asset.
- app/(dashboard)/economy/page.tsx
  - Route file â€” page/layout/segment asset.
- app/(dashboard)/economy/us/page.tsx
  - Route file â€” page/layout/segment asset.
- app/api/calendar/event/[id]/route.ts
  - API route â€” server handler for this path.
- app/api/calendar/route.ts
  - Calendar API â€” Serves econ events; schema â†” UI tables.
- app/api/cot/g8/ytd/route.ts
  - API route â€” server handler for this path.
- app/api/cot/market/[market]/route.ts
  - API route â€” server handler for this path.
- app/api/cot/route.ts
  - COT API (index) â€” Markets & shapes match lib/.
- app/api/cot/snapshot/route.ts
  - API route â€” server handler for this path.
- app/api/debug/finnhub-key/route.ts
  - API route â€” server handler for this path.
- app/api/economy/route.ts
  - API route â€” server handler for this path.
- app/api/yclose/route.ts
  - API route â€” server handler for this path.
- app/debug/yclose/page.tsx
  - Route file â€” page/layout/segment asset.
- app/fx-strength/page.tsx
  - Route file â€” page/layout/segment asset.
- app/globals.css
  - Global styles â€” Tailwind/CSS. Prefer modules where possible.
- app/layout.tsx
  - Root layout & providers â€” App shell: metadata, global providers, nav.
- app/page.tsx
  - Root landing page â€” Keep thin; route to dashboard pages.

## Prompt â€” paste this block into our chat
Create a concise progress summary and next-action checklist for the HaydosFX app.

Context:

Date: 2025-09-22 15:16:49 +01:00
Repo: C:\dev\haydosfx-app
App dir: C:\dev\haydosfx-app\app
Git: branch=master | last=fb91b8d 2025-09-08 21:38:26 +0100 - Initial commit from Create Next App

Working changes (git status):
M README.md
 M package-lock.json
 M package.json
 M tsconfig.json
?? .vscode/
?? CHANGELOG.md
?? PROJECT_NOTES.md
?? "README CHATGPT.md"
?? app-structure.txt
?? app/
?? components.json
?? components/
?? config/
?? lib/
?? next.config.mjs
?? postcss.config.js
?? scripts/
?? tailwind.config.js
?? tailwind.config.ts.bak

Files changed in last commit:
A	.gitignore
A	README.md
A	eslint.config.mjs
A	next.config.ts
A	package-lock.json
A	package.json
A	postcss.config.mjs
A	public/file.svg
A	public/globe.svg
A	public/next.svg
A	public/vercel.svg
A	public/window.svg
A	src/app/favicon.ico
A	src/app/globals.css
A	src/app/layout.tsx
A	src/app/page.tsx
A	tsconfig.json

app/ file tree:
app/(dashboard)/calendar/CalendarTable.tsx
app/(dashboard)/calendar/EventDetailsSheet.tsx
app/(dashboard)/calendar/layout.tsx
app/(dashboard)/calendar/page.tsx
app/(dashboard)/calendar/RangePicker.tsx
app/(dashboard)/calendar/TimeZoneControl.tsx
app/(dashboard)/cot/[market]/page.tsx
app/(dashboard)/cot/components/CotCharts.tsx
app/(dashboard)/cot/components/CotTable.tsx
app/(dashboard)/cot/components/CurrencyStrengthChart.tsx
app/(dashboard)/cot/components/RangeControls.tsx
app/(dashboard)/cot/page.tsx
app/(dashboard)/currency-strength/page.tsx
app/(dashboard)/dev-calendar/DevCalendarTable.tsx
app/(dashboard)/dev-calendar/page.tsx
app/(dashboard)/economy/compare/page.tsx
app/(dashboard)/economy/layout.tsx
app/(dashboard)/economy/page.tsx
app/(dashboard)/economy/us/page.tsx
app/api/calendar/event/[id]/route.ts
app/api/calendar/route.ts
app/api/cot/g8/ytd/route.ts
app/api/cot/market/[market]/route.ts
app/api/cot/route.ts
app/api/cot/snapshot/route.ts
app/api/debug/finnhub-key/route.ts
app/api/economy/route.ts
app/api/yclose/route.ts
app/debug/yclose/page.tsx
app/fx-strength/page.tsx
app/globals.css
app/layout.tsx
app/page.tsx
