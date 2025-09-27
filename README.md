This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### Command to run to be able to add/update comments

Get-ChildItem "C:\dev\haydosfx-app\app" -Recurse |
  Where-Object { -not $_.PSIsContainer } |
  Select-Object -ExpandProperty FullName |
  ForEach-Object { ($_ -replace "C:\\dev\\haydosfx-app\\app\\", "app/") } |
  Sort-Object |
  Out-File "C:\dev\haydosfx-app\APP_TREE.txt" -Encoding utf8


  USE THIS CODE TO RUN IN CHATGPT TO RUN AN UPDATED SNAPSHOT OF CHANGES MADE TO KEEP README UPTO DATE.
  ### App Snapshot (for quick summaries)

Step 1 — Run the script in PowerShell

Open PowerShell and run:

cd C:\dev\haydosfx-app
.\scripts\tools\make-app-snapshot.ps1 -OutFile '.\README CHATGPT.md'

### Updating Project notes.
npm run notes
Also ask ChatGPT to draft "what we acheived today" as a markdown changelog entry (like you’ve been generating with your PowerShell snapshot scripts)


# 📂 HaydosFX App — File & Folder Reference

Project root:  
C:\dev\haydosfx-app\app


This is a **Next.js 14+ app** deployed to Vercel, built for financial dashboards:  
Economic Calendar · COT Reports · Currency Strength · Macro Dashboards · Developer Tools

---

## Folder Structure (with purpose)

app/
├─ globals.css # Tailwind / global styles
├─ layout.tsx # Root layout (wraps all pages)
├─ page.tsx # Root landing page

(dashboard)/ # Main user dashboards
├─ calendar/ # Economic Calendar
│ ├─ CalendarTable.tsx # Main table w/ flags, impacts, values
│ ├─ RangePicker.tsx # Date range picker
│ ├─ TimeZoneControl.tsx # Timezone switcher
│ ├─ layout.tsx
│ └─ page.tsx
│
├─ cot/ # Commitment of Traders dashboards
│ ├─ components/ # Shared charts/tables
│ │ ├─ CotCharts.tsx
│ │ ├─ CotTable.tsx
│ │ ├─ CurrencyStrengthChart.tsx
│ │ └─ RangeControls.tsx
│ ├─ [market]/page.tsx # Dynamic per-market route
│ └─ page.tsx
│
├─ currency-strength/
│ └─ page.tsx
│
├─ dev-calendar/
│ ├─ DevCalendarTable.tsx
│ └─ page.tsx
│
└─ economy/ # Macro dashboards
├─ compare/page.tsx
├─ us/page.tsx
├─ layout.tsx
└─ page.tsx

api/ # Serverless APIs
├─ calendar/route.ts # Economic calendar API
├─ cot/
│ ├─ g8/ytd/route.ts # G8 COT year-to-date
│ ├─ market/[market]/route.ts# Market-specific COT
│ ├─ snapshot/route.ts # COT snapshot
│ └─ route.ts # General COT API
├─ economy/route.ts # Economy API
├─ yclose/route.ts # Yahoo close data
└─ debug/finnhub-key/route.ts # Debug endpoint

debug/
└─ yclose/page.tsx # Debug page for Yahoo close

fx-strength/
└─ page.tsx # FX Strength dashboard

markdown
Copy code

---

## Notes
- `(dashboard)` → grouped routes for dashboards  
- `[market]` → dynamic routes for individual markets  
- `api/*/route.ts` → serverless API endpoints (Node/Edge)  
- `debug/*` → dev/test pages, not production  
- Keep this README updated as a **living reference**  
