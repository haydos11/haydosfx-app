param(
  [string]$RepoRoot = "C:\dev\haydosfx-app",
  [string]$AppDir   = "C:\dev\haydosfx-app\app",
  [string]$OutFile  = "C:\dev\haydosfx-app\README-CHATGPT.md"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path $RepoRoot)) { throw "RepoRoot not found: $RepoRoot" }
if (-not (Test-Path $AppDir))   { throw "AppDir not found: $AppDir" }

# ------- Build app/ file tree (relative paths) -------
$treeLines = Get-ChildItem -LiteralPath $AppDir -Recurse -File |
  Select-Object -ExpandProperty FullName |
  ForEach-Object { $_ -replace [regex]::Escape($AppDir + "\"), "" } |
  Sort-Object |
  ForEach-Object { "app/" + ($_ -replace "\\","/") }

# ------- Git context (best-effort) -------
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

# ------- Pre-render strings (no here-strings inside conditionals) -------
$now         = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss K")
$gitHeader   = if ($inGit) { "**Git branch:** $branch  `last commit:` $lastCommit" } else { "**Git:** not a git repo" }
$fileTree    = ($treeLines -join "`n")
$statusText  = if ($status.Count)  { $status -join "`n" }  else { "" }
$changedText = if ($changed.Count) { $changed -join "`n" } else { "" }

# Helper to wrap text in Markdown ``` fences without using here-strings
function Wrap-CodeBlock([string]$text) {
    if ([string]::IsNullOrEmpty($text)) { return "_(none)_" }
    $nl = [Environment]::NewLine
    return '```' + $nl + $text + $nl + '```'
}


$statusBlock  = if ($inGit -and $status.Count)  { (Wrap-CodeBlock $statusText) }  else { "_(none or no git)_" }
$changedBlock = if ($inGit -and $changed.Count) { (Wrap-CodeBlock $changedText) } else { "_(none or no git)_" }

$gitLine       = if ($inGit) { "branch=$branch | last=$lastCommit" } else { "not a git repo" }
$promptStatus  = if ($statusText)  { $statusText }  else { "_(none)_" }
$promptChanged = if ($changedText) { $changedText } else { "_(none)_" }

# ------- Prompt block (single expandable here-string; closing "@ must be at column 1) -------
$promptBlock = @"
Create a concise progress summary and next-action checklist for the HaydosFX app.

Context:

Date: $now
Repo: $RepoRoot
App dir: $AppDir
Git: $gitLine

Working changes (git status):
$promptStatus

Files changed in last commit:
$promptChanged

app/ file tree:
$fileTree
"@

# ------- Final markdown -------
$md = @"
# HaydosFX App Snapshot — $now
**Repo:** $RepoRoot  
**App dir:** $AppDir  
$gitHeader

## File tree (app/)
$fileTree

## Working tree changes
$statusBlock

## Files changed in last commit
$changedBlock

## Prompt — paste this block into our chat
$promptBlock
"@

# ------- Write file -------
New-Item -ItemType File -Path $OutFile -Force | Out-Null
$md | Out-File -FilePath $OutFile -Encoding utf8
Write-Host "Snapshot written to: $OutFile"
