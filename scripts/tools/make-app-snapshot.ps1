param(
  [string]$RepoRoot = "C:\dev\haydosfx-app",
  [string]$OutFile  = "C:\dev\haydosfx-app\README CHATGPT.md",
  [switch]$Append
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path $RepoRoot)) { throw "RepoRoot not found: $RepoRoot" }

# --------- Helper: build a tree for a folder (relative to repo) ----------
function Get-FolderTree {
  param(
    [string]$Root,
    [string]$FolderName  # e.g. "app", "components"
  )
  $abs = Join-Path $Root $FolderName
  if (-not (Test-Path $abs)) { return @() }
  Get-ChildItem -LiteralPath $abs -Recurse -File |
    Select-Object -ExpandProperty FullName |
    ForEach-Object { $_ -replace [regex]::Escape($abs + "\"), "" } |
    Sort-Object |
    ForEach-Object { "$FolderName/" + ($_ -replace "\\","/") }
}

# --------- Build trees (four sections) ----------
$treeApp        = Get-FolderTree -Root $RepoRoot -FolderName "app"
$treeComponents = Get-FolderTree -Root $RepoRoot -FolderName "components"
$treeConfig     = Get-FolderTree -Root $RepoRoot -FolderName "config"
$treeLib        = Get-FolderTree -Root $RepoRoot -FolderName "lib"

# --------- Git context (best-effort) ----------
$inGit   = $false
$branch  = ""
$lastCommit = ""
$status  = @()
$changed = @()

try {
  Push-Location -LiteralPath $RepoRoot
  try { $inGit = (git rev-parse --is-inside-work-tree) -eq "true" } catch { $inGit = $false }
  if ($inGit) {
    try { $branch     = (git rev-parse --abbrev-ref HEAD).Trim() } catch {}
    try { $lastCommit = (git log -1 --pretty="%h %ad - %s" --date=iso8601).Trim() } catch {}
    try { $status     = git status --porcelain=v1 } catch {}
    try { $changed    = git log -1 --name-status --pretty="" } catch {}
  }
}
finally {
  Pop-Location -ErrorAction SilentlyContinue
}

# --------- Pre-render strings ----------
$now         = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss K")
$gitHeader   = if ($inGit) { "**Git branch:** $branch  last commit: $lastCommit" } else { "**Git:** not a git repo" }
$statusText  = if ($status.Count)  { $status -join "`n" }  else { "" }
$changedText = if ($changed.Count) { $changed -join "`n" } else { "" }

function Format-CodeBlock {
  param([string]$text)
  if ([string]::IsNullOrEmpty($text)) { return "_(none)_" }
  $nl = [Environment]::NewLine
  return '```' + $nl + $text + $nl + '```'
}

$statusBlock  = if ($inGit -and $status.Count)  { (Format-CodeBlock -text $statusText) }  else { "_(none or no git)_" }
$changedBlock = if ($inGit -and $changed.Count) { (Format-CodeBlock -text $changedText) } else { "_(none or no git)_" }
$gitLine      = if ($inGit) { "branch=$branch | last=$lastCommit" } else { "not a git repo" }

# --------- Annotations (trim/add as needed) ----------
$Annotations = @(
  @{ Pattern = '^app/layout\.tsx$';                                Purpose='Root layout & providers';            Notes='App shell: metadata, global providers, nav.' },
  @{ Pattern = '^app/page\.tsx$';                                  Purpose='Root landing page';                  Notes='Keep thin; route to dashboard pages.' },
  @{ Pattern = '^app/globals\.css$';                               Purpose='Global styles';                      Notes='Tailwind/CSS. Prefer modules where possible.' },

  @{ Pattern = '^app/\(dashboard\)/calendar/CalendarTable\.tsx$';  Purpose='Economic calendar table';            Notes='Match API schema & unit normalisation.' },
  @{ Pattern = '^app/\(dashboard\)/calendar/RangePicker\.tsx$';    Purpose='Date range picker (UTC)';            Notes='Align with API query boundaries & timezone.' },
  @{ Pattern = '^app/\(dashboard\)/calendar/TimeZoneControl\.tsx$';Purpose='Timezone selector';                  Notes='Switch display TZ; do not mutate query UTC.' },

  @{ Pattern = '^app/api/calendar/route\.(t|j)s$';                 Purpose='Calendar API';                       Notes='Serves econ events; schema ↔ UI tables.' },
  @{ Pattern = '^app/api/cot/route\.(t|j)s$';                      Purpose='COT API (index)';                    Notes='Markets & shapes match lib/.' },

  @{ Pattern = '^components/.*';                                   Purpose='Shared UI components';               Notes='Re-usable; avoid server-only code.' },
  @{ Pattern = '^lib/calendar/.*';                                 Purpose='Calendar utilities';                 Notes='Provider/db helpers; keep schema in sync.' },
  @{ Pattern = '^lib/.*';                                          Purpose='Utilities';                          Notes='General helpers; watch client env.' },
  @{ Pattern = '^config/.*';                                       Purpose='Configuration';                      Notes='Update .env.local/Vercel envs when changed.' }
)

function Get-PathDescription {
  param([string]$relPath)
  foreach ($a in $Annotations) {
    if ($relPath -match $a.Pattern) {
      return ($a.Purpose + ' — ' + $a.Notes)
    }
  }
  if ($relPath -match '^app/api/') { return 'API route — server handler for this path.' }
  if ($relPath -match '^app/')     { return 'Route file — page/layout/segment asset.' }
  if ($relPath -match '^components/') { return 'Shared UI component.' }
  if ($relPath -match '^config/')     { return 'Config file.' }
  if ($relPath -match '^lib/')        { return 'Library/helper file.' }
  return 'Project file'
}

# Annotate only app tree (keeps it focused)
$annotatedLines = @()
foreach ($p in $treeApp) {
  $annotatedLines += ('- {0}' -f $p)
  $annotatedLines += ('  - {0}' -f (Get-PathDescription -relPath $p))
}
$annotatedBlock = ($annotatedLines -join "`n")

# Prompt block
$promptBlock = @"
Create a concise progress summary and next-action checklist for the HaydosFX app.

Context:

Date: $now
Repo: $RepoRoot
App dir: $(Join-Path $RepoRoot 'app')
Git: $gitLine

Working changes (git status):
$($statusText.Trim())

Files changed in last commit:
$($changedText.Trim())

app/ file tree:
$([string]::Join("`n", $treeApp))
"@

# --------- Final markdown ----------
$md = @"
# HaydosFX App Snapshot — $now
**Repo:** $RepoRoot  
**App dir:** $(Join-Path $RepoRoot 'app')  
$gitHeader

## File tree (app/)
$([string]::Join("`n", $treeApp))

## File tree (components/)
$([string]::Join("`n", $treeComponents))

## File tree (config/)
$([string]::Join("`n", $treeConfig))

## File tree (lib/)
$([string]::Join("`n", $treeLib))

## Working tree changes
$($statusBlock)

## Files changed in last commit
$($changedBlock)

## app/ quick purpose & linkage hints
$annotatedBlock

## Prompt — paste this block into our chat
$promptBlock
"@

# Write file
if ($Append) {
  ($md + "`n`n---`n") | Out-File -FilePath $OutFile -Encoding UTF8 -Append
}
else {
  New-Item -ItemType File -Path $OutFile -Force | Out-Null
  $md | Out-File -FilePath $OutFile -Encoding UTF8
}
Write-Host "Snapshot written to: $OutFile (Append mode: $Append)"
