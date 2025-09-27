param(
  [string]$RepoRoot = (Resolve-Path "."),
  [string]$OutFile  = "PROJECT_NOTES.md"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$today = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"

function Get-FolderTree {
  param([string]$FolderName)
  $abs = Join-Path $RepoRoot $FolderName
  if (-not (Test-Path $abs)) { return @() }
  Get-ChildItem -LiteralPath $abs -Recurse -File |
    Select-Object -ExpandProperty FullName |
    ForEach-Object { $_ -replace [regex]::Escape($abs + "\"), "" } |
    Sort-Object |
    ForEach-Object { "$FolderName/" + ($_ -replace "\\","/") }
}

# Build all four trees
$appTree        = Get-FolderTree "app"
$componentsTree = Get-FolderTree "components"
$configTree     = Get-FolderTree "config"
$libTree        = Get-FolderTree "lib"

# Ensure file exists with markers (non-destructive defaults)
if (-not (Test-Path $OutFile)) {
@"
# HaydosFX Project Notes
_Last updated: $today_

## File tree (app/)
<!-- BEGIN:APP_TREE -->
<!-- END:APP_TREE -->

## File tree (components/)
<!-- BEGIN:COMP_TREE -->
<!-- END:COMP_TREE -->

## File tree (config/)
<!-- BEGIN:CONFIG_TREE -->
<!-- END:CONFIG_TREE -->

## File tree (lib/)
<!-- BEGIN:LIB_TREE -->
<!-- END:LIB_TREE -->

## Features Implemented
- (add items)

## Pending / Ideas
- (add items)

## Changelog
"@ | Out-File -Encoding UTF8 $OutFile
}

$text = Get-Content $OutFile -Raw

function Update-Section {
  param(
    [string]$Text,
    [string]$BeginMarker,   # e.g. <!-- BEGIN:APP_TREE -->
    [string]$EndMarker,     # e.g. <!-- END:APP_TREE -->
    [string[]]$Lines
  )
  $payload = ($Lines -join "`r`n")
  $pattern = "(?s)($([regex]::Escape($BeginMarker))).*?($([regex]::Escape($EndMarker)))"
  $replacement = "`$1`r`n$payload`r`n`$2"
  return [regex]::Replace($Text, $pattern, $replacement)
}

# Inject each section (only if markers are present)
if ($text -match "<!--\s*BEGIN:APP_TREE\s*-->")       { $text = Update-Section $text "<!-- BEGIN:APP_TREE -->"      "<!-- END:APP_TREE -->"      $appTree }
if ($text -match "<!--\s*BEGIN:COMP_TREE\s*-->")      { $text = Update-Section $text "<!-- BEGIN:COMP_TREE -->"     "<!-- END:COMP_TREE -->"     $componentsTree }
if ($text -match "<!--\s*BEGIN:CONFIG_TREE\s*-->")    { $text = Update-Section $text "<!-- BEGIN:CONFIG_TREE -->"   "<!-- END:CONFIG_TREE -->"   $configTree }
if ($text -match "<!--\s*BEGIN:LIB_TREE\s*-->")       { $text = Update-Section $text "<!-- BEGIN:LIB_TREE -->"      "<!-- END:LIB_TREE -->"      $libTree }

# Update the "Last updated" line (first occurrence)
if ($text -match "_Last updated:") {
  $text = $text -replace "_Last updated: .*", "_Last updated: $today"
} else {
  $text = $text -replace "(?<=# HaydosFX Project Notes)", "`r`n_Last updated: $today"
}

# Journal-friendly changelog entry (placeholder only)
$entry = @"
### Update $today
- (add your notes here)

"@

if ($text -match "(?m)^## Changelog\s*$") {
  $text = $text.TrimEnd() + "`r`n" + $entry
} else {
  $text = $text.TrimEnd() + "`r`n## Changelog`r`n" + $entry
}

Set-Content $OutFile -Value $text -Encoding UTF8
Write-Host ("Updated {0} at {1}. Counts → app:{2} components:{3} config:{4} lib:{5}" -f $OutFile, $today, $appTree.Count, $componentsTree.Count, $configTree.Count, $libTree.Count)
