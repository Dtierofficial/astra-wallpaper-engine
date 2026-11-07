# Read-only UI Automation snapshot of the Astra window for debugging.
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$process = Get-Process astraui -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (!$process) { throw 'Astra UI window is not running.' }
$root = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
$items = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
$rows = foreach ($item in $items) {
  try {
    $current = $item.Current
    if ($current.Name -or $current.AutomationId) {
      [PSCustomObject]@{
        Name=$current.Name
        Type=$current.ControlType.ProgrammaticName
        Id=$current.AutomationId
        Offscreen=$current.IsOffscreen
        Bounds=$current.BoundingRectangle.ToString()
      }
    }
  } catch {}
}
$rows | ConvertTo-Json -Depth 3 | Set-Content -Encoding UTF8 -Path (Join-Path $PSScriptRoot '../diagnostics/astra-uia.json')
Write-Output "Recorded $($rows.Count) named elements."
