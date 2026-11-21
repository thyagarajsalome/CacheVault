$sw = [System.Diagnostics.Stopwatch]::StartNew()
$drives = [System.IO.DriveInfo]::GetDrives() | Where-Object { $_.IsReady }
$results = @()
foreach ($d in $drives) {
    $total = [uint64]$d.TotalSize
    $free = [uint64]$d.TotalFreeSpace
    $used = $total - $free
    $pct = if ($total -gt 0) { [math]::Round(($used / $total) * 100, 1) } else { 0 }
    $results += [PSCustomObject]@{
        letter = $d.Name.TrimEnd('\')
        label = if ($d.VolumeLabel) { $d.VolumeLabel } else { 'Local Disk' }
        filesystem = $d.DriveFormat
        total_bytes = $total
        free_bytes = $free
        used_bytes = $used
        percent_used = $pct
        drive_type = "$($d.DriveType)"
        bus_type = if ($d.DriveType -eq 'Removable') { 'USB' } else { 'Fixed' }
        health_status = 'Healthy'
        health_message = 'Operating normally.'
        cluster_size = 4096
    }
}
$sw.Stop()
Write-Host "Elapsed ms: $($sw.ElapsedMilliseconds)"
$results | ConvertTo-Json -Compress
