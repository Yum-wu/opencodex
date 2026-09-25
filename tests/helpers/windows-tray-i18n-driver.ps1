# Behavioral driver for the tray's locale selection.
#
# Loads the REAL Test-TrayChineseCulture / Get-TrayText out of src/tray/windows-tray.ps1 via the
# PowerShell AST (function definitions only - the top-level tray UI never runs) and reports what
# each culture actually renders. A selector that always answered English would pass a source-text
# check and fail here, which is the point.
param(
  [Parameter(Mandatory = $true)][string]$TrayScriptPath,
  [Parameter(Mandatory = $true)][string]$ResultPath
)
$ErrorActionPreference = "Stop"

$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($TrayScriptPath, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -gt 0) { throw "tray script parse failed: $($parseErrors[0].Message)" }
$wanted = @(
  "Test-TrayChineseCulture",
  "Get-TrayText"
)
$definitions = $ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true)
$loaded = @()
foreach ($fn in $definitions) {
  if ($wanted -contains $fn.Name) {
    # Dot-source the full definition extent so each function is defined exactly as the tray
    # script declares it, params included.
    . ([ScriptBlock]::Create($fn.Extent.Text))
    $loaded += $fn.Name
  }
}
$missing = @($wanted | Where-Object { $loaded -notcontains $_ })
if ($missing.Count -gt 0) { throw "tray script is missing functions: $($missing -join ', ')" }

$cultureDecisions = [ordered]@{}
foreach ($name in @("zh-CN", "zh-TW", "zh-Hans", "en-US", "ja-JP", "")) {
  $cultureDecisions[$name] = [bool](Test-TrayChineseCulture $name)
}

$rendered = [ordered]@{}
foreach ($isZh in @($false, $true)) {
  $script:isZh = $isZh
  $rendered[$(if ($isZh) { "zh" } else { "en" })] = [ordered]@{
    open = Get-TrayText "Open Dashboard" "打开面板"
    start = Get-TrayText "Start Proxy" "启动代理"
    restart = Get-TrayText "Restart Proxy" "重启代理"
    exit = Get-TrayText "Exit Tray" "退出托盘"
    status = Get-TrayText "opencodex: Online" "opencodex: 在线"
  }
}

$result = [ordered]@{ cultureDecisions = $cultureDecisions; rendered = $rendered }
[System.IO.File]::WriteAllText($ResultPath, ($result | ConvertTo-Json -Depth 5 -Compress), (New-Object System.Text.UTF8Encoding($false)))
