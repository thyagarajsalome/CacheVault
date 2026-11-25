$wsh = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$oneDriveDesktop = "$env:USERPROFILE\OneDrive\Desktop"

foreach ($targetDesktop in @($desktop, $oneDriveDesktop)) {
    if (Test-Path $targetDesktop) {
        $shortcut = $wsh.CreateShortcut("$targetDesktop\CacheVault Pro.lnk")
        $shortcut.TargetPath = "D:\Agent-Drive\launch.bat"
        $shortcut.WorkingDirectory = "D:\Agent-Drive"
        $shortcut.IconLocation = "D:\Agent-Drive\src-tauri\icons\icon.ico,0"
        $shortcut.Description = "CacheVault Pro - Windows Storage Suite"
        $shortcut.Save()
    }
}
Write-Host "Desktop shortcut updated with CacheVault Pro icon!"
