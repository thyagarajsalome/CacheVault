$wsh = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$oneDriveDesktop = "$env:USERPROFILE\OneDrive\Desktop"

foreach ($targetDesktop in @($desktop, $oneDriveDesktop)) {
    if (Test-Path $targetDesktop) {
        $shortcut = $wsh.CreateShortcut("$targetDesktop\CacheVault Pro.lnk")
        $shortcut.TargetPath = "D:\Agent-Drive\launch.bat"
        $shortcut.WorkingDirectory = "D:\Agent-Drive"
        $shortcut.Description = "CacheVault Pro - Storage Suite"
        $shortcut.Save()
    }
}
Write-Host "Desktop shortcut successfully updated to CacheVault Pro.lnk!"
